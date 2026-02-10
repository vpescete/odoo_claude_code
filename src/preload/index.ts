import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '@shared/types/settings'
import type { OdooInstance, CreateInstanceArgs } from '@shared/types/odoo'
import type { DependencyStatus, InstallResult } from '@shared/types/dependency'
import type { ClaudeAuthStatus, SessionRecord } from '@shared/types/claude'
import type { AddonRepo } from '@shared/types/addon'
import type { UpdateInfo, UpdateProgress } from '@shared/types/update'

const api = {
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (callback: (maximized: boolean) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, maximized: boolean): void => {
        callback(maximized)
      }
      ipcRenderer.on('window:maximize-changed', handler)
      return () => ipcRenderer.removeListener('window:maximize-changed', handler)
    }
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (updates: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke('settings:update', updates),
    isFirstLaunch: (): Promise<boolean> => ipcRenderer.invoke('settings:is-first-launch'),
    completeFirstLaunch: (): Promise<void> =>
      ipcRenderer.invoke('settings:complete-first-launch'),
    setApiKey: (key: string): Promise<{ valid: boolean }> =>
      ipcRenderer.invoke('settings:set-api-key', { key }),
    getApiKeyExists: (): Promise<boolean> =>
      ipcRenderer.invoke('settings:get-api-key-exists'),
    setGitHubToken: (token: string): Promise<void> =>
      ipcRenderer.invoke('settings:set-github-token', { token }),
    getGitHubTokenExists: (): Promise<boolean> =>
      ipcRenderer.invoke('settings:get-github-token-exists'),
    removeApiKey: (): Promise<void> =>
      ipcRenderer.invoke('settings:remove-api-key'),
    removeGitHubToken: (): Promise<void> =>
      ipcRenderer.invoke('settings:remove-github-token')
  },

  odoo: {
    list: (): Promise<OdooInstance[]> => ipcRenderer.invoke('odoo:list'),
    get: (instanceId: string): Promise<OdooInstance | undefined> =>
      ipcRenderer.invoke('odoo:get', { instanceId }),
    create: (args: CreateInstanceArgs): Promise<OdooInstance> =>
      ipcRenderer.invoke('odoo:create', args),
    delete: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('odoo:delete', { instanceId }),
    start: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('odoo:start', { instanceId }),
    stop: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('odoo:stop', { instanceId }),
    restart: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('odoo:restart', { instanceId }),
    readConfig: (instanceId: string): Promise<string> =>
      ipcRenderer.invoke('odoo:read-config', { instanceId }),
    writeConfig: (instanceId: string, content: string): Promise<void> =>
      ipcRenderer.invoke('odoo:write-config', { instanceId, content }),
    shellStart: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('odoo:shell-start', { instanceId }),
    shellWrite: (instanceId: string, data: string): Promise<void> =>
      ipcRenderer.invoke('odoo:shell-write', { instanceId, data }),
    shellResize: (instanceId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('odoo:shell-resize', { instanceId, cols, rows }),
    shellStop: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('odoo:shell-stop', { instanceId })
  },

  dependency: {
    checkAll: (): Promise<DependencyStatus[]> =>
      ipcRenderer.invoke('dependency:check-all'),
    install: (dependencyId: string): Promise<InstallResult> =>
      ipcRenderer.invoke('dependency:install', { dependencyId })
  },

  shell: {
    openPath: (path: string): Promise<void> =>
      ipcRenderer.invoke('shell:open-path', { path })
  },

  dialog: {
    openFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:open-files'),
    selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-directory')
  },

  addons: {
    list: (instanceId: string): Promise<AddonRepo[]> =>
      ipcRenderer.invoke('addons:list', { instanceId }),
    add: (instanceId: string, url: string, branch: string): Promise<AddonRepo> =>
      ipcRenderer.invoke('addons:add', { instanceId, url, branch }),
    remove: (instanceId: string, repoId: string): Promise<void> =>
      ipcRenderer.invoke('addons:remove', { instanceId, repoId }),
    pull: (instanceId: string, repoId: string): Promise<void> =>
      ipcRenderer.invoke('addons:pull', { instanceId, repoId }),
    switchBranch: (instanceId: string, repoId: string, branch: string): Promise<string> =>
      ipcRenderer.invoke('addons:switch-branch', { instanceId, repoId, branch }),
    listBranches: (instanceId: string, repoId: string): Promise<{ local: string[]; remote: string[]; current: string }> =>
      ipcRenderer.invoke('addons:list-branches', { instanceId, repoId }),
    refreshBranch: (instanceId: string, repoId: string): Promise<string> =>
      ipcRenderer.invoke('addons:refresh-branch', { instanceId, repoId })
  },

  update: {
    check: (): Promise<void> => ipcRenderer.invoke('update:check'),
    download: (): Promise<void> => ipcRenderer.invoke('update:download'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    getInfo: (): Promise<UpdateInfo | null> => ipcRenderer.invoke('update:get-info')
  },

  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version')
  },

  claude: {
    startSession: (instanceId: string, model: string, resumeSessionId?: string, permissionMode?: string): Promise<void> =>
      ipcRenderer.invoke('claude:start-session', { instanceId, model, resumeSessionId, permissionMode }),
    sendMessage: (instanceId: string, text: string, parentToolUseId?: string): Promise<void> =>
      ipcRenderer.invoke('claude:send-message', { instanceId, text, parentToolUseId }),
    stopSession: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('claude:stop-session', { instanceId }),
    interrupt: (instanceId: string): Promise<void> =>
      ipcRenderer.invoke('claude:interrupt', { instanceId }),
    setModel: (instanceId: string, model: string): Promise<void> =>
      ipcRenderer.invoke('claude:set-model', { instanceId, model }),
    setPermissionMode: (instanceId: string, mode: string): Promise<void> =>
      ipcRenderer.invoke('claude:set-permission-mode', { instanceId, mode }),
    resolvePermission: (requestId: string, allowed: boolean, message?: string): Promise<void> =>
      ipcRenderer.invoke('claude:resolve-permission', { requestId, allowed, message }),
    slashCommands: (instanceId: string): Promise<Array<{ name: string; description: string; argumentHint: string }>> =>
      ipcRenderer.invoke('claude:slash-commands', { instanceId }),
    supportedModels: (instanceId: string): Promise<Array<{ value: string; displayName: string; description: string }>> =>
      ipcRenderer.invoke('claude:supported-models', { instanceId }),
    hasSession: (instanceId: string): Promise<boolean> =>
      ipcRenderer.invoke('claude:has-session', { instanceId }),
    listSessions: (instanceId: string): Promise<SessionRecord[]> =>
      ipcRenderer.invoke('claude:list-sessions', { instanceId }),
    deleteSessionRecord: (instanceId: string, sessionId: string): Promise<void> =>
      ipcRenderer.invoke('claude:delete-session-record', { instanceId, sessionId }),
    checkAuth: (): Promise<ClaudeAuthStatus> =>
      ipcRenderer.invoke('claude:check-auth'),
    loginWithToken: (token: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('claude:login-with-token', { token }),
    logout: (): Promise<void> =>
      ipcRenderer.invoke('claude:logout')
  },

  // Event listeners for streaming data
  on: {
    odooStatusChanged: (
      callback: (data: { instanceId: string; status: string }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { instanceId: string; status: string }
      ): void => callback(data)
      ipcRenderer.on('odoo:status-changed', handler)
      return () => ipcRenderer.removeListener('odoo:status-changed', handler)
    },
    odooLogLine: (
      callback: (data: { instanceId: string; line: string; level: string }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { instanceId: string; line: string; level: string }
      ): void => callback(data)
      ipcRenderer.on('odoo:log-line', handler)
      return () => ipcRenderer.removeListener('odoo:log-line', handler)
    },
    odooCreationProgress: (
      callback: (data: { step: string; message: string; percent: number }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { step: string; message: string; percent: number }
      ): void => callback(data)
      ipcRenderer.on('odoo:creation-progress', handler)
      return () => ipcRenderer.removeListener('odoo:creation-progress', handler)
    },
    odooInstancesChanged: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('odoo:instances-changed', handler)
      return () => ipcRenderer.removeListener('odoo:instances-changed', handler)
    },
    odooShellOutput: (
      callback: (data: { instanceId: string; data: string }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { instanceId: string; data: string }
      ): void => callback(data)
      ipcRenderer.on('odoo:shell-output', handler)
      return () => ipcRenderer.removeListener('odoo:shell-output', handler)
    },
    odooShellExit: (
      callback: (data: { instanceId: string }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { instanceId: string }
      ): void => callback(data)
      ipcRenderer.on('odoo:shell-exit', handler)
      return () => ipcRenderer.removeListener('odoo:shell-exit', handler)
    },
    dependencyInstallProgress: (
      callback: (data: { dependencyId: string; message: string; percent: number }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { dependencyId: string; message: string; percent: number }
      ): void => callback(data)
      ipcRenderer.on('dependency:install-progress', handler)
      return () => ipcRenderer.removeListener('dependency:install-progress', handler)
    },

    // Addons events
    addonsCloneProgress: (
      callback: (data: { instanceId: string; message: string; percent: number }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { instanceId: string; message: string; percent: number }
      ): void => callback(data)
      ipcRenderer.on('addons:clone-progress', handler)
      return () => ipcRenderer.removeListener('addons:clone-progress', handler)
    },
    addonsPullProgress: (
      callback: (data: { instanceId: string; repoId: string; message: string; percent: number }) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { instanceId: string; repoId: string; message: string; percent: number }
      ): void => callback(data)
      ipcRenderer.on('addons:pull-progress', handler)
      return () => ipcRenderer.removeListener('addons:pull-progress', handler)
    },

    // Claude events
    claudeSessionStarted: (
      callback: (data: { instanceId: string; model: string }) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:session-started', handler)
      return () => ipcRenderer.removeListener('claude:session-started', handler)
    },
    claudeSessionStopped: (
      callback: (data: { instanceId: string }) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:session-stopped', handler)
      return () => ipcRenderer.removeListener('claude:session-stopped', handler)
    },
    claudeSystemInit: (
      callback: (data: any) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:system-init', handler)
      return () => ipcRenderer.removeListener('claude:system-init', handler)
    },
    claudeAssistantMessage: (
      callback: (data: any) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:assistant-message', handler)
      return () => ipcRenderer.removeListener('claude:assistant-message', handler)
    },
    claudeStreamEvent: (
      callback: (data: any) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:stream-event', handler)
      return () => ipcRenderer.removeListener('claude:stream-event', handler)
    },
    claudeResult: (
      callback: (data: any) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:result', handler)
      return () => ipcRenderer.removeListener('claude:result', handler)
    },
    claudePermissionRequest: (
      callback: (data: { instanceId: string; requestId: string; toolName: string; input: any }) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:permission-request', handler)
      return () => ipcRenderer.removeListener('claude:permission-request', handler)
    },
    claudeError: (
      callback: (data: { instanceId: string; error: string }) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: any): void => callback(data)
      ipcRenderer.on('claude:error', handler)
      return () => ipcRenderer.removeListener('claude:error', handler)
    },

    // Update events
    updateAvailable: (
      callback: (data: UpdateInfo) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: UpdateInfo): void => callback(data)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    updateDownloadProgress: (
      callback: (data: UpdateProgress) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: UpdateProgress): void => callback(data)
      ipcRenderer.on('update:download-progress', handler)
      return () => ipcRenderer.removeListener('update:download-progress', handler)
    },
    updateReady: (
      callback: (data: UpdateInfo) => void
    ): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: UpdateInfo): void => callback(data)
      ipcRenderer.on('update:ready', handler)
      return () => ipcRenderer.removeListener('update:ready', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
