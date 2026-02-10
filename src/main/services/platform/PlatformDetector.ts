import { homedir } from 'os'
import { join } from 'path'

export type Platform = 'darwin' | 'linux' | 'win32'

class PlatformDetector {
  readonly platform: Platform = process.platform as Platform

  get isMac(): boolean {
    return this.platform === 'darwin'
  }

  get isLinux(): boolean {
    return this.platform === 'linux'
  }

  get isWindows(): boolean {
    return this.platform === 'win32'
  }

  get homeDir(): string {
    return homedir()
  }

  get defaultWorkspacePath(): string {
    return join(this.homeDir, 'OdooProjects')
  }

  get pathSeparator(): string {
    return this.isWindows ? ';' : ':'
  }

  get whichCommand(): string {
    return this.isWindows ? 'where' : 'which'
  }

  get pythonCommands(): string[] {
    if (this.isWindows) {
      return ['python', 'python3', 'py -3']
    }
    return ['python3', 'python3.12', 'python3.11', 'python3.10', 'python3.9', 'python3.8']
  }

  get pipCommand(): string {
    return this.isWindows ? 'pip' : 'pip3'
  }
}

export const platformDetector = new PlatformDetector()
