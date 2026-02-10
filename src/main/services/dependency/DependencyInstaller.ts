import type { InstallResult } from '@shared/types/dependency'
import { platformDetector } from '../platform/PlatformDetector'
import { execCommandSafe, spawnWithProgress } from '../platform/ShellExecutor'

type ProgressCallback = (message: string, percent: number) => void

export class DependencyInstaller {
  private platform = platformDetector

  async install(
    dependencyId: string,
    onProgress: ProgressCallback
  ): Promise<InstallResult> {
    if (this.platform.isMac) {
      return this.installMacOS(dependencyId, onProgress)
    }
    if (this.platform.isLinux) {
      return this.installLinux(dependencyId, onProgress)
    }
    if (this.platform.isWindows) {
      return this.installWindows(dependencyId, onProgress)
    }
    return { success: false, error: 'Unsupported platform' }
  }

  private async installMacOS(
    id: string,
    onProgress: ProgressCallback
  ): Promise<InstallResult> {
    // Check Homebrew
    const hasBrew = await execCommandSafe('brew --version')
    if (!hasBrew) {
      return {
        success: false,
        error: 'Homebrew is required for auto-install on macOS.',
        manualInstructions:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      }
    }

    const packages: Record<string, { formula: string; postInstall?: string }> = {
      python: { formula: 'python@3.12' },
      git: { formula: 'git' },
      postgresql: {
        formula: 'postgresql@16',
        postInstall: 'brew services start postgresql@16'
      },
      pip: { formula: 'python@3.12' },
      node: { formula: 'node' }
    }

    const pkg = packages[id]
    if (!pkg) return { success: false, error: `Unknown dependency: ${id}` }

    onProgress(`Installing ${pkg.formula} via Homebrew...`, 10)

    return new Promise((resolve) => {
      const child = spawnWithProgress(
        'brew',
        ['install', pkg.formula],
        (line) => onProgress(line, 50),
        (line) => onProgress(line, 50)
      )

      child.on('close', async (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `brew install exited with code ${code}` })
          return
        }

        if (pkg.postInstall) {
          onProgress('Running post-install...', 80)
          await execCommandSafe(pkg.postInstall)
        }

        onProgress('Installation complete', 100)
        resolve({ success: true })
      })

      child.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  }

  private async installLinux(
    id: string,
    onProgress: ProgressCallback
  ): Promise<InstallResult> {
    // Detect package manager
    const hasApt = await execCommandSafe('apt --version')
    const hasDnf = await execCommandSafe('dnf --version')

    if (!hasApt && !hasDnf) {
      return {
        success: false,
        error: 'No supported package manager found (apt or dnf required).'
      }
    }

    const pm = hasApt ? 'apt' : 'dnf'
    const installCmd = hasApt ? 'sudo apt install -y' : 'sudo dnf install -y'

    const packages: Record<string, string> = {
      python: 'python3 python3-venv python3-pip',
      git: 'git',
      postgresql: 'postgresql postgresql-client',
      pip: 'python3-pip',
      node: 'nodejs npm'
    }

    const pkg = packages[id]
    if (!pkg) return { success: false, error: `Unknown dependency: ${id}` }

    onProgress(`Installing ${pkg} via ${pm}...`, 10)

    return new Promise((resolve) => {
      const args = pkg.split(' ')
      const child = spawnWithProgress(
        installCmd.split(' ')[0],
        [...installCmd.split(' ').slice(1), ...args],
        (line) => onProgress(line, 50),
        (line) => onProgress(line, 50)
      )

      child.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: `Installation failed with code ${code}. You may need to run with sudo.`
          })
          return
        }
        onProgress('Installation complete', 100)
        resolve({ success: true })
      })

      child.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  }

  private async installWindows(
    id: string,
    onProgress: ProgressCallback
  ): Promise<InstallResult> {
    // Check winget
    const hasWinget = await execCommandSafe('winget --version')

    if (!hasWinget) {
      const manualUrls: Record<string, string> = {
        python: 'https://www.python.org/downloads/',
        git: 'https://git-scm.com/download/win',
        postgresql: 'https://www.postgresql.org/download/windows/',
        pip: 'https://www.python.org/downloads/',
        node: 'https://nodejs.org/en/download/'
      }
      return {
        success: false,
        error: 'winget not available.',
        manualInstructions: `Download manually from: ${manualUrls[id] || 'the official website'}`
      }
    }

    const packages: Record<string, string> = {
      python: 'Python.Python.3.12',
      git: 'Git.Git',
      postgresql: 'PostgreSQL.PostgreSQL.16',
      pip: 'Python.Python.3.12',
      node: 'OpenJS.NodeJS.LTS'
    }

    const pkg = packages[id]
    if (!pkg) return { success: false, error: `Unknown dependency: ${id}` }

    onProgress(`Installing ${pkg} via winget...`, 10)

    return new Promise((resolve) => {
      const child = spawnWithProgress(
        'winget',
        ['install', '--id', pkg, '--accept-package-agreements', '--accept-source-agreements'],
        (line) => onProgress(line, 50),
        (line) => onProgress(line, 50)
      )

      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `winget install exited with code ${code}` })
          return
        }
        onProgress('Installation complete', 100)
        resolve({ success: true })
      })

      child.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  }
}

export const dependencyInstaller = new DependencyInstaller()
