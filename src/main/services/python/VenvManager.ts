import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { platformDetector } from '../platform/PlatformDetector'

type ProgressCallback = (message: string, percent: number) => void

export class VenvManager {
  getPythonBin(venvPath: string): string {
    if (platformDetector.isWindows) {
      return join(venvPath, 'Scripts', 'python.exe')
    }
    return join(venvPath, 'bin', 'python')
  }

  getPipBin(venvPath: string): string {
    if (platformDetector.isWindows) {
      return join(venvPath, 'Scripts', 'pip.exe')
    }
    return join(venvPath, 'bin', 'pip')
  }

  async create(
    pythonPath: string,
    venvPath: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    if (existsSync(venvPath)) {
      onProgress('Virtual environment already exists', 100)
      return
    }

    return new Promise((resolve, reject) => {
      onProgress('Creating virtual environment...', 10)

      const child = spawn(pythonPath, ['-m', 'venv', venvPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      child.stderr?.on('data', (data: Buffer) => {
        onProgress(data.toString().trim(), 50)
      })

      child.on('close', (code) => {
        if (code === 0) {
          onProgress('Virtual environment created', 100)
          resolve()
        } else {
          reject(new Error(`venv creation failed with code ${code}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`venv creation failed: ${err.message}`))
      })
    })
  }
}

export const venvManager = new VenvManager()
