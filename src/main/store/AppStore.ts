import Store from 'electron-store'
import type { OdooInstance } from '@shared/types/odoo'
import type { AppSettings } from '@shared/types/settings'
import type { SessionRecord } from '@shared/types/claude'
import { DEFAULT_SETTINGS } from '@shared/constants/defaults'

interface AppStoreSchema {
  instances: Record<string, OdooInstance>
  settings: AppSettings
  recentSessions: Record<string, SessionRecord[]>
}

const store = new Store<AppStoreSchema>({
  name: 'odoo-claude-config',
  defaults: {
    instances: {},
    settings: DEFAULT_SETTINGS,
    recentSessions: {}
  }
})

export { store }
export type { AppStoreSchema }
