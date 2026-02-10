import { safeStorage } from 'electron'
import { store } from './AppStore'

class SecureStore {
  private encryptAndStore(key: string, value: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value)
      store.set(key as never, encrypted.toString('base64') as never)
    } else {
      // Fallback: store as plain text (less secure, but functional)
      store.set(key as never, value as never)
    }
  }

  private retrieveAndDecrypt(key: string): string | null {
    const stored = store.get(key as never) as string | undefined
    if (!stored) return null

    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(stored, 'base64'))
      } catch {
        // May be stored as plain text from fallback
        return stored
      }
    }
    return stored
  }

  setApiKey(key: string): void {
    this.encryptAndStore('claudeApiKey', key)
  }

  getApiKey(): string | null {
    return this.retrieveAndDecrypt('claudeApiKey')
  }

  removeApiKey(): void {
    store.delete('claudeApiKey' as never)
  }

  setGitHubToken(token: string): void {
    this.encryptAndStore('githubToken', token)
  }

  getGitHubToken(): string | null {
    return this.retrieveAndDecrypt('githubToken')
  }

  removeGitHubToken(): void {
    store.delete('githubToken' as never)
  }
}

export const secureStore = new SecureStore()
