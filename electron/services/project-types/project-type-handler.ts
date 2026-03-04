export type ProjectType = 'dotnet' | 'angular'

export interface LaunchCommand {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
  shell?: boolean
}

export interface ScannedSubProjectBase {
  id: string
  name: string
  projectType: ProjectType
  dirPath: string
  port?: number
  configFiles: string[]
}

export interface ScannedDotnetSubProject extends ScannedSubProjectBase {
  projectType: 'dotnet'
  csprojPath: string
  kind: 'runnable' | 'package' | 'library'
  targetFramework?: string
  version?: string
}

export interface ScannedAngularSubProject extends ScannedSubProjectBase {
  projectType: 'angular'
  angularJsonPath: string
  packageJsonPath: string
  angularVersion?: string
  kind: 'application' | 'library'
}

export type ScannedSubProject = ScannedDotnetSubProject | ScannedAngularSubProject

export type LaunchMode = 'watch' | 'release' | 'devcontainer'

export interface ConfigFileHandler {
  read(filePath: string): Promise<Record<string, unknown>>
  write(filePath: string, data: Record<string, unknown>): Promise<void>
}

export interface ProjectTypeHandler {
  readonly type: ProjectType
  detect(dirEntries: string[], dirPath: string): Promise<boolean>
  scan(dirPath: string, rootPath: string): Promise<ScannedSubProject[]>
  getLaunchCommand(subProject: ScannedSubProject, mode: LaunchMode, rootPath: string, portOverride?: number): LaunchCommand
  getDevcontainerCommand(subProject: ScannedSubProject, rootPath: string): LaunchCommand
  getConfigFileHandler(): ConfigFileHandler
}
