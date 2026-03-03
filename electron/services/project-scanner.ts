import fs from 'fs/promises'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface ScannedSubProject {
  id: string
  name: string
  csprojPath: string
  dirPath: string
  kind: 'runnable' | 'library'
  targetFramework?: string
  port?: number
  appsettingsFiles: string[]
}

export interface ScannedFolderProject {
  id: string
  name: string
  rootPath: string
  originalRootPath: string
  subProjects: ScannedSubProject[]
  solutionFile?: string
  hasDockerCompose: boolean
  dockerComposePath?: string
  branch?: string
  activeWorktreePath?: string
}

const EXCLUDE_DIRS = new Set(['bin', 'obj', 'node_modules', '.git', 'dist', 'wwwroot', '.vs', '.idea', 'packages'])

export class ProjectScanner {
  private xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

  async scanFolder(dirPath: string): Promise<ScannedFolderProject> {
    const subProjects: ScannedSubProject[] = []
    await this.scanRecursive(dirPath, subProjects, 0)

    const rootEntries = await this.safeReaddir(dirPath)

    const slnFile = rootEntries.find(e => e.endsWith('.sln'))
    const hasDockerCompose = rootEntries.includes('docker-compose.yml') || rootEntries.includes('docker-compose.yaml')
    const dockerComposePath = hasDockerCompose
      ? path.join(dirPath, rootEntries.includes('docker-compose.yml') ? 'docker-compose.yml' : 'docker-compose.yaml')
      : undefined

    const branch = await this.getCurrentBranch(dirPath)

    return {
      id: this.generateId(dirPath),
      name: path.basename(dirPath),
      rootPath: dirPath,
      originalRootPath: dirPath,
      subProjects,
      solutionFile: slnFile ? path.join(dirPath, slnFile) : undefined,
      hasDockerCompose,
      dockerComposePath,
      branch
    }
  }

  async rescanSubProjects(rootPath: string): Promise<ScannedSubProject[]> {
    const subProjects: ScannedSubProject[] = []
    await this.scanRecursive(rootPath, subProjects, 0)
    return subProjects
  }

  private async scanRecursive(dirPath: string, subProjects: ScannedSubProject[], depth: number): Promise<void> {
    if (depth > 5) return

    const entries = await this.safeReaddir(dirPath)
    if (entries.length === 0) return

    const csprojFiles = entries.filter(e => e.endsWith('.csproj'))
    for (const csproj of csprojFiles) {
      const csprojPath = path.join(dirPath, csproj)
      const info = await this.parseCsproj(csprojPath)
      const hasProgramCs = await this.fileExists(path.join(dirPath, 'Program.cs'))
      const appsettingsFiles = await this.findAppsettingsFiles(dirPath)
      const port = await this.detectPort(dirPath)

      subProjects.push({
        id: this.generateId(csprojPath),
        name: csproj.replace('.csproj', ''),
        csprojPath,
        dirPath,
        kind: (info.isWeb || hasProgramCs) ? 'runnable' : 'library',
        targetFramework: info.targetFramework,
        port,
        appsettingsFiles
      })
    }

    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry) || entry.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry)
      try {
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          await this.scanRecursive(fullPath, subProjects, depth + 1)
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  }

  private async parseCsproj(csprojPath: string): Promise<{ isWeb: boolean; targetFramework?: string }> {
    try {
      const content = await fs.readFile(csprojPath, 'utf-8')
      const parsed = this.xmlParser.parse(content)
      const project = parsed.Project
      if (!project) return { isWeb: false }

      const sdk: string = project['@_Sdk'] || ''
      const isWeb = sdk.includes('Microsoft.NET.Sdk.Web')

      const propertyGroup = Array.isArray(project.PropertyGroup) ? project.PropertyGroup[0] : project.PropertyGroup
      const targetFramework = propertyGroup?.TargetFramework

      return { isWeb, targetFramework }
    } catch {
      return { isWeb: false }
    }
  }

  private async findAppsettingsFiles(dirPath: string): Promise<string[]> {
    const entries = await this.safeReaddir(dirPath)
    return entries
      .filter(e => e.startsWith('appsettings') && e.endsWith('.json'))
      .map(e => path.join(dirPath, e))
      .sort()
  }

  private async detectPort(dirPath: string): Promise<number | undefined> {
    const launchSettingsPath = path.join(dirPath, 'Properties', 'launchSettings.json')
    try {
      const content = await fs.readFile(launchSettingsPath, 'utf-8')
      const settings = JSON.parse(content)
      const profiles = settings.profiles || {}
      for (const profile of Object.values(profiles) as any[]) {
        const url = profile.applicationUrl
        if (url) {
          const match = url.match(/:(\d+)/)
          if (match) return parseInt(match[1], 10)
        }
      }
    } catch {
      // No launch settings
    }
    return undefined
  }

  private async getCurrentBranch(dirPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dirPath })
      return stdout.trim()
    } catch {
      return undefined
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async safeReaddir(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    } catch {
      return []
    }
  }

  generateId(filePath: string): string {
    let hash = 0
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(36)
  }
}
