import { useState, useEffect } from 'react'
import { Circle, Box } from 'lucide-react'

export function StatusBar() {
  const [runningCount, setRunningCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [version, setVersion] = useState('')

  // Fetch app version
  useEffect(() => {
    window.api.app.getVersion().then(setVersion)
  }, [])

  // Fetch initial counts
  useEffect(() => {
    window.api.odoo.list().then((instances) => {
      setTotalCount(instances.length)
      setRunningCount(instances.filter((i) => i.status === 'running').length)
    })
  }, [])

  // Update on status changes
  useEffect(() => {
    const unsub = window.api.on.odooStatusChanged(() => {
      window.api.odoo.list().then((instances) => {
        setTotalCount(instances.length)
        setRunningCount(instances.filter((i) => i.status === 'running').length)
      })
    })
    return unsub
  }, [])

  const isMac = navigator.platform.includes('Mac')
  const mod = isMac ? '\u2318' : 'Ctrl'

  return (
    <footer className="h-6 px-4 flex items-center justify-between bg-sidebar border-t border-sidebar-border text-[11px] text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Circle size={7} className="fill-green-500 text-green-500" />
          Ready
        </span>
        {totalCount > 0 && (
          <span className="flex items-center gap-1">
            <Box size={10} />
            {runningCount > 0
              ? `${runningCount}/${totalCount} running`
              : `${totalCount} instance${totalCount > 1 ? 's' : ''}`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="opacity-60">
          {mod}+N new &middot; {mod}+, settings &middot; Esc back
        </span>
        {version && <span>v{version}</span>}
      </div>
    </footer>
  )
}
