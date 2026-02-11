import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { settingsStore } from '../store/SettingsStore'
import { instanceStore } from '../store/InstanceStore'
import { secureStore } from '../store/SecureStore'
import { dependencyChecker } from '../services/dependency/DependencyChecker'
import { dependencyInstaller } from '../services/dependency/DependencyInstaller'
import { odooInstanceManager } from '../services/odoo/OdooInstanceManager'
import { odooProcessManager } from '../services/odoo/OdooProcessManager'
import { databaseManager } from '../services/postgres/DatabaseManager'
import { claudeSessionManager } from '../services/claude/ClaudeSessionManager'
import { claudeAuthManager } from '../services/claude/ClaudeAuthManager'
import { addonManager } from '../services/odoo/AddonManager'
import { odooShellManager } from '../services/odoo/OdooShellManager'
import { sessionStore } from '../store/SessionStore'
import { autoUpdateService } from '../services/updater/AutoUpdateService'

export function registerAllIpcHandlers(): void {
  // Window controls
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.on('window:set-title-bar-overlay', (event, options: { color: string; symbolColor: string }) => {
    if (process.platform !== 'win32') return
    const win = BrowserWindow.fromWebContents(event.sender)
    try {
      win?.setTitleBarOverlay({
        color: options.color,
        symbolColor: options.symbolColor,
        height: 48
      })
    } catch {
      // setTitleBarOverlay may fail if overlay is not enabled
    }
  })

  // Settings
  ipcMain.handle('settings:get', () => {
    return settingsStore.get()
  })

  ipcMain.handle('settings:update', (_event, updates) => {
    settingsStore.update(updates)
  })

  ipcMain.handle('settings:is-first-launch', () => {
    return !settingsStore.isFirstLaunchComplete()
  })

  ipcMain.handle('settings:complete-first-launch', () => {
    settingsStore.setFirstLaunchComplete()
  })

  // Instances
  ipcMain.handle('odoo:list', () => {
    return instanceStore.getAll()
  })

  ipcMain.handle('odoo:get', (_event, { instanceId }) => {
    return instanceStore.get(instanceId)
  })

  ipcMain.handle('odoo:create', async (event, args) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const instance = await odooInstanceManager.createInstance(args, (step, message, percent) => {
      win?.webContents.send('odoo:creation-progress', { step, message, percent })
    })
    win?.webContents.send('odoo:instances-changed')
    return instance
  })

  ipcMain.handle('odoo:delete', async (event, { instanceId }) => {
    await odooInstanceManager.deleteInstance(instanceId)
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.webContents.send('odoo:instances-changed')
  })

  ipcMain.handle('odoo:start', async (_event, { instanceId }) => {
    await odooProcessManager.start(instanceId)
  })

  ipcMain.handle('odoo:stop', async (_event, { instanceId }) => {
    await odooProcessManager.stop(instanceId)
  })

  ipcMain.handle('odoo:restart', async (_event, { instanceId }) => {
    await odooProcessManager.restart(instanceId)
  })

  ipcMain.handle('shell:open-path', async (_event, { path }) => {
    const { shell } = await import('electron')
    await shell.openPath(path)
  })

  ipcMain.handle('odoo:read-config', async (_event, { instanceId }) => {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')
    const content = await readFile(instance.configPath, 'utf-8')
    return content
  })

  ipcMain.handle('odoo:write-config', async (_event, { instanceId, content }) => {
    const instance = instanceStore.get(instanceId)
    if (!instance) throw new Error('Instance not found')
    await writeFile(instance.configPath, content, 'utf-8')

    // Sync relevant fields back to instance metadata
    const parsed = parseConfContent(content)
    const updates: Record<string, unknown> = {}
    if (parsed.http_port) updates.httpPort = parseInt(parsed.http_port, 10)
    if (parsed.longpolling_port) updates.longpollingPort = parseInt(parsed.longpolling_port, 10)
    if (parsed.db_name) updates.dbName = parsed.db_name
    if (parsed.db_user) updates.dbUser = parsed.db_user
    if (parsed.db_password) updates.dbPassword = parsed.db_password
    if (parsed.db_host) updates.dbHost = parsed.db_host
    if (parsed.db_port) updates.dbPort = parseInt(parsed.db_port, 10)
    if (Object.keys(updates).length > 0) {
      instanceStore.update(instanceId, updates)
    }
  })

  // PostgreSQL
  ipcMain.handle('postgres:list-databases', async () => {
    return databaseManager.listDatabases()
  })

  // Secure credentials
  ipcMain.handle('settings:set-api-key', (_event, { key }) => {
    secureStore.setApiKey(key)
    return { valid: true }
  })

  ipcMain.handle('settings:get-api-key-exists', () => {
    return !!secureStore.getApiKey()
  })

  ipcMain.handle('settings:set-github-token', (_event, { token }) => {
    secureStore.setGitHubToken(token)
  })

  ipcMain.handle('settings:get-github-token-exists', () => {
    return !!secureStore.getGitHubToken()
  })

  ipcMain.handle('settings:remove-api-key', () => {
    secureStore.removeApiKey()
  })

  ipcMain.handle('settings:remove-github-token', () => {
    secureStore.removeGitHubToken()
  })

  // Claude Code
  ipcMain.handle('claude:start-session', async (_event, { instanceId, model, resumeSessionId, permissionMode }) => {
    await claudeSessionManager.startSession(instanceId, model, resumeSessionId, permissionMode)
  })

  ipcMain.handle('claude:send-message', async (_event, { instanceId, text, parentToolUseId }) => {
    await claudeSessionManager.sendMessage(instanceId, text, parentToolUseId)
  })

  ipcMain.handle('claude:stop-session', async (_event, { instanceId }) => {
    await claudeSessionManager.stopSession(instanceId)
  })

  ipcMain.handle('claude:interrupt', async (_event, { instanceId }) => {
    await claudeSessionManager.interruptSession(instanceId)
  })

  ipcMain.handle('claude:set-model', async (_event, { instanceId, model }) => {
    await claudeSessionManager.setModel(instanceId, model)
  })

  ipcMain.handle('claude:set-permission-mode', async (_event, { instanceId, mode }) => {
    await claudeSessionManager.setPermissionMode(instanceId, mode)
  })

  ipcMain.handle('claude:resolve-permission', (_event, { requestId, allowed, message }) => {
    claudeSessionManager.resolvePermission(requestId, allowed, message)
  })

  ipcMain.handle('claude:slash-commands', async (_event, { instanceId }) => {
    return claudeSessionManager.getSlashCommands(instanceId)
  })

  ipcMain.handle('claude:supported-models', async (_event, { instanceId }) => {
    return claudeSessionManager.getSupportedModels(instanceId)
  })

  ipcMain.handle('claude:has-session', (_event, { instanceId }) => {
    return claudeSessionManager.hasSession(instanceId)
  })

  ipcMain.handle('claude:list-sessions', (_event, { instanceId }) => {
    return sessionStore.getSessions(instanceId)
  })

  ipcMain.handle('claude:delete-session-record', (_event, { instanceId, sessionId }) => {
    sessionStore.removeSession(instanceId, sessionId)
  })

  // Claude Auth
  ipcMain.handle('claude:check-auth', async () => {
    return claudeAuthManager.checkAuthStatus()
  })

  ipcMain.handle('claude:login-oauth', async () => {
    return claudeAuthManager.loginOAuth()
  })

  ipcMain.handle('claude:login-with-token', async (_event, { token }) => {
    return claudeAuthManager.loginWithToken(token)
  })

  ipcMain.handle('claude:logout', async () => {
    await claudeAuthManager.logout()
  })

  // Addons management
  ipcMain.handle('addons:list', (_event, { instanceId }) => {
    return addonManager.listRepos(instanceId)
  })

  ipcMain.handle('addons:add', async (event, { instanceId, url, branch }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return addonManager.addRepo(instanceId, url, branch, (message, percent) => {
      win?.webContents.send('addons:clone-progress', { instanceId, message, percent })
    })
  })

  ipcMain.handle('addons:remove', async (_event, { instanceId, repoId }) => {
    await addonManager.removeRepo(instanceId, repoId)
  })

  ipcMain.handle('addons:pull', async (event, { instanceId, repoId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    await addonManager.pullRepo(instanceId, repoId, (message, percent) => {
      win?.webContents.send('addons:pull-progress', { instanceId, repoId, message, percent })
    })
  })

  ipcMain.handle('addons:switch-branch', async (_event, { instanceId, repoId, branch }) => {
    return addonManager.switchBranch(instanceId, repoId, branch)
  })

  ipcMain.handle('addons:list-branches', async (_event, { instanceId, repoId }) => {
    return addonManager.listBranches(instanceId, repoId)
  })

  ipcMain.handle('addons:refresh-branch', async (_event, { instanceId, repoId }) => {
    return addonManager.refreshBranch(instanceId, repoId)
  })

  // Odoo Shell (PTY)
  ipcMain.handle('odoo:shell-start', async (_event, { instanceId }) => {
    await odooShellManager.start(instanceId)
  })

  ipcMain.handle('odoo:shell-write', (_event, { instanceId, data }) => {
    odooShellManager.write(instanceId, data)
  })

  ipcMain.handle('odoo:shell-resize', (_event, { instanceId, cols, rows }) => {
    odooShellManager.resize(instanceId, cols, rows)
  })

  ipcMain.handle('odoo:shell-stop', (_event, { instanceId }) => {
    odooShellManager.stop(instanceId)
  })

  // File dialog
  ipcMain.handle('dialog:open-files', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      title: 'Attach files'
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle('dialog:select-directory', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Update
  ipcMain.handle('update:check', () => autoUpdateService.checkForUpdates())
  ipcMain.handle('update:download', () => autoUpdateService.downloadUpdate())
  ipcMain.handle('update:install', () => autoUpdateService.quitAndInstall())
  ipcMain.handle('update:get-info', () => autoUpdateService.getUpdateInfo())

  // App version
  ipcMain.handle('app:get-version', () => app.getVersion())

  // Dependency checking
  ipcMain.handle('dependency:check-all', async () => {
    return dependencyChecker.checkAll()
  })

  ipcMain.handle('dependency:install', async (event, { dependencyId }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dependencyInstaller.install(dependencyId, (message, percent) => {
      win?.webContents.send('dependency:install-progress', {
        dependencyId,
        message,
        percent
      })
    })
    return result
  })
}

/** Parse an odoo.conf INI string into a key-value map */
function parseConfContent(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('[')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (key) result[key] = value
  }
  return result
}
