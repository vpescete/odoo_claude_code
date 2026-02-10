import { mkdir, rm, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import type { AddonRepo } from '@shared/types/addon'
import { instanceStore } from '../../store/InstanceStore'

const execFileAsync = promisify(execFile)

type ProgressCallback = (message: string, percent: number) => void

class AddonManager {
  async addRepo(
    instanceId: string,
    url: string,
    branch: string,
    onProgress: ProgressCallback
  ): Promise<AddonRepo> {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    const extraAddonsDir = join(instance.basePath, 'extra-addons')
    if (!existsSync(extraAddonsDir)) {
      await mkdir(extraAddonsDir, { recursive: true })
    }

    const repoName = this.deriveRepoName(url)
    const targetDir = join(extraAddonsDir, repoName)

    if (existsSync(targetDir)) {
      throw new Error(`Addon "${repoName}" already exists`)
    }

    const repo: AddonRepo = {
      id: randomUUID(),
      url,
      branch,
      name: repoName,
      clonedPath: targetDir,
      status: 'cloning',
      addedAt: new Date().toISOString()
    }

    // Save cloning state immediately
    const repos = [...(instance.addonRepos || []), repo]
    instanceStore.update(instanceId, { addonRepos: repos })

    try {
      onProgress('Cloning repository...', 5)
      await this.gitClone(url, branch, targetDir, onProgress)

      repo.status = 'ready'
      this.updateRepo(instanceId, repo)

      await this.syncAddonsPath(instanceId)

      onProgress('Repository added successfully', 100)
      return repo
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Clone failed'
      repo.status = 'error'
      repo.error = errMsg
      this.updateRepo(instanceId, repo)

      // Clean up partial clone
      if (existsSync(targetDir)) {
        await rm(targetDir, { recursive: true, force: true }).catch(() => {})
      }

      throw new Error(`Failed to clone repository: ${errMsg}`)
    }
  }

  async removeRepo(instanceId: string, repoId: string): Promise<void> {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    const repos = instance.addonRepos || []
    const repo = repos.find((r) => r.id === repoId)
    if (!repo) throw new Error('Addon repo not found')

    // Remove from disk
    if (existsSync(repo.clonedPath)) {
      await rm(repo.clonedPath, { recursive: true, force: true })
    }

    // Remove from store
    const updated = repos.filter((r) => r.id !== repoId)
    instanceStore.update(instanceId, { addonRepos: updated })

    await this.syncAddonsPath(instanceId)
  }

  listRepos(instanceId: string): AddonRepo[] {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')
    return instance.addonRepos || []
  }

  async pullRepo(
    instanceId: string,
    repoId: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    const repos = instance.addonRepos || []
    const repo = repos.find((r) => r.id === repoId)
    if (!repo) throw new Error('Addon repo not found')

    if (!existsSync(repo.clonedPath)) {
      throw new Error('Repository directory not found on disk')
    }

    onProgress('Pulling latest changes...', 10)

    await new Promise<void>((resolve, reject) => {
      const child = spawn('git', ['pull', '--progress'], {
        cwd: repo.clonedPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        const match = text.match(/(\d+)%/)
        if (match) {
          const pct = 10 + Math.round(parseInt(match[1], 10) * 0.85)
          onProgress(text.trim(), pct)
        }
      })

      child.stdout?.on('data', (data: Buffer) => {
        onProgress(data.toString().trim(), 50)
      })

      child.on('close', (code) => {
        if (code === 0) {
          onProgress('Pull complete', 100)
          resolve()
        } else {
          reject(new Error(`git pull exited with code ${code}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`git pull failed: ${err.message}`))
      })
    })
  }

  async switchBranch(instanceId: string, repoId: string, newBranch: string): Promise<string> {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    const repo = (instance.addonRepos || []).find((r) => r.id === repoId)
    if (!repo) throw new Error('Addon repo not found')
    if (!existsSync(repo.clonedPath)) throw new Error('Repository directory not found on disk')

    const gitOpts = { cwd: repo.clonedPath, env: { ...process.env } }

    // Fetch all remotes first to ensure we have the latest branches
    await execFileAsync('git', ['fetch', '--all'], gitOpts)

    // Try checkout: local branch first, then remote tracking branch
    try {
      await execFileAsync('git', ['checkout', newBranch], gitOpts)
    } catch {
      // Branch might only exist on remote — create tracking branch
      await execFileAsync('git', ['checkout', '-b', newBranch, `origin/${newBranch}`], gitOpts)
    }

    // Read the actual current branch after checkout
    const actualBranch = await this.getCurrentBranch(repo.clonedPath)

    // Update stored metadata
    repo.branch = actualBranch
    this.updateRepo(instanceId, repo)

    return actualBranch
  }

  async listBranches(instanceId: string, repoId: string): Promise<{ local: string[]; remote: string[]; current: string }> {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    const repo = (instance.addonRepos || []).find((r) => r.id === repoId)
    if (!repo) throw new Error('Addon repo not found')
    if (!existsSync(repo.clonedPath)) throw new Error('Repository directory not found on disk')

    const gitOpts = { cwd: repo.clonedPath, env: { ...process.env } }

    // Fetch to ensure we see all remote branches
    await execFileAsync('git', ['fetch', '--all', '--prune'], gitOpts).catch(() => {})

    const current = await this.getCurrentBranch(repo.clonedPath)

    // Local branches
    const { stdout: localOut } = await execFileAsync('git', ['branch', '--format=%(refname:short)'], gitOpts)
    const local = localOut.split('\n').map((b) => b.trim()).filter(Boolean)

    // Remote branches (strip 'origin/' prefix, exclude HEAD)
    const { stdout: remoteOut } = await execFileAsync('git', ['branch', '-r', '--format=%(refname:short)'], gitOpts)
    const remote = remoteOut
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b && !b.endsWith('/HEAD'))
      .map((b) => b.replace(/^origin\//, ''))
      .filter((b) => !local.includes(b))

    // Sync current branch into metadata if it changed (e.g. Claude switched it)
    if (repo.branch !== current) {
      repo.branch = current
      this.updateRepo(instanceId, repo)
    }

    return { local, remote, current }
  }

  async refreshBranch(instanceId: string, repoId: string): Promise<string> {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    const repo = (instance.addonRepos || []).find((r) => r.id === repoId)
    if (!repo) throw new Error('Addon repo not found')
    if (!existsSync(repo.clonedPath)) throw new Error('Repository directory not found on disk')

    const current = await this.getCurrentBranch(repo.clonedPath)
    if (repo.branch !== current) {
      repo.branch = current
      this.updateRepo(instanceId, repo)
    }
    return current
  }

  private async getCurrentBranch(repoPath: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoPath,
      env: { ...process.env }
    })
    return stdout.trim()
  }

  private async syncAddonsPath(instanceId: string): Promise<void> {
    const instance = instanceStore.get(instanceId)
    if (!instance) return

    const configContent = await readFile(instance.configPath, 'utf-8')

    // Build the new addons_path
    const addonsPaths = [
      join(instance.odooPath, 'addons'),
      join(instance.odooPath, 'odoo', 'addons')
    ]
    if (instance.enterprisePath) {
      addonsPaths.push(instance.enterprisePath)
    }
    for (const repo of instance.addonRepos || []) {
      if (repo.status === 'ready') {
        addonsPaths.push(repo.clonedPath)
      }
    }

    const newAddonsPath = addonsPaths.join(',')

    // Replace addons_path line in config
    const lines = configContent.split('\n')
    let found = false
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (trimmed.startsWith('addons_path')) {
        lines[i] = `addons_path = ${newAddonsPath}`
        found = true
        break
      }
    }
    if (!found) {
      // Insert after [options] header
      const optionsIdx = lines.findIndex((l) => l.trim() === '[options]')
      if (optionsIdx >= 0) {
        lines.splice(optionsIdx + 1, 0, `addons_path = ${newAddonsPath}`)
      }
    }

    await writeFile(instance.configPath, lines.join('\n'), 'utf-8')
  }

  private gitClone(
    url: string,
    branch: string,
    targetDir: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['clone', '--branch', branch, url, targetDir, '--progress']
      const child = spawn('git', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        const match = text.match(/(\d+)%/)
        if (match) {
          const pct = 5 + Math.round(parseInt(match[1], 10) * 0.9)
          onProgress(text.trim(), pct)
        }
      })

      child.stdout?.on('data', (data: Buffer) => {
        onProgress(data.toString().trim(), 50)
      })

      child.on('close', (code) => {
        if (code === 0) {
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

  private deriveRepoName(url: string): string {
    // Handle both HTTPS and SSH URLs:
    // https://github.com/user/repo.git → repo
    // git@github.com:user/repo.git → repo
    const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '')
    const parts = cleaned.split(/[/:]/)
    return parts[parts.length - 1] || 'addon'
  }

  private updateRepo(instanceId: string, repo: AddonRepo): void {
    const instance = instanceStore.get(instanceId)
    if (!instance) return
    const repos = (instance.addonRepos || []).map((r) =>
      r.id === repo.id ? repo : r
    )
    instanceStore.update(instanceId, { addonRepos: repos })
  }
}

export const addonManager = new AddonManager()
