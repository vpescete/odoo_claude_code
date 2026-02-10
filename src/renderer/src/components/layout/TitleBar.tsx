import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const isMac = navigator.platform.toLowerCase().includes('mac')

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    const unsub = window.api.window.onMaximizeChange(setIsMaximized)
    return unsub
  }, [])

  if (isMac) {
    // macOS uses native traffic lights, just need a drag region
    return (
      <div className="drag-region relative z-50 h-10 flex items-center pl-20 pr-4 bg-sidebar border-b border-sidebar-border">
        <span className="text-xs font-medium text-muted-foreground">Clodoo</span>
      </div>
    )
  }

  // Windows/Linux custom title bar
  return (
    <div className="drag-region relative z-50 h-10 flex items-center justify-between px-4 bg-sidebar border-b border-sidebar-border">
      <span className="text-xs font-medium text-muted-foreground">Clodoo</span>
      <div className="no-drag flex items-center gap-0.5">
        <button
          onClick={() => window.api.window.minimize()}
          className="p-1.5 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.api.window.maximize()}
          className="p-1.5 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {isMaximized ? <Copy size={14} /> : <Square size={14} />}
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="p-1.5 rounded-sm hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
