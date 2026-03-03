import { contextBridge, ipcRenderer } from 'electron'

const sparkApi = {
  // Folder Projects
  scanFolder: (dirPath: string) => ipcRenderer.invoke('projects:scanFolder', dirPath),
  listFolderProjects: () => ipcRenderer.invoke('projects:listFolderProjects'),
  addFolderProject: (project: unknown) => ipcRenderer.invoke('projects:addFolder', project),
  removeFolderProject: (id: string) => ipcRenderer.invoke('projects:removeFolder', id),
  setProjectWorktree: (id: string, worktreePath: string | null) => ipcRenderer.invoke('projects:setWorktree', id, worktreePath),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // File system
  readFileContent: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),

  // Appsettings
  readAppsettings: (filePath: string) => ipcRenderer.invoke('appsettings:read', filePath),
  writeAppsettings: (filePath: string, data: unknown) => ipcRenderer.invoke('appsettings:write', filePath, data),
  watchAppsettings: (filePath: string) => ipcRenderer.invoke('appsettings:watch', filePath),
  unwatchAppsettings: (filePath: string) => ipcRenderer.invoke('appsettings:unwatch', filePath),

  // Profiles
  listProfiles: (projectId: string) => ipcRenderer.invoke('profiles:list', projectId),
  saveProfile: (projectId: string, name: string, overlay: unknown) => ipcRenderer.invoke('profiles:save', projectId, name, overlay),
  applyProfile: (projectId: string, name: string) => ipcRenderer.invoke('profiles:apply', projectId, name),
  deleteProfile: (projectId: string, name: string) => ipcRenderer.invoke('profiles:delete', projectId, name),
  previewProfile: (projectId: string, name: string) => ipcRenderer.invoke('profiles:preview', projectId, name),

  // Process
  startProcess: (config: unknown) => ipcRenderer.invoke('process:start', config),
  stopProcess: (id: string) => ipcRenderer.invoke('process:stop', id),
  restartProcess: (id: string) => ipcRenderer.invoke('process:restart', id),
  listProcesses: () => ipcRenderer.invoke('process:list'),

  // Docker
  dockerStatus: (composePath: string, profiles: string[]) => ipcRenderer.invoke('docker:status', composePath, profiles),
  dockerUp: (composePath: string, services: string[], profiles: string[]) => ipcRenderer.invoke('docker:up', composePath, services, profiles),
  dockerDown: (composePath: string, services: string[], profiles: string[]) => ipcRenderer.invoke('docker:down', composePath, services, profiles),
  dockerRestart: (composePath: string, services: string[], profiles: string[]) => ipcRenderer.invoke('docker:restart', composePath, services, profiles),
  dockerLogs: (composePath: string, service: string) => ipcRenderer.invoke('docker:logs', composePath, service),

  // Git
  gitBranches: (repoPath: string) => ipcRenderer.invoke('git:branches', repoPath),
  gitCurrentBranch: (repoPath: string) => ipcRenderer.invoke('git:currentBranch', repoPath),
  gitWorktreeList: (repoPath: string) => ipcRenderer.invoke('git:worktreeList', repoPath),
  gitWorktreeAdd: (repoPath: string, branch: string, path: string) => ipcRenderer.invoke('git:worktreeAdd', repoPath, branch, path),
  gitWorktreeRemove: (worktreePath: string) => ipcRenderer.invoke('git:worktreeRemove', worktreePath),

  // Events (push from main)
  onProcessLog: (callback: (data: { id: string; data: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }) => callback(data)
    ipcRenderer.on('process:log', listener)
    return () => ipcRenderer.removeListener('process:log', listener)
  },
  onAppsettingsChanged: (callback: (data: { filePath: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string }) => callback(data)
    ipcRenderer.on('appsettings:changed', listener)
    return () => ipcRenderer.removeListener('appsettings:changed', listener)
  },
  onDockerStatus: (callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('docker:statusUpdate', listener)
    return () => ipcRenderer.removeListener('docker:statusUpdate', listener)
  }
}

contextBridge.exposeInMainWorld('sparkApi', sparkApi)

export type SparkApi = typeof sparkApi
