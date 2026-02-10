import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { OdooInstance, InstanceStatus } from '@shared/types/odoo'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar'

const statusDotColors: Record<InstanceStatus, string> = {
  running: 'bg-green-500',
  starting: 'bg-yellow-500 animate-pulse',
  stopping: 'bg-yellow-500 animate-pulse',
  stopped: 'bg-gray-400',
  error: 'bg-red-500'
}

interface NavInstancesProps {
  instances: OdooInstance[]
}

export function NavInstances({ instances }: NavInstancesProps) {
  if (instances.length === 0) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Instances</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {instances.map((inst) => (
            <SidebarMenuItem key={inst.id}>
              <SidebarMenuButton asChild tooltip={inst.name}>
                <NavLink to={`/instance/${inst.id}`}>
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          statusDotColors[inst.status]
                        )}
                      />
                      <span className={cn('flex-1 truncate', isActive && 'font-medium')}>
                        {inst.name}
                      </span>
                      <span className="text-[10px] text-sidebar-foreground/50 tabular-nums">
                        {inst.version}
                      </span>
                    </>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
