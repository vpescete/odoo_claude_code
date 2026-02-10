import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play,
  Square,
  RotateCw,
  ExternalLink,
  Circle,
  Terminal,
  Info,
  Settings,
  Trash2,
  FolderOpen,
  AlertTriangle,
  Copy,
  CopyCheck,
  CheckSquare,
  Bot,
  TerminalSquare,
  Loader2,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Package,
  Plus,
  GitBranch,
  Download,
  Trash2 as Trash2Icon,
  AlertCircle,
  ChevronDown,
  Check,
  RefreshCw
} from 'lucide-react'
import { Skeleton } from '../ui/skeleton'
import { cn } from '@/lib/utils'
import type { OdooInstance, InstanceStatus } from '@shared/types/odoo'
import type { AddonRepo } from '@shared/types/addon'
import { ClaudePanel } from '../claude/ClaudePanel'
import { ShellTab } from './ShellTab'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'

type Tab = 'overview' | 'logs' | 'config' | 'addons' | 'shell' | 'claude'

const statusLabels: Record<InstanceStatus, string> = {
  stopped: 'Stopped',
  starting: 'Starting...',
  running: 'Running',
  stopping: 'Stopping...',
  error: 'Error'
}

const statusColors: Record<InstanceStatus, string> = {
  stopped: 'text-gray-400',
  starting: 'text-yellow-500 animate-pulse',
  running: 'text-green-500',
  stopping: 'text-yellow-500 animate-pulse',
  error: 'text-red-500'
}

