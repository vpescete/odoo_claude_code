import { Circle, Trash2, ExternalLink, Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OdooInstance, InstanceStatus } from '@shared/types/odoo'

interface InstanceCardProps {
  instance: OdooInstance
  onDelete: (id: string) => void
  onClick: (id: string) => void
}

const statusColors: Record<InstanceStatus, string> = {
  stopped: 'text-gray-400',
  starting: 'text-yellow-500 animate-pulse',
  running: 'text-green-500',
  stopping: 'text-yellow-500 animate-pulse',
  error: 'text-red-500'
}

const editionColors = {
  community: 'bg-slate-medium/15 text-slate-medium dark:text-[#94a3b8]',
  enterprise: 'bg-coral/15 text-coral dark:text-peach'
} as const

export function InstanceCard({ instance, onDelete, onClick }: InstanceCardProps) {
  const isRunning = instance.status === 'running'
  const isStopped = instance.status === 'stopped'
  const isBusy = instance.status === 'starting' || instance.status === 'stopping'

  const handleQuickAction = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (isRunning) {
      await window.api.odoo.stop(instance.id)
    } else if (isStopped || instance.status === 'error') {
      await window.api.odoo.start(instance.id)
    }
  }

  return (
    <Card
      onClick={() => onClick(instance.id)}
      className="cursor-pointer hover:border-primary/40 transition-colors group py-4 gap-3"
    >
      <CardHeader className="px-4 gap-1">
        <div className="flex items-center gap-2">
          <Circle
            size={8}
            className={cn('fill-current shrink-0', statusColors[instance.status])}
          />
          <CardTitle className="text-sm truncate">{instance.name}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', editionColors[instance.edition])}>
            {instance.edition}
          </Badge>
          <span className="text-xs text-muted-foreground">v{instance.version}</span>
        </div>
      </CardHeader>

      <CardContent className="px-4">
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Port</span>
            <span className="font-mono">{instance.httpPort}</span>
          </div>
          <div className="flex justify-between">
            <span>Database</span>
            <span className="font-mono">{instance.dbName}</span>
          </div>
          <div className="flex justify-between">
            <span>Python</span>
            <span className="font-mono">{instance.pythonVersion}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            {!isBusy && (
              <button
                onClick={handleQuickAction}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  isRunning
                    ? 'text-red-500 hover:bg-red-500/10'
                    : 'text-green-500 hover:bg-green-500/10'
                )}
              >
                {isRunning ? <Square size={14} /> : <Play size={14} />}
              </button>
            )}
            {isRunning && (
              <a
                href={`http://localhost:${instance.httpPort}`}
                onClick={(e) => e.stopPropagation()}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(instance.id)
            }}
            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
