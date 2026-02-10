import { app, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import type {
  Query,
  SDKMessage,
  SDKUserMessage,
  Options,
  PermissionMode,
  PermissionResult,
  SlashCommand,
  ModelInfo
} from '@anthropic-ai/claude-code'
import { secureStore } from '../../store/SecureStore'
import { instanceStore } from '../../store/InstanceStore'
import { sessionStore } from '../../store/SessionStore'
import { execCommandSafe } from '../platform/ShellExecutor'

interface ActiveSession {
  instanceId: string
  sessionId: string | undefined
  query: Query
  abortController: AbortController
  inputQueue: SDKUserMessage[]
  inputResolve: ((value: IteratorResult<SDKUserMessage>) => void) | null
  model: string
  permissionMode: PermissionMode
  messagesSent: number
}

class ClaudeSessionManager {
  private sessions = new Map<string, ActiveSession>()

  async startSession(
    instanceId: string,
    model: string,
    resumeSessionId?: string,
    permissionMode?: PermissionMode
  ): Promise<void> {
    // Stop existing session for this instance
    if (this.sessions.has(instanceId)) {
      await this.stopSession(instanceId)
    }

    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')

    const abortController = new AbortController()
    const inputQueue: SDKUserMessage[] = []
    let inputResolve: ((value: IteratorResult<SDKUserMessage>) => void) | null = null

    // Create async iterable for multi-turn input
    const inputStream: AsyncIterable<SDKUserMessage> = {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<SDKUserMessage>> {
            if (inputQueue.length > 0) {
              return Promise.resolve({ value: inputQueue.shift()!, done: false })
            }
            return new Promise((resolve) => {
              inputResolve = resolve
            })
          }
        }
      }
    }

    const session: ActiveSession = {
      instanceId,
      sessionId: resumeSessionId,
      query: null as unknown as Query,
      abortController,
      inputQueue,
      inputResolve: null,
      model,
      permissionMode: permissionMode || 'default',
      messagesSent: 0
    }

    // Find Claude Code executable
    const executablePath = await this.findClaudeExecutable()

    // Build query options
    const options: Options = {
      abortController,
      cwd: instance.basePath,
      model,
      includePartialMessages: true,
      permissionMode: permissionMode || 'default',
      resume: resumeSessionId,
      pathToClaudeCodeExecutable: executablePath,
      canUseTool: async (toolName, input, { signal, suggestions }) => {
        return this.handlePermissionRequest(instanceId, toolName, input, suggestions)
      }
    }

    // Set API key if available
    const apiKey = secureStore.getApiKey()
    if (apiKey) {
      options.env = { ...options.env, ANTHROPIC_API_KEY: apiKey }
    }

    // Dynamic import since SDK is ESM
    const { query } = await import('@anthropic-ai/claude-code')

    const queryInstance = query({
      prompt: inputStream,
      options
    })

    session.query = queryInstance
    // Store inputResolve reference via closure
    Object.defineProperty(session, 'inputResolve', {
      get: () => inputResolve,
      set: (v) => { inputResolve = v }
    })

    this.sessions.set(instanceId, session)

    // Broadcast session started
    this.broadcast(instanceId, 'claude:session-started', {
      instanceId,
      model
    })

    // Process messages in background
    this.processMessages(instanceId, queryInstance).catch((err) => {
      if (err.name !== 'AbortError') {
        this.broadcast(instanceId, 'claude:error', {
          instanceId,
          error: err.message
        })
      }
    })
  }

  async sendMessage(instanceId: string, text: string, parentToolUseId?: string): Promise<void> {
    const session = this.sessions.get(instanceId)
    if (!session) throw new Error('No active session for this instance')

    const message: SDKUserMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: text
      },
      session_id: session.sessionId || '',
      parent_tool_use_id: parentToolUseId || null
    }

    // Update session preview on first user message
    if (session.messagesSent === 0 && session.sessionId) {
      sessionStore.updateSessionPreview(instanceId, session.sessionId, text.slice(0, 100))
    }
    session.messagesSent++

    // Push to queue or resolve pending promise
    if (session.inputResolve) {
      const resolve = session.inputResolve
      session.inputResolve = null
      resolve({ value: message, done: false })
    } else {
      session.inputQueue.push(message)
    }
  }

  async stopSession(instanceId: string): Promise<void> {
    const session = this.sessions.get(instanceId)
    if (!session) return

    session.abortController.abort()
    this.sessions.delete(instanceId)

    this.broadcast(instanceId, 'claude:session-stopped', { instanceId })
  }

  async interruptSession(instanceId: string): Promise<void> {
    const session = this.sessions.get(instanceId)
    if (!session) return

    try {
      await session.query.interrupt()
    } catch {
      // May fail if not streaming
    }
  }

  async setModel(instanceId: string, model: string): Promise<void> {
    const session = this.sessions.get(instanceId)
    if (!session) throw new Error('No active session')

    session.model = model
    await session.query.setModel(model)
  }

  async setPermissionMode(instanceId: string, mode: PermissionMode): Promise<void> {
    const session = this.sessions.get(instanceId)
    if (!session) throw new Error('No active session')

    session.permissionMode = mode
    await session.query.setPermissionMode(mode)
  }

  async getSlashCommands(instanceId: string): Promise<SlashCommand[]> {
    const session = this.sessions.get(instanceId)
    if (!session) return []

    try {
      return await session.query.supportedCommands()
    } catch {
      return []
    }
  }

  async getSupportedModels(instanceId: string): Promise<ModelInfo[]> {
    const session = this.sessions.get(instanceId)
    if (!session) return []

    try {
      return await session.query.supportedModels()
    } catch {
      return []
    }
  }

  hasSession(instanceId: string): boolean {
    return this.sessions.has(instanceId)
  }

  async stopAll(): Promise<void> {
    const promises = Array.from(this.sessions.keys()).map((id) =>
      this.stopSession(id).catch(() => {})
    )
    await Promise.all(promises)
  }

  private async findClaudeExecutable(): Promise<string> {
    // 1. Try node_modules cli.js (development)
    const nodeModulesPath = join(app.getAppPath(), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath
    }

    // 2. Try global claude binary
    const isWin = process.platform === 'win32'
    const whichCmd = isWin ? 'where claude' : 'which claude'
    const result = await execCommandSafe(whichCmd)
    if (result?.stdout) {
      const foundPath = result.stdout.split('\n')[0].trim()
      if (foundPath && existsSync(foundPath)) return foundPath
    }

    // 3. Common global paths
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

    throw new Error(
      'Claude Code CLI not found. Install it globally with: npm install -g @anthropic-ai/claude-code'
    )
  }

  private async processMessages(instanceId: string, queryInstance: Query): Promise<void> {
    for await (const message of queryInstance) {
      this.routeMessage(instanceId, message)
    }
  }

  private routeMessage(instanceId: string, message: SDKMessage): void {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          // Update session ID
          const session = this.sessions.get(instanceId)
          if (session) {
            session.sessionId = message.session_id
            // Save session ID to instance for resume
            instanceStore.update(instanceId, {
              lastClaudeSessionId: message.session_id
            })
            // Save session record for the picker
            sessionStore.addSession(instanceId, {
              sessionId: message.session_id,
              model: message.model || session.model,
              createdAt: new Date().toISOString()
            })
          }
          this.broadcast(instanceId, 'claude:system-init', {
            instanceId,
            sessionId: message.session_id,
            model: message.model,
            tools: message.tools,
            permissionMode: message.permissionMode
          })
        }
        break

      case 'assistant':
        this.broadcast(instanceId, 'claude:assistant-message', {
          instanceId,
          uuid: message.uuid,
          sessionId: message.session_id,
          message: message.message
        })
        break

      case 'stream_event':
        this.broadcast(instanceId, 'claude:stream-event', {
          instanceId,
          uuid: message.uuid,
          event: message.event,
          parentToolUseId: message.parent_tool_use_id
        })
        break

      case 'result':
        this.broadcast(instanceId, 'claude:result', {
          instanceId,
          uuid: message.uuid,
          subtype: message.subtype,
          totalCostUsd: message.total_cost_usd,
          numTurns: message.num_turns,
          durationMs: message.duration_ms,
          usage: message.usage,
          isError: message.is_error,
          result: message.subtype === 'success' ? (message as any).result : undefined
        })
        break
    }
  }

  private async handlePermissionRequest(
    instanceId: string,
    toolName: string,
    input: Record<string, unknown>,
    suggestions?: any
  ): Promise<PermissionResult> {
    return new Promise<PermissionResult>((resolve) => {
      const requestId = `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`

      // Store the resolver
      this.pendingPermissions.set(requestId, { resolve, suggestions })

      // Ask the renderer
      this.broadcast(instanceId, 'claude:permission-request', {
        instanceId,
        requestId,
        toolName,
        input
      })

      // Auto-approve after 60s timeout
      setTimeout(() => {
        if (this.pendingPermissions.has(requestId)) {
          this.pendingPermissions.delete(requestId)
          resolve({ behavior: 'allow', updatedInput: input })
        }
      }, 60000)
    })
  }

  private pendingPermissions = new Map<string, {
    resolve: (result: PermissionResult) => void
    suggestions?: any
  }>()

  resolvePermission(requestId: string, allowed: boolean, message?: string): void {
    const pending = this.pendingPermissions.get(requestId)
    if (!pending) return

    this.pendingPermissions.delete(requestId)

    if (allowed) {
      pending.resolve({
        behavior: 'allow',
        updatedInput: {},
        updatedPermissions: pending.suggestions
      })
    } else {
      pending.resolve({
        behavior: 'deny',
        message: message || 'User denied this action'
      })
    }
  }

  private broadcast(instanceId: string, channel: string, data: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, data)
    }
  }
}

export const claudeSessionManager = new ClaudeSessionManager()
