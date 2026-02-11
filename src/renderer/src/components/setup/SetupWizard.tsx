import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  ArrowRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import clodooLogo from '@/assets/clodoo-logo.svg'
import type { DependencyStatus, InstallResult } from '@shared/types/dependency'

type CheckState = 'idle' | 'checking' | 'done'

interface InstallState {
  dependencyId: string
  status: 'installing' | 'success' | 'error'
  message: string
  percent: number
  error?: string
}

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([])
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({})

  const allInstalled = dependencies.length > 0 && dependencies.every((d) => d.installed)

  const runChecks = useCallback(async () => {
    setCheckState('checking')
    try {
      const results = await window.api.dependency.checkAll()
      setDependencies(results)
    } catch (err) {
      console.error('Dependency check failed:', err)
    }
    setCheckState('done')
  }, [])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  // Listen for install progress
  useEffect(() => {
    const unsub = window.api.on.dependencyInstallProgress((data) => {
      setInstallStates((prev) => ({
        ...prev,
        [data.dependencyId]: {
          dependencyId: data.dependencyId,
          status: 'installing',
          message: data.message,
          percent: data.percent
        }
      }))
    })
    return unsub
  }, [])

  const handleInstall = async (depId: string): Promise<void> => {
    setInstallStates((prev) => ({
      ...prev,
      [depId]: { dependencyId: depId, status: 'installing', message: 'Starting...', percent: 0 }
    }))

    try {
      const result: InstallResult = await window.api.dependency.install(depId)
      if (result.success) {
        setInstallStates((prev) => ({
          ...prev,
          [depId]: { ...prev[depId], status: 'success', message: 'Installed!', percent: 100 }
        }))
        // Re-check after install
        setTimeout(runChecks, 1000)
      } else {
        setInstallStates((prev) => ({
          ...prev,
          [depId]: {
            ...prev[depId],
            status: 'error',
            message: result.error || 'Installation failed',
            error: result.manualInstructions
          }
        }))
      }
    } catch (err) {
      setInstallStates((prev) => ({
        ...prev,
        [depId]: {
          ...prev[depId],
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error'
        }
      }))
    }
  }

  const handleContinue = async (): Promise<void> => {
    await window.api.settings.completeFirstLaunch()
    onComplete()
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center p-8 relative">
      {/* Drag region for window dragging */}
      <div className="drag-region absolute top-0 left-0 right-0 h-12" />
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <img src={clodooLogo} alt="Clodoo" className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-semibold">Welcome to Clodoo</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Let's check that all required dependencies are installed.
          </p>
        </div>

        {/* Dependency List */}
        <div className="bg-card border rounded-xl overflow-hidden mb-6">
          {checkState === 'checking' && dependencies.length === 0 ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Checking dependencies...</span>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {dependencies.map((dep) => (
                <DependencyRow
                  key={dep.id}
                  dep={dep}
                  installState={installStates[dep.id]}
                  onInstall={() => handleInstall(dep.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={runChecks}
            disabled={checkState === 'checking'}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={checkState === 'checking' ? 'animate-spin' : ''} />
            Re-check
          </button>

          <button
            onClick={handleContinue}
            disabled={!allInstalled}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-colors',
              allInstalled
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </div>

        {!allInstalled && checkState === 'done' && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Install all required dependencies to continue.
          </p>
        )}
      </div>
    </div>
  )
}

function DependencyRow({
  dep,
  installState,
  onInstall
}: {
  dep: DependencyStatus
  installState?: InstallState
  onInstall: () => void
}) {
  const isInstalling = installState?.status === 'installing'
  const installError = installState?.status === 'error'

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {dep.installed ? (
            <CheckCircle2 size={18} className="text-green-500 shrink-0" />
          ) : (
            <XCircle size={18} className="text-red-500 shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{dep.name}</span>
              {dep.version && (
                <span className="text-xs text-muted-foreground">{dep.version}</span>
              )}
            </div>
            {!dep.installed && dep.installInstructions && !isInstalling && !installError && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dep.installInstructions}
              </p>
            )}
            {isInstalling && (
              <div className="mt-1">
                <p className="text-xs text-muted-foreground truncate max-w-xs">
                  {installState.message}
                </p>
                <div className="w-48 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${installState.percent}%` }}
                  />
                </div>
              </div>
            )}
            {installError && (
              <div className="flex items-start gap-1.5 mt-1">
                <AlertCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-red-500">{installState.message}</p>
                  {installState.error && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {installState.error}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {!dep.installed && dep.canAutoInstall && !isInstalling && (
          <button
            onClick={onInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Download size={12} />
            Install
          </button>
        )}

        {isInstalling && (
          <Loader2 size={16} className="animate-spin text-primary shrink-0" />
        )}
      </div>
    </li>
  )
}
