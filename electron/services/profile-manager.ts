import { ConfigManager } from './config-manager'
import { ConfigFileManager } from './config-file-manager'
import type { ProjectType } from './project-types/project-type-handler'

export class ProfileManager {
  private config: ConfigManager
  private configFileManager: ConfigFileManager

  constructor(config: ConfigManager, configFileManager: ConfigFileManager) {
    this.config = config
    this.configFileManager = configFileManager
  }

  async listProfiles(projectId: string, filePath: string): Promise<string[]> {
    return this.config.getProfileNames(projectId, filePath)
  }

  async saveProfile(projectId: string, filePath: string, name: string, currentData: Record<string, unknown>, projectType: ProjectType): Promise<void> {
    const baseline = await this.ensureBaseline(projectId, filePath, projectType)
    const overlay = this.extractDiff(currentData, baseline)
    await this.config.setProfile(projectId, filePath, name, overlay, baseline)
  }

  async applyProfile(projectId: string, filePath: string, name: string, projectType: ProjectType): Promise<{ merged: Record<string, unknown> | null; error?: string }> {
    const baseline = await this.ensureBaseline(projectId, filePath, projectType)
    const overlay = await this.config.getProfileOverlay(projectId, filePath, name)
    if (!overlay) return { merged: null, error: 'Profile not found' }
    const merged = this.deepMerge(baseline, overlay)
    return { merged }
  }

  async deleteProfile(projectId: string, filePath: string, name: string): Promise<void> {
    await this.config.deleteProfile(projectId, filePath, name)
  }

  async getBaseline(projectId: string, filePath: string): Promise<Record<string, unknown> | null> {
    return this.config.getBaseline(projectId, filePath)
  }

  async resetBaseline(projectId: string, filePath: string, projectType: ProjectType): Promise<Record<string, unknown>> {
    const diskData = await this.configFileManager.read(filePath, projectType) as Record<string, unknown>
    await this.config.setBaseline(projectId, filePath, diskData)
    return diskData
  }

  private async ensureBaseline(projectId: string, filePath: string, projectType: ProjectType): Promise<Record<string, unknown>> {
    const stored = await this.config.getBaseline(projectId, filePath)
    if (stored) return stored
    const diskData = await this.configFileManager.read(filePath, projectType) as Record<string, unknown>
    await this.config.setBaseline(projectId, filePath, diskData)
    return diskData
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
