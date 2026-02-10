import { store } from './AppStore'
import type { OdooInstance } from '@shared/types/odoo'

class InstanceStore {
  getAll(): OdooInstance[] {
    const instances = store.get('instances')
    return Object.values(instances)
  }

  get(id: string): OdooInstance | undefined {
    const instances = store.get('instances')
    return instances[id]
  }

  save(instance: OdooInstance): void {
    store.set(`instances.${instance.id}`, instance)
  }

  update(id: string, updates: Partial<OdooInstance>): void {
    const instance = this.get(id)
    if (!instance) return
    store.set(`instances.${id}`, { ...instance, ...updates })
  }

  delete(id: string): void {
    const instances = store.get('instances')
    delete instances[id]
    store.set('instances', instances)
  }

  exists(id: string): boolean {
    return !!this.get(id)
  }

  findByName(name: string): OdooInstance | undefined {
    return this.getAll().find((i) => i.name === name)
  }

  findByPort(port: number): OdooInstance | undefined {
    return this.getAll().find((i) => i.httpPort === port || i.longpollingPort === port)
  }

  /**
   * Reset stale statuses on app startup.
   * Instances left as 'running'/'starting'/'stopping' from a previous session
   * are set to 'stopped' since their processes no longer exist.
   */
  resetStaleStatuses(): void {
    const staleStatuses = ['running', 'starting', 'stopping']
    for (const instance of this.getAll()) {
      if (staleStatuses.includes(instance.status)) {
        this.update(instance.id, { status: 'stopped' })
      }
    }
  }
}

export const instanceStore = new InstanceStore()
