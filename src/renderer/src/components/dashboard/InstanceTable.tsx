import { useNavigate } from 'react-router-dom'
import { Play, Square, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { OdooInstance, InstanceStatus } from '@shared/types/odoo'

const statusDotColors: Record<InstanceStatus, string> = {
  running: 'bg-green-500',
  starting: 'bg-yellow-500 animate-pulse',
  stopping: 'bg-yellow-500 animate-pulse',
  stopped: 'bg-gray-400',
  error: 'bg-red-500'
}

const statusLabels: Record<InstanceStatus, string> = {
  stopped: 'Stopped',
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  error: 'Error'
}

const editionColors = {
  community: 'bg-slate-medium/15 text-slate-medium dark:text-[#94a3b8]',
  enterprise: 'bg-coral/15 text-coral dark:text-peach'
} as const

interface InstanceTableProps {
  instances: OdooInstance[]
  onDelete: (id: string) => void
  onStart: (id: string) => void
  onStop: (id: string) => void
  deleting: string | null
}

export function InstanceTable({
  instances,
  onDelete,
  onStart,
  onStop,
  deleting
}: InstanceTableProps) {
  const navigate = useNavigate()

  if (instances.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No instances.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {instances.map((inst) => {
        const isRunning = inst.status === 'running'
        const isStopped = inst.status === 'stopped' || inst.status === 'error'
        const isBusy = inst.status === 'starting' || inst.status === 'stopping'

        return (
          <div
            key={inst.id}
            onClick={() => navigate(`/instance/${inst.id}`)}
            className={cn(
              'flex items-center gap-4 px-4 py-3 rounded-lg border bg-card cursor-pointer hover:border-primary/40 transition-colors',
              deleting === inst.id && 'opacity-50'
            )}
          >
            {/* Status dot + label */}
            <div className="flex items-center gap-2 w-24 shrink-0">
              <span className={cn('size-2 rounded-full shrink-0', statusDotColors[inst.status])} />
              <span className="text-xs text-muted-foreground">{statusLabels[inst.status]}</span>
            </div>

            {/* Name */}
            <span className="font-medium text-sm truncate min-w-0 flex-1">
              {inst.name}
            </span>

            {/* Version */}
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              {inst.version}
            </span>

            {/* Edition badge */}
            <Badge
              variant="outline"
              className={cn('capitalize text-[10px] shrink-0', editionColors[inst.edition])}
            >
              {inst.edition}
            </Badge>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
              {!isBusy && isStopped && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                  onClick={() => onStart(inst.id)}
                >
                  <Play size={14} />
                </Button>
              )}
              {!isBusy && isRunning && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"
                  onClick={() => onStop(inst.id)}
                >
                  <Square size={14} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(inst.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
