import type { OdooVersion } from '../types/odoo'

export interface OdooVersionInfo {
  pythonMinVersion: string
  pythonMaxVersion: string
  pythonRecommended: string
  repoUrl: string
  enterpriseRepoUrl: string
  branch: string
  requiresLessCompiler: boolean
}

export const ODOO_VERSION_CONFIG: Record<OdooVersion, OdooVersionInfo> = {
  '14.0': {
    pythonMinVersion: '3.7',
    pythonMaxVersion: '3.10',
    pythonRecommended: '3.8',
    repoUrl: 'https://github.com/odoo/odoo.git',
    enterpriseRepoUrl: 'https://github.com/odoo/enterprise.git',
    branch: '14.0',
    requiresLessCompiler: true
  },
  '15.0': {
    pythonMinVersion: '3.8',
    pythonMaxVersion: '3.10',
    pythonRecommended: '3.8',
    repoUrl: 'https://github.com/odoo/odoo.git',
    enterpriseRepoUrl: 'https://github.com/odoo/enterprise.git',
    branch: '15.0',
    requiresLessCompiler: false
  },
  '16.0': {
    pythonMinVersion: '3.10',
    pythonMaxVersion: '3.12',
    pythonRecommended: '3.10',
    repoUrl: 'https://github.com/odoo/odoo.git',
    enterpriseRepoUrl: 'https://github.com/odoo/enterprise.git',
    branch: '16.0',
    requiresLessCompiler: false
  },
  '17.0': {
    pythonMinVersion: '3.10',
    pythonMaxVersion: '3.12',
    pythonRecommended: '3.10',
    repoUrl: 'https://github.com/odoo/odoo.git',
    enterpriseRepoUrl: 'https://github.com/odoo/enterprise.git',
    branch: '17.0',
    requiresLessCompiler: false
  },
  '18.0': {
    pythonMinVersion: '3.10',
    pythonMaxVersion: '3.12',
    pythonRecommended: '3.12',
    repoUrl: 'https://github.com/odoo/odoo.git',
    enterpriseRepoUrl: 'https://github.com/odoo/enterprise.git',
    branch: '18.0',
    requiresLessCompiler: false
  }
}

export const SUPPORTED_VERSIONS: OdooVersion[] = ['14.0', '15.0', '16.0', '17.0', '18.0']
