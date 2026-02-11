import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Notification } from 'electron'
import log from 'electron-log'
import { is } from '@electron-toolkit/utils'
import type { UpdateInfo } from '@shared/types/update'

class AutoUpdateService {
  private updateInfo: UpdateInfo | null = null

  constructor() {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = log

    autoUpdater.on('update-available', (info) => {
      this.updateInfo = {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        releaseName: info.releaseName ?? undefined,
        releaseDate: info.releaseDate
      }
      this.sendToRenderer('update:available', this.updateInfo)
    })

    autoUpdater.on('download-progress', (progress) => {
      this.sendToRenderer('update:download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred
      })
    })

    autoUpdater.on('update-downloaded', () => {
      this.sendToRenderer('update:ready', this.updateInfo)
      this.showNativeNotification()
    })

    autoUpdater.on('error', (error) => {
      log.error('Auto-update error:', error)
    })
  }

  async checkForUpdates(): Promise<void> {
    if (is.dev) {
      log.info('Skipping update check in dev mode')
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      log.error('Failed to check for updates:', error)
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      log.error('Failed to download update:', error)
    }
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }

  getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo
  }

  private showNativeNotification(): void {
    if (!Notification.isSupported()) return
    const notification = new Notification({
      title: 'Clodoo Update Ready',
      body: `Version ${this.updateInfo?.version ?? 'unknown'} has been downloaded. Restart to install.`
    })
    notification.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.show()
        win.focus()
      }
    })
    notification.show()
  }

  private sendToRenderer(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send(channel, data)
    }
  }
}

export const autoUpdateService = new AutoUpdateService()
