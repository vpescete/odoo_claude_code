import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Plus, LayoutGrid, List } from 'lucide-react'
import type { OdooInstance, InstanceStatus } from '@shared/types/odoo'
import { InstanceCard } from '../instance/InstanceCard'
import { SectionCards } from './SectionCards'
import { InstanceTable } from './InstanceTable'
import { Skeleton } from '../ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'

type ViewMode = 'cards' | 'table'

function getStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem('dashboard_view_mode')
    if (stored === 'cards' || stored === 'table') return stored
  } catch {}
  return 'cards'
}

export function Dashboard() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState<OdooInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode)

  const handleViewModeChange = (value: string): void => {
    const mode = value as ViewMode
    setViewMode(mode)
    try {
      localStorage.setItem('dashboard_view_mode', mode)
    } catch {}
  }

  const fetchInstances = useCallback(async () => {
    try {
      const list = await window.api.odoo.list()
      setInstances(list)
    } catch (err) {
      console.error('Failed to fetch instances:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  // Re-fetch when instances are created or deleted
  useEffect(() => {
    const unsub = window.api.on.odooInstancesChanged(() => {
      fetchInstances()
    })
    return unsub
  }, [fetchInstances])

  // Listen for real-time status changes
  useEffect(() => {
    const unsub = window.api.on.odooStatusChanged((data) => {
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === data.instanceId
            ? { ...inst, status: data.status as InstanceStatus }
            : inst
        )
      )
    })
    return unsub
  }, [])

  const handleStart = async (id: string): Promise<void> => {
    try {
      await window.api.odoo.start(id)
    } catch (err) {
      console.error('Failed to start instance:', err)
    }
  }

  const handleStop = async (id: string): Promise<void> => {
    try {
      await window.api.odoo.stop(id)
    } catch (err) {
      console.error('Failed to stop instance:', err)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    const instance = instances.find((i) => i.id === id)
    if (!instance) return

    const confirmed = window.confirm(
      `Delete "${instance.name}"? This will remove all files and the database.`
    )
    if (!confirmed) return

    setDeleting(id)
    try {
      await window.api.odoo.delete(id)
      setInstances((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      console.error('Failed to delete instance:', err)
    }
    setDeleting(null)
  }

  const handleClick = (id: string): void => {
    navigate(`/instance/${id}`)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 @sm/main:grid-cols-2 @xl/main:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-12" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCards instances={instances} />

      {instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Box size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">No instances yet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first Odoo instance to get started.
          </p>
          <button
            onClick={() => navigate('/new-instance')}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            Create Instance
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <ToggleGroup value={viewMode} onValueChange={handleViewModeChange}>
              <ToggleGroupItem value="cards" aria-label="Card view">
                <LayoutGrid className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view">
                <List className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 @sm/main:grid-cols-2 @lg/main:grid-cols-3 gap-4">
              {instances.map((instance) => (
                <div key={instance.id} className={deleting === instance.id ? 'opacity-50' : ''}>
                  <InstanceCard
                    instance={instance}
                    onDelete={handleDelete}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>
          ) : (
            <InstanceTable
              instances={instances}
              onDelete={handleDelete}
              onStart={handleStart}
              onStop={handleStop}
              deleting={deleting}
            />
          )}
        </>
      )}
    </div>
  )
}
