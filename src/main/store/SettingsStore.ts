import { app } from 'electron'
import { join } from 'path'
import { store } from './AppStore'
import type { AppSettings } from '@shared/types/settings'

class SettingsStore {
  get(): AppSettings {
    const settings = store.get('settings')
    // Set default workspace path if not set
    if (!settings.workspacePath) {
      settings.workspacePath = join(app.getPath('home'), 'OdooProjects')
    }
    return settings
  }

  update(updates: Partial<AppSettings>): void {
    const current = this.get()
    store.set('settings', { ...current, ...updates })
  }

  getWorkspacePath(): string {
    return this.get().workspacePath || join(app.getPath('home'), 'OdooProjects')
  }

  isFirstLaunchComplete(): boolean {
    return this.get().firstLaunchComplete
  }

  setFirstLaunchComplete(): void {
    this.update({ firstLaunchComplete: true })
  }
}

export const settingsStore = new SettingsStore()
