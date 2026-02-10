import { useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Dashboard } from './components/dashboard/Dashboard'
import { SettingsPage } from './components/settings/SettingsPage'
import { SetupWizard } from './components/setup/SetupWizard'
import { CreateInstanceDialog } from './components/instance/CreateInstanceDialog'
import { InstanceDetail } from './components/instance/InstanceDetail'

function applyTheme(theme: string): void {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else if (theme === 'light') {
    html.classList.remove('dark')
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.classList.toggle('dark', prefersDark)
  }
}

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null)

  // Apply theme from settings on load
  useEffect(() => {
    window.api.settings.get().then((s) => {
      applyTheme(s.theme || 'dark')
    })
  }, [])

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      window.api.settings.get().then((s) => {
        if (s.theme === 'system') applyTheme('system')
      })
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    window.api.settings.isFirstLaunch().then(setIsFirstLaunch)
  }, [])

  const handleSetupComplete = useCallback(() => {
    setIsFirstLaunch(false)
  }, [])

  // Loading state
  if (isFirstLaunch === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isFirstLaunch) {
    return (
      <HashRouter>
        <SetupWizard onComplete={handleSetupComplete} />
      </HashRouter>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-instance" element={<CreateInstanceDialog />} />
          <Route path="/instance/:id" element={<InstanceDetail />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
