import { useState, useEffect, useCallback } from 'react'
import type { OdooInstance, InstanceStatus } from '@shared/types/odoo'
import clodooLogo from '@/assets/clodoo-logo.svg'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail
} from '@/components/ui/sidebar'
import { NavMain } from './nav-main'
import { NavInstances } from './nav-instances'
import { NavSecondary } from './nav-secondary'

const isMac = navigator.platform.toLowerCase().includes('mac')

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [instances, setInstances] = useState<OdooInstance[]>([])

  const fetchInstances = useCallback(async () => {
    try {
      const list = await window.api.odoo.list()
      setInstances(list)
    } catch (err) {
      console.error('Failed to fetch instances for sidebar:', err)
    }
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

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader className={isMac ? 'pt-8' : ''}>
        <div className="drag-region flex items-center gap-2.5 px-1 py-1.5">
          <img src={clodooLogo} alt="Clodoo" className="size-6 no-drag" />
          <span className="font-semibold text-sm truncate">Clodoo</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        <NavInstances instances={instances} />
        <NavSecondary />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
