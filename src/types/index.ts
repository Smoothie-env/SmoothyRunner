export interface SubProject {
  id: string
  name: string
  csprojPath: string
  dirPath: string
  kind: 'runnable' | 'library'
  targetFramework?: string
  port?: number
  appsettingsFiles: string[]
}

export interface FolderProject {
  id: string
  name: string
  rootPath: string
  originalRootPath: string
  subProjects: SubProject[]
  solutionFile?: string
  hasDockerCompose: boolean
  dockerComposePath?: string
  branch?: string
  activeWorktreePath?: string
}

export type SidebarSelection =
  | { type: 'project'; projectId: string }
  | { type: 'subproject'; projectId: string; subProjectId: string }
  | null

export type ViewTab = 'csproj' | 'appsettings' | 'services' | 'docker'

export interface ProcessInfo {
  id: string
  name: string
  type: string
  status: 'running' | 'stopped' | 'starting' | 'error'
  pid?: number
  port?: number
  startedAt?: string
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
  overlay: Record<string, unknown>
}

declare global {
  interface Window {
    sparkApi: {
      // Folder Projects
      scanFolder: (dirPath: string) => Promise<FolderProject>
      listFolderProjects: () => Promise<FolderProject[]>
      addFolderProject: (project: FolderProject) => Promise<void>
      removeFolderProject: (id: string) => Promise<void>
      setProjectWorktree: (id: string, worktreePath: string | null) => Promise<void>
      selectDirectory: () => Promise<string | null>

      // File system
      readFileContent: (filePath: string) => Promise<string>

      // Appsettings
      readAppsettings: (filePath: string) => Promise<unknown>
      writeAppsettings: (filePath: string, data: unknown) => Promise<void>
      watchAppsettings: (filePath: string) => Promise<void>
      unwatchAppsettings: (filePath: string) => Promise<void>

      // Profiles
      listProfiles: (projectId: string) => Promise<string[]>
      saveProfile: (projectId: string, name: string, overlay: unknown) => Promise<void>
      applyProfile: (projectId: string, name: string) => Promise<{ success: boolean; error?: string }>
      deleteProfile: (projectId: string, name: string) => Promise<void>
      previewProfile: (projectId: string, name: string) => Promise<{ merged: unknown; error?: string }>

      // Process
      startProcess: (config: unknown) => Promise<ProcessInfo>
      stopProcess: (id: string) => Promise<void>
      restartProcess: (id: string) => Promise<ProcessInfo>
      listProcesses: () => Promise<ProcessInfo[]>

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

      // Events
      onProcessLog: (callback: (data: { id: string; data: string }) => void) => () => void
      onAppsettingsChanged: (callback: (data: { filePath: string }) => void) => () => void
      onDockerStatus: (callback: (data: unknown) => void) => () => void
    }
  }
}
