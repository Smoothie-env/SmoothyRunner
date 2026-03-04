import { BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs/promises'
import { ProjectScanner } from '../services/project-scanner'
import { ConfigManager } from '../services/config-manager'
import type { FolderProjectConfig } from '../services/config-manager'
import { ConfigFileManager } from '../services/config-file-manager'
import { ProfileManager } from '../services/profile-manager'
import { ProcessManager } from '../services/process-manager'
import { DockerManager } from '../services/docker-manager'
import { GitManager } from '../services/git-manager'
import { GitWatcher } from '../services/git-watcher'
import type { ProjectType } from '../services/project-types/project-type-handler'

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  const scanner = new ProjectScanner()
  const config = new ConfigManager()
  const configFileManager = new ConfigFileManager(mainWindow)
  const profiles = new ProfileManager(config, configFileManager)
  const processes = new ProcessManager(mainWindow)
  const docker = new DockerManager()
  const git = new GitManager()
  const gitWatcher = new GitWatcher(mainWindow)

  // Dialog
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Folder Projects
  ipcMain.handle('projects:scanFolder', async (_event, dirPath: string) => {
    return scanner.scanFolder(dirPath)
  })

  ipcMain.handle('projects:listFolderProjects', async () => {
    const configs = await config.listFolderProjects()
    const results = await Promise.all(configs.map(async (cfg) => {
      const subProjects = await scanner.rescanSubProjects(cfg.rootPath)
      const branch = await git.currentBranch(cfg.rootPath).catch(() => undefined)
      gitWatcher.watchProject(cfg.rootPath)
      return {
        ...cfg,
        subProjects,
        branch
      }
    }))
    return results
  })

  ipcMain.handle('projects:addFolder', async (_event, project: unknown) => {
    const p = project as any
    const folderConfig: FolderProjectConfig = {
      id: p.id,
      name: p.name,
      rootPath: p.rootPath,
      originalRootPath: p.originalRootPath,
      activeWorktreePath: p.activeWorktreePath,
      hasDockerCompose: p.hasDockerCompose,
      dockerComposePath: p.dockerComposePath,
      hasDevContainer: p.hasDevContainer ?? false,
      devContainerPath: p.devContainerPath,
      groupId: p.groupId
    }
    return config.addFolderProject(folderConfig)
  })

  ipcMain.handle('projects:removeFolder', async (_event, id: string) => {
    return config.removeFolderProject(id)
  })

  ipcMain.handle('projects:setWorktree', async (_event, id: string, worktreePath: string | null) => {
    return config.setProjectWorktree(id, worktreePath)
  })

  // Groups
  ipcMain.handle('groups:list', async () => {
    return config.listGroups()
  })

  ipcMain.handle('groups:add', async (_event, name: string) => {
    return config.addGroup(name)
  })

  ipcMain.handle('groups:rename', async (_event, id: string, name: string) => {
    return config.renameGroup(id, name)
  })

  ipcMain.handle('groups:remove', async (_event, id: string) => {
    return config.removeGroup(id)
  })

  ipcMain.handle('groups:setProject', async (_event, projectId: string, groupId: string | null) => {
    return config.setProjectGroup(projectId, groupId)
  })

  // File system
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    return fs.writeFile(filePath, content, 'utf-8')
  })

  // Config files (was appsettings)
  ipcMain.handle('config:read', async (_event, filePath: string, projectType: ProjectType) => {
    return configFileManager.read(filePath, projectType)
  })

  ipcMain.handle('config:write', async (_event, filePath: string, data: unknown, projectType: ProjectType) => {
    return configFileManager.write(filePath, data, projectType)
  })

  ipcMain.handle('config:watch', async (_event, filePath: string) => {
    return configFileManager.watch(filePath)
  })

  ipcMain.handle('config:unwatch', async (_event, filePath: string) => {
    return configFileManager.unwatch(filePath)
  })

  // Profiles
  ipcMain.handle('profiles:list', async (_event, projectId: string, filePath: string) => {
    return profiles.listProfiles(projectId, filePath)
  })

  ipcMain.handle('profiles:save', async (_event, projectId: string, filePath: string, name: string, currentData: Record<string, unknown>, projectType: ProjectType) => {
    return profiles.saveProfile(projectId, filePath, name, currentData, projectType)
  })

  ipcMain.handle('profiles:apply', async (_event, projectId: string, filePath: string, name: string, projectType: ProjectType) => {
    return profiles.applyProfile(projectId, filePath, name, projectType)
  })

  ipcMain.handle('profiles:delete', async (_event, projectId: string, filePath: string, name: string) => {
    return profiles.deleteProfile(projectId, filePath, name)
  })

  ipcMain.handle('profiles:get-baseline', async (_event, projectId: string, filePath: string) => {
    return profiles.getBaseline(projectId, filePath)
  })

  ipcMain.handle('profiles:reset-baseline', async (_event, projectId: string, filePath: string, projectType: ProjectType) => {
    return profiles.resetBaseline(projectId, filePath, projectType)
  })

  // Process
  ipcMain.handle('process:start', async (_event, processConfig: unknown) => {
    return processes.start(processConfig as any)
  })

  ipcMain.handle('process:stop', async (_event, id: string) => {
    return processes.stop(id)
  })

  ipcMain.handle('process:restart', async (_event, id: string) => {
    return processes.restart(id)
  })

  ipcMain.handle('process:list', async () => {
    return processes.list()
  })

  ipcMain.handle('process:killPort', async (_event, port: number) => {
    return processes.killByPort(port)
  })

  // Docker
  ipcMain.handle('docker:status', async (_event, composePath: string, dockerProfiles: string[]) => {
    return docker.status(composePath, dockerProfiles)
  })

  ipcMain.handle('docker:up', async (_event, composePath: string, services: string[], dockerProfiles: string[]) => {
    return docker.up(composePath, services, dockerProfiles)
  })

  ipcMain.handle('docker:down', async (_event, composePath: string, services: string[], dockerProfiles: string[]) => {
    return docker.down(composePath, services, dockerProfiles)
  })

  ipcMain.handle('docker:restart', async (_event, composePath: string, services: string[], dockerProfiles: string[]) => {
    return docker.restart(composePath, services, dockerProfiles)
  })

  ipcMain.handle('docker:logs', async (_event, composePath: string, service: string) => {
    return docker.logs(composePath, service)
  })

  // Git
  ipcMain.handle('git:branches', async (_event, repoPath: string) => {
    return git.listBranches(repoPath)
  })

  ipcMain.handle('git:currentBranch', async (_event, repoPath: string) => {
    return git.currentBranch(repoPath)
  })

  ipcMain.handle('git:worktreeList', async (_event, repoPath: string) => {
    return git.worktreeList(repoPath)
  })

  ipcMain.handle('git:worktreeAdd', async (_event, repoPath: string, branch: string, worktreePath: string) => {
    return git.worktreeAdd(repoPath, branch, worktreePath)
  })

  ipcMain.handle('git:worktreeRemove', async (_event, worktreePath: string) => {
    return git.worktreeRemove(worktreePath)
  })

  ipcMain.handle('git:checkout', async (_event, repoPath: string, branch: string) => {
    return git.checkout(repoPath, branch)
  })

  ipcMain.handle('git:isDirty', async (_event, repoPath: string) => {
    return git.isDirty(repoPath)
  })

  ipcMain.handle('git:stash', async (_event, repoPath: string, message?: string) => {
    return git.stash(repoPath, message)
  })

  ipcMain.handle('git:stashPop', async (_event, repoPath: string) => {
    return git.stashPop(repoPath)
  })

  // Graceful shutdown
  const cleanup = () => {
    processes.stopAll()
    configFileManager.destroy()
    gitWatcher.destroy()
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
  mainWindow.on('close', cleanup)
}
