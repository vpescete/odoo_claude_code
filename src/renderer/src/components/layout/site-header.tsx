import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

function usePageTitle(): string {
  const location = useLocation()
  const [instanceName, setInstanceName] = useState<string>('')

  useEffect(() => {
    const match = location.pathname.match(/^\/instance\/(.+)$/)
    if (match) {
      window.api.odoo.get(match[1]).then((inst) => {
        if (inst) setInstanceName(inst.name)
      })
    }
  }, [location.pathname])

  if (location.pathname === '/') return 'Dashboard'
  if (location.pathname === '/settings') return 'Settings'
  if (location.pathname === '/new-instance') return 'New Instance'
  if (location.pathname.startsWith('/instance/') && instanceName) {
    return instanceName
  }
  return ''
}

export function SiteHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const title = usePageTitle()

  const isDashboard = location.pathname === '/'

  return (
    <header
      data-slot="site-header"
      className="drag-region flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4"
    >
      <SidebarTrigger className="-ml-1 no-drag" />
      <Separator orientation="vertical" className="mx-2 !h-4" />
      <h1 className="text-sm font-medium truncate">{title}</h1>

      <div className="ml-auto flex items-center gap-2 no-drag">
        {isDashboard && (
          <Button size="sm" onClick={() => navigate('/new-instance')}>
            <Plus className="size-4" />
            New Instance
          </Button>
        )}
      </div>
    </header>
  )
}
