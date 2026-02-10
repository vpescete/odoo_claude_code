import type { OdooVersion, OdooEdition } from './odoo'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  workspacePath: string
  defaultOdooVersion: OdooVersion
  defaultEdition: OdooEdition
  defaultDbUser: string
  defaultDbHost: string
  defaultDbPort: number
  claudeModel: string
  claudeMaxTurns?: number
  claudeMaxBudgetUsd?: number
  postgresPath?: string
  autoStartPostgres: boolean
  pythonPaths: Record<string, string>
  githubUsername?: string
  logsRetentionDays: number
  maxLogLines: number
  firstLaunchComplete: boolean
}
