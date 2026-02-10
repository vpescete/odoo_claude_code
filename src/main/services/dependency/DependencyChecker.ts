import { existsSync } from 'fs'
import type { DependencyStatus } from '@shared/types/dependency'
import { platformDetector } from '../platform/PlatformDetector'
import { execCommandSafe } from '../platform/ShellExecutor'

/** Common Windows install paths for dependencies not yet in PATH */
const WIN_PATHS: Record<string, string[]> = {
  git: [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
  ],
  psql: [
    'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
    'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe'
  ]
}

export class DependencyChecker {
  private platform = platformDetector

  async checkAll(): Promise<DependencyStatus[]> {
    const results = await Promise.allSettled([
      this.checkPython(),
      this.checkGit(),
      this.checkPostgreSQL(),
      this.checkPip(),
      this.checkNode()
    ])

    return results.map((result) => {
      if (result.status === 'fulfilled') return result.value
      return {
        id: 'unknown',
        name: 'Unknown',
        required: true,
        installed: false,
        installInstructions: 'Check failed',
        canAutoInstall: false
      }
    })
  }

  async checkPython(): Promise<DependencyStatus> {
    const foundVersions: { version: string; path: string; command: string }[] = []

    for (const cmd of this.platform.pythonCommands) {
      const binaryName = cmd.split(' ')[0]
      const result = await execCommandSafe(`${cmd} --version`)
      if (!result) continue

      const versionMatch = result.stdout.match(/Python (\d+\.\d+\.\d+)/)
        || result.stderr.match(/Python (\d+\.\d+\.\d+)/)
      if (!versionMatch) continue

      const version = versionMatch[1]
      // Avoid duplicates
      if (foundVersions.some((f) => f.version === version)) continue

      const pathResult = await execCommandSafe(`${this.platform.whichCommand} ${binaryName}`)
      const pythonPath = pathResult?.stdout.split('\n')[0] || binaryName

      foundVersions.push({ version, path: pythonPath, command: cmd })
    }

    return {
      id: 'python',
      name: 'Python',
      required: true,
      installed: foundVersions.length > 0,
      version: foundVersions.map((f) => f.version).join(', '),
      path: foundVersions[0]?.path,
      installInstructions: this.getPythonInstallInstructions(),
      canAutoInstall: this.platform.isMac || this.platform.isLinux,
      extra: { foundVersions }
    }
  }

  async checkGit(): Promise<DependencyStatus> {
    // Try PATH first, then common Windows install locations
    let result = await execCommandSafe('git --version')
    let gitPath: string | undefined

    if (!result && this.platform.isWindows) {
      for (const p of WIN_PATHS.git) {
        if (existsSync(p)) {
          result = await execCommandSafe(`"${p}" --version`)
          if (result) { gitPath = p; break }
        }
      }
    }

    if (!result) {
      return {
        id: 'git',
        name: 'Git',
        required: true,
        installed: false,
        installInstructions: this.getGitInstallInstructions(),
        canAutoInstall: true
      }
    }

    const versionMatch = result.stdout.match(/git version (\d+\.\d+[\.\d]*)/)
    if (!gitPath) {
      const pathResult = await execCommandSafe(`${this.platform.whichCommand} git`)
      gitPath = pathResult?.stdout.split('\n')[0]
    }

    return {
      id: 'git',
      name: 'Git',
      required: true,
      installed: true,
      version: versionMatch?.[1] || 'unknown',
      path: gitPath,
      installInstructions: '',
      canAutoInstall: true
    }
  }

