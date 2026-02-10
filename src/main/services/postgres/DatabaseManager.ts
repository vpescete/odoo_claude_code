import { execCommandSafe, execCommand } from '../platform/ShellExecutor'

export class DatabaseManager {
  async createDatabase(dbName: string, dbUser: string): Promise<void> {
    // Check if database already exists
    const exists = await this.databaseExists(dbName)
    if (exists) return

    // Check if user exists, create if not
    await this.ensureUser(dbUser)

    // Create database
    await execCommand(`createdb -U ${dbUser} ${dbName}`)
  }

  async dropDatabase(dbName: string, dbUser: string): Promise<void> {
    const exists = await this.databaseExists(dbName)
    if (!exists) return

    await execCommand(`dropdb -U ${dbUser} ${dbName}`)
  }

  async databaseExists(dbName: string): Promise<boolean> {
    const result = await execCommandSafe(
      `psql -U postgres -lqt | grep -w ${dbName}`
    )
    if (result && result.stdout.includes(dbName)) return true

    // Try without specifying user
    const result2 = await execCommandSafe(
      `psql -lqt | grep -w ${dbName}`
    )
    return !!(result2 && result2.stdout.includes(dbName))
  }

  async listDatabases(): Promise<string[]> {
    // Try with postgres user first, then without
    let result = await execCommandSafe(
      `psql -U postgres -lqt`
    )
    if (!result) {
      result = await execCommandSafe(`psql -lqt`)
    }
    if (!result) return []

    return result.stdout
      .split('\n')
      .map((line) => line.split('|')[0]?.trim())
      .filter((name) => name && !['', 'template0', 'template1', 'postgres'].includes(name))
  }

  private async ensureUser(dbUser: string): Promise<void> {
    // Check if user exists
    const result = await execCommandSafe(
      `psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${dbUser}'"`
    )

    if (result && result.stdout.includes('1')) return

    // Try to create user
    await execCommandSafe(
      `createuser -U postgres -s ${dbUser}`
    )

    // If postgres user doesn't work, try without -U
    if (!result) {
      await execCommandSafe(`createuser -s ${dbUser}`)
    }
  }
}

export const databaseManager = new DatabaseManager()
