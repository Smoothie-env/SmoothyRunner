import fs from 'fs/promises'
import path from 'path'
import type {
  ProjectTypeHandler,
  ScannedSubProject,
  ScannedAngularSubProject,
  LaunchCommand,
  LaunchMode,
  ConfigFileHandler
} from './project-type-handler'

function generateId(filePath: string): string {
  let hash = 0
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export class AngularHandler implements ProjectTypeHandler {
  readonly type = 'angular' as const

  async detect(dirEntries: string[]): Promise<boolean> {
    return dirEntries.includes('angular.json')
  }

  async scan(dirPath: string): Promise<ScannedAngularSubProject[]> {
    const angularJsonPath = path.join(dirPath, 'angular.json')
    const packageJsonPath = path.join(dirPath, 'package.json')
    const results: ScannedAngularSubProject[] = []

    try {
      const angularJson = JSON.parse(await fs.readFile(angularJsonPath, 'utf-8'))
      const angularVersion = await this.getAngularVersion(packageJsonPath)
      const projects = angularJson.projects || {}

      for (const [name, config] of Object.entries(projects) as [string, any][]) {
        const projectType = config.projectType || 'application'
        const kind = projectType === 'application' ? 'application' as const : 'library' as const
        const projectRoot = path.join(dirPath, config.root || '')

        const port = config.architect?.serve?.options?.port as number | undefined
        const configFiles = await this.findEnvironmentFiles(projectRoot, config)

        results.push({
          id: generateId(path.join(angularJsonPath, name)),
          name,
          projectType: 'angular',
          angularJsonPath,
          packageJsonPath,
          dirPath: projectRoot,
          kind,
          angularVersion,
          port,
          configFiles
        })
      }
    } catch {
      // Invalid angular.json
    }

    return results
  }

  getLaunchCommand(subProject: ScannedSubProject, mode: LaunchMode, rootPath?: string, portOverride?: number): LaunchCommand {
    const sp = subProject as ScannedAngularSubProject
    const cwd = path.dirname(sp.angularJsonPath)

    if (mode === 'release') {
      return {
        command: 'npx',
        args: ['ng', 'build', '--configuration', 'production'],
        cwd,
        shell: true
      }
    }

    // watch mode (default)
    const args = ['ng', 'serve']
    if (portOverride) args.push('--port', String(portOverride))
    return {
      command: 'npx',
      args,
      cwd,
      shell: true
    }
  }

  getDevcontainerCommand(subProject: ScannedSubProject, rootPath: string): LaunchCommand {
    const sp = subProject as ScannedAngularSubProject
    const workspaceFolder = rootPath || path.dirname(sp.angularJsonPath)

    return {
      command: 'devcontainer',
      args: ['exec', '--workspace-folder', workspaceFolder, 'npx', 'ng', 'serve'],
      cwd: workspaceFolder
    }
  }

  getConfigFileHandler(): ConfigFileHandler {
    return {
      async read(filePath: string): Promise<Record<string, unknown>> {
        const content = await fs.readFile(filePath, 'utf-8')
        const match = content.match(/export\s+const\s+\w+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
        if (!match) return {}
        const obj = new Function(`return (${match[1]})`)()
        return obj as Record<string, unknown>
      },
      async write(filePath: string, data: Record<string, unknown>): Promise<void> {
        const existing = await fs.readFile(filePath, 'utf-8').catch(() => '')
        const nameMatch = existing.match(/export\s+const\s+(\w+)\s*=/)
        const varName = nameMatch?.[1] || 'environment'

        const serialized = JSON.stringify(data, null, 2)
          .replace(/"([^"]+)":/g, '$1:')
          .replace(/"/g, "'")

        const newContent = `export const ${varName} = ${serialized};\n`
        await fs.writeFile(filePath, newContent, 'utf-8')
      }
    }
  }

  private async getAngularVersion(packageJsonPath: string): Promise<string | undefined> {
    try {
      const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      const ver = pkg.dependencies?.['@angular/core'] || pkg.devDependencies?.['@angular/core']
      if (ver) return ver.replace(/^[~^]/, '')
    } catch {
      // No package.json
    }
    return undefined
  }

  private async findEnvironmentFiles(projectRoot: string, config: any): Promise<string[]> {
    // Look in standard Angular environment locations
    const envDirs = [
      path.join(projectRoot, 'src', 'environments'),
      path.join(projectRoot, 'environments')
    ]

    const files: string[] = []
    for (const envDir of envDirs) {
      try {
        const entries = await fs.readdir(envDir)
        const envFiles = entries
          .filter(e => e.startsWith('environment') && e.endsWith('.ts'))
          .map(e => path.join(envDir, e))
        files.push(...envFiles)
      } catch {
        // Directory doesn't exist
      }
    }

    return files.sort()
  }
}
