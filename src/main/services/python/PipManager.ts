import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { venvManager } from './VenvManager'

type ProgressCallback = (message: string, percent: number) => void

export class PipManager {
  async installRequirements(
    venvPath: string,
    requirementsPath: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    if (!existsSync(requirementsPath)) {
      throw new Error(`requirements.txt not found: ${requirementsPath}`)
    }

    const pipBin = venvManager.getPipBin(venvPath)
    const pythonBin = venvManager.getPythonBin(venvPath)

    // First upgrade pip using python -m pip (required on Windows)
    onProgress('Upgrading pip...', 5)
    await this.runCommand(pythonBin, ['-m', 'pip', 'install', '--upgrade', 'pip'], (msg) => onProgress(msg, 10))

    // Install requirements
    return new Promise((resolve, reject) => {
      onProgress('Installing Python dependencies...', 15)

      const child = spawn(pipBin, ['install', '-r', requirementsPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let installedCount = 0

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          if (line.includes('Successfully installed') || line.includes('Requirement already satisfied')) {
            installedCount++
          }
          // Estimate progress between 15-95
          const progress = Math.min(15 + installedCount * 2, 95)
          onProgress(line.trim().substring(0, 100), progress)
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim()
        if (text) {
          onProgress(text.substring(0, 100), 50)
        }
      })

      child.on('close', (code) => {
        if (code === 0) {
          onProgress('Dependencies installed', 100)
          resolve()
        } else {
          reject(new Error(`pip install exited with code ${code}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`pip install failed: ${err.message}`))
      })
    })
  }

  private runCommand(bin: string, args: string[], onProgress: (msg: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      child.stdout?.on('data', (data: Buffer) => onProgress(data.toString().trim()))
      child.stderr?.on('data', (data: Buffer) => onProgress(data.toString().trim()))

      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`pip exited with code ${code}`))
      })

      child.on('error', reject)
    })
  }
}

export const pipManager = new PipManager()
