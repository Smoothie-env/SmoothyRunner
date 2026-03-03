import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface FolderProjectConfig {
  id: string
  name: string
  rootPath: string
  originalRootPath: string
  activeWorktreePath?: string
  hasDockerCompose: boolean
  dockerComposePath?: string
}

// Old format for migration
interface LegacyProjectConfig {
  id: string
  name: string
  path: string
  type: 'dotnet' | 'angular'
  csprojPath?: string
  isRunnable: boolean
  targetFramework?: string
  port?: number
  appsettingsFiles: string[]
  hasDockerCompose: boolean
  dockerComposePath?: string
}

export interface SparkConfig {
  folderProjects: FolderProjectConfig[]
  profiles: Record<string, Record<string, unknown>>
}

interface LegacySparkConfig {
  projects?: LegacyProjectConfig[]
  folderProjects?: FolderProjectConfig[]
  profiles: Record<string, Record<string, unknown>>
}

export class ConfigManager {
  private configDir: string
  private configPath: string
  private config: SparkConfig | null = null

  constructor() {
    this.configDir = path.join(os.homedir(), '.spark-project-manager')
    this.configPath = path.join(this.configDir, 'spark-projects.json')
  }

  private async ensureConfigDir(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true })
  }

  private async load(): Promise<SparkConfig> {
    if (this.config) return this.config

    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      const raw = JSON.parse(content) as LegacySparkConfig

      // Migrate old format
      if (raw.projects && !raw.folderProjects) {
        this.config = this.migrateFromLegacy(raw)
        await this.save()
        return this.config
      }

      this.config = {
        folderProjects: raw.folderProjects || [],
        profiles: raw.profiles || {}
      }
      return this.config
    } catch {
      this.config = { folderProjects: [], profiles: {} }
      return this.config
    }
  }

  private migrateFromLegacy(raw: LegacySparkConfig): SparkConfig {
    const projects = raw.projects || []
    const grouped = new Map<string, LegacyProjectConfig[]>()

    for (const p of projects) {
      // Group by parent directory
      const parentDir = path.dirname(p.path)
      const existing = grouped.get(parentDir) || []
      existing.push(p)
      grouped.set(parentDir, existing)
    }

    const folderProjects: FolderProjectConfig[] = []
    for (const [dirPath, _group] of grouped) {
      const id = this.generateId(dirPath)
      folderProjects.push({
        id,
        name: path.basename(dirPath),
        rootPath: dirPath,
        originalRootPath: dirPath,
        hasDockerCompose: _group.some(p => p.hasDockerCompose),
        dockerComposePath: _group.find(p => p.dockerComposePath)?.dockerComposePath
      })
    }

    return {
      folderProjects,
      profiles: raw.profiles || {}
    }
  }

  private async save(): Promise<void> {
    await this.ensureConfigDir()
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
  }

  async listFolderProjects(): Promise<FolderProjectConfig[]> {
    const config = await this.load()
    return config.folderProjects
  }

  async addFolderProject(project: FolderProjectConfig): Promise<void> {
    const config = await this.load()
    const existing = config.folderProjects.findIndex(p => p.id === project.id)
    if (existing >= 0) {
      config.folderProjects[existing] = project
    } else {
      config.folderProjects.push(project)
    }
    await this.save()
  }

  async removeFolderProject(id: string): Promise<void> {
    const config = await this.load()
    config.folderProjects = config.folderProjects.filter(p => p.id !== id)
    delete config.profiles[id]
    await this.save()
  }

  async getFolderProject(id: string): Promise<FolderProjectConfig | undefined> {
    const config = await this.load()
    return config.folderProjects.find(p => p.id === id)
  }

  async setProjectWorktree(id: string, worktreePath: string | null): Promise<void> {
    const config = await this.load()
    const project = config.folderProjects.find(p => p.id === id)
    if (project) {
      project.activeWorktreePath = worktreePath || undefined
      project.rootPath = worktreePath || project.originalRootPath
      await this.save()
    }
  }

  // Profile storage
  async getProfiles(projectId: string): Promise<Record<string, unknown>> {
    const config = await this.load()
    return config.profiles[projectId] || {}
  }

  async setProfile(projectId: string, name: string, overlay: unknown): Promise<void> {
    const config = await this.load()
    if (!config.profiles[projectId]) {
      config.profiles[projectId] = {}
    }
    config.profiles[projectId][name] = overlay
    await this.save()
  }

  async deleteProfile(projectId: string, name: string): Promise<void> {
    const config = await this.load()
    if (config.profiles[projectId]) {
      delete config.profiles[projectId][name]
    }
    await this.save()
  }

  private generateId(filePath: string): string {
    let hash = 0
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(36)
  }
}
