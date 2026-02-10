import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Loader2,
  Bot,
  User,
  Square,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Wrench,
  DollarSign,
  Activity,
  Key,
  ShieldAlert,
  FileEdit,
  Eye,
  Plus,
  RotateCw,
  X,
  Clock,
  FileText,
  HelpCircle,
  LogOut,
  Paperclip,
  Copy,
  CopyCheck
} from 'lucide-react'
import type { AuthMethod, SessionRecord } from '@shared/types/claude'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolUse?: Array<{ id: string; name: string; input: any }>
  thinking?: string
  timestamp: number
}

interface PermissionRequest {
  requestId: string
  toolName: string
  input: any
}

interface SlashCommand {
  name: string
  description: string
  argumentHint: string
}

/** Default slash commands shown before session is active */
const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  { name: 'help', description: 'Show available commands and help', argumentHint: '' },
  { name: 'clear', description: 'Clear conversation history', argumentHint: '' },
  { name: 'compact', description: 'Compact conversation to save context', argumentHint: '' },
  { name: 'cost', description: 'Show token usage and cost for this session', argumentHint: '' },
  { name: 'doctor', description: 'Check Claude Code installation health', argumentHint: '' },
  { name: 'init', description: 'Initialize CLAUDE.md project file', argumentHint: '' },
  { name: 'review', description: 'Review code changes', argumentHint: '' },
  { name: 'bug', description: 'Report a bug', argumentHint: '' },
  { name: 'config', description: 'Show or update configuration', argumentHint: '' },
  { name: 'login', description: 'Log in to your Anthropic account', argumentHint: '' },
  { name: 'logout', description: 'Log out of your Anthropic account', argumentHint: '' },
  { name: 'status', description: 'Show session status', argumentHint: '' },
  { name: 'memory', description: 'View or edit CLAUDE.md memory', argumentHint: '' }
]

const PERMISSION_MODES = [
  { value: 'default', label: 'Default', icon: Shield, description: 'Ask before tool use' },
  { value: 'plan', label: 'Plan', icon: Eye, description: 'Read-only, suggests changes' },
  { value: 'acceptEdits', label: 'Auto-edit', icon: FileEdit, description: 'Auto-accept file edits' },
  { value: 'bypassPermissions', label: 'YOLO', icon: ShieldAlert, description: 'Accept all actions' }
]

const MODEL_OPTIONS = [
  { value: 'claude-opus-4-6', label: 'Opus 4.6' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' }
]
const DEFAULT_MODEL = MODEL_OPTIONS[0].value
const VALID_MODEL_IDS = new Set(MODEL_OPTIONS.map((m) => m.value))

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return count.toString()
}

interface Props {
  instanceId: string
}

