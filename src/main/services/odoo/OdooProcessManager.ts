import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { createServer } from 'net'
import { join } from 'path'
import { BrowserWindow, Notification } from 'electron'
import type { InstanceStatus } from '@shared/types/odoo'
import { instanceStore } from '../../store/InstanceStore'
import { venvManager } from '../python/VenvManager'
import { platformDetector } from '../platform/PlatformDetector'

interface ManagedProcess {
  child: ChildProcess
  instanceId: string
  readyDetected: boolean
}

class OdooProcessManager {
  private processes = new Map<string, ManagedProcess>()

  async start(instanceId: string): Promise<void> {
    if (this.processes.has(instanceId)) {
      throw new Error('Instance is already running')
    }

    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    // Validate paths exist on disk
    const pythonBin = venvManager.getPythonBin(instance.venvPath)
    const odooBin = join(instance.odooPath, 'odoo-bin')

    if (!existsSync(pythonBin)) {
      throw new Error(`Python not found at ${pythonBin}. The virtual environment may be corrupted.`)
    }
    if (!existsSync(odooBin)) {
      throw new Error(`odoo-bin not found at ${odooBin}. The Odoo installation may be corrupted.`)
    }
    if (!existsSync(instance.configPath)) {
      throw new Error(`Config file not found at ${instance.configPath}.`)
    }

    // Check if ports are available
    const httpPortInUse = await this.isPortInUse(instance.httpPort)
    if (httpPortInUse) {
      throw new Error(
        `Port ${instance.httpPort} is already in use. Another process may be using it. ` +
        `Stop the other process or change the HTTP port in the instance configuration.`
      )
    }
    const lpPortInUse = await this.isPortInUse(instance.longpollingPort)
    if (lpPortInUse) {
      throw new Error(
        `Port ${instance.longpollingPort} (longpolling) is already in use. ` +
        `Stop the other process or change the longpolling port.`
      )
    }

    this.broadcastStatus(instanceId, 'starting')
    instanceStore.update(instanceId, {
      status: 'starting',
      lastStartedAt: new Date().toISOString()
    })

    const args = [odooBin, '-c', instance.configPath]

    const child = spawn(pythonBin, args, {
      cwd: instance.basePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    })

    const managed: ManagedProcess = { child, instanceId, readyDetected: false }
    this.processes.set(instanceId, managed)

    const handleData = (data: Buffer): void => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        const parsed = this.parseLogLine(line)
        this.broadcastLog(instanceId, line, parsed.level)

        // Detect when Odoo is ready (only once)
        if (
          !managed.readyDetected &&
          line.includes('HTTP service (werkzeug) running on')
        ) {
          managed.readyDetected = true
          this.broadcastStatus(instanceId, 'running')
          instanceStore.update(instanceId, { status: 'running' })
          this.notify(`${instance.name} is running`, `Available on port ${instance.httpPort}`)
        }
      }
    }

    child.stdout?.on('data', handleData)
    child.stderr?.on('data', handleData)

    child.on('close', (code) => {
      this.processes.delete(instanceId)
      const status: InstanceStatus = code === 0 || code === null ? 'stopped' : 'error'
      this.broadcastStatus(instanceId, status)
      instanceStore.update(instanceId, { status })
      if (code !== 0 && code !== null) {
        this.broadcastLog(instanceId, `Process exited with code ${code}`, 'ERROR')
        this.notify(`${instance.name} error`, `Process exited with code ${code}`)
      }
    })

    child.on('error', (err) => {
      this.processes.delete(instanceId)
      this.broadcastStatus(instanceId, 'error')
      instanceStore.update(instanceId, { status: 'error' })
      this.broadcastLog(instanceId, `Process error: ${err.message}`, 'ERROR')
      this.notify(`${instance.name} error`, err.message)
    })
  }

  async stop(instanceId: string): Promise<void> {
    const managed = this.processes.get(instanceId)
    if (!managed) {
      throw new Error('Instance is not running')
    }

    this.broadcastStatus(instanceId, 'stopping')
    instanceStore.update(instanceId, { status: 'stopping' })

    return new Promise<void>((resolve) => {
      const { child } = managed

      // Safety timeout: if neither SIGTERM nor SIGKILL closes the process, resolve anyway
      const safetyTimeout = setTimeout(() => {
        this.processes.delete(instanceId)
        this.broadcastStatus(instanceId, 'stopped')
        instanceStore.update(instanceId, { status: 'stopped' })
        resolve()
      }, 15000)

      const killTimeout = setTimeout(() => {
        child.kill('SIGKILL')
      }, 10000)

      child.once('close', () => {
        clearTimeout(killTimeout)
        clearTimeout(safetyTimeout)
        resolve()
      })

      if (platformDetector.isWindows) {
        child.kill()
      } else {
        child.kill('SIGTERM')
      }
    })
  }

  async restart(instanceId: string): Promise<void> {
    if (this.processes.has(instanceId)) {
      await this.stop(instanceId)
    }
    await this.start(instanceId)
  }

  isRunning(instanceId: string): boolean {
    return this.processes.has(instanceId)
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map((id) =>
      this.stop(id).catch(() => {})
    )
    await Promise.all(stopPromises)
  }

  private isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer()
      server.once('error', () => resolve(true))
      server.once('listening', () => {
        server.close(() => resolve(false))
      })
      server.listen(port, '127.0.0.1')
    })
  }

  private parseLogLine(line: string): { level: string; module: string; message: string } {
    // Odoo log format: 2024-01-01 12:00:00,000 PID INFO module: message
    const match = line.match(
      /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d+\s+\d+\s+(INFO|WARNING|ERROR|CRITICAL|DEBUG)\s+(\S+?):\s*(.*)/
    )
    if (match) {
      return { level: match[1], module: match[2], message: match[3] }
    }
    return { level: 'INFO', module: '', message: line }
  }

  private broadcastStatus(instanceId: string, status: InstanceStatus): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('odoo:status-changed', { instanceId, status })
    }
  }

  private broadcastLog(instanceId: string, line: string, level: string): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('odoo:log-line', { instanceId, line, level })
    }
  }

  /** Send a native OS notification only when the app is not focused */
  private notify(title: string, body: string): void {
    const focused = BrowserWindow.getAllWindows().some((w) => w.isFocused())
    if (!focused && Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  }
}

export const odooProcessManager = new OdooProcessManager()
