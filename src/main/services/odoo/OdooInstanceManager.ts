import { mkdir, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import type { OdooInstance, CreateInstanceArgs } from '@shared/types/odoo'
import { ODOO_VERSION_CONFIG } from '@shared/constants/odooVersions'
import { instanceStore } from '../../store/InstanceStore'
import { settingsStore } from '../../store/SettingsStore'
import { secureStore } from '../../store/SecureStore'
import { odooRepository } from './OdooRepository'
import { venvManager } from '../../services/python/VenvManager'
import { pipManager } from '../../services/python/PipManager'
import { databaseManager } from '../../services/postgres/DatabaseManager'
import { execCommandSafe } from '../../services/platform/ShellExecutor'
import { platformDetector } from '../../services/platform/PlatformDetector'

type ProgressCallback = (step: string, message: string, percent: number) => void

export class OdooInstanceManager {
  async createInstance(
    args: CreateInstanceArgs,
    onProgress: ProgressCallback
  ): Promise<OdooInstance> {
    const versionConfig = ODOO_VERSION_CONFIG[args.version]
    if (!versionConfig) {
      throw new Error(`Unsupported Odoo version: ${args.version}`)
    }

    // Validate uniqueness
    if (instanceStore.findByName(args.name)) {
      throw new Error(`Instance "${args.name}" already exists`)
    }
    if (instanceStore.findByPort(args.httpPort)) {
      throw new Error(`Port ${args.httpPort} is already in use by another instance`)
    }
    if (instanceStore.findByPort(args.longpollingPort)) {
      throw new Error(`Port ${args.longpollingPort} is already in use by another instance`)
    }

    const id = randomUUID()
    const workspacePath = settingsStore.getWorkspacePath()
    const basePath = join(workspacePath, args.name)
    const odooPath = join(basePath, 'odoo')
    const venvPath = join(basePath, 'venv')
    const configPath = join(basePath, 'odoo.conf')
    const dataDir = join(basePath, 'data')

    try {
      // Step 1: Create directory structure (0-5%)
      onProgress('directory', 'Creating project directory...', 2)
      await mkdir(basePath, { recursive: true })
      await mkdir(dataDir, { recursive: true })

      // Step 2: Clone Odoo Community (5-30%)
      onProgress('clone', 'Cloning Odoo Community...', 5)
      await odooRepository.clone(
        versionConfig.repoUrl,
        versionConfig.branch,
        odooPath,
        (msg, pct) => onProgress('clone', msg, 5 + Math.round(pct * 0.25))
      )

      // Step 3: Clone Enterprise (if needed) (30-40%)
      let enterprisePath: string | undefined
      if (args.edition === 'enterprise') {
        onProgress('clone-enterprise', 'Cloning Odoo Enterprise...', 30)
        enterprisePath = join(basePath, 'enterprise')
        const githubToken = secureStore.getGitHubToken()
        if (!githubToken) {
          throw new Error('GitHub token required for Enterprise edition. Set it in Settings.')
        }
        await odooRepository.cloneWithToken(
          versionConfig.enterpriseRepoUrl,
          versionConfig.branch,
          enterprisePath,
          githubToken,
          (msg, pct) => onProgress('clone-enterprise', msg, 30 + Math.round(pct * 0.1))
        )
      }

      // Step 4: Find Python and create venv (40-45%)
      onProgress('venv', 'Creating virtual environment...', 40)
      const pythonPath = await this.findPython(versionConfig.pythonRecommended)
      await venvManager.create(
        pythonPath,
        venvPath,
        (msg, pct) => onProgress('venv', msg, 40 + Math.round(pct * 0.05))
      )

      // Step 5: Install Python dependencies (45-60%)
      onProgress('pip', 'Installing Python dependencies...', 45)
      const requirementsPath = join(odooPath, 'requirements.txt')
      await pipManager.installRequirements(
        venvPath,
        requirementsPath,
        (msg, pct) => onProgress('pip', msg, 45 + Math.round(pct * 0.15))
      )

      // Step 6: Create PostgreSQL database (60-62%)
      onProgress('database', 'Creating database...', 60)
      await databaseManager.createDatabase(args.dbName, args.dbUser)

      // Step 7: Generate odoo.conf (62-65%)
      onProgress('config', 'Generating configuration...', 62)
      const addonsPaths = [join(odooPath, 'addons'), join(odooPath, 'odoo', 'addons')]
      if (enterprisePath) addonsPaths.push(enterprisePath)

      const configContent = this.generateConfig({
        addons_paths: addonsPaths.join(','),
        db_host: args.dbHost,
        db_port: String(args.dbPort),
        db_user: args.dbUser,
        db_password: args.dbPassword,
        db_name: args.dbName,
        http_port: String(args.httpPort),
        longpolling_port: String(args.longpollingPort),
        data_dir: dataDir
      })
      await writeFile(configPath, configContent, 'utf-8')

      // Step 8: Initialize database with base module (65-95%)
      onProgress('init-db', 'Initializing database (installing base module)...', 65)
      await this.initializeDatabase(
        venvPath,
        odooPath,
        configPath,
        basePath,
        (msg, pct) => onProgress('init-db', msg, 65 + Math.round(pct * 0.30))
      )

      // Step 9: Save instance metadata (95-100%)
      onProgress('saving', 'Saving instance...', 96)
      const pythonVersion = await this.getPythonVersion(pythonPath)

      const instance: OdooInstance = {
        id,
        name: args.name,
        version: args.version,
        edition: args.edition,
        status: 'stopped',
        basePath,
        odooPath,
        enterprisePath,
        venvPath,
        configPath,
        httpPort: args.httpPort,
        longpollingPort: args.longpollingPort,
        dbName: args.dbName,
        dbUser: args.dbUser,
        dbPassword: args.dbPassword,
        dbHost: args.dbHost,
        dbPort: args.dbPort,
        pythonVersion,
        pythonPath,
        createdAt: new Date().toISOString()
      }

      instanceStore.save(instance)

      onProgress('done', 'Instance created successfully!', 100)
      return instance
    } catch (error) {
      // Cleanup on failure: remove directory AND drop database
      if (existsSync(basePath)) {
        await rm(basePath, { recursive: true, force: true }).catch(() => {})
      }
      try {
        await databaseManager.dropDatabase(args.dbName, args.dbUser)
      } catch {
        // Database may not exist yet, ignore
      }
      throw error
    }
  }

  async deleteInstance(instanceId: string): Promise<void> {
    const instance = instanceStore.get(instanceId)

    if (instance) {
      // Drop database
      try {
        await databaseManager.dropDatabase(instance.dbName, instance.dbUser)
      } catch {
        // Database may not exist, continue
      }

      // Remove files
      if (existsSync(instance.basePath)) {
        await rm(instance.basePath, { recursive: true, force: true })
      }
    }

    // Always remove from store (even if instance data was partial)
    instanceStore.delete(instanceId)
  }

  private async initializeDatabase(
    venvPath: string,
    odooPath: string,
    configPath: string,
    basePath: string,
    onProgress: (message: string, percent: number) => void
  ): Promise<void> {
    const pythonBin = venvManager.getPythonBin(venvPath)
    const odooBin = join(odooPath, 'odoo-bin')

    return new Promise<void>((resolve, reject) => {
      onProgress('Starting database initialization...', 0)

      const child = spawn(pythonBin, [odooBin, '-c', configPath, '-i', 'base', '--stop-after-init'], {
        cwd: basePath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      })

      let lastModule = ''
      let hasError = false
      let errorOutput = ''

      const handleData = (data: Buffer): void => {
        const text = data.toString()
        const lines = text.split('\n').filter(Boolean)

        for (const line of lines) {
          // Track module loading progress
          const moduleMatch = line.match(/Loading module (\w+)/)
          if (moduleMatch && moduleMatch[1] !== lastModule) {
            lastModule = moduleMatch[1]
            onProgress(`Loading module: ${lastModule}...`, 30)
          }

          // Track specific phases
          if (line.includes('loading base module')) {
            onProgress('Loading base module...', 10)
          } else if (line.includes('updating modules list')) {
            onProgress('Updating modules list...', 50)
          } else if (line.includes('Modules loaded')) {
            onProgress('Modules loaded, finalizing...', 80)
          } else if (line.includes('odoo.modules.loading: Modules loaded')) {
            onProgress('Database initialized successfully', 95)
          }

          // Detect critical errors
          if (line.includes('CRITICAL') || (line.includes('ERROR') && line.includes('odoo.modules'))) {
            hasError = true
            errorOutput += line + '\n'
          }
        }
      }

      child.stdout?.on('data', handleData)
      child.stderr?.on('data', handleData)

      child.on('close', (code) => {
        if (code === 0) {
          onProgress('Database initialized', 100)
          resolve()
        } else if (hasError) {
          reject(new Error(`Database initialization failed:\n${errorOutput.slice(0, 500)}`))
        } else {
          reject(new Error(`Database initialization failed with exit code ${code}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`Failed to start database initialization: ${err.message}`))
      })
    })
  }

  private async findPython(recommendedVersion: string): Promise<string> {
    // Try the recommended version first
    const commands = platformDetector.isWindows
      ? [`py -${recommendedVersion}`, 'python3', 'python']
      : [`python${recommendedVersion}`, `python3.${recommendedVersion.split('.').pop()}`, 'python3']

    for (const cmd of commands) {
      const result = await execCommandSafe(`${cmd} --version`)
      if (result) {
        const whichResult = await execCommandSafe(`${platformDetector.whichCommand} ${cmd}`)
        if (whichResult) return whichResult.stdout.split('\n')[0].trim()
        return cmd
      }
    }

    // Fallback: just use python3
    const fallback = await execCommandSafe(`${platformDetector.whichCommand} python3`)
    if (fallback) return fallback.stdout.split('\n')[0].trim()

    throw new Error(`Python ${recommendedVersion} not found. Please install it.`)
  }

  private async getPythonVersion(pythonPath: string): Promise<string> {
    const result = await execCommandSafe(`${pythonPath} --version`)
    if (!result) return 'unknown'
    const match = result.stdout.match(/Python (\d+\.\d+\.\d+)/)
      || result.stderr.match(/Python (\d+\.\d+\.\d+)/)
    return match?.[1] || 'unknown'
  }

  private generateConfig(vars: Record<string, string>): string {
    let config = `[options]
addons_path = {{addons_paths}}
admin_passwd = admin
db_host = {{db_host}}
db_port = {{db_port}}
db_user = {{db_user}}
db_password = {{db_password}}
db_name = {{db_name}}
http_port = {{http_port}}
longpolling_port = {{longpolling_port}}
logfile =
log_level = info
data_dir = {{data_dir}}
`
    for (const [key, value] of Object.entries(vars)) {
      config = config.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    return config
  }
}

export const odooInstanceManager = new OdooInstanceManager()
