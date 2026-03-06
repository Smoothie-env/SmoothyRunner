import { BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { ConfigManager } from './config-manager'
import type { TaskFlowConfig, TaskFlowStepConfig, TaskFlowProcessStepConfig, TaskFlowDockerStepConfig } from './config-manager'
import { ProfileManager } from './profile-manager'
import { ConfigFileManager } from './config-file-manager'
import { ProcessManager } from './process-manager'
import type { ProcessConfig } from './process-manager'
import { GitManager } from './git-manager'
import { ProjectScanner } from './project-scanner'
import type { ScannedSubProject } from './project-scanner'
import type { ProjectType } from './project-types/project-type-handler'
import { StandaloneDockerManager } from './standalone-docker-manager'

type StepStatus = 'pending' | 'checkout' | 'applying-profile' | 'starting' | 'running' | 'error' | 'skipped' | 'completed' | 'pulling' | 'waiting-health' | 'healthy' | 'stopped'

interface RunContext {
  flowId: string
  aborted: boolean
}

interface DockerMonitorEntry {
  flowId: string
  stepId: string
  containerName: string
  lastStatus: string
}

export class TaskFlowRunner {
  private mainWindow: BrowserWindow
  private configManager: ConfigManager
  private profileManager: ProfileManager
  private configFileManager: ConfigFileManager
  private processManager: ProcessManager
  private gitManager: GitManager
  private scanner: ProjectScanner
  private dockerManager: StandaloneDockerManager
  private activeRuns = new Map<string, RunContext>()
  private dockerMonitors = new Map<string, NodeJS.Timeout>()
  private monitoredContainers = new Map<string, DockerMonitorEntry[]>()
  private dockerLogIds = new Map<string, string>() // containerName → stepId

  constructor(
    mainWindow: BrowserWindow,
    configManager: ConfigManager,
    profileManager: ProfileManager,
    configFileManager: ConfigFileManager,
    processManager: ProcessManager,
    gitManager: GitManager,
    scanner: ProjectScanner,
    dockerManager: StandaloneDockerManager
  ) {
    this.mainWindow = mainWindow
    this.configManager = configManager
    this.profileManager = profileManager
    this.configFileManager = configFileManager
    this.processManager = processManager
    this.gitManager = gitManager
    this.scanner = scanner
    this.dockerManager = dockerManager
  }

  private groupByPhase(steps: TaskFlowStepConfig[]): Map<number, TaskFlowStepConfig[]> {
    const map = new Map<number, TaskFlowStepConfig[]>()
    for (const step of steps) {
      const phase = step.phase ?? 0
      const group = map.get(phase) || []
      group.push(step)
      map.set(phase, group)
    }
    // Sort by phase number, and within each phase sort by order
    const sorted = new Map(
      [...map.entries()]
        .sort(([a], [b]) => a - b)
        .map(([phase, phaseSteps]) => [phase, phaseSteps.sort((a, b) => a.order - b.order)])
    )
    return sorted
  }

  async run(flow: TaskFlowConfig): Promise<void> {
    const ctx: RunContext = { flowId: flow.id, aborted: false }
    this.activeRuns.set(flow.id, ctx)

    // Stop any previous Docker monitor for this flow
    this.stopDockerMonitor(flow.id)

    const allSteps = [...flow.steps]
    const allDockerSteps = allSteps.filter((s): s is TaskFlowDockerStepConfig => s.type === 'docker')
    const allProcessSteps = allSteps.filter((s): s is TaskFlowProcessStepConfig => s.type === 'process')

    // Pre-flight: stop previous processes and Docker containers
    for (const step of allProcessSteps) {
      if (step.subProjectId) {
        try { await this.processManager.stop(step.id) } catch { /* not running */ }
      }
    }
    for (const step of allDockerSteps) {
      const containerName = this.resolveContainerName(flow.id, step)
      this.stopDockerLogStream(containerName)
      await this.dockerManager.stop(containerName)
      await this.dockerManager.remove(containerName)
    }

    // Mark all as pending
    for (const step of allSteps) {
      this.sendProgress(flow.id, step.id, 'pending')
    }

    if (ctx.aborted) {
      this.markRemainingSkipped(flow.id, allSteps)
      this.sendProgress(flow.id, '__flow__', 'completed')
      this.activeRuns.delete(flow.id)
      return
    }

    const phases = this.groupByPhase(flow.steps)
    const folderProjects = await this.configManager.listFolderProjects()

    for (const [_phaseNum, phaseSteps] of phases) {
      if (ctx.aborted) break

      const dockerSteps = phaseSteps.filter((s): s is TaskFlowDockerStepConfig => s.type === 'docker')
      const processSteps = phaseSteps.filter((s): s is TaskFlowProcessStepConfig => s.type === 'process')

      // Start all steps in this phase in parallel
      const results = await Promise.allSettled([
        ...dockerSteps.map(s => this.startDockerStep(flow.id, s, ctx)),
        ...processSteps.map(s => this.executeProcessStep(flow.id, s, folderProjects, ctx))
      ])

      // Check if any step failed critically
      const hasFatalError = results.some(r => r.status === 'rejected')
      if (hasFatalError) {
        ctx.aborted = true
        break
      }

      if (ctx.aborted) break

      // Wait for Docker health in this phase
      if (dockerSteps.length > 0) {
        try {
          await Promise.all(dockerSteps.map(s => this.waitForDockerHealth(flow.id, s, ctx)))
        } catch {
          ctx.aborted = true
          break
        }
        this.startDockerMonitor(flow.id, dockerSteps)
      }

      if (ctx.aborted) break
    }

    if (ctx.aborted) {
      this.markRemainingSkipped(flow.id, allSteps)
    }

    this.sendProgress(flow.id, '__flow__', 'completed')
    this.activeRuns.delete(flow.id)
    // NOTE: Docker monitor keeps running — containers stay monitored after flow completes
  }

  async runSingleStep(flow: TaskFlowConfig, stepId: string): Promise<void> {
    const step = flow.steps.find(s => s.id === stepId)
    if (!step) {
      this.sendProgress(flow.id, stepId, 'error', 'Step not found')
      return
    }

    this.sendProgress(flow.id, step.id, 'pending')
    const ctx: RunContext = { flowId: flow.id, aborted: false }

    if (step.type === 'docker') {
      const dockerStep = step as TaskFlowDockerStepConfig
      const containerName = this.resolveContainerName(flow.id, dockerStep)

      // Stop+remove previous container, stop its monitor and log stream
      this.stopDockerMonitor(flow.id)
      this.stopDockerLogStream(containerName)
      await this.dockerManager.stop(containerName)
      await this.dockerManager.remove(containerName)

      try {
        await this.startDockerStep(flow.id, dockerStep, ctx)
        await this.waitForDockerHealth(flow.id, dockerStep, ctx)
        // Start monitoring this container
        this.startDockerMonitor(flow.id, [dockerStep])
      } catch (err: any) {
        this.sendProgress(flow.id, step.id, 'error', err.message || 'Docker step failed')
      }
    } else {
      const processStep = step as TaskFlowProcessStepConfig

      if (processStep.subProjectId) {
        try { await this.processManager.stop(processStep.id) } catch { /* not running */ }
      }

      const folderProjects = await this.configManager.listFolderProjects()
      try {
        await this.executeProcessStep(flow.id, processStep, folderProjects, ctx)
      } catch (err: any) {
        this.sendProgress(flow.id, step.id, 'error', err.message || 'Unknown error')
      }
    }

    this.sendProgress(flow.id, '__flow__', 'completed')
  }

  async stopSingleStep(flow: TaskFlowConfig, stepId: string): Promise<void> {
    const step = flow.steps.find(s => s.id === stepId)
    if (!step) return

    if (step.type === 'docker') {
      const dockerStep = step as TaskFlowDockerStepConfig
      const containerName = this.resolveContainerName(flow.id, dockerStep)

      // Remove from monitored containers
      const entries = this.monitoredContainers.get(flow.id)
      if (entries) {
        const filtered = entries.filter(e => e.stepId !== stepId)
        if (filtered.length === 0) {
          this.stopDockerMonitor(flow.id)
        } else {
          this.monitoredContainers.set(flow.id, filtered)
        }
      }

      this.stopDockerLogStream(containerName)
      await this.dockerManager.stop(containerName)
      await this.dockerManager.remove(containerName)
      this.mainWindow.webContents.send('process:log', {
        id: stepId,
        data: '\r\n[Container stopped]\r\n'
      })
      this.sendProgress(flow.id, stepId, 'stopped')
    } else {
      try {
        await this.processManager.stop(stepId)
      } catch { /* not running */ }
      this.sendProgress(flow.id, stepId, 'stopped')
    }
  }

  async runPhase(flow: TaskFlowConfig, phaseNumber: number): Promise<void> {
    const runKey = `${flow.id}:phase:${phaseNumber}`
    const ctx: RunContext = { flowId: flow.id, aborted: false }
    this.activeRuns.set(runKey, ctx)

    const allSteps = flow.steps.filter(s => (s.phase ?? 0) === phaseNumber)
    if (allSteps.length === 0) {
      this.activeRuns.delete(runKey)
      return
    }

    const dockerSteps = allSteps.filter((s): s is TaskFlowDockerStepConfig => s.type === 'docker')
    const processSteps = allSteps.filter((s): s is TaskFlowProcessStepConfig => s.type === 'process')

    // Pre-flight cleanup for this phase
    for (const step of processSteps) {
      if (step.subProjectId) {
        try { await this.processManager.stop(step.id) } catch { /* not running */ }
      }
    }
    for (const step of dockerSteps) {
      const containerName = this.resolveContainerName(flow.id, step)
      this.stopDockerLogStream(containerName)
      await this.dockerManager.stop(containerName)
      await this.dockerManager.remove(containerName)
    }

    // Mark all phase steps as pending
    for (const step of allSteps) {
      this.sendProgress(flow.id, step.id, 'pending')
    }

    if (ctx.aborted) {
      this.markRemainingSkipped(flow.id, allSteps)
      this.sendProgress(flow.id, '__flow__', 'completed')
      this.activeRuns.delete(runKey)
      return
    }

    const folderProjects = await this.configManager.listFolderProjects()

    // Start all steps in this phase in parallel
    const results = await Promise.allSettled([
      ...dockerSteps.map(s => this.startDockerStep(flow.id, s, ctx)),
      ...processSteps.map(s => this.executeProcessStep(flow.id, s, folderProjects, ctx))
    ])

    const hasFatalError = results.some(r => r.status === 'rejected')
    if (hasFatalError) {
      ctx.aborted = true
    }

    // Wait for Docker health
    if (!ctx.aborted && dockerSteps.length > 0) {
      try {
        await Promise.all(dockerSteps.map(s => this.waitForDockerHealth(flow.id, s, ctx)))
      } catch {
        ctx.aborted = true
      }
      if (!ctx.aborted) {
        this.startDockerMonitor(flow.id, dockerSteps)
      }
    }

    if (ctx.aborted) {
      this.markRemainingSkipped(flow.id, allSteps)
    }

    this.sendProgress(flow.id, '__flow__', 'completed')
    this.activeRuns.delete(runKey)
  }

  async stopPhase(flow: TaskFlowConfig, phaseNumber: number): Promise<void> {
    const runKey = `${flow.id}:phase:${phaseNumber}`
    const ctx = this.activeRuns.get(runKey)
    if (ctx) {
      ctx.aborted = true
    }

    const phaseSteps = flow.steps.filter(s => (s.phase ?? 0) === phaseNumber)

    for (const step of phaseSteps) {
      if (step.type === 'process') {
        try {
          await this.processManager.stop(step.id)
        } catch { /* not running */ }
      } else if (step.type === 'docker') {
        const dockerStep = step as TaskFlowDockerStepConfig
        const containerName = this.resolveContainerName(flow.id, dockerStep)

        // Remove from monitored containers
        const entries = this.monitoredContainers.get(flow.id)
        if (entries) {
          const filtered = entries.filter(e => e.stepId !== step.id)
          if (filtered.length === 0) {
            this.stopDockerMonitor(flow.id)
          } else {
            this.monitoredContainers.set(flow.id, filtered)
          }
        }

        this.stopDockerLogStream(containerName)
        await this.dockerManager.stop(containerName)
        await this.dockerManager.remove(containerName)
        this.mainWindow.webContents.send('process:log', {
          id: step.id,
          data: '\r\n[Container stopped]\r\n'
        })
      }
      this.sendProgress(flow.id, step.id, 'stopped')
    }

    this.activeRuns.delete(runKey)
  }

  async stopAll(flow: TaskFlowConfig): Promise<void> {
    const ctx = this.activeRuns.get(flow.id)
    if (ctx) {
      ctx.aborted = true
    }

    // Stop Docker monitor and log streams
    this.stopDockerMonitor(flow.id)

    for (const step of flow.steps) {
      if (step.type === 'process') {
        try {
          await this.processManager.stop(step.id)
        } catch {
          // Process may not be running
        }
      } else if (step.type === 'docker') {
        const dockerStep = step as TaskFlowDockerStepConfig
        const containerName = this.resolveContainerName(flow.id, dockerStep)
        this.stopDockerLogStream(containerName)
        await this.dockerManager.stop(containerName)
        await this.dockerManager.remove(containerName)
        // Send exit message to log panel
        this.mainWindow.webContents.send('process:log', {
          id: step.id,
          data: '\r\n[Container stopped]\r\n'
        })
        this.sendProgress(flow.id, step.id, 'stopped')
      }
    }

    this.activeRuns.delete(flow.id)
  }

  // ── Docker status monitor ──────────────────────────────────────────

  private startDockerMonitor(flowId: string, dockerSteps: TaskFlowDockerStepConfig[]): void {
    // Build list of containers to monitor
    const entries: DockerMonitorEntry[] = dockerSteps.map(step => ({
      flowId,
      stepId: step.id,
      containerName: this.resolveContainerName(flowId, step),
      lastStatus: 'healthy'
    }))

    // Merge with existing monitors for this flow
    const existing = this.monitoredContainers.get(flowId) || []
    const merged = [...existing]
    for (const entry of entries) {
      const idx = merged.findIndex(e => e.stepId === entry.stepId)
      if (idx >= 0) {
        merged[idx] = entry
      } else {
        merged.push(entry)
      }
    }
    this.monitoredContainers.set(flowId, merged)

    // Don't create duplicate interval
    if (this.dockerMonitors.has(flowId)) return

    const interval = setInterval(() => this.pollDockerStatus(flowId), 5000)
    this.dockerMonitors.set(flowId, interval)
  }

  private stopDockerMonitor(flowId: string): void {
    const interval = this.dockerMonitors.get(flowId)
    if (interval) {
      clearInterval(interval)
      this.dockerMonitors.delete(flowId)
    }
    this.monitoredContainers.delete(flowId)
  }

  private async pollDockerStatus(flowId: string): Promise<void> {
    const entries = this.monitoredContainers.get(flowId)
    if (!entries || entries.length === 0) {
      this.stopDockerMonitor(flowId)
      return
    }

    // Check sequentially to avoid EAGAIN
    for (const entry of entries) {
      try {
        const running = await this.dockerManager.isRunning(entry.containerName)

        if (!running) {
          if (entry.lastStatus !== 'stopped' && entry.lastStatus !== 'error') {
            entry.lastStatus = 'stopped'
            this.sendProgress(flowId, entry.stepId, 'error', 'Container stopped')
          }
          continue
        }

        const health = await this.dockerManager.healthStatus(entry.containerName)

        let newStatus: string
        if (health === 'healthy' || health === 'none') {
          newStatus = 'healthy'
        } else if (health === 'unhealthy') {
          newStatus = 'error'
        } else {
          newStatus = 'waiting-health'
        }

        if (newStatus !== entry.lastStatus) {
          entry.lastStatus = newStatus
          if (newStatus === 'error') {
            this.sendProgress(flowId, entry.stepId, 'error', 'Container unhealthy')
          } else {
            this.sendProgress(flowId, entry.stepId, newStatus as StepStatus)
          }
        }
      } catch {
        // Docker inspect failed — container may have been removed externally
        if (entry.lastStatus !== 'stopped' && entry.lastStatus !== 'error') {
          entry.lastStatus = 'stopped'
          this.sendProgress(flowId, entry.stepId, 'error', 'Container not found')
        }
      }
    }
  }

  // ── Docker log streaming ────────────────────────────────────────────

  private startDockerLogStream(flowId: string, step: TaskFlowDockerStepConfig, containerName: string): void {
    this.dockerLogIds.set(containerName, step.id)

    // Build display name: image:tag or containerName
    const displayName = step.containerName
      ? step.containerName
      : `${step.image}:${step.tag || 'latest'}`

    // Send pseudo process:log header
    this.mainWindow.webContents.send('process:log', {
      id: step.id,
      data: `[Docker] ${displayName} (${containerName})\r\n`
    })

    this.dockerManager.followLogs(containerName, (data) => {
      this.mainWindow.webContents.send('process:log', { id: step.id, data })
    })
  }

  private stopDockerLogStream(containerName: string): void {
    this.dockerManager.stopFollowLogs(containerName)
    this.dockerLogIds.delete(containerName)
  }

  private stopAllDockerLogStreams(flowId: string, steps: TaskFlowDockerStepConfig[]): void {
    for (const step of steps) {
      const containerName = this.resolveContainerName(flowId, step)
      this.stopDockerLogStream(containerName)
    }
  }

  // ── Docker step execution ──────────────────────────────────────────

  private async startDockerStep(
    flowId: string,
    step: TaskFlowDockerStepConfig,
    ctx: RunContext
  ): Promise<void> {
    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      throw new Error('Aborted')
    }

    if (!step.image) {
      this.sendProgress(flowId, step.id, 'error', 'No image configured')
      throw new Error('No image configured')
    }

    this.sendProgress(flowId, step.id, 'pulling')
    const containerName = this.resolveContainerName(flowId, step)

    try {
      await this.dockerManager.run({
        image: step.image,
        tag: step.tag || 'latest',
        containerName,
        ports: step.ports || [],
        env: step.env || [],
        volumes: step.volumes || []
      })
      this.sendProgress(flowId, step.id, 'starting')

      // Start streaming container logs to the bottom panel
      this.startDockerLogStream(flowId, step, containerName)
    } catch (err: any) {
      this.sendProgress(flowId, step.id, 'error', err.message || 'Failed to start container')
      throw err
    }
  }

  private async waitForDockerHealth(
    flowId: string,
    step: TaskFlowDockerStepConfig,
    ctx: RunContext
  ): Promise<void> {
    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      throw new Error('Aborted')
    }

    if (!step.healthCheckEnabled) {
      this.sendProgress(flowId, step.id, 'healthy')
      return
    }

    this.sendProgress(flowId, step.id, 'waiting-health')
    const containerName = this.resolveContainerName(flowId, step)
    const timeoutMs = (step.healthTimeoutSeconds || 60) * 1000
    const pollInterval = 2000
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      if (ctx.aborted) {
        this.sendProgress(flowId, step.id, 'skipped')
        throw new Error('Aborted')
      }

      const running = await this.dockerManager.isRunning(containerName)
      if (!running) {
        this.sendProgress(flowId, step.id, 'error', 'Container stopped unexpectedly')
        throw new Error('Container stopped unexpectedly')
      }

      const health = await this.dockerManager.healthStatus(containerName)

      if (health === 'healthy') {
        this.sendProgress(flowId, step.id, 'healthy')
        return
      }

      if (health === 'none') {
        this.sendProgress(flowId, step.id, 'healthy')
        return
      }

      if (health === 'unhealthy') {
        this.sendProgress(flowId, step.id, 'error', 'Container health check failed')
        throw new Error('Container health check failed')
      }

      await this.delay(pollInterval)
    }

    this.sendProgress(flowId, step.id, 'error', `Health check timed out after ${step.healthTimeoutSeconds}s`)
    throw new Error(`Health check timed out after ${step.healthTimeoutSeconds}s`)
  }

  private resolveContainerName(flowId: string, step: TaskFlowDockerStepConfig): string {
    if (step.containerName) {
      return step.containerName.replace(/[^a-zA-Z0-9._-]/g, '-')
    }
    return `smoothy-${flowId}-${step.id}`.replace(/[^a-zA-Z0-9._-]/g, '-')
  }

  private markRemainingSkipped(flowId: string, steps: TaskFlowStepConfig[]): void {
    for (const step of steps) {
      this.sendProgress(flowId, step.id, 'skipped')
    }
  }

  // ── Process step execution ─────────────────────────────────────────

  private async executeProcessStep(
    flowId: string,
    step: TaskFlowProcessStepConfig,
    folderProjects: { id: string; rootPath: string; originalRootPath: string }[],
    ctx: RunContext
  ): Promise<void> {
    const projectConfig = folderProjects.find(p => p.id === step.projectId)
    if (!projectConfig) {
      this.sendProgress(flowId, step.id, 'error', 'Project not found')
      return
    }

    let effectiveRootPath = projectConfig.originalRootPath
    if (step.branchStrategy === 'worktree' && step.worktreePath) {
      effectiveRootPath = step.worktreePath
    }

    // Run sub-project scan and git branch check in parallel
    const needsCheckout = !!(step.branch && step.branchStrategy !== 'worktree')
    const [subProjects, currentBranch] = await Promise.all([
      this.scanner.rescanSubProjects(effectiveRootPath),
      needsCheckout ? this.gitManager.currentBranch(effectiveRootPath).catch(() => null) : Promise.resolve(null)
    ])

    let subProject = subProjects.find(sp => sp.id === step.subProjectId)

    if (!subProject && effectiveRootPath !== projectConfig.originalRootPath) {
      const canonicalSubs = await this.scanner.rescanSubProjects(projectConfig.originalRootPath)
      const canonical = canonicalSubs.find(sp => sp.id === step.subProjectId)
      if (canonical) {
        subProject = subProjects.find(
          sp => sp.name === canonical.name && sp.projectType === canonical.projectType
        )
      }
    }

    if (!subProject) {
      this.sendProgress(flowId, step.id, 'error', 'Sub-project not found')
      return
    }

    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      return
    }

    if (needsCheckout && step.branch && currentBranch !== step.branch) {
      this.sendProgress(flowId, step.id, 'checkout')
      try {
        const isDirty = await this.gitManager.isDirty(effectiveRootPath)
        if (isDirty) {
          await this.gitManager.stash(effectiveRootPath, `taskflow: switch to ${step.branch}`)
        }
        await this.gitManager.checkout(effectiveRootPath, step.branch)
      } catch (err: any) {
        this.sendProgress(flowId, step.id, 'error', `Branch checkout failed: ${err.message}`)
        return
      }
    }

    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      return
    }

    if (step.profiles.length > 0) {
      this.sendProgress(flowId, step.id, 'applying-profile')
      for (const profileRef of step.profiles) {
        try {
          const diskFilePath = effectiveRootPath !== projectConfig.originalRootPath
            ? profileRef.filePath.replace(projectConfig.originalRootPath, effectiveRootPath)
            : profileRef.filePath

          const result = await this.profileManager.applyProfile(
            step.projectId,
            profileRef.filePath,
            profileRef.profileName,
            subProject.projectType as ProjectType
          )
          if (result.merged) {
            await this.configFileManager.write(
              diskFilePath,
              result.merged,
              subProject.projectType as ProjectType
            )
          } else if (result.error) {
            this.sendProgress(flowId, step.id, 'error', `Profile "${profileRef.profileName}" not found for ${profileRef.filePath}`)
            return
          }
        } catch {
          // Non-fatal
        }
      }
    }

    if (ctx.aborted) {
      this.sendProgress(flowId, step.id, 'skipped')
      return
    }

    // Ensure node_modules exist in worktree for node-based projects (check for actual ng binary, not just directory)
    if (effectiveRootPath !== projectConfig.originalRootPath && subProject.projectType === 'angular') {
      const projectDir = path.dirname((subProject as any).angularJsonPath)
      const ngBinPath = path.join(projectDir, 'node_modules', '.bin', 'ng')
      const hasNgBin = await fs.access(ngBinPath).then(() => true).catch(() => false)
      if (!hasNgBin) {
        this.sendProgress(flowId, step.id, 'starting')
        this.mainWindow.webContents.send('process:log', {
          id: step.id,
          data: '[TaskFlow] node_modules not found in worktree, running npm install...\r\n'
        })
        try {
          await this.runNpmInstall(flowId, step.id, projectDir)
        } catch (err: any) {
          this.sendProgress(flowId, step.id, 'error', `npm install failed: ${err.message}`)
          return
        }
      }
    }

    this.sendProgress(flowId, step.id, 'starting')
    const processConfig = this.buildProcessConfig(step.id, subProject, step.mode, effectiveRootPath, step.portOverride ?? undefined)

    try {
      await this.processManager.start(processConfig)
      this.sendProgress(flowId, step.id, 'running')
    } catch (err: any) {
      const effectivePort = processConfig.portOverride || processConfig.port
      const isPortConflict = effectivePort && err.message?.includes('already in use')

      if (isPortConflict) {
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

  private buildProcessConfig(stepId: string, subProject: ScannedSubProject, mode: string, rootPath: string, portOverride?: number): ProcessConfig {
    const effectivePort = portOverride || subProject.port
    return {
      id: stepId,
      name: effectivePort ? `${subProject.name} :${effectivePort}` : subProject.name,
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

  private runNpmInstall(flowId: string, stepId: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('npm', ['install'], { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } })

      proc.stdout?.on('data', (data: Buffer) => {
        this.mainWindow.webContents.send('process:log', { id: stepId, data: data.toString() })
      })
      proc.stderr?.on('data', (data: Buffer) => {
        this.mainWindow.webContents.send('process:log', { id: stepId, data: data.toString() })
      })

      proc.on('exit', (code) => {
        if (code === 0) {
          this.mainWindow.webContents.send('process:log', {
            id: stepId,
            data: '[TaskFlow] npm install completed\r\n'
          })
          resolve()
        } else {
          reject(new Error(`npm install exited with code ${code}`))
        }
      })
      proc.on('error', reject)
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private sendProgress(flowId: string, stepId: string, status: StepStatus, error?: string): void {
    this.mainWindow.webContents.send('taskflow:stepProgress', { flowId, stepId, status, error })
  }
}
