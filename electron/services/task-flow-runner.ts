import { BrowserWindow } from 'electron'
import { ConfigManager } from './config-manager'
import type { TaskFlowConfig, TaskFlowStepConfig } from './config-manager'
import { ProfileManager } from './profile-manager'
import { ConfigFileManager } from './config-file-manager'
import { ProcessManager } from './process-manager'
import type { ProcessConfig } from './process-manager'
import { GitManager } from './git-manager'
import { ProjectScanner } from './project-scanner'
import type { ScannedSubProject } from './project-scanner'
import type { ProjectType } from './project-types/project-type-handler'

type StepStatus = 'pending' | 'checkout' | 'applying-profile' | 'starting' | 'running' | 'error' | 'skipped' | 'completed'

interface RunContext {
  flowId: string
  aborted: boolean
}

export class TaskFlowRunner {
  private mainWindow: BrowserWindow
  private configManager: ConfigManager
  private profileManager: ProfileManager
  private configFileManager: ConfigFileManager
  private processManager: ProcessManager
  private gitManager: GitManager
  private scanner: ProjectScanner
  private activeRuns = new Map<string, RunContext>()

  constructor(
    mainWindow: BrowserWindow,
    configManager: ConfigManager,
    profileManager: ProfileManager,
    configFileManager: ConfigFileManager,
    processManager: ProcessManager,
    gitManager: GitManager,
    scanner: ProjectScanner
  ) {
    this.mainWindow = mainWindow
    this.configManager = configManager
    this.profileManager = profileManager
    this.configFileManager = configFileManager
    this.processManager = processManager
    this.gitManager = gitManager
    this.scanner = scanner
  }

  async run(flow: TaskFlowConfig): Promise<void> {
    const ctx: RunContext = { flowId: flow.id, aborted: false }
    this.activeRuns.set(flow.id, ctx)

    const sortedSteps = [...flow.steps].sort((a, b) => a.order - b.order)

    // Pre-flight: stop all processes from previous flow execution
    for (const step of sortedSteps) {
      if (step.subProjectId) {
        try { await this.processManager.stop(step.subProjectId) } catch { /* not running */ }
      }
    }

    // Mark all as pending
    for (const step of sortedSteps) {
      this.sendProgress(flow.id, step.id, 'pending')
    }

    const folderProjects = await this.configManager.listFolderProjects()

    for (const step of sortedSteps) {
      if (ctx.aborted) {
        this.sendProgress(flow.id, step.id, 'skipped')
        continue
      }

      try {
        await this.executeStep(flow.id, step, folderProjects, ctx)
      } catch (err: any) {
        this.sendProgress(flow.id, step.id, 'error', err.message || 'Unknown error')
      }
    }

    this.sendProgress(flow.id, '__flow__', 'completed')
    this.activeRuns.delete(flow.id)
  }

  async runSingleStep(flow: TaskFlowConfig, stepId: string): Promise<void> {
    const step = flow.steps.find(s => s.id === stepId)
    if (!step) {
      this.sendProgress(flow.id, stepId, 'error', 'Step not found')
      return
    }

    // Stop existing process for this step before restarting
    if (step.subProjectId) {
      try { await this.processManager.stop(step.subProjectId) } catch { /* not running */ }
    }

    this.sendProgress(flow.id, step.id, 'pending')
    const folderProjects = await this.configManager.listFolderProjects()
    const ctx: RunContext = { flowId: flow.id, aborted: false }

    try {
      await this.executeStep(flow.id, step, folderProjects, ctx)
    } catch (err: any) {
      this.sendProgress(flow.id, step.id, 'error', err.message || 'Unknown error')
    }

    this.sendProgress(flow.id, '__flow__', 'completed')
  }

  async stopAll(flow: TaskFlowConfig): Promise<void> {
    const ctx = this.activeRuns.get(flow.id)
    if (ctx) {
      ctx.aborted = true
    }

    // Stop all processes started by this flow's steps
    for (const step of flow.steps) {
      try {
        await this.processManager.stop(step.subProjectId)
      } catch {
        // Process may not be running
      }
    }

    this.activeRuns.delete(flow.id)
  }

