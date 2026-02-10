import { store } from './AppStore'
import type { SessionRecord } from '@shared/types/claude'

const MAX_SESSIONS_PER_INSTANCE = 20

class SessionStore {
  getSessions(instanceId: string): SessionRecord[] {
    const all = store.get('recentSessions') || {}
    return all[instanceId] || []
  }

  addSession(instanceId: string, record: SessionRecord): void {
    const all = store.get('recentSessions') || {}
    const list = all[instanceId] || []

    // Remove existing entry with same sessionId if present
    const filtered = list.filter((s) => s.sessionId !== record.sessionId)

    // Add at the beginning (most recent first)
    filtered.unshift(record)

    // Limit to max
    if (filtered.length > MAX_SESSIONS_PER_INSTANCE) {
      filtered.length = MAX_SESSIONS_PER_INSTANCE
    }

    store.set(`recentSessions.${instanceId}`, filtered)
  }

  updateSessionPreview(instanceId: string, sessionId: string, firstMessage: string): void {
    const all = store.get('recentSessions') || {}
    const list = all[instanceId] || []

    const index = list.findIndex((s) => s.sessionId === sessionId)
    if (index >= 0) {
      list[index] = { ...list[index], firstMessage }
      store.set(`recentSessions.${instanceId}`, list)
    }
  }

  removeSession(instanceId: string, sessionId: string): void {
    const all = store.get('recentSessions') || {}
    const list = all[instanceId] || []

    const filtered = list.filter((s) => s.sessionId !== sessionId)
    store.set(`recentSessions.${instanceId}`, filtered)
  }
}

export const sessionStore = new SessionStore()
