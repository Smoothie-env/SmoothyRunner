import { BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs/promises'
import { ProjectScanner } from '../services/project-scanner'
import { ConfigManager } from '../services/config-manager'
import type { FolderProjectConfig } from '../services/config-manager'
import { AppsettingsManager } from '../services/appsettings-manager'
import { ProfileManager } from '../services/profile-manager'
import { ProcessManager } from '../services/process-manager'
import { DockerManager } from '../services/docker-manager'
import { GitManager } from '../services/git-manager'

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  const scanner = new ProjectScanner()
  const config = new ConfigManager()
  const appsettings = new AppsettingsManager(mainWindow)
  const profiles = new ProfileManager(config, scanner)
  const processes = new ProcessManager(mainWindow)
  const docker = new DockerManager()
  const git = new GitManager()

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
    // Rescan subProjects for each folder
    const results = await Promise.all(configs.map(async (cfg) => {
      const subProjects = await scanner.rescanSubProjects(cfg.rootPath)
      const branch = await git.currentBranch(cfg.rootPath).catch(() => undefined)
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
      dockerComposePath: p.dockerComposePath
    }
    return config.addFolderProject(folderConfig)
  })

  ipcMain.handle('projects:removeFolder', async (_event, id: string) => {
    return config.removeFolderProject(id)
  })

  ipcMain.handle('projects:setWorktree', async (_event, id: string, worktreePath: string | null) => {
    return config.setProjectWorktree(id, worktreePath)
  })

  // File system
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  // Appsettings
  ipcMain.handle('appsettings:read', async (_event, filePath: string) => {
    return appsettings.read(filePath)
  })

  ipcMain.handle('appsettings:write', async (_event, filePath: string, data: unknown) => {
    return appsettings.write(filePath, data)
  })

  ipcMain.handle('appsettings:watch', async (_event, filePath: string) => {
    return appsettings.watch(filePath)
  })

  ipcMain.handle('appsettings:unwatch', async (_event, filePath: string) => {
    return appsettings.unwatch(filePath)
  })

  // Profiles
  ipcMain.handle('profiles:list', async (_event, projectId: string) => {
    return profiles.listProfiles(projectId)
  })

  ipcMain.handle('profiles:save', async (_event, projectId: string, name: string, overlay: unknown) => {
    return profiles.saveProfile(projectId, name, overlay)
  })

  ipcMain.handle('profiles:apply', async (_event, projectId: string, name: string) => {
    return profiles.applyProfile(projectId, name)
  })

  ipcMain.handle('profiles:delete', async (_event, projectId: string, name: string) => {
    return profiles.deleteProfile(projectId, name)
  })

  ipcMain.handle('profiles:preview', async (_event, projectId: string, name: string) => {
    return profiles.previewProfile(projectId, name)
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

  // Graceful shutdown
  process.on('SIGTERM', () => processes.stopAll())
  process.on('SIGINT', () => processes.stopAll())
  mainWindow.on('close', () => processes.stopAll())
}
