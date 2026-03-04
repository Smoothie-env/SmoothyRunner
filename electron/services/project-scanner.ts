import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getAllHandlers } from './project-types/registry'
import type { ScannedSubProject } from './project-types/project-type-handler'

const execFileAsync = promisify(execFile)

export type { ScannedSubProject }

export interface ScannedFolderProject {
  id: string
  name: string
  rootPath: string
  originalRootPath: string
  subProjects: ScannedSubProject[]
  solutionFile?: string
  hasDockerCompose: boolean
  dockerComposePath?: string
  hasDevContainer: boolean
  devContainerPath?: string
  branch?: string
  activeWorktreePath?: string
}

const EXCLUDE_DIRS = new Set(['bin', 'obj', 'node_modules', '.git', 'dist', 'wwwroot', '.vs', '.idea', 'packages'])

export class ProjectScanner {
  async scanFolder(dirPath: string): Promise<ScannedFolderProject> {
    const subProjects: ScannedSubProject[] = []
    await this.scanRecursive(dirPath, subProjects, 0, dirPath)

    const rootEntries = await this.safeReaddir(dirPath)

    const slnFile = rootEntries.find(e => e.endsWith('.sln'))
    const hasDockerCompose = rootEntries.includes('docker-compose.yml') || rootEntries.includes('docker-compose.yaml')
    const dockerComposePath = hasDockerCompose
      ? path.join(dirPath, rootEntries.includes('docker-compose.yml') ? 'docker-compose.yml' : 'docker-compose.yaml')
      : undefined

    const devContainerJsonPath = path.join(dirPath, '.devcontainer', 'devcontainer.json')
    const hasDevContainer = await this.fileExists(devContainerJsonPath)

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
      hasDevContainer,
      devContainerPath: hasDevContainer ? devContainerJsonPath : undefined,
      branch
    }
  }

  async rescanSubProjects(rootPath: string): Promise<ScannedSubProject[]> {
    const subProjects: ScannedSubProject[] = []
    await this.scanRecursive(rootPath, subProjects, 0, rootPath)
    return subProjects
  }

  private async scanRecursive(dirPath: string, subProjects: ScannedSubProject[], depth: number, rootPath: string): Promise<void> {
    if (depth > 5) return

    const entries = await this.safeReaddir(dirPath)
    if (entries.length === 0) return

    // Ask each handler if it detects its project type in this directory
    const handlers = getAllHandlers()
    for (const handler of handlers) {
      const detected = await handler.detect(entries, dirPath)
      if (detected) {
        const scanned = await handler.scan(dirPath, rootPath)
        subProjects.push(...scanned)
      }
    }

    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry) || entry.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry)
      try {
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          await this.scanRecursive(fullPath, subProjects, depth + 1, rootPath)
        }
      } catch {
        // Skip inaccessible entries
      }
    }
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
