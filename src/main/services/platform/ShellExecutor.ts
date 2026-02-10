import { exec, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface ExecResult {
  stdout: string
  stderr: string
}

export async function execCommand(
  command: string,
  timeout = 15000
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout })
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
    stdio: ['ignore', 'pipe', 'pipe']
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
