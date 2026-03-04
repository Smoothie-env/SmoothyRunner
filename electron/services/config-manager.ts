import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface ProjectGroup {
  id: string
  name: string
  order: number
}

export interface FolderProjectConfig {
  id: string
  name: string
  rootPath: string
  originalRootPath: string
  activeWorktreePath?: string
  hasDockerCompose: boolean
  dockerComposePath?: string
  hasDevContainer: boolean
  devContainerPath?: string
  groupId?: string
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

export interface FileProfileData {
  baseline: Record<string, unknown> | null
  profiles: Record<string, Record<string, unknown>>
}

export interface ProjectProfileData {
  files: Record<string, FileProfileData>
}

export interface TaskFlowConfig {
  id: string
  name: string
  steps: TaskFlowStepConfig[]
  createdAt: string
  updatedAt: string
}

export interface TaskFlowStepConfig {
  id: string
  type: 'process'
  projectId: string
  subProjectId: string
  branch: string | null
  mode: 'watch' | 'release' | 'devcontainer'
  profiles: { filePath: string; profileName: string }[]
  branchStrategy: 'checkout' | 'worktree'
  worktreePath?: string | null
  portOverride?: number | null
  order: number
}

export interface SmoothyConfig {
  folderProjects: FolderProjectConfig[]
  profiles: Record<string, ProjectProfileData>
  groups: ProjectGroup[]
  taskFlows: TaskFlowConfig[]
}

interface LegacySmoothyConfig {
  projects?: LegacyProjectConfig[]
  folderProjects?: FolderProjectConfig[]
  profiles: Record<string, unknown>
}

export class ConfigManager {
  private configDir: string
  private configPath: string
  private config: SmoothyConfig | null = null

  constructor() {
    this.configDir = path.join(os.homedir(), '.smoothy-runner')
    this.configPath = path.join(this.configDir, 'smoothy-projects.json')
  }

