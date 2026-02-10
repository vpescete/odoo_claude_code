import type { AddonRepo } from './addon'

export type OdooVersion = '14.0' | '15.0' | '16.0' | '17.0' | '18.0'
export type OdooEdition = 'community' | 'enterprise'
export type InstanceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface OdooInstance {
  id: string
  name: string
  version: OdooVersion
  edition: OdooEdition
  status: InstanceStatus

  // Paths
  basePath: string
  odooPath: string
  enterprisePath?: string
  customAddonsPath?: string
  venvPath: string
  configPath: string

  // Server config
  httpPort: number
  longpollingPort: number
  dbName: string
  dbUser: string
  dbPassword: string
  dbHost: string
  dbPort: number

  // Python
  pythonVersion: string
  pythonPath: string

  // Timestamps
  createdAt: string
  lastStartedAt?: string

  // Claude
  lastClaudeSessionId?: string

  // Custom addons
  addonRepos?: AddonRepo[]
}

export interface CreateInstanceArgs {
  name: string
  version: OdooVersion
  edition: OdooEdition
  httpPort: number
  longpollingPort: number
  dbName: string
  dbUser: string
  dbPassword: string
  dbHost: string
  dbPort: number
}
