import { contextBridge, ipcRenderer } from 'electron'

const smoothyApi = {
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

  // Config files (was appsettings)
  readConfig: (filePath: string, projectType: string) => ipcRenderer.invoke('config:read', filePath, projectType),
  writeConfig: (filePath: string, data: unknown, projectType: string) => ipcRenderer.invoke('config:write', filePath, data, projectType),
  watchConfig: (filePath: string) => ipcRenderer.invoke('config:watch', filePath),
  unwatchConfig: (filePath: string) => ipcRenderer.invoke('config:unwatch', filePath),

  // Profiles
  listProfiles: (projectId: string, filePath: string) => ipcRenderer.invoke('profiles:list', projectId, filePath),
  saveProfile: (projectId: string, filePath: string, name: string, currentData: Record<string, unknown>, projectType: string) => ipcRenderer.invoke('profiles:save', projectId, filePath, name, currentData, projectType),
  applyProfile: (projectId: string, filePath: string, name: string, projectType: string) => ipcRenderer.invoke('profiles:apply', projectId, filePath, name, projectType),
  deleteProfile: (projectId: string, filePath: string, name: string) => ipcRenderer.invoke('profiles:delete', projectId, filePath, name),
  getBaseline: (projectId: string, filePath: string) => ipcRenderer.invoke('profiles:get-baseline', projectId, filePath),
  resetBaseline: (projectId: string, filePath: string, projectType: string) => ipcRenderer.invoke('profiles:reset-baseline', projectId, filePath, projectType),

  // Process
  startProcess: (config: unknown) => ipcRenderer.invoke('process:start', config),
  stopProcess: (id: string) => ipcRenderer.invoke('process:stop', id),
  restartProcess: (id: string) => ipcRenderer.invoke('process:restart', id),
  listProcesses: () => ipcRenderer.invoke('process:list'),
  removeProcess: (id: string) => ipcRenderer.invoke('process:remove', id),
  killPort: (port: number) => ipcRenderer.invoke('process:killPort', port),

  // Docker
  dockerStatus: (composePath: string, profiles: string[]) => ipcRenderer.invoke('docker:status', composePath, profiles),
  dockerUp: (composePath: string, services: string[], profiles: string[]) => ipcRenderer.invoke('docker:up', composePath, services, profiles),
  dockerDown: (composePath: string, services: string[], profiles: string[]) => ipcRenderer.invoke('docker:down', composePath, services, profiles),
  dockerRestart: (composePath: string, services: string[], profiles: string[]) => ipcRenderer.invoke('docker:restart', composePath, services, profiles),
  dockerLogs: (composePath: string, service: string) => ipcRenderer.invoke('docker:logs', composePath, service),

  // Docker (standalone containers)
  dockerStandaloneStop: (containerName: string) => ipcRenderer.invoke('docker:standaloneStop', containerName),
  dockerStandaloneRemove: (containerName: string) => ipcRenderer.invoke('docker:standaloneRemove', containerName),
  dockerStandaloneHealth: (containerName: string) => ipcRenderer.invoke('docker:standaloneHealth', containerName),
  dockerStandaloneLogs: (containerName: string, tail?: number) => ipcRenderer.invoke('docker:standaloneLogs', containerName, tail),

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
  onConfigChanged: (callback: (data: { filePath: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string }) => callback(data)
    ipcRenderer.on('config:changed', listener)
    return () => ipcRenderer.removeListener('config:changed', listener)
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
  gitCreateBranch: (repoPath: string, branchName: string) => ipcRenderer.invoke('git:createBranch', repoPath, branchName),
  gitIsDirty: (repoPath: string) => ipcRenderer.invoke('git:isDirty', repoPath),
  gitStash: (repoPath: string, message?: string) => ipcRenderer.invoke('git:stash', repoPath, message),
  gitStashPop: (repoPath: string) => ipcRenderer.invoke('git:stashPop', repoPath),
  gitDirtyCount: (repoPath: string) => ipcRenderer.invoke('git:dirtyCount', repoPath),

  // Task Flows
  listTaskFlows: () => ipcRenderer.invoke('taskflows:list'),
  getTaskFlow: (id: string) => ipcRenderer.invoke('taskflows:get', id),
  addTaskFlow: (flow: unknown) => ipcRenderer.invoke('taskflows:add', flow),
  updateTaskFlow: (id: string, updates: unknown) => ipcRenderer.invoke('taskflows:update', id, updates),
  removeTaskFlow: (id: string) => ipcRenderer.invoke('taskflows:remove', id),
  runTaskFlow: (flowId: string) => ipcRenderer.invoke('taskflows:run', flowId),
  runTaskFlowStep: (flowId: string, stepId: string) => ipcRenderer.invoke('taskflows:runStep', flowId, stepId),
  stopTaskFlow: (flowId: string) => ipcRenderer.invoke('taskflows:stop', flowId),
  stopTaskFlowStep: (flowId: string, stepId: string) => ipcRenderer.invoke('taskflows:stopStep', flowId, stepId),
  runTaskFlowPhase: (flowId: string, phaseNumber: number) => ipcRenderer.invoke('taskflows:runPhase', flowId, phaseNumber),
  stopTaskFlowPhase: (flowId: string, phaseNumber: number) => ipcRenderer.invoke('taskflows:stopPhase', flowId, phaseNumber),

  // Compose import
  parseCompose: () => ipcRenderer.invoke('taskflows:parseCompose'),
  parseComposeFile: (filePath: string) => ipcRenderer.invoke('taskflows:parseComposeFile', filePath),
  checkComposeSync: (filePath: string, lastHash: string) => ipcRenderer.invoke('taskflows:checkComposeSync', filePath, lastHash),
  flattenAppsettings: (appsettingsPath: string) => ipcRenderer.invoke('taskflows:flattenAppsettings', appsettingsPath),
  onTaskFlowProgress: (callback: (data: { flowId: string; stepId: string; status: string; error?: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { flowId: string; stepId: string; status: string; error?: string }) => callback(data)
    ipcRenderer.on('taskflow:stepProgress', listener)
    return () => ipcRenderer.removeListener('taskflow:stepProgress', listener)
  }
}

contextBridge.exposeInMainWorld('smoothyApi', smoothyApi)

export type SmoothyApi = typeof smoothyApi
