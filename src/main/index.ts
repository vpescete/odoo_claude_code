import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIpcHandlers } from './ipc'
import { odooProcessManager } from './services/odoo/OdooProcessManager'
import { odooShellManager } from './services/odoo/OdooShellManager'
import { claudeSessionManager } from './services/claude/ClaudeSessionManager'
import { instanceStore } from './store/InstanceStore'
import { autoUpdateService } from './services/updater/AutoUpdateService'

let mainWindow: BrowserWindow | null = null

function getIconPath(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'build', 'icon.png')
  }
  return join(process.resourcesPath, 'icon.png')
}

function createWindow(): void {
  const icon = nativeImage.createFromPath(getIconPath())

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    frame: false,
    icon,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.clodoo.app')

  // Set dock icon on macOS
  if (process.platform === 'darwin' && app.dock) {
    const icon = nativeImage.createFromPath(getIconPath())
    app.dock.setIcon(icon)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Reset stale statuses from previous session crash
  instanceStore.resetStaleStatuses()

  registerAllIpcHandlers()
  createWindow()

  // Check for updates 5 seconds after launch
  setTimeout(() => autoUpdateService.checkForUpdates(), 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  odooShellManager.stopAll()
  await claudeSessionManager.stopAll()
  await odooProcessManager.stopAll()
})

export { mainWindow }