  async checkPostgreSQL(): Promise<DependencyStatus> {
    // Try PATH first, then common Windows install locations
    let result = await execCommandSafe('psql --version')
    let psqlDir: string | undefined

    if (!result && this.platform.isWindows) {
      for (const p of WIN_PATHS.psql) {
        if (existsSync(p)) {
          result = await execCommandSafe(`"${p}" --version`)
          if (result) {
            psqlDir = p.replace(/\\psql\.exe$/, '')
            break
          }
        }
      }
    }

    if (!result) {
      return {
        id: 'postgresql',
        name: 'PostgreSQL',
        required: true,
        installed: false,
        installInstructions: this.getPostgresInstallInstructions(),
        canAutoInstall: true
      }
    }

    const versionMatch = result.stdout.match(/(\d+[\.\d]*)/)

    // Check if server is running
    const pgIsReadyCmd = psqlDir ? `"${psqlDir}\\pg_isready.exe"` : 'pg_isready'
    const isReady = await execCommandSafe(pgIsReadyCmd)
    const serverRunning = isReady !== null && isReady.stdout.includes('accepting connections')

    return {
      id: 'postgresql',
      name: 'PostgreSQL',
      required: true,
      installed: true,
      version: versionMatch?.[1] || 'unknown',
      installInstructions: '',
      canAutoInstall: true,
      extra: { serverRunning, binDir: psqlDir }
    }
  }

  async checkPip(): Promise<DependencyStatus> {
    const commands = this.platform.isWindows
      ? ['pip --version', 'pip3 --version']
      : ['pip3 --version', 'pip --version']

    for (const cmd of commands) {
      const result = await execCommandSafe(cmd)
      if (!result) continue

      const versionMatch = result.stdout.match(/pip (\d+[\.\d]*)/)
      return {
        id: 'pip',
        name: 'pip',
        required: true,
        installed: true,
        version: versionMatch?.[1] || 'unknown',
        installInstructions: '',
        canAutoInstall: true
      }
    }

    return {
      id: 'pip',
      name: 'pip',
      required: true,
      installed: false,
      installInstructions: 'pip is usually bundled with Python. Try: python3 -m ensurepip',
      canAutoInstall: true
    }
  }

  async checkNode(): Promise<DependencyStatus> {
    const result = await execCommandSafe('node --version')
    if (!result) {
      return {
        id: 'node',
        name: 'Node.js',
        required: true,
        installed: false,
        requiredVersion: '>=18.0.0',
        installInstructions: this.getNodeInstallInstructions(),
        canAutoInstall: this.platform.isMac || this.platform.isLinux
      }
    }

    const version = result.stdout.replace('v', '')
    const majorVersion = parseInt(version.split('.')[0], 10)

    return {
      id: 'node',
      name: 'Node.js',
      required: true,
      installed: true,
      version,
      requiredVersion: '>=18.0.0',
      installInstructions: '',
      canAutoInstall: this.platform.isMac || this.platform.isLinux,
      extra: { meetsMinimum: majorVersion >= 18 }
    }
  }

  private getPythonInstallInstructions(): string {
    if (this.platform.isMac) {
      return 'Install via Homebrew: brew install python@3.12'
    }
    if (this.platform.isLinux) {
      return 'Install via apt: sudo apt install python3 python3-venv python3-pip'
    }
    return 'Download from https://www.python.org/downloads/'
  }

  private getGitInstallInstructions(): string {
    if (this.platform.isMac) {
      return 'Install via Xcode CLI tools: xcode-select --install'
    }
    if (this.platform.isLinux) {
      return 'Install via apt: sudo apt install git'
    }
    return 'Download from https://git-scm.com/download/win'
  }

  private getPostgresInstallInstructions(): string {
    if (this.platform.isMac) {
      return 'Install via Homebrew: brew install postgresql@16 && brew services start postgresql@16'
    }
    if (this.platform.isLinux) {
      return 'Install via apt: sudo apt install postgresql postgresql-client'
    }
    return 'Download from https://www.postgresql.org/download/windows/'
  }

  private getNodeInstallInstructions(): string {
    if (this.platform.isMac) {
      return 'Install via Homebrew: brew install node'
    }
    if (this.platform.isLinux) {
      return 'Install via apt: sudo apt install nodejs npm'
    }
    return 'Download from https://nodejs.org/'
  }
}

export const dependencyChecker = new DependencyChecker()
