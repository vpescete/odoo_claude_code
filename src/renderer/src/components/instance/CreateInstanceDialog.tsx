import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Server,
  Lock,
  Circle,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OdooVersion, OdooEdition, CreateInstanceArgs } from '@shared/types/odoo'
import { SUPPORTED_VERSIONS } from '@shared/constants/odooVersions'
import {
  DEFAULT_HTTP_PORT,
  DEFAULT_LONGPOLLING_PORT,
  DEFAULT_DB_HOST,
  DEFAULT_DB_PORT,
  DEFAULT_DB_USER
} from '@shared/constants/defaults'

const STEPS = ['Project', 'Database', 'Server', 'Review'] as const

interface FormData {
  name: string
  version: OdooVersion
  edition: OdooEdition
  dbName: string
  dbUser: string
  dbPassword: string
  dbHost: string
  dbPort: number
  httpPort: number
  longpollingPort: number
}

type CreationState = 'idle' | 'creating' | 'success' | 'error'

type StepStatus = 'pending' | 'active' | 'done' | 'error'

interface CreationStep {
  key: string
  label: string
  status: StepStatus
  message: string
  percentStart: number
  percentEnd: number
}

const CREATION_STEPS: Array<{ key: string; label: string; percentStart: number; percentEnd: number }> = [
  { key: 'directory', label: 'Creating project directory', percentStart: 0, percentEnd: 5 },
  { key: 'clone', label: 'Cloning Odoo Community', percentStart: 5, percentEnd: 30 },
  { key: 'clone-enterprise', label: 'Cloning Odoo Enterprise', percentStart: 30, percentEnd: 40 },
  { key: 'venv', label: 'Creating virtual environment', percentStart: 40, percentEnd: 45 },
  { key: 'pip', label: 'Installing Python dependencies', percentStart: 45, percentEnd: 60 },
  { key: 'database', label: 'Creating database', percentStart: 60, percentEnd: 62 },
  { key: 'config', label: 'Generating configuration', percentStart: 62, percentEnd: 65 },
  { key: 'init-db', label: 'Initializing database', percentStart: 65, percentEnd: 96 },
  { key: 'saving', label: 'Saving instance', percentStart: 96, percentEnd: 100 },
  { key: 'done', label: 'Done', percentStart: 100, percentEnd: 100 }
]

