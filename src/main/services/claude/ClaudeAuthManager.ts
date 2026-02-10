import { existsSync, readFileSync } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { secureStore } from '../../store/SecureStore'
import { execCommandSafe } from '../platform/ShellExecutor'
import type { AuthMethod, ClaudeAuthStatus } from '@shared/types/claude'

class ClaudeAuthManager {
  private claudeDir = join(process.env.HOME || process.env.USERPROFILE || '', '.claude')

  /**
   * Check the current authentication status.
   * Priority: API key in app > Account token (CLI auth) > None
   */
  async checkAuthStatus(): Promise<ClaudeAuthStatus> {
    // 1. Check if API key is configured in our app
    const apiKey = secureStore.getApiKey()
    if (apiKey) {
      return {
        authenticated: true,
        method: 'api-key'
      }
    }

    // 2. Check if CLI is authenticated (account/OAuth token)
    const cliAuth = await this.checkCliAuth()
    if (cliAuth) {
      return cliAuth
    }

    return {
      authenticated: false,
      method: 'none'
    }
  }

  /**
   * Check if the Claude CLI has valid authentication by running a quick command.
   */
  private async checkCliAuth(): Promise<ClaudeAuthStatus | null> {
    try {
      const claudePath = await this.findClaudeExecutable()
      if (!claudePath) return null

      // Try running claude with a minimal prompt to check auth
      return await new Promise<ClaudeAuthStatus | null>((resolve) => {
        const child = spawn(claudePath, ['-p', 'hi', '--max-budget-usd', '0.001', '--output-format', 'json'], {
          timeout: 15000,
          env: {
            ...process.env,
            // Don't pass any API key - we want to test CLI auth only
            ANTHROPIC_API_KEY: ''
          },
          stdio: ['ignore', 'pipe', 'pipe']
        })

        let stdout = ''
        let stderr = ''

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        const timer = setTimeout(() => {
          child.kill('SIGKILL')
          // If it's taking long but didn't error, it's probably authenticated and processing
          resolve({
            authenticated: true,
            method: 'oauth'
          })
        }, 12000)

        child.on('close', (code) => {
          clearTimeout(timer)

          if (code === 0) {
            resolve({
              authenticated: true,
              method: 'oauth'
            })
          } else {
            // Check if error is auth-related
            const combined = stdout + stderr
            if (
              combined.includes('not authenticated') ||
              combined.includes('login') ||
              combined.includes('unauthorized') ||
              combined.includes('API key')
            ) {
              resolve(null) // Not authenticated
            } else {
              // Other error but might still be authenticated (budget limit hit, etc.)
              // Budget limit error means auth worked but we hit the $0.001 limit
              if (combined.includes('budget') || combined.includes('limit')) {
                resolve({
                  authenticated: true,
                  method: 'oauth'
                })
              }
              resolve(null)
            }
          }
        })

        child.on('error', () => {
          clearTimeout(timer)
          resolve(null)
        })
      })
    } catch {
      return null
    }
  }

  /**
   * Login via OAuth (browser-based flow).
   * Runs `claude login` which opens the browser for authentication via claude.ai.
   */
  async loginOAuth(): Promise<{ success: boolean; error?: string }> {
    try {
      const claudePath = await this.findClaudeExecutable()
      if (!claudePath) {
        return { success: false, error: 'Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code' }
      }

      return await new Promise((resolve) => {
        const child = spawn(claudePath, ['login'], {
          timeout: 120000,
          stdio: ['ignore', 'pipe', 'pipe']
        })

        let stderr = ''

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        child.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true })
          } else {
            resolve({
              success: false,
              error: stderr.trim() || 'OAuth login failed'
            })
          }
        })

        child.on('error', (err) => {
          resolve({ success: false, error: err.message })
        })
      })
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * Login with a long-lived authentication token from the Anthropic console.
   * This runs `claude setup-token` and pipes the token to it.
   */
  async loginWithToken(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const claudePath = await this.findClaudeExecutable()
      if (!claudePath) {
        return { success: false, error: 'Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code' }
      }

      return await new Promise((resolve) => {
        const child = spawn(claudePath, ['setup-token'], {
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        let stdout = ''
        let stderr = ''

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString()
          // When it prompts for token, send it
          if (stdout.includes('token') || stdout.includes('Token') || stdout.includes(':') || stdout.includes('Enter') || stdout.includes('Paste')) {
            child.stdin?.write(token + '\n')
            child.stdin?.end()
          }
        })

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString()
        })

        // If no prompt appears within 3s, just send the token
        const promptTimeout = setTimeout(() => {
          child.stdin?.write(token + '\n')
          child.stdin?.end()
        }, 3000)

        child.on('close', (code) => {
          clearTimeout(promptTimeout)
          if (code === 0) {
            resolve({ success: true })
          } else {
            resolve({
              success: false,
              error: stderr.trim() || stdout.trim() || 'Token setup failed'
            })
          }
        })

        child.on('error', (err) => {
          clearTimeout(promptTimeout)
          resolve({ success: false, error: err.message })
        })
      })
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * Logout: remove API key from app and optionally clear CLI auth.
   */
  async logout(): Promise<void> {
    // Remove API key from our store
    secureStore.removeApiKey()

    // Clear CLI authentication token
    const credentialsPath = join(this.claudeDir, '.credentials.json')
    if (existsSync(credentialsPath)) {
      await unlink(credentialsPath)
    }
  }

  /**
   * Quick check if ~/.claude directory exists (basic indicator of CLI installation)
   */
  hasClaudeDirectory(): boolean {
    return existsSync(this.claudeDir)
  }

  /**
   * Find the claude executable path.
   */
  private async findClaudeExecutable(): Promise<string | null> {
    const isWin = process.platform === 'win32'

    // Try global claude binary
    const whichCmd = isWin ? 'where claude' : 'which claude'
    const result = await execCommandSafe(whichCmd)
    if (result?.stdout) {
      const foundPath = result.stdout.split('\n')[0].trim()
      if (foundPath && existsSync(foundPath)) return foundPath
    }

    // Common global paths
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const commonPaths = isWin
      ? [
          join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
          join(process.env.APPDATA || '', 'npm', 'claude'),
          join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
          join(home, '.npm-global', 'claude.cmd')
        ]
      : [
          '/opt/homebrew/bin/claude',
          '/usr/local/bin/claude',
          '/usr/bin/claude',
          join(home, '.npm-global', 'bin', 'claude')
        ]
    for (const p of commonPaths) {
      if (existsSync(p)) return p
    }

    return null
  }
}

export const claudeAuthManager = new ClaudeAuthManager()
