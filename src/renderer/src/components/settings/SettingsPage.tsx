import { useState, useEffect, useCallback } from 'react'
import {
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  FolderOpen,
  Github,
  Bot,
  Database,
  LogIn,
  LogOut,
  Key,
  User,
  ExternalLink,
  ChevronDown,
  Wrench,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent
} from '@/components/ui/collapsible'
import { SUPPORTED_VERSIONS } from '@shared/constants/odooVersions'
import type { OdooVersion, OdooEdition } from '@shared/types/odoo'
import type { AppSettings } from '@shared/types/settings'
import type { ClaudeAuthStatus } from '@shared/types/claude'

type AuthTab = 'account' | 'api-key'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Credential states
  const [hasApiKey, setHasApiKey] = useState(false)
  const [hasGithubToken, setHasGithubToken] = useState(false)

  // Auth status
  const [authStatus, setAuthStatus] = useState<ClaudeAuthStatus | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [authTab, setAuthTab] = useState<AuthTab>('account')

  // Token login states
  const [accountToken, setAccountToken] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)

  // Input states
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [githubTokenInput, setGithubTokenInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showGithubToken, setShowGithubToken] = useState(false)
  const [showAccountToken, setShowAccountToken] = useState(false)

  // Saving states
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [savingGithubToken, setSavingGithubToken] = useState(false)
  const [savedField, setSavedField] = useState<string | null>(null)

  // Python paths state
  const [pythonPaths, setPythonPaths] = useState<Record<string, string>>({})

  // Advanced section
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const loadSettings = useCallback(async () => {
    const [s, apiKey, ghToken] = await Promise.all([
      window.api.settings.get(),
      window.api.settings.getApiKeyExists(),
      window.api.settings.getGitHubTokenExists()
    ])
    setSettings(s)
    setHasApiKey(apiKey)
    setHasGithubToken(ghToken)
    setPythonPaths(s.pythonPaths || {})
    setLoading(false)
  }, [])

  const checkAuthStatus = useCallback(async () => {
    setCheckingAuth(true)
    try {
      const status = await window.api.claude.checkAuth()
      setAuthStatus(status)
      if (status.method === 'api-key') {
        setAuthTab('api-key')
      }
    } catch {
      setAuthStatus({ authenticated: false, method: 'none' })
    } finally {
      setCheckingAuth(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
    checkAuthStatus()
  }, [loadSettings, checkAuthStatus])

  const showSaved = (field: string): void => {
    setSavedField(field)
    setTimeout(() => setSavedField(null), 2000)
  }

  const updateSetting = async (updates: Partial<AppSettings>): Promise<void> => {
    await window.api.settings.update(updates)
    setSettings((s) => (s ? { ...s, ...updates } : s))

    if (updates.theme) {
      const html = document.documentElement
      if (updates.theme === 'dark') {
        html.classList.add('dark')
      } else if (updates.theme === 'light') {
        html.classList.remove('dark')
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        html.classList.toggle('dark', prefersDark)
      }
    }
  }

  const handleSaveApiKey = async (): Promise<void> => {
    if (!apiKeyInput.trim()) return
    setSavingApiKey(true)
    await window.api.settings.setApiKey(apiKeyInput.trim())
    setHasApiKey(true)
    setApiKeyInput('')
    setSavingApiKey(false)
    showSaved('apiKey')
    checkAuthStatus()
  }

  const handleRemoveApiKey = async (): Promise<void> => {
    await window.api.settings.removeApiKey()
    setHasApiKey(false)
    showSaved('apiKey')
    checkAuthStatus()
  }

  const handleLoginWithToken = async (): Promise<void> => {
    if (!accountToken.trim()) return
    setLoggingIn(true)
    setLoginError(null)
    setLoginSuccess(false)

    try {
      const result = await window.api.claude.loginWithToken(accountToken.trim())
      if (result.success) {
        setLoginSuccess(true)
        setAccountToken('')
        await checkAuthStatus()
        setTimeout(() => setLoginSuccess(false), 3000)
      } else {
        setLoginError(result.error || 'Login failed')
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async (): Promise<void> => {
    await window.api.claude.logout()
    setHasApiKey(false)
    setAuthStatus({ authenticated: false, method: 'none' })
  }

  const handleSaveGithubToken = async (): Promise<void> => {
    if (!githubTokenInput.trim()) return
    setSavingGithubToken(true)
    await window.api.settings.setGitHubToken(githubTokenInput.trim())
    setHasGithubToken(true)
    setGithubTokenInput('')
    setSavingGithubToken(false)
    showSaved('githubToken')
  }

  const handleRemoveGithubToken = async (): Promise<void> => {
    await window.api.settings.removeGitHubToken()
    setHasGithubToken(false)
    showSaved('githubToken')
  }

  const handleSelectWorkspace = async (): Promise<void> => {
    const dir = await window.api.dialog.selectDirectory()
    if (dir) {
      updateSetting({ workspacePath: dir })
    }
  }

  const handleSelectPostgresPath = async (): Promise<void> => {
    const dir = await window.api.dialog.selectDirectory()
    if (dir) {
      updateSetting({ postgresPath: dir })
    }
  }

  const handlePythonPathChange = (version: string, path: string): void => {
    const updated = { ...pythonPaths, [version]: path }
    if (!path) {
      delete updated[version]
    }
    setPythonPaths(updated)
    updateSetting({ pythonPaths: updated })
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your workspace, authentication, and application preferences.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">

      {/* 1. Authentication */}
      <Card className="border-2 col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key size={16} />
            Authentication
          </CardTitle>
          <CardDescription>
            Connect your Claude account or API key to use AI features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status banner */}
          {checkingAuth && !authStatus ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-input bg-muted/30">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Checking authentication...
              </span>
            </div>
          ) : authStatus?.authenticated ? (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-md border border-green-500/30 bg-green-500/5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center">
                  {authStatus.method === 'oauth' ? (
                    <User size={12} className="text-green-600" />
                  ) : (
                    <Key size={12} className="text-green-600" />
                  )}
                </div>
                <span className="text-sm font-medium">Connected</span>
                {authStatus.accountEmail && (
                  <span className="text-xs text-muted-foreground">
                    {authStatus.accountEmail}
                  </span>
                )}
                <Badge variant="success">
                  {authStatus.method === 'oauth' ? 'Account' : 'API Key'}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut size={12} />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-yellow-500/30 bg-yellow-500/5">
              <div className="w-6 h-6 rounded-full bg-yellow-500/15 flex items-center justify-center">
                <AlertCircle size={12} className="text-yellow-600" />
              </div>
              <span className="text-sm text-yellow-700 dark:text-yellow-400">
                Not authenticated
              </span>
            </div>
          )}

          {/* Login tabs — only when not authenticated */}
          {(!authStatus?.authenticated || authStatus.method === 'none') && (
            <>
              <ToggleGroup
                value={authTab}
                onValueChange={(v) => setAuthTab(v as AuthTab)}
              >
                <ToggleGroupItem value="account">
                  <User size={12} />
                  Account
                </ToggleGroupItem>
                <ToggleGroupItem value="api-key">
                  <Key size={12} />
                  API Key
                </ToggleGroupItem>
              </ToggleGroup>

              {authTab === 'account' && (
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-md p-3 space-y-2">
                    <p className="text-xs font-medium">
                      Login with your Claude account (Pro/Max)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Opens the browser to authenticate via claude.ai. Requires Claude Code CLI installed.
                    </p>
                  </div>

                  <Button
                    onClick={async () => {
                      setLoggingIn(true)
                      setLoginError(null)
                      setLoginSuccess(false)
                      try {
                        const result = await window.api.claude.loginOAuth()
                        if (result.success) {
                          setLoginSuccess(true)
                          await checkAuthStatus()
                        } else {
                          setLoginError(result.error || 'OAuth login failed')
                        }
                      } catch {
                        setLoginError('Failed to start OAuth login')
                      } finally {
                        setLoggingIn(false)
                      }
                    }}
                    disabled={loggingIn}
                    className="w-full"
                  >
                    {loggingIn ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ExternalLink size={14} />
                    )}
                    {loggingIn ? 'Waiting for browser login...' : 'Login with Browser'}
                  </Button>

                  <Separator />

                  <div className="space-y-1.5">
                    <label className="block text-xs text-muted-foreground">
                      Or paste a token from{' '}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          window.open?.('https://console.anthropic.com')
                        }}
                        className="text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
                      >
                        Anthropic Console <ExternalLink size={10} />
                      </a>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showAccountToken ? 'text' : 'password'}
                          value={accountToken}
                          onChange={(e) => {
                            setAccountToken(e.target.value)
                            setLoginError(null)
                          }}
                          placeholder="Paste your authentication token..."
                          className="pr-9 font-mono"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleLoginWithToken()
                          }}
                        />
                        <button
                          onClick={() => setShowAccountToken(!showAccountToken)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showAccountToken ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleLoginWithToken}
                        disabled={!accountToken.trim() || loggingIn}
                      >
                        {loggingIn ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <LogIn size={14} />
                        )}
                        Login
                      </Button>
                    </div>
                  </div>

                  {loginError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                      <X size={12} />
                      {loginError}
                    </div>
                  )}

                  {loginSuccess && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/30 text-xs text-green-600">
                      <Check size={12} />
                      Successfully connected to your Claude account
                    </div>
                  )}
                </div>
              )}

              {authTab === 'api-key' && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Use an Anthropic API key for pay-per-use access. Get your key from
                    the{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        window.open?.('https://console.anthropic.com/settings/keys')
                      }}
                      className="text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-center gap-0.5"
                    >
                      Anthropic Console <ExternalLink size={10} />
                    </a>
                    .
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">API Key</label>
                    {hasApiKey ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-9 flex items-center gap-2 px-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
                            <Check size={14} className="text-green-500" />
                            API key configured
                          </div>
                          {savedField === 'apiKey' && (
                            <Badge variant="success">Saved</Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveApiKey}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <X size={12} />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="sk-ant-xxxxxxxxxxxxxxxxxxxx"
                            className="pr-9 font-mono"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveApiKey()
                            }}
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                        </div>
                        <Button
                          onClick={handleSaveApiKey}
                          disabled={!apiKeyInput.trim() || savingApiKey}
                        >
                          {savingApiKey ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. Claude Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot size={16} />
            Claude Code
          </CardTitle>
          <CardDescription>
            Default model and session limits for Claude Code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Model</label>
            <select
              value={settings.claudeModel}
              onChange={(e) => updateSetting({ claudeModel: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            </select>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">
              Budget per Session (USD)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={settings.claudeMaxBudgetUsd ?? ''}
                onChange={(e) =>
                  updateSetting({
                    claudeMaxBudgetUsd: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined
                  })
                }
                placeholder="No limit"
                className="w-32"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Max Turns</label>
            <Input
              type="number"
              min="1"
              value={settings.claudeMaxTurns ?? ''}
              onChange={(e) =>
                updateSetting({
                  claudeMaxTurns: e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined
                })
              }
              placeholder="No limit"
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. Workspace & Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen size={16} />
            Workspace & Projects
          </CardTitle>
          <CardDescription>
            Default workspace path and project settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Workspace Path</label>
            <p className="text-xs text-muted-foreground">
              Root directory where Odoo instances are stored.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={settings.workspacePath}
                onChange={(e) => updateSetting({ workspacePath: e.target.value })}
                className="flex-1 font-mono"
              />
              <Button variant="outline" size="icon" onClick={handleSelectWorkspace}>
                <FolderOpen size={14} />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Default Odoo Version</label>
            <ToggleGroup
              value={settings.defaultOdooVersion}
              onValueChange={(v) =>
                updateSetting({ defaultOdooVersion: v as OdooVersion })
              }
            >
              {SUPPORTED_VERSIONS.map((v) => (
                <ToggleGroupItem key={v} value={v}>
                  {v}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Default Edition</label>
            <ToggleGroup
              value={settings.defaultEdition}
              onValueChange={(v) =>
                updateSetting({ defaultEdition: v as OdooEdition })
              }
            >
              <ToggleGroupItem value="community">Community</ToggleGroupItem>
              <ToggleGroupItem value="enterprise">Enterprise</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* 5. GitHub */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github size={16} />
            GitHub
          </CardTitle>
          <CardDescription>
            GitHub credentials for cloning repositories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Username</label>
            <Input
              value={settings.githubUsername ?? ''}
              onChange={(e) =>
                updateSetting({
                  githubUsername: e.target.value || undefined
                })
              }
              placeholder="username"
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">
              Personal Access Token
            </label>
            <p className="text-xs text-muted-foreground">
              Required for cloning Odoo Enterprise repositories. Create a token with
              &apos;repo&apos; scope at github.com/settings/tokens.
            </p>
            {hasGithubToken ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 flex items-center gap-2 px-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
                    <Check size={14} className="text-green-500" />
                    Token configured
                  </div>
                  {savedField === 'githubToken' && (
                    <Badge variant="success">Saved</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveGithubToken}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <X size={12} />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showGithubToken ? 'text' : 'password'}
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="pr-9 font-mono"
                  />
                  <button
                    onClick={() => setShowGithubToken(!showGithubToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGithubToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <Button
                  onClick={handleSaveGithubToken}
                  disabled={!githubTokenInput.trim() || savingGithubToken}
                >
                  {savingGithubToken ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 6. Database */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database size={16} />
            Database
          </CardTitle>
          <CardDescription>
            PostgreSQL configuration and default connection settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">PostgreSQL Path</label>
            <div className="flex items-center gap-2">
              <Input
                value={settings.postgresPath ?? ''}
                onChange={(e) =>
                  updateSetting({ postgresPath: e.target.value || undefined })
                }
                placeholder="/usr/local/pgsql"
                className="flex-1 font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSelectPostgresPath}
              >
                <FolderOpen size={14} />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium">
                Auto-start PostgreSQL
              </label>
              <p className="text-xs text-muted-foreground">
                Start PostgreSQL automatically when the app launches.
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting({ autoStartPostgres: !settings.autoStartPostgres })
              }
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                settings.autoStartPostgres ? 'bg-primary' : 'bg-input'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                  settings.autoStartPostgres ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">DB User</label>
              <Input
                value={settings.defaultDbUser}
                onChange={(e) => updateSetting({ defaultDbUser: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">DB Host</label>
              <Input
                value={settings.defaultDbHost}
                onChange={(e) => updateSetting({ defaultDbHost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">DB Port</label>
            <Input
              type="number"
              value={settings.defaultDbPort}
              onChange={(e) =>
                updateSetting({
                  defaultDbPort: parseInt(e.target.value, 10) || 5432
                })
              }
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* 7. Advanced (Collapsible) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="col-span-2">
        <Card>
          <CardHeader className="pb-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-0 hover:bg-transparent"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Wrench size={16} />
                  Advanced
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    'text-muted-foreground transition-transform',
                    advancedOpen && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CardDescription>
              Python paths, logging, and other advanced settings.
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Python Paths per Version
                </label>
                <p className="text-xs text-muted-foreground">
                  Override the Python binary path for each Odoo version.
                </p>
                <div className="space-y-2">
                  {SUPPORTED_VERSIONS.map((v) => (
                    <div
                      key={v}
                      className="grid grid-cols-[80px_1fr_auto] items-center gap-2"
                    >
                      <span className="text-sm text-muted-foreground">{v}</span>
                      <Input
                        value={pythonPaths[v] || ''}
                        onChange={(e) => handlePythonPathChange(v, e.target.value)}
                        placeholder={`/usr/bin/python3`}
                        className="font-mono"
                      />
                      {pythonPaths[v] && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePythonPathChange(v, '')}
                          className="text-muted-foreground"
                        >
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Logs Retention (days)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={settings.logsRetentionDays}
                  onChange={(e) =>
                    updateSetting({
                      logsRetentionDays: parseInt(e.target.value, 10) || 7
                    })
                  }
                  className="w-32"
                />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium">Max Log Lines</label>
                <Input
                  type="number"
                  min="100"
                  value={settings.maxLogLines}
                  onChange={(e) =>
                    updateSetting({
                      maxLogLines: parseInt(e.target.value, 10) || 5000
                    })
                  }
                  className="w-32"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      </div>{/* end grid */}
    </div>
  )
}
