import fs from 'fs/promises'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import type {
  ProjectTypeHandler,
  ScannedSubProject,
  ScannedDotnetSubProject,
  LaunchCommand,
  LaunchMode,
  ConfigFileHandler
} from './project-type-handler'

function stripJsonComments(content: string): string {
  let result = ''
  let i = 0
  let inString = false
  let escape = false

  while (i < content.length) {
    const ch = content[i]
    const next = content[i + 1]

    if (inString) {
      result += ch
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      i++
      continue
    }

    if (ch === '"') {
      inString = true
      result += ch
      i++
      continue
    }

    if (ch === '/' && next === '/') {
      i += 2
      while (i < content.length && content[i] !== '\n') i++
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++
      i += 2
      continue
    }

    result += ch
    i++
  }

  return result
}

function generateId(filePath: string): string {
  let hash = 0
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export class DotnetHandler implements ProjectTypeHandler {
  readonly type = 'dotnet' as const
  private xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

  async detect(dirEntries: string[]): Promise<boolean> {
    return dirEntries.some(e => e.endsWith('.csproj'))
  }

  async scan(dirPath: string): Promise<ScannedDotnetSubProject[]> {
    const entries = await this.safeReaddir(dirPath)
    const csprojFiles = entries.filter(e => e.endsWith('.csproj'))
    const results: ScannedDotnetSubProject[] = []

    for (const csproj of csprojFiles) {
      const csprojPath = path.join(dirPath, csproj)
      const info = await this.parseCsproj(csprojPath)
      const hasProgramCs = await this.fileExists(path.join(dirPath, 'Program.cs'))
      const configFiles = await this.findAppsettingsFiles(dirPath)
      const port = await this.detectPort(dirPath)

      const kind = (info.isWeb || hasProgramCs) ? 'runnable' as const
        : info.isPackable ? 'package' as const
        : 'library' as const

      results.push({
        id: generateId(csprojPath),
        name: csproj.replace('.csproj', ''),
        projectType: 'dotnet',
        csprojPath,
        dirPath,
        kind,
        targetFramework: info.targetFramework,
        version: info.version,
        port,
        configFiles
      })
    }

    return results
  }

  getLaunchCommand(subProject: ScannedSubProject, mode: LaunchMode, rootPath: string, portOverride?: number): LaunchCommand {
    const sp = subProject as ScannedDotnetSubProject
    const env: Record<string, string> = {}

    if (portOverride) {
      env.ASPNETCORE_URLS = `http://localhost:${portOverride}`
      env.ASPNETCORE_ENVIRONMENT = 'Development'
    }

    if (mode === 'release') {
      const args = ['run', '-c', 'Release']
      if (portOverride) args.push('--no-launch-profile')
      if (sp.csprojPath) args.push('--project', sp.csprojPath)
      return { command: 'dotnet', args, cwd: sp.dirPath, env: Object.keys(env).length ? env : undefined }
    }

    // watch mode (default)
    const args = ['watch', 'run']
    if (portOverride) args.push('--no-launch-profile')
    if (sp.csprojPath) args.push('--project', sp.csprojPath)
    env.DOTNET_WATCH_RESTART_ON_RUDE_EDIT = 'true'
    return {
      command: 'dotnet',
      args,
      cwd: sp.dirPath,
      env
    }
  }

  getDevcontainerCommand(subProject: ScannedSubProject, rootPath: string): LaunchCommand {
    const sp = subProject as ScannedDotnetSubProject
    const workspaceFolder = rootPath || sp.dirPath
    const relativeCsproj = sp.csprojPath
      ? path.relative(workspaceFolder, sp.csprojPath)
      : undefined

    const args = ['exec', '--workspace-folder', workspaceFolder, 'dotnet', 'run']
    if (relativeCsproj) args.push('--project', relativeCsproj)

    return { command: 'devcontainer', args, cwd: workspaceFolder }
  }

  getConfigFileHandler(): ConfigFileHandler {
    return {
      async read(filePath: string): Promise<Record<string, unknown>> {
        const content = await fs.readFile(filePath, 'utf-8')
        return JSON.parse(stripJsonComments(content))
      },
      async write(filePath: string, data: Record<string, unknown>): Promise<void> {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      }
    }
  }

  private async parseCsproj(csprojPath: string): Promise<{ isWeb: boolean; targetFramework?: string; version?: string; isPackable: boolean }> {
    try {
      const content = await fs.readFile(csprojPath, 'utf-8')
      const parsed = this.xmlParser.parse(content)
      const project = parsed.Project
      if (!project) return { isWeb: false, isPackable: false }

      const sdk: string = project['@_Sdk'] || ''
      const isWeb = sdk.includes('Microsoft.NET.Sdk.Web')

      const propertyGroups = Array.isArray(project.PropertyGroup) ? project.PropertyGroup : [project.PropertyGroup]
      const targetFramework = propertyGroups[0]?.TargetFramework

      let version: string | undefined
      let isPackable = false
      for (const pg of propertyGroups) {
        if (pg?.Version) version = String(pg.Version)
        if (pg?.GeneratePackageOnBuild === true || pg?.GeneratePackageOnBuild === 'true') isPackable = true
        if (pg?.PackageId) isPackable = true
        if (pg?.PackageIcon || pg?.PackageIconUrl) isPackable = true
        if (pg?.IsPackable === false || pg?.IsPackable === 'false') isPackable = false
      }

      return { isWeb, targetFramework, version, isPackable }
    } catch {
      return { isWeb: false, isPackable: false }
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
}