export function CreateInstanceDialog() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [creationState, setCreationState] = useState<CreationState>('idle')
  const [creationMessage, setCreationMessage] = useState('')
  const [creationPercent, setCreationPercent] = useState(0)
  const [creationError, setCreationError] = useState('')
  const [creationSteps, setCreationSteps] = useState<CreationStep[]>([])
  const [stepPercent, setStepPercent] = useState(0)
  const [hasGithubToken, setHasGithubToken] = useState(false)

  const [form, setForm] = useState<FormData>({
    name: '',
    version: '18.0',
    edition: 'community',
    dbName: '',
    dbUser: DEFAULT_DB_USER,
    dbPassword: '',
    dbHost: DEFAULT_DB_HOST,
    dbPort: DEFAULT_DB_PORT,
    httpPort: DEFAULT_HTTP_PORT,
    longpollingPort: DEFAULT_LONGPOLLING_PORT
  })

  // Check if GitHub token is configured
  useEffect(() => {
    window.api.settings.getGitHubTokenExists().then(setHasGithubToken)
  }, [])

  // Listen for creation progress
  useEffect(() => {
    const unsub = window.api.on.odooCreationProgress((data) => {
      setCreationMessage(data.message)
      setCreationPercent(data.percent)

      const stepKey = data.step
      if (!stepKey) return

      // Compute per-step percent from the global percent and the step's range
      const stepDef = CREATION_STEPS.find((s) => s.key === stepKey)
      if (stepDef) {
        const range = stepDef.percentEnd - stepDef.percentStart
        const localPct = range > 0
          ? Math.min(100, Math.round(((data.percent - stepDef.percentStart) / range) * 100))
          : 100
        setStepPercent(Math.max(0, localPct))
      }

      setCreationSteps((prev) => {
        const activeIdx = prev.findIndex((p) => p.key === stepKey)
        if (activeIdx === -1) return prev

        return prev.map((s, i) => {
          if (i < activeIdx) {
            return s.status !== 'done' ? { ...s, status: 'done' as StepStatus, message: '' } : s
          }
          if (i === activeIdx) {
            return {
              ...s,
              status: (stepKey === 'done' ? 'done' : 'active') as StepStatus,
              message: data.message
            }
          }
          return s
        })
      })
    })
    return unsub
  }, [])

  const updateForm = (updates: Partial<FormData>): void => {
    setForm((f) => ({ ...f, ...updates }))
  }

  const canGoNext = (): boolean => {
    switch (STEPS[currentStep]) {
      case 'Project':
        return form.name.trim().length > 0
      case 'Database':
        return form.dbName.trim().length > 0 && form.dbUser.trim().length > 0
      case 'Server':
        return form.httpPort > 0 && form.longpollingPort > 0
      case 'Review':
        return true
      default:
        return false
    }
  }

  const handleCreate = async (): Promise<void> => {
    setCreationState('creating')
    setCreationMessage('Starting...')
    setCreationPercent(0)

    // Initialize steps based on edition
    const steps = CREATION_STEPS.filter(
      (s) => s.key !== 'clone-enterprise' || form.edition === 'enterprise'
    ).map((s) => ({ ...s, status: 'pending' as StepStatus, message: '' }))
    setCreationSteps(steps)
    setStepPercent(0)

    try {
      const args: CreateInstanceArgs = {
        name: form.name.trim(),
        version: form.version,
        edition: form.edition,
        httpPort: form.httpPort,
        longpollingPort: form.longpollingPort,
        dbName: form.dbName.trim(),
        dbUser: form.dbUser.trim(),
        dbPassword: form.dbPassword,
        dbHost: form.dbHost,
        dbPort: form.dbPort
      }

      await window.api.odoo.create(args)
      setCreationState('success')
      setCreationMessage('Instance created successfully!')
      setCreationPercent(100)
      setCreationSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as StepStatus })))
    } catch (err) {
      setCreationState('error')
      setCreationError(err instanceof Error ? err.message : 'Unknown error')
      // Mark the active step as error
      setCreationSteps((prev) =>
        prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' as StepStatus } : s))
      )
    }
  }

  if (creationState !== 'idle') {
    return (
      <div className="py-8 px-12">
        {/* Header */}
        <div className="text-center mb-8">
          {creationState === 'creating' && (
            <>
              <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
              <h2 className="text-xl font-semibold">Creating Instance</h2>
            </>
          )}
          {creationState === 'success' && (
            <>
              <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-semibold">Instance Created!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your Odoo {form.version} instance &quot;{form.name}&quot; is ready.
              </p>
            </>
          )}
          {creationState === 'error' && (
            <>
              <AlertCircle size={32} className="text-red-500 mx-auto mb-3" />
              <h2 className="text-xl font-semibold">Creation Failed</h2>
              <p className="text-sm text-red-500 mt-1">{creationError}</p>
            </>
          )}
        </div>

        {/* Step cards */}
        <div className="space-y-2 mb-8">
          {creationSteps.map((step) => (
            <div
              key={step.key}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors',
                step.status === 'done' && 'border-green-500/40 bg-green-500/5',
                step.status === 'active' && 'border-primary/60 bg-primary/5',
                step.status === 'error' && 'border-red-500/40 bg-red-500/5',
                step.status === 'pending' && 'border-border/50 opacity-50'
              )}
            >
              <div className="shrink-0">
                {step.status === 'done' && <Check size={16} className="text-green-500" />}
                {step.status === 'active' && <Loader2 size={16} className="text-primary animate-spin" />}
                {step.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                {step.status === 'pending' && <Circle size={16} className="text-muted-foreground/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn(
                    'text-sm font-medium',
                    step.status === 'pending' && 'text-muted-foreground'
                  )}>
                    {step.label}
                  </p>
                  {step.status === 'active' && (
                    <span className="text-xs text-muted-foreground shrink-0">{stepPercent}%</span>
                  )}
                </div>
                {step.status === 'active' && (
                  <>
                    <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${stepPercent}%` }}
                      />
                    </div>
                    {step.message && (
                      <p className="text-xs text-muted-foreground truncate mt-1">{step.message}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {(creationState === 'success' || creationState === 'error') && (
          <div className="flex gap-3 justify-center">
            {creationState === 'error' && (
              <button
                onClick={() => setCreationState('idle')}
                className="px-4 py-2 rounded-md text-sm font-medium border hover:bg-accent transition-colors"
              >
                Try Again
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="py-4 px-12">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <h1 className="text-2xl font-semibold">New Odoo Instance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1.5 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= currentStep ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        {STEPS[currentStep] === 'Project' && (
          <StepProject form={form} onChange={updateForm} hasGithubToken={hasGithubToken} />
        )}
        {STEPS[currentStep] === 'Database' && (
          <StepDatabase form={form} onChange={updateForm} />
        )}
        {STEPS[currentStep] === 'Server' && (
          <StepServer form={form} onChange={updateForm} />
        )}
        {STEPS[currentStep] === 'Review' && <StepReview form={form} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-0"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={!canGoNext()}
            className={cn(
              'flex items-center gap-1 px-5 py-2.5 rounded-md text-sm font-medium transition-colors',
              canGoNext()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Next
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Server size={14} />
            Create Instance
          </button>
        )}
      </div>
    </div>
  )
}

/* --- Step Components --- */

function StepProject({
  form,
  onChange,
  hasGithubToken
}: {
  form: FormData
  onChange: (u: Partial<FormData>) => void
  hasGithubToken: boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Project Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) =>
            onChange({
              name: e.target.value,
              dbName: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
            })
          }
          placeholder="my-odoo-project"
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Odoo Version</label>
        <select
          value={form.version}
          onChange={(e) => onChange({ version: e.target.value as OdooVersion })}
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {[...SUPPORTED_VERSIONS].reverse().map((v) => (
            <option key={v} value={v}>
              Odoo {v}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Edition</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChange({ edition: 'community' })}
            className={cn(
              'py-2.5 px-3 rounded-md border text-sm font-medium transition-colors',
              form.edition === 'community'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input hover:bg-accent'
            )}
          >
            Community
          </button>
          <button
            onClick={() => {
              if (hasGithubToken) onChange({ edition: 'enterprise' })
            }}
            disabled={!hasGithubToken}
            className={cn(
              'py-2.5 px-3 rounded-md border text-sm font-medium transition-colors relative',
              !hasGithubToken && 'opacity-50 cursor-not-allowed',
              form.edition === 'enterprise'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input hover:bg-accent'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              {!hasGithubToken && <Lock size={13} />}
              Enterprise
            </span>
          </button>
        </div>
        {!hasGithubToken && (
          <p className="text-xs text-muted-foreground mt-2">
            Enterprise requires a GitHub token.{' '}
            <button
              onClick={() => navigate('/settings')}
              className="text-primary hover:underline"
            >
              Configure in Settings
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

function StepDatabase({
  form,
  onChange
}: {
  form: FormData
  onChange: (u: Partial<FormData>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Database Name</label>
        <input
          type="text"
          value={form.dbName}
          onChange={(e) => onChange({ dbName: e.target.value })}
          placeholder="my_odoo_db"
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">DB User</label>
          <input
            type="text"
            value={form.dbUser}
            onChange={(e) => onChange({ dbUser: e.target.value })}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">DB Password</label>
          <input
            type="password"
            value={form.dbPassword}
            onChange={(e) => onChange({ dbPassword: e.target.value })}
            placeholder="(empty for local)"
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">DB Host</label>
          <input
            type="text"
            value={form.dbHost}
            onChange={(e) => onChange({ dbHost: e.target.value })}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">DB Port</label>
          <input
            type="number"
            value={form.dbPort}
            onChange={(e) => onChange({ dbPort: parseInt(e.target.value, 10) || 5432 })}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </div>
  )
}

function StepServer({
  form,
  onChange
}: {
  form: FormData
  onChange: (u: Partial<FormData>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">HTTP Port</label>
          <input
            type="number"
            value={form.httpPort}
            onChange={(e) => onChange({ httpPort: parseInt(e.target.value, 10) || 8069 })}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Odoo will be accessible at localhost:{form.httpPort}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Longpolling Port</label>
          <input
            type="number"
            value={form.longpollingPort}
            onChange={(e) => onChange({ longpollingPort: parseInt(e.target.value, 10) || 8072 })}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </div>
  )
}

function StepReview({ form }: { form: FormData }) {
  return (
    <div className="-m-6 overflow-hidden rounded-xl">
      <ReviewSection title="Project">
        <ReviewRow label="Name" value={form.name} />
        <ReviewRow label="Version" value={`Odoo ${form.version}`} />
        <ReviewRow label="Edition" value={form.edition} />
      </ReviewSection>
      <ReviewSection title="Database">
        <ReviewRow label="Name" value={form.dbName} />
        <ReviewRow label="User" value={form.dbUser} />
        <ReviewRow label="Password" value={form.dbPassword || '(none)'} />
        <ReviewRow label="Host" value={`${form.dbHost}:${form.dbPort}`} />
      </ReviewSection>
      <ReviewSection title="Server">
        <ReviewRow label="HTTP Port" value={String(form.httpPort)} />
        <ReviewRow label="Longpolling Port" value={String(form.longpollingPort)} />
      </ReviewSection>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b last:border-b-0">
      <div className="px-6 py-2 bg-muted/30">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-6 py-2.5 text-sm items-baseline">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  )
}
