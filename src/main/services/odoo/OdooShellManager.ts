import { existsSync } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import { instanceStore } from '../../store/InstanceStore'
import { venvManager } from '../python/VenvManager'

import type { IPty } from 'node-pty'

export class OdooShellManager {
  private shells: Map<string, IPty> = new Map()

  async start(instanceId: string): Promise<void> {
    if (this.shells.has(instanceId)) {
      throw new Error('Shell already running for this instance')
    }

    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

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

    const pty = await import('node-pty')

    const shell = pty.spawn(pythonBin, [odooBin, 'shell', '-c', instance.configPath, '-d', instance.dbName], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: instance.basePath,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    })

    this.shells.set(instanceId, shell)

    shell.onData((data) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('odoo:shell-output', { instanceId, data })
      }
    })

    shell.onExit(() => {
      this.shells.delete(instanceId)
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('odoo:shell-exit', { instanceId })
      }
    })
  }

  write(instanceId: string, data: string): void {
    const shell = this.shells.get(instanceId)
    if (!shell) throw new Error('No shell running for this instance')
    shell.write(data)
  }

  resize(instanceId: string, cols: number, rows: number): void {
    const shell = this.shells.get(instanceId)
    if (!shell) return
    shell.resize(cols, rows)
  }

  stop(instanceId: string): void {
    const shell = this.shells.get(instanceId)
    if (!shell) return
    shell.kill()
    this.shells.delete(instanceId)
  }

  isRunning(instanceId: string): boolean {
    return this.shells.has(instanceId)
  }

  stopAll(): void {
    for (const [id] of this.shells) {
      this.stop(id)
    }
  }
}

export const odooShellManager = new OdooShellManager()
