export interface AddonRepo {
  id: string
  url: string
  branch: string
  name: string
  clonedPath: string
  status: 'cloning' | 'ready' | 'error'
  error?: string
  addedAt: string
}
