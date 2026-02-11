import { Outlet } from 'react-router-dom'
import { StatusBar } from './StatusBar'
import { AppSidebar } from './app-sidebar'
import { SiteHeader } from './site-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export function AppLayout() {
  useKeyboardShortcuts()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <div className="@container/main flex flex-col flex-1 overflow-auto">
              <main className="flex flex-col flex-1 gap-4 p-4 lg:p-6">
                <Outlet />
              </main>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
      <StatusBar />
    </div>
  )
}
