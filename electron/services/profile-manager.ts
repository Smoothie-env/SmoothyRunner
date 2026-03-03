import fs from 'fs/promises'
import { ConfigManager } from './config-manager'
import { ProjectScanner } from './project-scanner'

export class ProfileManager {
  private config: ConfigManager
  private scanner: ProjectScanner

  constructor(config: ConfigManager, scanner?: ProjectScanner) {
    this.config = config
    this.scanner = scanner || new ProjectScanner()
  }

  async listProfiles(projectId: string): Promise<string[]> {
    const profiles = await this.config.getProfiles(projectId)
    return Object.keys(profiles)
  }

  async saveProfile(projectId: string, name: string, overlay: unknown): Promise<void> {
    await this.config.setProfile(projectId, name, overlay)
  }

  async applyProfile(projectId: string, name: string): Promise<{ success: boolean; error?: string }> {
    const project = await this.config.getFolderProject(projectId)
    if (!project) return { success: false, error: 'Project not found' }

    const profiles = await this.config.getProfiles(projectId)
    const overlay = profiles[name]
    if (!overlay) return { success: false, error: 'Profile not found' }

    // Rescan to find appsettings files
    const subProjects = await this.scanner.rescanSubProjects(project.rootPath)
    const allAppsettingsFiles = subProjects.flatMap(sp => sp.appsettingsFiles)

    const devSettings = allAppsettingsFiles.find(f => f.includes('Development'))
    if (!devSettings) return { success: false, error: 'No Development appsettings found' }

    const baseContent = await fs.readFile(devSettings, 'utf-8')
    const base = JSON.parse(baseContent)

    const merged = this.deepMerge(base, overlay as Record<string, unknown>)

    await fs.writeFile(devSettings, JSON.stringify(merged, null, 2), 'utf-8')

    return { success: true }
  }

  async deleteProfile(projectId: string, name: string): Promise<void> {
    await this.config.deleteProfile(projectId, name)
  }

  async previewProfile(projectId: string, name: string): Promise<{ merged: unknown; error?: string }> {
    const project = await this.config.getFolderProject(projectId)
    if (!project) return { merged: null, error: 'Project not found' }

    const profiles = await this.config.getProfiles(projectId)
    const overlay = profiles[name]
    if (!overlay) return { merged: null, error: 'Profile not found' }

    const subProjects = await this.scanner.rescanSubProjects(project.rootPath)
    const allAppsettingsFiles = subProjects.flatMap(sp => sp.appsettingsFiles)

    const devSettings = allAppsettingsFiles.find(f => f.includes('Development'))
    if (!devSettings) return { merged: null, error: 'No Development appsettings found' }

    const baseContent = await fs.readFile(devSettings, 'utf-8')
    const base = JSON.parse(baseContent)

    return { merged: this.deepMerge(base, overlay as Record<string, unknown>) }
  }

  extractDiff(current: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> {
    const diff: Record<string, unknown> = {}

    for (const key of Object.keys(current)) {
      const currentVal = current[key]
      const baseVal = base[key]

      if (baseVal === undefined) {
        diff[key] = currentVal
      } else if (
        typeof currentVal === 'object' && currentVal !== null && !Array.isArray(currentVal) &&
        typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal)
      ) {
        const nested = this.extractDiff(currentVal as Record<string, unknown>, baseVal as Record<string, unknown>)
        if (Object.keys(nested).length > 0) {
          diff[key] = nested
        }
      } else if (JSON.stringify(currentVal) !== JSON.stringify(baseVal)) {
        diff[key] = currentVal
      }
    }

    return diff
  }

  private deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
    const result = { ...base }

    for (const key of Object.keys(overlay)) {
      const overlayVal = overlay[key]
      const baseVal = result[key]

      if (Array.isArray(overlayVal)) {
        result[key] = overlayVal
      } else if (
        typeof overlayVal === 'object' && overlayVal !== null &&
        typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal)
      ) {
        result[key] = this.deepMerge(baseVal as Record<string, unknown>, overlayVal as Record<string, unknown>)
      } else {
        result[key] = overlayVal
      }
    }

    return result
  }
}
