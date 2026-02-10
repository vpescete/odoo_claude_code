import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Global keyboard shortcuts:
 * - Cmd/Ctrl+N → New instance
 * - Cmd/Ctrl+, → Settings
 * - Escape → Go back to dashboard (when not on dashboard)
 */
export function useKeyboardShortcuts(): void {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const isMod = e.metaKey || e.ctrlKey

      // Don't capture shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only allow Escape to work inside inputs
        if (e.key !== 'Escape') return
      }

      if (isMod && e.key === 'n') {
        e.preventDefault()
        navigate('/new-instance')
      } else if (isMod && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
      } else if (e.key === 'Escape' && location.pathname !== '/') {
        e.preventDefault()
        navigate('/')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, location.pathname])
}
