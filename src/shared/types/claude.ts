export type AuthMethod = 'api-key' | 'oauth' | 'none'

export interface ClaudeAuthStatus {
  authenticated: boolean
  method: AuthMethod
  accountEmail?: string
}

export interface ClaudeSession {
  id: string
  instanceId: string
  model: string
  messages: ChatMessage[]
  isStreaming: boolean
  partialContent: string
  totalCost: number
  tokenUsage: { input: number; output: number }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolUse?: ToolUseInfo[]
  fileChanges?: FileChange[]
  thinking?: string
  timestamp: number
  metadata?: {
    cost?: number
    turns?: number
    duration?: number
  }
}

export interface ToolUseInfo {
  id: string
  name: string
  input: unknown
  output?: unknown
}

export interface FileChange {
  filePath: string
  type: 'create' | 'edit' | 'delete'
  diff?: string
}

export interface SessionRecord {
  sessionId: string
  model: string
  createdAt: string
  firstMessage?: string
}