export function ClaudePanel({ instanceId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [partialContent, setPartialContent] = useState('')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [totalCost, setTotalCost] = useState(0)
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0 })
  const [authMethod, setAuthMethod] = useState<AuthMethod>('none')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [permissionMode, setPermissionMode] = useState('default')
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [showPicker, setShowPicker] = useState(true)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [activeQuestion, setActiveQuestion] = useState<{
    toolUseId: string
    question: string
    options: Array<{ label: string; description?: string }>
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages, partialContent])

  // Load default model from settings, check auth, and load recent sessions
  useEffect(() => {
    window.api.settings.get().then((settings) => {
      if (settings.claudeModel && VALID_MODEL_IDS.has(settings.claudeModel)) {
        setModel(settings.claudeModel)
      }
    })
    window.api.claude.hasSession(instanceId).then((active) => {
      setIsSessionActive(active)
      if (active) setShowPicker(false)
    })
    window.api.claude.checkAuth().then((status) => setAuthMethod(status.method)).catch(() => {})
    window.api.claude.listSessions(instanceId).then(setRecentSessions).catch(() => {})
  }, [instanceId])

  // Load slash commands: defaults first, then SDK commands when session is active
  useEffect(() => {
    if (isSessionActive) {
      window.api.claude.slashCommands(instanceId).then((cmds) => {
        setSlashCommands(cmds.length > 0 ? cmds : DEFAULT_SLASH_COMMANDS)
      }).catch(() => setSlashCommands(DEFAULT_SLASH_COMMANDS))
    } else {
      setSlashCommands(DEFAULT_SLASH_COMMANDS)
    }
  }, [instanceId, isSessionActive])

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      try {
        localStorage.setItem(
          `claude-messages-${currentSessionId}`,
          JSON.stringify(messages)
        )
      } catch {
        // localStorage might be full, ignore
      }
    }
  }, [currentSessionId, messages])

  // Listen for Claude events
  useEffect(() => {
    const unsubs = [
      window.api.on.claudeSessionStarted((data) => {
        if (data.instanceId === instanceId) {
          setIsSessionActive(true)
          setShowPicker(false)
          setModel(data.model)
          setSessionError(null)
        }
      }),
      window.api.on.claudeSystemInit((data) => {
        if (data.instanceId === instanceId) {
          setCurrentSessionId(data.sessionId)
        }
      }),
      window.api.on.claudeSessionStopped((data) => {
        if (data.instanceId === instanceId) {
          setIsSessionActive(false)
          setIsStreaming(false)
          setPartialContent('')
          setCurrentSessionId(null)
          // Reload sessions and show picker
          window.api.claude.listSessions(instanceId).then(setRecentSessions).catch(() => {})
          setShowPicker(true)
        }
      }),
      window.api.on.claudeAssistantMessage((data) => {
        if (data.instanceId !== instanceId) return

        // Extract text content from API message
        const msg = data.message
        let textContent = ''
        const toolUses: Array<{ id: string; name: string; input: any }> = []
        let thinkingContent = ''

        if (msg.content) {
          for (const block of msg.content) {
            if (block.type === 'text') {
              textContent += block.text
            } else if (block.type === 'tool_use') {
              toolUses.push({ id: block.id, name: block.name, input: block.input })
            } else if (block.type === 'thinking') {
              thinkingContent += block.thinking
            }
          }
        }

        // Detect AskUserQuestion tool use
        for (const tu of toolUses) {
          if (tu.name === 'AskUserQuestion') {
            const q = tu.input as any
            if (q?.questions?.[0]) {
              const first = q.questions[0]
              setActiveQuestion({
                toolUseId: tu.id,
                question: first.question,
                options: first.options || []
              })
            }
          }
        }

        setMessages((prev) => {
          const msgId = data.uuid || `msg_${Date.now()}`
          const existingIndex = prev.findIndex((m) => m.id === msgId)

          if (existingIndex >= 0) {
            // Merge into existing message with same uuid
            const existing = prev[existingIndex]
            const merged: Message = {
              ...existing,
              content:
                existing.content && textContent
                  ? existing.content + '\n' + textContent
                  : existing.content || textContent,
              toolUse: [
                ...(existing.toolUse || []),
                ...toolUses
              ],
              thinking:
                existing.thinking && thinkingContent
                  ? existing.thinking + '\n' + thinkingContent
                  : existing.thinking || thinkingContent || undefined
            }
            // Remove toolUse array if empty
            if (merged.toolUse && merged.toolUse.length === 0) {
              merged.toolUse = undefined
            }
            return [...prev.slice(0, existingIndex), merged, ...prev.slice(existingIndex + 1)]
          }

          // New message
          return [
            ...prev,
            {
              id: msgId,
              role: 'assistant',
              content: textContent,
              toolUse: toolUses.length > 0 ? toolUses : undefined,
              thinking: thinkingContent || undefined,
              timestamp: Date.now()
            }
          ]
        })
        setIsStreaming(false)
        setPartialContent('')
      }),
      window.api.on.claudeStreamEvent((data) => {
        if (data.instanceId !== instanceId) return
        setIsStreaming(true)

        const event = data.event
        if (event.type === 'content_block_delta') {
          const delta = (event as any).delta
          if (delta?.type === 'text_delta') {
            setPartialContent((prev) => prev + delta.text)
          }
        } else if (event.type === 'message_start') {
          setPartialContent('')
        }
      }),
      window.api.on.claudeResult((data) => {
        if (data.instanceId !== instanceId) return
        setIsStreaming(false)
        setPartialContent('')
        setTotalCost(data.totalCostUsd || 0)
        if (data.usage) {
          setTokenUsage({
            input: data.usage.input_tokens || 0,
            output: data.usage.output_tokens || 0
          })
        }

        if (data.isError || data.subtype !== 'success') {
          setMessages((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              role: 'system',
              content: `Session ended: ${data.subtype}${data.result ? ` - ${data.result}` : ''}`,
              timestamp: Date.now()
            }
          ])
          // Reload sessions and show picker on error
          window.api.claude.listSessions(instanceId).then(setRecentSessions).catch(() => {})
          setShowPicker(true)
        }
      }),
      window.api.on.claudePermissionRequest((data) => {
        if (data.instanceId === instanceId) {
          setPermissionRequest({
            requestId: data.requestId,
            toolName: data.toolName,
            input: data.input
          })
        }
      }),
      window.api.on.claudeError((data) => {
        if (data.instanceId === instanceId) {
          setSessionError(data.error)
          setIsStreaming(false)
        }
      })
    ]

    return () => unsubs.forEach((fn) => fn())
  }, [instanceId])

  const handleStartSession = useCallback(async (resumeSessionId?: string, resumeModel?: string) => {
    try {
      setSessionError(null)
      setShowPicker(false)
      const sessionModel = resumeModel || model || DEFAULT_MODEL
      await window.api.claude.startSession(instanceId, sessionModel, resumeSessionId, permissionMode)
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to start session')
      setShowPicker(true)
    }
  }, [instanceId, model, permissionMode])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text && attachedFiles.length === 0) return
    if (isStreaming) return

    // Build message with attached files
    let fullMessage = text
    if (attachedFiles.length > 0) {
      const fileLines = attachedFiles.map(f => `- ${f}`).join('\n')
      fullMessage = `[Attached files]\n${fileLines}\n\n${text}`
    }

    // Start session if not active
    if (!isSessionActive) {
      await handleStartSession()
    }

    setInput('')
    setAttachedFiles([])
    setMessages((prev) => [
      ...prev,
      {
        id: `user_${Date.now()}`,
        role: 'user',
        content: fullMessage,
        timestamp: Date.now()
      }
    ])

    try {
      await window.api.claude.sendMessage(instanceId, fullMessage)
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }, [input, attachedFiles, isStreaming, isSessionActive, instanceId, handleStartSession])

  // Slash command filtering
  const filteredSlashCommands = slashCommands.filter((cmd) =>
    cmd.name.toLowerCase().startsWith(slashFilter.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value
    setInput(value)

    // Detect slash command typing - show menu only when typing the command (no space yet)
    if (value.startsWith('/') && !value.includes(' ')) {
      const filter = value.slice(1)
      setSlashFilter(filter)
      setShowSlashMenu(true)
      setSlashSelectedIndex(0)
    } else {
      setShowSlashMenu(false)
    }
  }

  const handleSelectSlashCommand = (cmd: SlashCommand): void => {
    setInput(`/${cmd.name} `)
    setShowSlashMenu(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Slash menu navigation
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelectedIndex((prev) =>
          prev < filteredSlashCommands.length - 1 ? prev + 1 : 0
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSlashCommands.length - 1
        )
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        handleSelectSlashCommand(filteredSlashCommands[slashSelectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePermissionModeChange = async (mode: string): Promise<void> => {
    setPermissionMode(mode)
    if (isSessionActive) {
      try {
        await window.api.claude.setPermissionMode(instanceId, mode)
      } catch {
        // ignore
      }
    }
  }

  const handleInterrupt = async (): Promise<void> => {
    try {
      await window.api.claude.interrupt(instanceId)
    } catch {
      // ignore
    }
  }

  const handleStopSession = useCallback(async () => {
    if (isSessionActive) {
      try {
        await window.api.claude.stopSession(instanceId)
      } catch {
        // ignore
      }
    }
    // Reset UI state regardless
    setMessages([])
    setSessionError(null)
    setShowPicker(true)
  }, [instanceId, isSessionActive])

  const handleAttachFiles = async (): Promise<void> => {
    const paths = await window.api.dialog.openFiles()
    if (paths.length > 0) {
      setAttachedFiles(prev => [...prev, ...paths.filter(p => !prev.includes(p))])
    }
  }

  const handlePermissionResponse = async (allowed: boolean): Promise<void> => {
    if (!permissionRequest) return
    await window.api.claude.resolvePermission(permissionRequest.requestId, allowed)
    setPermissionRequest(null)
  }

  const handleQuestionResponse = useCallback(async (answer: string) => {
    if (!activeQuestion) return
    const toolUseId = activeQuestion.toolUseId
    setActiveQuestion(null)

    // Add user message to chat
    setMessages((prev) => [...prev, {
      id: `user_${Date.now()}`,
      role: 'user' as const,
      content: answer,
      timestamp: Date.now()
    }])

    // Send with parent_tool_use_id
    try {
      await window.api.claude.sendMessage(instanceId, answer, toolUseId)
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Failed to send response')
    }
  }, [activeQuestion, instanceId])

  const handleNewSession = useCallback(() => {
    setShowPicker(false)
    setMessages([])
    setCurrentSessionId(null)
    setTotalCost(0)
    setTokenUsage({ input: 0, output: 0 })
    setSessionError(null)
  }, [])

  const handleResumeSession = useCallback((record: SessionRecord) => {
    // Restore persisted messages for this session
    try {
      const stored = localStorage.getItem(`claude-messages-${record.sessionId}`)
      if (stored) {
        setMessages(JSON.parse(stored))
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
    setTotalCost(0)
    setTokenUsage({ input: 0, output: 0 })
    setCurrentSessionId(record.sessionId)
    handleStartSession(record.sessionId, record.model)
  }, [handleStartSession])

  const handleDeleteSessionRecord = useCallback(async (sessionId: string) => {
    await window.api.claude.deleteSessionRecord(instanceId, sessionId)
    setRecentSessions((prev) => prev.filter((s) => s.sessionId !== sessionId))
    try {
      localStorage.removeItem(`claude-messages-${sessionId}`)
    } catch {
      // ignore
    }
  }, [instanceId])

  const currentMode = PERMISSION_MODES.find((m) => m.value === permissionMode) || PERMISSION_MODES[0]

  // Show session picker when no active session and picker is visible
  if (!isSessionActive && showPicker) {
    return (
      <div className="flex flex-col h-full bg-card border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-primary" />
            <span className="text-sm font-medium">Claude Code</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Permission mode selector */}
            <select
              value={permissionMode}
              onChange={(e) => handlePermissionModeChange(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
              title={currentMode.description}
            >
              {PERMISSION_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            {/* Model selector */}
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                window.api.settings.update({ claudeModel: e.target.value })
              }}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Session Picker */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-md mx-auto">
            <div className="flex flex-col items-center text-center mb-6">
              <Bot size={32} className="mb-3 opacity-40 text-muted-foreground" />
              <p className="text-sm font-medium">Claude Code</p>
              <p className="text-xs mt-1 text-muted-foreground max-w-xs">
                Start a new session or resume a previous one.
              </p>
            </div>

            <button
              onClick={handleNewSession}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mb-6"
            >
              <Plus size={16} />
              New Session
            </button>

            {recentSessions.length > 0 && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Recent Sessions
                </h3>
                <div className="space-y-2">
                  {recentSessions.map((session) => (
                    <SessionCard
                      key={session.sessionId}
                      session={session}
                      onResume={() => handleResumeSession(session)}
                      onDelete={() => handleDeleteSessionRecord(session.sessionId)}
                    />
                  ))}
                </div>
              </>
            )}

            {recentSessions.length === 0 && (
              <p className="text-xs text-center text-muted-foreground">
                No previous sessions
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-card border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          <span className="text-sm font-medium">Claude Code</span>
          {isSessionActive && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/15 text-green-600">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Auth-aware usage display */}
          {authMethod === 'api-key' && totalCost > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" title="API cost this session">
              <DollarSign size={11} />
              {totalCost.toFixed(4)}
            </span>
          )}
          {authMethod === 'oauth' && (tokenUsage.input > 0 || tokenUsage.output > 0) && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Tokens used this session">
              <Activity size={11} />
              {formatTokens(tokenUsage.input + tokenUsage.output)}
            </span>
          )}
          {authMethod === 'none' && (
            <span className="flex items-center gap-1 text-xs text-yellow-600" title="Not authenticated">
              <Key size={11} />
            </span>
          )}

          {/* Permission mode selector */}
          <select
            value={permissionMode}
            onChange={(e) => handlePermissionModeChange(e.target.value)}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
            title={currentMode.description}
          >
            {PERMISSION_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>

          {/* Model selector */}
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value)
              window.api.settings.update({ claudeModel: e.target.value })
              if (isSessionActive) {
                window.api.claude.setModel(instanceId, e.target.value)
              }
            }}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Stop session / exit button — always visible */}
          <button
            onClick={handleStopSession}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="End session"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot size={32} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Claude Code</p>
            <p className="text-xs mt-1 max-w-xs">
              Ask Claude to help with your Odoo project. It has full access to read, edit, and run code in this project directory.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming indicator */}
        {isStreaming && partialContent && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SimpleMarkdown text={partialContent} />
            </div>
          </div>
        )}

        {isStreaming && !partialContent && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Thinking...
          </div>
        )}

        {/* Permission request dialog */}
        {permissionRequest && (
          permissionRequest.toolName === 'ExitPlanMode'
            ? <PlanReviewDialog
                input={permissionRequest.input}
                onApprove={() => handlePermissionResponse(true)}
                onReject={() => handlePermissionResponse(false)}
              />
            : <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium">Permission Required</span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Claude wants to use: <strong>{permissionRequest.toolName}</strong>
                </p>
                <pre className="text-xs bg-muted/50 rounded p-2 mb-3 max-h-32 overflow-y-auto">
                  {JSON.stringify(permissionRequest.input, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePermissionResponse(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <ShieldCheck size={12} />
                    Allow
                  </button>
                  <button
                    onClick={() => handlePermissionResponse(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
        )}

        {/* AskUserQuestion interactive picker */}
        {activeQuestion && (
          <QuestionPicker
            question={activeQuestion.question}
            options={activeQuestion.options}
            onSelect={handleQuestionResponse}
          />
        )}

        {/* Error */}
        {sessionError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <AlertTriangle size={14} />
            <span className="flex-1">{sessionError}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        {/* Slash command autocomplete */}
        {showSlashMenu && filteredSlashCommands.length > 0 && (
          <div className="mb-2 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSlashCommands.map((cmd, i) => (
              <button
                key={cmd.name}
                onClick={() => handleSelectSlashCommand(cmd)}
                className={cn(
                  'w-full text-left px-3 py-2 flex items-start gap-2 transition-colors',
                  i === slashSelectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className="text-sm font-mono text-primary shrink-0">/{cmd.name}</span>
                <span className="text-xs text-muted-foreground">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachedFiles.map(f => (
              <span key={f} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs font-mono truncate max-w-[250px]">
                <Paperclip size={10} className="shrink-0" />
                {f.split('/').pop()}
                <button onClick={() => setAttachedFiles(prev => prev.filter(p => p !== f))} className="ml-0.5 text-muted-foreground hover:text-foreground">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleAttachFiles}
            className="self-end h-[38px] w-[38px] flex items-center justify-center rounded-lg border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            title="Attach files"
          >
            <Paperclip size={14} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSlashMenu(false), 150)}
            placeholder={isSessionActive ? 'Message Claude... (type / for commands)' : 'Ask Claude about your Odoo project...'}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[38px] max-h-[120px]"
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`
            }}
          />
          {isStreaming ? (
            <button
              onClick={handleInterrupt}
              className="self-end h-[38px] w-[38px] flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shrink-0"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachedFiles.length === 0}
              className={cn(
                'self-end h-[38px] w-[38px] flex items-center justify-center rounded-lg transition-colors shrink-0',
                input.trim() || attachedFiles.length > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Send size={14} />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Enter to send, Shift+Enter for new line{isSessionActive ? ', / for commands' : ''}
        </p>
      </div>
    </div>
  )
}

/* --- Sub Components --- */

/* --- Plan Review Components --- */

function extractPlanText(input: any): string {
  if (typeof input?.plan === 'string') return input.plan
  if (input && typeof input === 'object') {
    for (const value of Object.values(input)) {
      if (typeof value === 'string' && value.length > 100) return value
    }
  }
  return JSON.stringify(input, null, 2)
}

function renderInline(text: string): React.ReactNode {
  if (!text) return text
  const parts: React.ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyCounter = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    const key = keyCounter++
    if (token.startsWith('`')) {
      parts.push(
        <code key={key} className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-2 rounded-md border overflow-hidden bg-[#0d1117]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <CopyCheck size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono overflow-x-auto text-[#c9d1d9]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function SimpleMarkdown({ text }: { text: string }) {
  const elements: React.JSX.Element[] = []
  const lines = text.split('\n')
  let i = 0
  let keyCounter = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    const indent = line.length - line.trimStart().length
    const key = keyCounter++

    // Code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // skip closing ```
      const codeText = codeLines.join('\n')
      elements.push(
        <CodeBlock key={key} code={codeText} language={lang} />
      )
      continue
    }

    // Empty line
    if (!trimmed) {
      elements.push(<div key={key} className="h-1.5" />)
      i++
      continue
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      elements.push(<h4 key={key} className="text-xs font-semibold mt-3 mb-1">{renderInline(trimmed.slice(5))}</h4>)
      i++; continue
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={key} className="text-sm font-semibold mt-3 mb-1">{renderInline(trimmed.slice(4))}</h3>)
      i++; continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={key} className="text-sm font-bold mt-4 mb-1.5">{renderInline(trimmed.slice(3))}</h2>)
      i++; continue
    }
    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={key} className="text-base font-bold mt-4 mb-2">{renderInline(trimmed.slice(2))}</h1>)
      i++; continue
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={key} className="my-3 border-border" />)
      i++; continue
    }

    // Unordered list items
    if (/^[-*]\s/.test(trimmed)) {
      const indentLevel = Math.floor(indent / 2)
      elements.push(
        <div key={key} className="flex gap-1.5 text-sm" style={{ paddingLeft: `${indentLevel * 16 + 8}px` }}>
          <span className="text-muted-foreground shrink-0">&#x2022;</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      )
      i++; continue
    }

    // Numbered list items
    const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
    if (numMatch) {
      const indentLevel = Math.floor(indent / 2)
      elements.push(
        <div key={key} className="flex gap-1.5 text-sm" style={{ paddingLeft: `${indentLevel * 16 + 8}px` }}>
          <span className="text-muted-foreground shrink-0 font-mono text-xs mt-px">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      )
      i++; continue
    }

    // Regular paragraph
    elements.push(<p key={key} className="text-sm">{renderInline(trimmed)}</p>)
    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

function PlanReviewDialog({
  input,
  onApprove,
  onReject
}: {
  input: any
  onApprove: () => void
  onReject: () => void
}) {
  const planText = extractPlanText(input)

  return (
    <div className="bg-slate-medium/5 border border-slate-medium/20 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-medium/20 bg-slate-medium/10">
        <FileText size={15} className="text-slate-medium" />
        <span className="text-sm font-medium">Plan Review</span>
      </div>
      <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
        <SimpleMarkdown text={planText} />
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-slate-medium/20">
        <button
          onClick={onApprove}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          <ShieldCheck size={12} />
          Approve Plan
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border text-destructive hover:bg-destructive/10 transition-colors"
        >
          Reject Plan
        </button>
      </div>
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function SessionCard({
  session,
  onResume,
  onDelete
}: {
  session: SessionRecord
  onResume: () => void
  onDelete: () => void
}) {
  const modelDisplay = session.model
    .replace('claude-', '')
    .replace(/-\d{8}$/, '')
    .replace(/-/g, ' ')

  return (
    <div className="group border rounded-lg p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium capitalize">{modelDisplay}</span>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatRelativeTime(session.createdAt)}
            </span>
          </div>
          {session.firstMessage && (
            <p className="text-xs text-muted-foreground/70 mt-1 truncate italic">
              &ldquo;{session.firstMessage}&rdquo;
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onResume}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <RotateCw size={11} />
            Resume
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove from list"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionPicker({
  question,
  options,
  onSelect
}: {
  question: string
  options: Array<{ label: string; description?: string }>
  onSelect: (answer: string) => void
}) {
  const [customAnswer, setCustomAnswer] = useState('')

  return (
    <div className="bg-coral/5 border border-coral/20 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-coral/20 bg-coral/10">
        <HelpCircle size={15} className="text-coral" />
        <span className="text-sm font-medium">Claude is asking...</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-medium mb-3">{question}</p>
        <div className="space-y-1.5">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onSelect(opt.label)}
              className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:border-coral/40 hover:bg-coral/5 transition-colors"
            >
              <span className="text-sm font-medium">{opt.label}</span>
              {opt.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Or type a custom answer</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customAnswer.trim()) {
                  onSelect(customAnswer.trim())
                }
              }}
              placeholder="Custom answer..."
              className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={() => customAnswer.trim() && onSelect(customAnswer.trim())}
              disabled={!customAnswer.trim()}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                customAnswer.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const [showThinking, setShowThinking] = useState(false)
  const [showToolDetails, setShowToolDetails] = useState(false)

  if (message.role === 'system') {
    return (
      <div className="text-xs text-center text-muted-foreground py-1">
        {message.content}
      </div>
    )
  }

  const isUser = message.role === 'user'

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isUser ? 'bg-muted' : 'bg-primary/10'
        )}
      >
        {isUser ? (
          <User size={14} className="text-muted-foreground" />
        ) : (
          <Bot size={14} className="text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {/* Thinking block */}
        {message.thinking && (
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors"
          >
            {showThinking ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Thinking
          </button>
        )}
        {showThinking && message.thinking && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 mb-2 whitespace-pre-wrap italic">
            {message.thinking}
          </div>
        )}

        {/* Main content */}
        {message.content && (
          isUser
            ? <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
            : <SimpleMarkdown text={message.content} />
        )}

        {/* Tool use blocks (exclude AskUserQuestion — handled by QuestionPicker) */}
        {(() => {
          const displayTools = message.toolUse?.filter((t) => t.name !== 'AskUserQuestion')
          return displayTools && displayTools.length > 0 ? (
            <div className="mt-2">
              <button
                onClick={() => setShowToolDetails(!showToolDetails)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Wrench size={11} />
                {displayTools.length} tool{displayTools.length > 1 ? 's' : ''} used
                {showToolDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {showToolDetails && (
                <div className="mt-1 space-y-1">
                  {displayTools.map((tool, i) => (
                    <div key={i} className="text-xs bg-muted/50 rounded-md p-2">
                      <span className="font-medium text-primary">{tool.name}</span>
                      <pre className="mt-1 text-muted-foreground overflow-x-auto max-h-24 overflow-y-auto">
                        {JSON.stringify(tool.input, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null
        })()}
      </div>
    </div>
  )
}
