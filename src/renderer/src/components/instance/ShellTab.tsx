import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { TerminalSquare, RotateCw, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import '@xterm/xterm/css/xterm.css'

export function ShellTab({ instanceId }: { instanceId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'exited'>('idle')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const startShell = useCallback(async () => {
    setStatus('starting')
    setError(null)
    try {
      await window.api.odoo.shellStart(instanceId)
      setStatus('running')
    } catch (err) {
      setStatus('exited')
      setError(err instanceof Error ? err.message : 'Failed to start shell')
    }
  }, [instanceId])

  const stopShell = useCallback(async () => {
    try {
      await window.api.odoo.shellStop(instanceId)
    } catch {
      // ignore
    }
  }, [instanceId])

  const restartShell = useCallback(async () => {
    await stopShell()
    termRef.current?.clear()
    await startShell()
  }, [stopShell, startShell])

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      }
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    // Small delay to ensure DOM is sized before fitting
    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Forward user input to the PTY
    term.onData((data) => {
      window.api.odoo.shellWrite(instanceId, data)
    })

    // Listen for PTY output
    const unsubOutput = window.api.on.odooShellOutput((ev) => {
      if (ev.instanceId === instanceId) {
        term.write(ev.data)
      }
    })

    // Listen for PTY exit
    const unsubExit = window.api.on.odooShellExit((ev) => {
      if (ev.instanceId === instanceId) {
        setStatus('exited')
        term.write('\r\n\x1b[90m--- Shell terminated ---\x1b[0m\r\n')
      }
    })

    // ResizeObserver for auto-fit
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
          if (termRef.current) {
            const { cols, rows } = termRef.current
            window.api.odoo.shellResize(instanceId, cols, rows).catch(() => {})
          }
        }
      })
    })
    observer.observe(terminalRef.current)

    // Auto-start the shell on mount
    if (!startedRef.current) {
      startedRef.current = true
      setStatus('starting')
      setError(null)
      window.api.odoo.shellStart(instanceId).then(() => {
        setStatus('running')
      }).catch((err) => {
        setStatus('exited')
        setError(err instanceof Error ? err.message : 'Failed to start shell')
      })
    }

    return () => {
      observer.disconnect()
      unsubOutput()
      unsubExit()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      window.api.odoo.shellStop(instanceId).catch(() => {})
    }
  }, [instanceId])

  return (
    <div className="relative flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <TerminalSquare size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium">Odoo Shell</span>
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              status === 'running' && 'bg-green-500/10 text-green-500',
              status === 'starting' && 'bg-yellow-500/10 text-yellow-500',
              status === 'exited' && 'bg-gray-500/10 text-gray-400',
              status === 'idle' && 'bg-gray-500/10 text-gray-400'
            )}
          >
            {status === 'running' && 'Connected'}
            {status === 'starting' && 'Connecting...'}
            {status === 'exited' && 'Disconnected'}
            {status === 'idle' && 'Idle'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {status === 'running' && (
            <button
              onClick={stopShell}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Square size={12} />
              Stop
            </button>
          )}
          {status === 'starting' && (
            <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Connecting...
            </div>
          )}
          {(status === 'exited' || status === 'idle') && (
            <button
              onClick={startShell}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <TerminalSquare size={12} />
              Start
            </button>
          )}
          {status === 'running' && (
            <button
              onClick={restartShell}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RotateCw size={12} />
              Restart
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-b text-xs text-destructive shrink-0">
          {error}
        </div>
      )}

      {/* Terminal — absolute fill so xterm can't push the layout */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={terminalRef}
          className="absolute inset-0"
          style={{ backgroundColor: '#0d1117', padding: '8px' }}
        />
      </div>
    </div>
  )
}