  private async ensureConfigDir(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true })
  }

  private async load(): Promise<SmoothyConfig> {
    if (this.config) return this.config

    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      const raw = JSON.parse(content) as LegacySmoothyConfig

      // Migrate old format
      if (raw.projects && !raw.folderProjects) {
        this.config = this.migrateFromLegacy(raw)
        await this.save()
        return this.config
      }

      const rawProfiles = (raw.profiles || {}) as Record<string, unknown>
      const migratedProfiles: Record<string, ProjectProfileData> = {}
      for (const [key, value] of Object.entries(rawProfiles)) {
        const val = value as Record<string, unknown>
        if (val && typeof val === 'object' && 'files' in val) {
          migratedProfiles[key] = val as ProjectProfileData
        } else {
          // Old format — reset (old profiles were broken anyway)
          migratedProfiles[key] = { files: {} }
        }
      }

      const taskFlows: TaskFlowConfig[] = ((raw as any).taskFlows || []).map((flow: TaskFlowConfig) => ({
        ...flow,
        steps: flow.steps.map(step => ({
          ...step,
          branchStrategy: step.branchStrategy || 'checkout'
        }))
      }))

      this.config = {
        folderProjects: raw.folderProjects || [],
        profiles: migratedProfiles,
        groups: (raw as any).groups || [],
        taskFlows
      }
      return this.config
    } catch {
      this.config = { folderProjects: [], profiles: {}, groups: [], taskFlows: [] }
      return this.config
    }
  }

  private migrateFromLegacy(raw: LegacySmoothyConfig): SmoothyConfig {
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
        dockerComposePath: _group.find(p => p.dockerComposePath)?.dockerComposePath,
        hasDevContainer: false
      })
    }

    return {
      folderProjects,
      profiles: raw.profiles || {},
      groups: [],
      taskFlows: []
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
  private ensureFileEntry(config: SmoothyConfig, projectId: string, filePath: string): FileProfileData {
    if (!config.profiles[projectId]) {
      config.profiles[projectId] = { files: {} }
    }
    if (!config.profiles[projectId].files[filePath]) {
      config.profiles[projectId].files[filePath] = { baseline: null, profiles: {} }
    }
    return config.profiles[projectId].files[filePath]
  }

  async getProfileNames(projectId: string, filePath: string): Promise<string[]> {
    const config = await this.load()
    const projectData = config.profiles[projectId]
    if (!projectData?.files[filePath]) return []
    return Object.keys(projectData.files[filePath].profiles)
  }

  async getProfileOverlay(projectId: string, filePath: string, name: string): Promise<Record<string, unknown> | null> {
    const config = await this.load()
    const projectData = config.profiles[projectId]
    if (!projectData?.files[filePath]) return null
    return projectData.files[filePath].profiles[name] || null
  }

  async getBaseline(projectId: string, filePath: string): Promise<Record<string, unknown> | null> {
    const config = await this.load()
    const projectData = config.profiles[projectId]
    if (!projectData?.files[filePath]) return null
    return projectData.files[filePath].baseline
  }

  async setProfile(projectId: string, filePath: string, name: string, overlay: Record<string, unknown>, baseline: Record<string, unknown> | null): Promise<void> {
    const config = await this.load()
    const entry = this.ensureFileEntry(config, projectId, filePath)
    entry.profiles[name] = overlay
    if (entry.baseline === null && baseline !== null) {
      entry.baseline = baseline
    }
    await this.save()
  }

  async setBaseline(projectId: string, filePath: string, baseline: Record<string, unknown>): Promise<void> {
    const config = await this.load()
    const entry = this.ensureFileEntry(config, projectId, filePath)
    entry.baseline = baseline
    await this.save()
  }

  async deleteProfile(projectId: string, filePath: string, name: string): Promise<void> {
    const config = await this.load()
    const projectData = config.profiles[projectId]
    if (!projectData?.files[filePath]) return
    delete projectData.files[filePath].profiles[name]
    // Cleanup empty entries
    if (Object.keys(projectData.files[filePath].profiles).length === 0) {
      delete projectData.files[filePath]
    }
    if (Object.keys(projectData.files).length === 0) {
      delete config.profiles[projectId]
    }
    await this.save()
  }

  // Groups CRUD
  async listGroups(): Promise<ProjectGroup[]> {
    const config = await this.load()
    return config.groups
  }

  async addGroup(name: string): Promise<ProjectGroup> {
    const config = await this.load()
    const maxOrder = config.groups.reduce((max, g) => Math.max(max, g.order), 0)
    const group: ProjectGroup = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      order: maxOrder + 1
    }
    config.groups.push(group)
    await this.save()
    return group
  }

  async renameGroup(id: string, name: string): Promise<void> {
    const config = await this.load()
    const group = config.groups.find(g => g.id === id)
    if (group) {
      group.name = name
      await this.save()
    }
  }

  async removeGroup(id: string): Promise<void> {
    const config = await this.load()
    config.groups = config.groups.filter(g => g.id !== id)
    // Ungroup projects that belonged to this group
    for (const p of config.folderProjects) {
      if (p.groupId === id) {
        p.groupId = undefined
      }
    }
    await this.save()
  }

  async setProjectGroup(projectId: string, groupId: string | null): Promise<void> {
    const config = await this.load()
    const project = config.folderProjects.find(p => p.id === projectId)
    if (project) {
      project.groupId = groupId || undefined
      await this.save()
    }
  }

  // Task Flows CRUD
  async listTaskFlows(): Promise<TaskFlowConfig[]> {
    const config = await this.load()
    return config.taskFlows
  }

  async getTaskFlow(id: string): Promise<TaskFlowConfig | undefined> {
    const config = await this.load()
    return config.taskFlows.find(f => f.id === id)
  }

  async addTaskFlow(flow: TaskFlowConfig): Promise<void> {
    const config = await this.load()
    config.taskFlows.push(flow)
    await this.save()
  }

  async updateTaskFlow(id: string, updates: Partial<TaskFlowConfig>): Promise<void> {
    const config = await this.load()
    const index = config.taskFlows.findIndex(f => f.id === id)
    if (index >= 0) {
      config.taskFlows[index] = { ...config.taskFlows[index], ...updates, updatedAt: new Date().toISOString() }
      await this.save()
    }
  }

  async removeTaskFlow(id: string): Promise<void> {
    const config = await this.load()
    config.taskFlows = config.taskFlows.filter(f => f.id !== id)
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
