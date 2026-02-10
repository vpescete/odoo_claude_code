import type { AppSettings } from '../types/settings'

export const DEFAULT_HTTP_PORT = 8069
export const DEFAULT_LONGPOLLING_PORT = 8072
export const DEFAULT_DB_HOST = 'localhost'
export const DEFAULT_DB_PORT = 5432
export const DEFAULT_DB_USER = 'odoo'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  workspacePath: '',
  defaultOdooVersion: '18.0',
  defaultEdition: 'community',
  defaultDbUser: DEFAULT_DB_USER,
  defaultDbHost: DEFAULT_DB_HOST,
  defaultDbPort: DEFAULT_DB_PORT,
  claudeModel: 'claude-opus-4-6',
  autoStartPostgres: true,
  pythonPaths: {},
  logsRetentionDays: 30,
  maxLogLines: 10000,
  firstLaunchComplete: false
}
