import { useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { Settings, Sun, Moon } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from '@/components/ui/sidebar'

export function NavSecondary() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  // Sync if something else changes the class (e.g. Settings page)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    return () => observer.disconnect()
  }, [])

  const toggleTheme = useCallback(async () => {
    const next = isDark ? 'light' : 'dark'
    const html = document.documentElement
    if (next === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    setIsDark(next === 'dark')
    await window.api.settings.update({ theme: next })

    // Sync title bar overlay colors on Windows
    window.api.window.setTitleBarOverlay(
      next === 'dark'
        ? { color: '#080d19', symbolColor: '#94a3b8' }
        : { color: '#f1f5f9', symbolColor: '#334155' }
    )
  }, [isDark])

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isDark ? 'Light mode' : 'Dark mode'}
              onClick={toggleTheme}
            >
              {isDark ? <Sun /> : <Moon />}
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <NavLink to="/settings">
                {({ isActive }) => (
                  <>
                    <Settings className={isActive ? 'text-sidebar-primary' : ''} />
                    <span>Settings</span>
                  </>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
