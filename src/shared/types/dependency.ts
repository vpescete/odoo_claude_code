export interface DependencyStatus {
  id: string
  name: string
  required: boolean
  installed: boolean
  version?: string
  requiredVersion?: string
  path?: string
  installInstructions: string
  canAutoInstall: boolean
  extra?: Record<string, unknown>
}

export interface InstallResult {
  success: boolean
  error?: string
  manualInstructions?: string
}