export function InstanceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [instance, setInstance] = useState<OdooInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ line: string; level: string }>>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchInstance = useCallback(async () => {
    if (!id) return
    const inst = await window.api.odoo.get(id)
    if (inst) {
      setInstance(inst)
    } else {
      navigate('/')
    }
    setLoading(false)
  }, [id, navigate])

  useEffect(() => {
    fetchInstance()
  }, [fetchInstance])

  // Listen for status changes
  useEffect(() => {
    const unsub = window.api.on.odooStatusChanged((data) => {
      if (data.instanceId === id) {
        setInstance((prev) =>
          prev ? { ...prev, status: data.status as InstanceStatus } : prev
        )
        setActionLoading(false)
      }
    })
    return unsub
  }, [id])

  // Listen for logs
  useEffect(() => {
    const unsub = window.api.on.odooLogLine((data) => {
      if (data.instanceId === id) {
        setLogs((prev) => {
          const next = [...prev, { line: data.line, level: data.level }]
          if (next.length > 5000) return next.slice(-5000)
          return next
        })
      }
    })
    return unsub
  }, [id])

  // Debounced auto-scroll
  useEffect(() => {
    if (!autoScroll || logs.length === 0) return
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }, 50)
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [logs.length, autoScroll])

  // Clear action error after 5s
  useEffect(() => {
    if (!actionError) return
    const t = setTimeout(() => setActionError(null), 5000)
    return () => clearTimeout(t)
  }, [actionError])

  const handleStart = async (): Promise<void> => {
    if (!id) return
    setActionLoading(true)
    setActionError(null)
    setLogs([])
    try {
      await window.api.odoo.start(id)
    } catch (err) {
      setActionLoading(false)
      setActionError(err instanceof Error ? err.message : 'Failed to start instance')
    }
  }

  const handleStop = async (): Promise<void> => {
    if (!id) return
    setActionLoading(true)
    setActionError(null)
    try {
      await window.api.odoo.stop(id)
    } catch (err) {
      setActionLoading(false)
      setActionError(err instanceof Error ? err.message : 'Failed to stop instance')
    }
  }

  const handleRestart = async (): Promise<void> => {
    if (!id) return
    setActionLoading(true)
    setActionError(null)
    setLogs([])
    try {
      await window.api.odoo.restart(id)
    } catch (err) {
      setActionLoading(false)
      setActionError(err instanceof Error ? err.message : 'Failed to restart instance')
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!id || !instance) return
    const confirmed = window.confirm(
      `Delete "${instance.name}"? This will remove all files and the database.`
    )
    if (!confirmed) return

    try {
      if (instance.status === 'running' || instance.status === 'starting') {
        await window.api.odoo.stop(id)
      }
      await window.api.odoo.delete(id)
      navigate('/')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete instance')
    }
  }

  const handleOpenFolder = (): void => {
    if (instance) {
      window.api.shell.openPath(instance.basePath)
    }
  }

  if (loading || !instance) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <div className="flex items-center gap-2 mt-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const isRunning = instance.status === 'running'
  const isBusy = instance.status === 'starting' || instance.status === 'stopping'

  return (
    <div className="flex flex-col flex-1 gap-6">
      {/* Instance status bar */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Circle
              size={8}
              className={cn('fill-current', statusColors[instance.status])}
            />
            <span className="text-sm text-muted-foreground">
              {statusLabels[instance.status]}
            </span>
            <span className="text-sm text-muted-foreground">
              &middot; Odoo {instance.version}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md capitalize',
                instance.edition === 'enterprise'
                  ? 'bg-coral/15 text-coral dark:text-peach'
                  : 'bg-slate-medium/15 text-slate-medium dark:text-[#94a3b8]'
              )}
            >
              {instance.edition}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isRunning && !isBusy && (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Start
              </button>
            )}
            {isRunning && (
              <>
                <button
                  onClick={handleRestart}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <RotateCw size={14} />
                  Restart
                </button>
                <button
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Square size={14} />
                  )}
                  Stop
                </button>
              </>
            )}
            {isBusy && (
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                {statusLabels[instance.status]}
              </div>
            )}
            {isRunning && (
              <a
                href={`http://localhost:${instance.httpPort}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border text-primary hover:bg-accent transition-colors"
              >
                <ExternalLink size={14} />
                Open
              </a>
            )}
          </div>
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-xs hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div>
        <ToggleGroup value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
          {([
            { key: 'overview', icon: Info, label: 'Overview' },
            { key: 'logs', icon: Terminal, label: 'Logs' },
            { key: 'config', icon: Settings, label: 'Configuration' },
            { key: 'addons', icon: Package, label: 'Addons' },
            { key: 'shell', icon: TerminalSquare, label: 'Shell' },
            { key: 'claude', icon: Bot, label: 'Claude' }
          ] as const).map((tab) => (
            <ToggleGroupItem key={tab.key} value={tab.key}>
              <tab.icon size={14} />
              {tab.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab instance={instance} onDelete={handleDelete} onOpenFolder={handleOpenFolder} />
      )}
      {activeTab === 'logs' && (
        <LogsTab
          logs={logs}
          logsEndRef={logsEndRef}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
          onClear={() => setLogs([])}
        />
      )}
      {activeTab === 'config' && (
        <ConfigTab instance={instance} onOpenFolder={handleOpenFolder} />
      )}
      {activeTab === 'addons' && (
        <AddonsTab instance={instance} />
      )}
      {/* Shell tab: always mounted, hidden when inactive to preserve session */}
      <div className={cn('flex-1 min-h-0', activeTab !== 'shell' && 'hidden')}>
        {id && <ShellTab instanceId={id} />}
      </div>
      {/* Claude tab: always mounted, hidden when inactive */}
      <div className={cn('flex-1 min-h-0', activeTab !== 'claude' && 'hidden')}>
        {id && <ClaudePanel instanceId={id} />}
      </div>
    </div>
  )
}

/* --- Tab Components --- */

function OverviewTab({
  instance,
  onDelete,
  onOpenFolder
}: {
  instance: OdooInstance
  onDelete: () => void
  onOpenFolder: () => void
}) {
  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="border rounded-xl overflow-hidden">
        {/* Server & Database */}
        <OverviewSection title="Server">
          <OverviewRow label="HTTP Port" value={String(instance.httpPort)} mono />
          <OverviewRow label="Longpolling Port" value={String(instance.longpollingPort)} mono />
          <OverviewRow label="Status" value={statusLabels[instance.status]} />
        </OverviewSection>

        <OverviewSection title="Database">
          <OverviewRow label="Name" value={instance.dbName} mono />
          <OverviewRow label="User" value={instance.dbUser} mono />
          <OverviewRow label="Host" value={`${instance.dbHost}:${instance.dbPort}`} mono />
        </OverviewSection>

        <OverviewSection title="Environment">
          <OverviewRow label="Python" value={instance.pythonVersion} mono />
          <OverviewRow label="Python Path" value={instance.pythonPath} mono />
          <OverviewRow label="Venv" value={instance.venvPath} mono />
        </OverviewSection>

        <OverviewSection title="Paths">
          <OverviewRow label="Base" value={instance.basePath} mono />
          <OverviewRow label="Odoo" value={instance.odooPath} mono />
          {instance.enterprisePath && (
            <OverviewRow label="Enterprise" value={instance.enterprisePath} mono />
          )}
          <OverviewRow label="Config" value={instance.configPath} mono />
        </OverviewSection>
      </div>

      <div className="mt-auto flex items-center justify-between py-3">
        <span className="text-xs text-muted-foreground">
          Created {new Date(instance.createdAt).toLocaleDateString()}
          {instance.lastStartedAt && (
            <> &middot; Last started {new Date(instance.lastStartedAt).toLocaleDateString()}</>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border hover:bg-accent transition-colors"
          >
            <FolderOpen size={12} />
            Open Folder
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={12} />
            Delete Instance
          </button>
        </div>
      </div>
    </div>
  )
}

function LogsTab({
  logs,
  logsEndRef,
  autoScroll,
  onToggleAutoScroll,
  onClear
}: {
  logs: Array<{ line: string; level: string }>
  logsEndRef: React.RefObject<HTMLDivElement | null>
  autoScroll: boolean
  onToggleAutoScroll: () => void
  onClear: () => void
}) {
  const [filter, setFilter] = useState<string>('ALL')
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
  const [copied, setCopied] = useState<'all' | 'selected' | null>(null)

  const filteredLogs =
    filter === 'ALL' ? logs : logs.filter((l) => l.level === filter)

  const handleLineClick = (index: number, e: React.MouseEvent): void => {
    // Don't interfere with text selection
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) return

    setSelectedLines((prev) => {
      const next = new Set(prev)

      if (e.shiftKey && lastClickedIndex !== null) {
        // Range select
        const start = Math.min(lastClickedIndex, index)
        const end = Math.max(lastClickedIndex, index)
        for (let i = start; i <= end; i++) {
          next.add(i)
        }
      } else if (e.metaKey || e.ctrlKey) {
        // Toggle single line
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
      } else {
        // Single click: if already selected alone, deselect; otherwise select only this
        if (next.size === 1 && next.has(index)) {
          next.clear()
        } else {
          next.clear()
          next.add(index)
        }
      }

      return next
    })
    setLastClickedIndex(index)
  }

  const copyToClipboard = async (text: string, type: 'all' | 'selected'): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCopyAll = (): void => {
    const text = filteredLogs.map((l) => l.line).join('\n')
    copyToClipboard(text, 'all')
  }

  const handleCopySelected = (): void => {
    const sorted = Array.from(selectedLines).sort((a, b) => a - b)
    const text = sorted.map((i) => filteredLogs[i]?.line).filter(Boolean).join('\n')
    copyToClipboard(text, 'selected')
  }

  const handleSelectAll = (): void => {
    if (selectedLines.size === filteredLogs.length) {
      setSelectedLines(new Set())
    } else {
      setSelectedLines(new Set(filteredLogs.map((_, i) => i)))
    }
  }

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedLines(new Set())
    setLastClickedIndex(null)
  }, [filter])

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">All levels</option>
            <option value="DEBUG">Debug</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <span className="text-xs text-muted-foreground">
            {filteredLogs.length} lines
          </span>
          {selectedLines.size > 0 && (
            <span className="text-xs text-primary font-medium">
              {selectedLines.size} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedLines.size > 0 && (
            <button
              onClick={handleCopySelected}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {copied === 'selected' ? <CopyCheck size={12} /> : <Copy size={12} />}
              {copied === 'selected' ? 'Copied!' : `Copy ${selectedLines.size} lines`}
            </button>
          )}
          {filteredLogs.length > 0 && (
            <>
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                title={selectedLines.size === filteredLogs.length ? 'Deselect all' : 'Select all'}
              >
                <CheckSquare size={12} />
                {selectedLines.size === filteredLogs.length ? 'Deselect' : 'Select all'}
              </button>
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === 'all' ? <CopyCheck size={12} /> : <Copy size={12} />}
                {copied === 'all' ? 'Copied!' : 'Copy all'}
              </button>
            </>
          )}
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={onToggleAutoScroll}
            className={cn(
              'px-2 py-1 rounded text-xs font-medium transition-colors',
              autoScroll
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={onClear}
            className="px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="bg-[#0d1117] border rounded-xl p-4 flex-1 min-h-0 overflow-y-auto font-mono text-xs leading-5 select-text">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Terminal size={24} className="mx-auto mb-2 opacity-50" />
              <p>No logs yet. Start the instance to see output.</p>
            </div>
          </div>
        ) : (
          <>
            {filteredLogs.map((log, i) => (
              <div
                key={i}
                onClick={(e) => handleLineClick(i, e)}
                className={cn(
                  'px-2 -mx-1 rounded cursor-pointer transition-colors',
                  selectedLines.has(i)
                    ? 'bg-primary/20 border-l-2 border-primary'
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                )}
              >
                <span className="text-gray-600 select-none mr-3 inline-block w-10 text-right">
                  {i + 1}
                </span>
                <span className={logLevelColor(log.level)}>{log.line}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>

      {filteredLogs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Click to select a line. Shift+click for range. {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+click to toggle. You can also select text directly to copy.
        </p>
      )}
    </div>
  )
}

/** Odoo config option descriptions for the most common keys */
const ODOO_CONFIG_DESCRIPTIONS: Record<string, string> = {
  addons_path: 'Specify additional addons paths (separated by commas).',
  admin_passwd: 'Master password for the database manager.',
  csv_internal_sep: 'Separator for CSV internal data (default: comma).',
  data_dir: 'Directory where Odoo stores filestore data.',
  db_host: 'Database server hostname.',
  db_maxconn: 'Maximum number of database connections (default 64).',
  db_name: 'Specify the database name.',
  db_password: 'Database password.',
  db_port: 'Database server port.',
  db_sslmode: 'SSL mode for database connection (disable, allow, prefer, require, etc.).',
  db_template: 'Template database for creating new databases (default: template0).',
  db_user: 'Database user name.',
  dbfilter: 'Regex filter to select databases visible per hostname.',
  demo: 'Load demo data. Set empty or False to disable.',
  email_from: 'Default email address for outgoing emails.',
  geoip_city_db: 'Path to the GeoIP city database.',
  geoip_country_db: 'Path to the GeoIP country database.',
  http_enable: 'Enable HTTP server (default True).',
  http_interface: 'IP address to listen on (empty = all interfaces).',
  http_port: 'HTTP port for the Odoo web server.',
  import_partial: 'Path for partial import recovery.',
  limit_memory_hard: 'Maximum allowed virtual memory per worker in bytes (default 2560MiB). Any memory allocation above this will be killed.',
  limit_memory_soft: 'Maximum allowed virtual memory per worker in bytes (default 2048MiB). When reached, the worker will be reset after the current request.',
  limit_request: 'Maximum number of requests processed per worker (default 2048).',
  limit_time_cpu: 'Maximum allowed CPU time per request in seconds (default 60).',
  limit_time_real: 'Maximum allowed real time per request in seconds (default 120).',
  limit_time_real_cron: 'Maximum allowed real time per cron job in seconds (default: limit_time_real * 10).',
  list_db: 'Disable the ability to list databases (True/False). Also disables access to the database manager and selector.',
  log_db: 'Log to database. True, False, or a database name.',
  log_db_level: 'Minimum log level for database logging (default: warning).',
  log_handler: 'Set specific log handler levels (e.g., werkzeug:WARNING).',
  log_level: 'General log level: debug, info, warning, error, critical.',
  logfile: 'Path to log file. Empty for stdout.',
  logrotate: 'Enable log rotation (True/False).',
  longpolling_port: 'Port for longpolling/gevent (default 8072).',
  max_cron_threads: 'Number of cron worker threads (default 2).',
  osv_memory_age_limit: 'Maximum age of transient records in hours (default 1.0).',
  osv_memory_count_limit: 'Maximum number of transient records per model.',
  pg_path: 'Path to PostgreSQL client binaries (pg_dump, etc.).',
  pidfile: 'Path to the PID file.',
  proxy_mode: 'Activate reverse proxy WSGI wrappers (headers rewriting). Only enable behind a trusted proxy.',
  reportgz: 'Compress report data (True/False).',
  screencasts: 'Path to store screencasts.',
  screenshots: 'Path to store screenshots.',
  server_wide_modules: 'Comma-separated list of server-wide modules (default: base,web).',
  smtp_password: 'SMTP password.',
  smtp_port: 'SMTP port (default 25).',
  smtp_server: 'SMTP server hostname.',
  smtp_ssl: 'Enable SMTP SSL (True/False).',
  smtp_ssl_certificate_filename: 'Path to SMTP SSL certificate.',
  smtp_ssl_private_key_filename: 'Path to SMTP SSL private key.',
  smtp_user: 'SMTP user name.',
  syslog: 'Send logs to syslog (True/False).',
  test_enable: 'Enable YAML and unit tests (True/False).',
  test_file: 'Launch a file-specific test.',
  test_tags: 'Comma-separated test tags to filter tests.',
  transient_age_limit: 'Maximum age for transient records in hours.',
  translate_modules: 'Modules to export translations for.',
  unaccent: 'Enable unaccent function in PostgreSQL searches (True/False).',
  upgrade_path: 'Additional upgrade path for module migrations.',
  websocket_keep_alive_timeout: 'WebSocket keep-alive timeout in seconds.',
  websocket_rate_limit_burst: 'WebSocket rate limit burst.',
  websocket_rate_limit_delay: 'WebSocket rate limit delay in seconds.',
  without_demo: 'Disable demo data loading (comma-separated modules or "all").',
  workers: 'Number of worker processes (default 0 = no multiprocessing).',
  x_sendfile: 'Enable X-Sendfile header for static files (True/False).'
}

/** Keys always visible (most commonly edited) */
const COMMON_CONFIG_KEYS = [
  'addons_path', 'admin_passwd', 'db_host', 'db_port', 'db_user', 'db_password',
  'db_name', 'http_port', 'longpolling_port', 'data_dir', 'log_level', 'logfile',
  'workers', 'proxy_mode', 'list_db', 'limit_time_cpu', 'limit_time_real',
  'limit_memory_hard', 'limit_memory_soft', 'server_wide_modules', 'without_demo'
]

function ConfigTab({
  instance,
  onOpenFolder
}: {
  instance: OdooInstance
  onOpenFolder: () => void
}) {
  const [configEntries, setConfigEntries] = useState<Array<{ key: string; value: string }>>([])
  const [originalRaw, setOriginalRaw] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load config from file
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.api.odoo.readConfig(instance.id).then((raw) => {
      if (cancelled) return
      setOriginalRaw(raw)
      setConfigEntries(parseOdooConf(raw))
      setLoading(false)
    }).catch((err) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to read config')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [instance.id])

  const handleValueChange = (key: string, value: string): void => {
    setConfigEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, value } : e))
    )
    setHasChanges(true)
    setSaved(false)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const content = serializeOdooConf(configEntries)
      await window.api.odoo.writeConfig(instance.id, content)
      setOriginalRaw(content)
      setHasChanges(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = (): void => {
    setConfigEntries(parseOdooConf(originalRaw))
    setHasChanges(false)
  }

  // Determine which entries to display
  const displayEntries = showAll
    ? configEntries
    : configEntries.filter((e) => COMMON_CONFIG_KEYS.includes(e.key))

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-12 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium">Odoo Instance Config</h3>
            <span className="text-xs text-muted-foreground font-mono">{instance.configPath}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <button
                onClick={() => setShowAll(!showAll)}
                className={cn(
                  'w-8 h-4 rounded-full relative transition-colors',
                  showAll ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                    showAll ? 'left-[18px]' : 'left-0.5'
                  )}
                />
              </button>
              Show all configuration options
            </label>
            <button
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border hover:bg-accent transition-colors"
            >
              <FolderOpen size={12} />
              Open Folder
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[minmax(200px,2fr)_minmax(200px,3fr)] px-5 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Name</span>
          <span>Value</span>
        </div>

        {/* Config rows */}
        <div className="divide-y">
          {displayEntries.map((entry) => {
            const description = ODOO_CONFIG_DESCRIPTIONS[entry.key]
            return (
              <div
                key={entry.key}
                className="grid grid-cols-[minmax(200px,2fr)_minmax(200px,3fr)] px-5 py-3 items-start hover:bg-muted/20 transition-colors"
              >
                <div className="pr-4">
                  <div className="text-sm font-medium">{entry.key}</div>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    value={entry.value}
                    onChange={(e) => handleValueChange(entry.key, e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-background transition-colors"
                  />
                </div>
              </div>
            )
          })}

          {displayEntries.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No configuration entries found.
            </div>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle size={12} />
              {error}
            </div>
          )}
          {saved && (
            <span className="text-xs text-green-600 font-medium">
              Configuration saved. Restart the instance to apply changes.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border hover:bg-accent transition-colors"
            >
              <RotateCcw size={12} />
              Discard changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors',
              hasChanges && !saving
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* --- Config parsing utilities --- */

function parseOdooConf(raw: string): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    // Skip comments, section headers, and empty lines
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('[')) {
      continue
    }
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (key) entries.push({ key, value })
  }
  return entries
}

function serializeOdooConf(entries: Array<{ key: string; value: string }>): string {
  let content = '[options]\n'
  for (const { key, value } of entries) {
    content += `${key} = ${value}\n`
  }
  return content
}

/* --- Addons Tab --- */

function AddonsTab({ instance }: { instance: OdooInstance }) {
  const [repos, setRepos] = useState<AddonRepo[]>(instance.addonRepos || [])
  const [showAddForm, setShowAddForm] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [repoBranch, setRepoBranch] = useState('')
  const [isCloning, setIsCloning] = useState(false)
  const [cloneProgress, setCloneProgress] = useState({ message: '', percent: 0 })
  const [error, setError] = useState<string | null>(null)
  const [pullingId, setPullingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Load repos on mount
  useEffect(() => {
    window.api.addons.list(instance.id).then(setRepos).catch(() => {})
  }, [instance.id])

  // Listen for clone progress
  useEffect(() => {
    const unsub = window.api.on.addonsCloneProgress((data) => {
      if (data.instanceId === instance.id) {
        setCloneProgress({ message: data.message, percent: data.percent })
      }
    })
    return unsub
  }, [instance.id])

  // Listen for pull progress
  useEffect(() => {
    const unsub = window.api.on.addonsPullProgress((data) => {
      if (data.instanceId === instance.id) {
        // Could show per-repo progress, for now just track which repo is pulling
      }
    })
    return unsub
  }, [instance.id])

  const handleAddRepo = async (): Promise<void> => {
    const url = repoUrl.trim()
    const branch = repoBranch.trim() || 'main'
    if (!url) return

    setIsCloning(true)
    setError(null)
    setCloneProgress({ message: 'Starting clone...', percent: 0 })

    try {
      const repo = await window.api.addons.add(instance.id, url, branch)
      setRepos((prev) => [...prev.filter((r) => r.id !== repo.id), repo])
      setRepoUrl('')
      setRepoBranch('')
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone repository')
    } finally {
      setIsCloning(false)
      setCloneProgress({ message: '', percent: 0 })
    }
  }

  const handleRemoveRepo = async (repoId: string): Promise<void> => {
    try {
      await window.api.addons.remove(instance.id, repoId)
      setRepos((prev) => prev.filter((r) => r.id !== repoId))
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove repository')
    }
  }

  const handlePullRepo = async (repoId: string): Promise<void> => {
    setPullingId(repoId)
    try {
      await window.api.addons.pull(instance.id, repoId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull repository')
    } finally {
      setPullingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Custom Addons</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage git repositories with custom Odoo modules
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); setError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={12} />
            Add Repository
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertCircle size={14} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive">
            <span className="text-xs">dismiss</span>
          </button>
        </div>
      )}

      {/* Add repo form */}
      {showAddForm && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h4 className="text-sm font-medium mb-3">Add Git Repository</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="git@github.com:user/repo.git or https://..."
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isCloning}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Branch
              </label>
              <input
                type="text"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
                placeholder="main"
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isCloning}
              />
            </div>

            {/* Clone progress */}
            {isCloning && (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${cloneProgress.percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {cloneProgress.message || 'Cloning...'}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddRepo}
                disabled={isCloning || !repoUrl.trim()}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isCloning || !repoUrl.trim()
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {isCloning ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    Clone
                  </>
                )}
              </button>
              {!isCloning && (
                <button
                  onClick={() => { setShowAddForm(false); setError(null) }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Repos list */}
      {repos.length > 0 ? (
        <div className="space-y-2">
          {repos.map((repo) => (
            <AddonRepoCard
              key={repo.id}
              repo={repo}
              instanceId={instance.id}
              pullingId={pullingId}
              confirmDeleteId={confirmDeleteId}
              onPull={handlePullRepo}
              onRemove={handleRemoveRepo}
              onConfirmDelete={setConfirmDeleteId}
              onBranchChanged={(repoId, newBranch) => {
                setRepos((prev) => prev.map((r) =>
                  r.id === repoId ? { ...r, branch: newBranch } : r
                ))
              }}
              onError={setError}
            />
          ))}
        </div>
      ) : !showAddForm ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Package size={32} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">No custom addons</p>
          <p className="text-xs mt-1 max-w-xs">
            Add git repositories with custom Odoo modules. They will be cloned into the extra-addons folder and the addons path will be updated automatically.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function AddonRepoCard({
  repo,
  instanceId,
  pullingId,
  confirmDeleteId,
  onPull,
  onRemove,
  onConfirmDelete,
  onBranchChanged,
  onError
}: {
  repo: AddonRepo
  instanceId: string
  pullingId: string | null
  confirmDeleteId: string | null
  onPull: (repoId: string) => void
  onRemove: (repoId: string) => void
  onConfirmDelete: (repoId: string | null) => void
  onBranchChanged: (repoId: string, newBranch: string) => void
  onError: (msg: string) => void
}) {
  const [showBranchPicker, setShowBranchPicker] = useState(false)
  const [branches, setBranches] = useState<{ local: string[]; remote: string[]; current: string } | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [switchingBranch, setSwitchingBranch] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    if (!showBranchPicker) return
    const handler = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowBranchPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showBranchPicker])

  const handleOpenBranchPicker = async (): Promise<void> => {
    if (showBranchPicker) {
      setShowBranchPicker(false)
      return
    }
    setShowBranchPicker(true)
    setLoadingBranches(true)
    try {
      const result = await window.api.addons.listBranches(instanceId, repo.id)
      setBranches(result)
      // Sync displayed branch if it changed externally (e.g. Claude switched it)
      if (result.current !== repo.branch) {
        onBranchChanged(repo.id, result.current)
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to list branches')
      setShowBranchPicker(false)
    } finally {
      setLoadingBranches(false)
    }
  }

  const handleSwitchBranch = async (branch: string): Promise<void> => {
    if (branch === branches?.current) {
      setShowBranchPicker(false)
      return
    }
    setSwitchingBranch(true)
    try {
      const actualBranch = await window.api.addons.switchBranch(instanceId, repo.id, branch)
      onBranchChanged(repo.id, actualBranch)
      setBranches((prev) => prev ? { ...prev, current: actualBranch } : prev)
      setShowBranchPicker(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to switch branch')
    } finally {
      setSwitchingBranch(false)
    }
  }

  const handleRefreshBranch = async (): Promise<void> => {
    try {
      const current = await window.api.addons.refreshBranch(instanceId, repo.id)
      onBranchChanged(repo.id, current)
    } catch {
      // silent
    }
  }

  return (
    <div className="border rounded-lg p-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Package size={14} className="text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{repo.name}</span>

            {/* Branch badge — clickable to open picker */}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={handleOpenBranchPicker}
                disabled={repo.status !== 'ready' || switchingBranch}
                className={cn(
                  'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors shrink-0',
                  repo.status === 'ready'
                    ? 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <GitBranch size={10} />
                {switchingBranch ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  repo.branch
                )}
                {repo.status === 'ready' && <ChevronDown size={10} />}
              </button>

              {/* Branch picker dropdown */}
              {showBranchPicker && (
                <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-60 overflow-y-auto bg-popover border rounded-lg shadow-lg">
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      Loading branches...
                    </div>
                  ) : branches ? (
                    <div>
                      {branches.local.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50">
                            Local
                          </div>
                          {branches.local.map((b) => (
                            <button
                              key={`local-${b}`}
                              onClick={() => handleSwitchBranch(b)}
                              className={cn(
                                'w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-accent transition-colors',
                                b === branches.current && 'text-primary font-medium'
                              )}
                            >
                              <span className="truncate">{b}</span>
                              {b === branches.current && <Check size={12} className="text-primary shrink-0" />}
                            </button>
                          ))}
                        </>
                      )}
                      {branches.remote.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50">
                            Remote
                          </div>
                          {branches.remote.map((b) => (
                            <button
                              key={`remote-${b}`}
                              onClick={() => handleSwitchBranch(b)}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                            >
                              <span className="truncate">{b}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {branches.local.length === 0 && branches.remote.length === 0 && (
                        <div className="px-3 py-3 text-xs text-muted-foreground">No branches found</div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Refresh branch button (detects if Claude changed branch externally) */}
            {repo.status === 'ready' && (
              <button
                onClick={handleRefreshBranch}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh current branch"
              >
                <RefreshCw size={11} />
              </button>
            )}

            {repo.status === 'cloning' && (
              <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                <Loader2 size={10} className="animate-spin" />
                Cloning
              </span>
            )}
            {repo.status === 'error' && (
              <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                <AlertCircle size={10} />
                Error
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate font-mono">{repo.url}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Added {formatAddonDate(repo.addedAt)}
          </p>
          {repo.error && (
            <p className="text-xs text-destructive mt-1">{repo.error}</p>
          )}
        </div>
        {repo.status === 'ready' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onPull(repo.id)}
              disabled={pullingId === repo.id}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border hover:bg-accent transition-colors disabled:opacity-50"
            >
              {pullingId === repo.id ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Download size={11} />
              )}
              Pull
            </button>
            {confirmDeleteId === repo.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onRemove(repo.id)}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => onConfirmDelete(null)}
                  className="px-2 py-1 rounded-md text-xs font-medium border hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => onConfirmDelete(repo.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
              >
                <Trash2Icon size={11} />
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatAddonDate(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/* --- Helper Components --- */

function OverviewSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="px-4 py-2 bg-muted/30">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  )
}

function OverviewRow({
  label,
  value,
  mono
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2 text-sm items-baseline">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          'break-all',
          mono && 'font-mono text-xs'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function logLevelColor(level: string): string {
  switch (level) {
    case 'ERROR':
    case 'CRITICAL':
      return 'text-red-400'
    case 'WARNING':
      return 'text-yellow-400'
    case 'DEBUG':
      return 'text-gray-500'
    default:
      return 'text-gray-300'
  }
}
