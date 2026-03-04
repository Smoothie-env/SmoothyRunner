export interface ProjectGroup {
  id: string
  name: string
  order: number
}

export type ProjectType = 'dotnet' | 'angular'

interface SubProjectBase {
  id: string
  name: string
  projectType: ProjectType
  dirPath: string
  port?: number
  configFiles: string[]
}

export interface DotnetSubProject extends SubProjectBase {
  projectType: 'dotnet'
  csprojPath: string
  kind: 'runnable' | 'package' | 'library'
  targetFramework?: string
  version?: string
}

export interface AngularSubProject extends SubProjectBase {
  projectType: 'angular'
  angularJsonPath: string
  packageJsonPath: string
  angularVersion?: string
  kind: 'application' | 'library'
}

export type SubProject = DotnetSubProject | AngularSubProject

export interface FolderProject {
  id: string
  name: string
  rootPath: string
  originalRootPath: string
  subProjects: SubProject[]
  solutionFile?: string
  hasDockerCompose: boolean
  dockerComposePath?: string
  hasDevContainer: boolean
  devContainerPath?: string
  branch?: string
  activeWorktreePath?: string
  groupId?: string
}

export type SidebarSelection =
  | { type: 'project'; projectId: string }
  | { type: 'subproject'; projectId: string; subProjectId: string }
  | null

export type ViewTab = 'projectFile' | 'config' | 'services' | 'docker'

export type LaunchMode = 'watch' | 'release' | 'devcontainer'

export interface ProcessInfo {
  id: string
  name: string
  projectType: string
  status: 'running' | 'stopped' | 'starting' | 'error'
  pid?: number
  port?: number
  startedAt?: string
  mode?: LaunchMode
}

export interface DockerContainer {
  name: string
  service: string
  status: 'running' | 'exited' | 'starting' | 'paused' | 'unknown'
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none'
  ports: string[]
  state: string
}

export interface Worktree {
  path: string
  branch: string
  head: string
  isBare: boolean
  isMain: boolean
}

export interface Profile {
  name: string
  filePath: string
  overlay: Record<string, unknown>
}

declare global {
  interface Window {
    smoothyApi: {
      // Folder Projects
      scanFolder: (dirPath: string) => Promise<FolderProject>
      listFolderProjects: () => Promise<FolderProject[]>
      addFolderProject: (project: FolderProject) => Promise<void>
      removeFolderProject: (id: string) => Promise<void>
      setProjectWorktree: (id: string, worktreePath: string | null) => Promise<void>
      selectDirectory: () => Promise<string | null>

      // Groups
      listGroups: () => Promise<ProjectGroup[]>
      addGroup: (name: string) => Promise<ProjectGroup>
      renameGroup: (id: string, name: string) => Promise<void>
      removeGroup: (id: string) => Promise<void>
      setProjectGroup: (projectId: string, groupId: string | null) => Promise<void>

      // File system
      readFileContent: (filePath: string) => Promise<string>
      writeFileContent: (filePath: string, content: string) => Promise<void>

      // Config files (was appsettings)
      readConfig: (filePath: string, projectType: ProjectType) => Promise<unknown>
      writeConfig: (filePath: string, data: unknown, projectType: ProjectType) => Promise<void>
      watchConfig: (filePath: string) => Promise<void>
      unwatchConfig: (filePath: string) => Promise<void>

      // Profiles
      listProfiles: (projectId: string, filePath: string) => Promise<string[]>
      saveProfile: (projectId: string, filePath: string, name: string, currentData: Record<string, unknown>, projectType: ProjectType) => Promise<void>
      applyProfile: (projectId: string, filePath: string, name: string, projectType: ProjectType) => Promise<{ merged: Record<string, unknown> | null; error?: string }>
      deleteProfile: (projectId: string, filePath: string, name: string) => Promise<void>
      getBaseline: (projectId: string, filePath: string) => Promise<Record<string, unknown> | null>
      resetBaseline: (projectId: string, filePath: string, projectType: ProjectType) => Promise<Record<string, unknown>>

      // Process
      startProcess: (config: unknown) => Promise<ProcessInfo>
      stopProcess: (id: string) => Promise<void>
      restartProcess: (id: string) => Promise<ProcessInfo>
      listProcesses: () => Promise<ProcessInfo[]>
      killPort: (port: number) => Promise<void>

      // Docker
      dockerStatus: (composePath: string, profiles: string[]) => Promise<DockerContainer[]>
      dockerUp: (composePath: string, services: string[], profiles: string[]) => Promise<void>
      dockerDown: (composePath: string, services: string[], profiles: string[]) => Promise<void>
      dockerRestart: (composePath: string, services: string[], profiles: string[]) => Promise<void>
      dockerLogs: (composePath: string, service: string) => Promise<string>

      // Git
      gitBranches: (repoPath: string) => Promise<{ local: string[]; remote: string[] }>
      gitCurrentBranch: (repoPath: string) => Promise<string>
      gitWorktreeList: (repoPath: string) => Promise<Worktree[]>
      gitWorktreeAdd: (repoPath: string, branch: string, path: string) => Promise<void>
      gitWorktreeRemove: (worktreePath: string) => Promise<void>

      // Git — checkout & dirty check
      gitCheckout: (repoPath: string, branch: string) => Promise<void>
      gitIsDirty: (repoPath: string) => Promise<boolean>
      gitStash: (repoPath: string, message?: string) => Promise<void>
      gitStashPop: (repoPath: string) => Promise<void>

      // Events
      onProcessLog: (callback: (data: { id: string; data: string }) => void) => () => void
      onConfigChanged: (callback: (data: { filePath: string }) => void) => () => void
      onDockerStatus: (callback: (data: unknown) => void) => () => void
      onBranchChanged: (callback: (data: { repoPath: string; branch: string }) => void) => () => void
    }
  }
}
