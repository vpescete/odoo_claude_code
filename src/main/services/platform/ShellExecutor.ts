import { exec, spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'
import { platformDetector } from './PlatformDetector'

const execAsync = promisify(exec)

/** Extra bin directories that may not be in Electron's default PATH on macOS */
const EXTRA_MAC_PATHS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  // Homebrew keg-only PostgreSQL (not symlinked into the main bin dirs)
  '/opt/homebrew/opt/postgresql@17/bin',
  '/opt/homebrew/opt/postgresql@16/bin',
  '/opt/homebrew/opt/postgresql@15/bin',
  '/opt/homebrew/opt/postgresql@14/bin',
  '/usr/local/opt/postgresql@17/bin',
  '/usr/local/opt/postgresql@16/bin',
  '/usr/local/opt/postgresql@15/bin',
  '/usr/local/opt/postgresql@14/bin',
]

function getEnhancedEnv(): NodeJS.ProcessEnv {
  if (platformDetector.isMac) {
    const currentPath = process.env.PATH || ''
    const extraPaths = EXTRA_MAC_PATHS.filter(
      p => !currentPath.includes(p) && existsSync(p)
    )
    if (extraPaths.length > 0) {
      return {
        ...process.env,
        PATH: `${extraPaths.join(':')}:${currentPath}`
      }
    }
  }
  return process.env
}

export interface ExecResult {
  stdout: string
  stderr: string
}

export async function execCommand(
  command: string,
  timeout = 15000
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout, env: getEnhancedEnv() })
    return { stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string }
    throw new Error(err.stderr || err.message)
  }
}

export async function execCommandSafe(
  command: string,
  timeout = 15000
): Promise<ExecResult | null> {
  try {
    return await execCommand(command, timeout)
  } catch {
    return null
  }
}

export function spawnWithProgress(
  command: string,
  args: string[],
  onData: (line: string) => void,
  onError?: (line: string) => void
): ChildProcess {
  const child = spawn(command, args, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: getEnhancedEnv()
  })

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(onData)
  })

  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(onError || onData)
  })

  return child
}
