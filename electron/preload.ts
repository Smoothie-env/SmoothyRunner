import { contextBridge, ipcRenderer } from 'electron'

const sparkApi = {
  // Folder Projects
  scanFolder: (dirPath: string) => ipcRenderer.invoke('projects:scanFolder', dirPath),
  listFolderProjects: () => ipcRenderer.invoke('projects:listFolderProjects'),
  addFolderProject: (project: unknown) => ipcRenderer.invoke('projects:addFolder', project),
  removeFolderProject: (id: string) => ipcRenderer.invoke('projects:removeFolder', id),
  setProjectWorktree: (id: string, worktreePath: string | null) => ipcRenderer.invoke('projects:setWorktree', id, worktreePath),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // Groups
  listGroups: () => ipcRenderer.invoke('groups:list'),
  addGroup: (name: string) => ipcRenderer.invoke('groups:add', name),
  renameGroup: (id: string, name: string) => ipcRenderer.invoke('groups:rename', id, name),
  removeGroup: (id: string) => ipcRenderer.invoke('groups:remove', id),
  setProjectGroup: (projectId: string, groupId: string | null) => ipcRenderer.invoke('groups:setProject', projectId, groupId),

  // File system
  readFileContent: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFileContent: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  // Appsettings
  readAppsettings: (filePath: string) => ipcRenderer.invoke('appsettings:read', filePath),
  writeAppsettings: (filePath: string, data: unknown) => ipcRenderer.invoke('appsettings:write', filePath, data),
  watchAppsettings: (filePath: string) => ipcRenderer.invoke('appsettings:watch', filePath),
  unwatchAppsettings: (filePath: string) => ipcRenderer.invoke('appsettings:unwatch', filePath),

  // Profiles
  listProfiles: (projectId: string, filePath: string) => ipcRenderer.invoke('profiles:list', projectId, filePath),
  saveProfile: (projectId: string, filePath: string, name: string, currentData: Record<string, unknown>) => ipcRenderer.invoke('profiles:save', projectId, filePath, name, currentData),
  applyProfile: (projectId: string, filePath: string, name: string) => ipcRenderer.invoke('profiles:apply', projectId, filePath, name),
  deleteProfile: (projectId: string, filePath: string, name: string) => ipcRenderer.invoke('profiles:delete', projectId, filePath, name),
  getBaseline: (projectId: string, filePath: string) => ipcRenderer.invoke('profiles:get-baseline', projectId, filePath),
  resetBaseline: (projectId: string, filePath: string) => ipcRenderer.invoke('profiles:reset-baseline', projectId, filePath),

  // Process
  startProcess: (config: unknown) => ipcRenderer.invoke('process:start', config),
  stopProcess: (id: string) => ipcRenderer.invoke('process:stop', id),
  restartProcess: (id: string) => ipcRenderer.invoke('process:restart', id),
  listProcesses: () => ipcRenderer.invoke('process:list'),
  killPort: (port: number) => ipcRenderer.invoke('process:killPort', port),

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
  },
  onBranchChanged: (callback: (data: { repoPath: string; branch: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { repoPath: string; branch: string }) => callback(data)
    ipcRenderer.on('git:branchChanged', listener)
    return () => ipcRenderer.removeListener('git:branchChanged', listener)
  },

  // Git — checkout & dirty check
  gitCheckout: (repoPath: string, branch: string) => ipcRenderer.invoke('git:checkout', repoPath, branch),
  gitIsDirty: (repoPath: string) => ipcRenderer.invoke('git:isDirty', repoPath),
  gitStash: (repoPath: string, message?: string) => ipcRenderer.invoke('git:stash', repoPath, message),
  gitStashPop: (repoPath: string) => ipcRenderer.invoke('git:stashPop', repoPath)
}

contextBridge.exposeInMainWorld('sparkApi', sparkApi)

export type SparkApi = typeof sparkApi
