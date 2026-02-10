import { spawn } from 'child_process'
import { existsSync } from 'fs'
import type { BrowserWindow } from 'electron'

type ProgressCallback = (message: string, percent: number) => void

export class OdooRepository {
  async clone(
    repoUrl: string,
    branch: string,
    targetDir: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    if (existsSync(targetDir)) {
      onProgress('Directory already exists, skipping clone', 100)
      return
    }

    return new Promise((resolve, reject) => {
      onProgress(`Cloning ${branch}...`, 5)

      const args = ['clone', '--depth', '1', '--branch', branch, repoUrl, targetDir, '--progress']
      const child = spawn('git', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let lastPercent = 5

      const parseProgress = (data: string): void => {
        // Git clone progress: "Receiving objects: 42% (1234/2938)"
        const match = data.match(/(\d+)%/)
        if (match) {
          const gitPercent = parseInt(match[1], 10)
          // Map git's 0-100 to our 5-95 range
          lastPercent = 5 + Math.round(gitPercent * 0.9)
          onProgress(data.trim(), lastPercent)
        }
      }

      child.stdout?.on('data', (data: Buffer) => {
        parseProgress(data.toString())
      })

      child.stderr?.on('data', (data: Buffer) => {
        // Git sends progress to stderr
        parseProgress(data.toString())
      })

      child.on('close', (code) => {
        if (code === 0) {
          onProgress('Clone complete', 100)
          resolve()
        } else {
          reject(new Error(`git clone exited with code ${code}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`git clone failed: ${err.message}`))
      })
    })
  }

  async cloneWithToken(
    repoUrl: string,
    branch: string,
    targetDir: string,
    githubToken: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    // Inject token into URL: https://TOKEN@github.com/odoo/enterprise.git
    const authenticatedUrl = repoUrl.replace(
      'https://github.com/',
      `https://${githubToken}@github.com/`
    )
    return this.clone(authenticatedUrl, branch, targetDir, onProgress)
  }
}

export const odooRepository = new OdooRepository()