  private async executeStep(
    flowId: string,
    step: TaskFlowStepConfig,
    folderProjects: { id: string; rootPath: string; originalRootPath: string }[],
    ctx: RunContext
  ): Promise<void> {
    // Resolve project
    const projectConfig = folderProjects.find(p => p.id === step.projectId)
    if (!projectConfig) {
      this.sendProgress(flowId, step.id, 'error', 'Project not found')
      return
    }

    // Rescan to get fresh sub-projects
    const subProjects = await this.scanner.rescanSubProjects(projectConfig.rootPath)
    const subProject = subProjects.find(sp => sp.id === step.subProjectId)
    if (!subProject) {
      this.sendProgress(flowId, step.id, 'error', 'Sub-project not found')
      return
    }

    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      return
    }

    // Checkout branch if specified
    if (step.branch) {
      this.sendProgress(flowId, step.id, 'checkout')
      try {
        const currentBranch = await this.gitManager.currentBranch(projectConfig.rootPath)
        if (currentBranch !== step.branch) {
          const isDirty = await this.gitManager.isDirty(projectConfig.rootPath)
          if (isDirty) {
            await this.gitManager.stash(projectConfig.rootPath, `taskflow: switch to ${step.branch}`)
          }
          await this.gitManager.checkout(projectConfig.rootPath, step.branch)
        }
      } catch (err: any) {
        this.sendProgress(flowId, step.id, 'error', `Branch checkout failed: ${err.message}`)
        return
      }
    }

    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      return
    }

    // Apply profiles
    if (step.profiles.length > 0) {
      this.sendProgress(flowId, step.id, 'applying-profile')
      for (const profileRef of step.profiles) {
        try {
          const result = await this.profileManager.applyProfile(
            step.projectId,
            profileRef.filePath,
            profileRef.profileName,
            subProject.projectType as ProjectType
          )
          if (result.merged) {
            await this.configFileManager.write(
              profileRef.filePath,
              result.merged,
              subProject.projectType as ProjectType
            )
          } else if (result.error) {
            // Profile not found — warn but continue
            this.sendProgress(flowId, step.id, 'error', `Profile "${profileRef.profileName}" not found for ${profileRef.filePath}`)
            return
          }
        } catch (err: any) {
          // Non-fatal: log but continue to start
        }
      }
    }

    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      return
    }

    // Start process
    this.sendProgress(flowId, step.id, 'starting')
    const processConfig = this.buildProcessConfig(subProject, step.mode, projectConfig.rootPath, step.portOverride ?? undefined)

    try {
      await this.processManager.start(processConfig)
      this.sendProgress(flowId, step.id, 'running')
    } catch (err: any) {
      const effectivePort = processConfig.portOverride || processConfig.port
      const isPortConflict = effectivePort && err.message?.includes('already in use')

      if (isPortConflict) {
        // Port occupied by external process — kill it and retry once
        try {
          await this.processManager.killByPort(effectivePort)
          await this.delay(1000)
          await this.processManager.start(processConfig)
          this.sendProgress(flowId, step.id, 'running')
          return
        } catch (retryErr: any) {
          this.sendProgress(flowId, step.id, 'error', `Port ${effectivePort} busy, retry failed: ${retryErr.message}`)
          return
        }
      }

      this.sendProgress(flowId, step.id, 'error', err.message || 'Failed to start process')
    }
  }

  private buildProcessConfig(subProject: ScannedSubProject, mode: string, rootPath: string, portOverride?: number): ProcessConfig {
    return {
      id: subProject.id,
      name: subProject.name,
      projectType: subProject.projectType,
      projectPath: subProject.dirPath,
      projectFilePath: subProject.projectType === 'dotnet'
        ? (subProject as any).csprojPath
        : subProject.projectType === 'angular'
          ? (subProject as any).angularJsonPath
          : undefined,
      port: portOverride || subProject.port,
      portOverride,
      mode: mode as any,
      rootPath,
      subProject
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private sendProgress(flowId: string, stepId: string, status: StepStatus, error?: string): void {
    this.mainWindow.webContents.send('taskflow:stepProgress', { flowId, stepId, status, error })
  }
}
