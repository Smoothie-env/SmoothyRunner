import { spawn, execFile, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow } from 'electron'
import { getHandler } from './project-types/registry'
import type { ProjectType, LaunchMode } from './project-types/project-type-handler'

const execFileAsync = promisify(execFile)

export type { LaunchMode }

export interface ProcessConfig {
  id: string
  name: string
  projectType: ProjectType
  projectPath: string
  projectFilePath?: string
  port?: number
  mode?: LaunchMode
  rootPath?: string
  // SubProject data needed by handler to build launch command
  subProject?: any
}

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

const LOG_BUFFER_SIZE = 10000

interface ProcessEntry {
  proc: ChildProcess
  config: ProcessConfig
  logs: string[]
  exited: boolean
  startedAt: string
}

export class ProcessManager {
  private processes = new Map<string, ProcessEntry>()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  async start(config: ProcessConfig): Promise<ProcessInfo> {
    // Check if already running
    if (this.processes.has(config.id)) {
      const existing = this.processes.get(config.id)!
      if (!existing.exited) {
        return this.toInfo(existing)
      }
      this.processes.delete(config.id)
    }

    // Check port availability
    if (config.port) {
      const portInUse = await this.isPortInUse(config.port)
      if (portInUse) {
        throw new Error(`Port ${config.port} is already in use`)
      }
    }

    const mode = config.mode || 'watch'
    const handler = getHandler(config.projectType)
    let proc: ChildProcess

    if (mode === 'devcontainer') {
      const workspaceFolder = config.rootPath || config.projectPath

      // First ensure container is up
      try {
        const upProc = spawn('devcontainer', ['up', '--workspace-folder', workspaceFolder], {
          stdio: ['pipe', 'pipe', 'pipe']
        })
        upProc.stdout?.on('data', (data: Buffer) => {
          this.mainWindow.webContents.send('process:log', { id: config.id, data: data.toString() })
        })
        upProc.stderr?.on('data', (data: Buffer) => {
          this.mainWindow.webContents.send('process:log', { id: config.id, data: data.toString() })
        })
        await new Promise<void>((resolve, reject) => {
          upProc.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`devcontainer up failed with code ${code}`))
          })
          upProc.on('error', reject)
        })
      } catch (err: any) {
        if (err.message?.includes('ENOENT')) {
          throw new Error('devcontainer CLI not found. Install it via: npm install -g @devcontainers/cli')
        }
        throw err
      }

      const cmd = handler.getDevcontainerCommand(config.subProject, config.rootPath || config.projectPath)
      proc = spawn(cmd.command, cmd.args, {
        cwd: cmd.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: cmd.shell
      })
    } else {
      const cmd = handler.getLaunchCommand(config.subProject, mode, config.rootPath || config.projectPath)
      proc = spawn(cmd.command, cmd.args, {
        cwd: cmd.cwd,
        env: cmd.env ? { ...process.env, ...cmd.env } : undefined,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: cmd.shell
      })
    }

    const logs: string[] = []
    const entry: ProcessEntry = {
      proc,
      config,
      logs,
      exited: false,
      startedAt: new Date().toISOString()
    }
    this.processes.set(config.id, entry)

    const pushLog = (data: Buffer) => {
      const text = data.toString()
      logs.push(text)
      if (logs.length > LOG_BUFFER_SIZE) {
        logs.splice(0, logs.length - LOG_BUFFER_SIZE)
      }
      this.mainWindow.webContents.send('process:log', { id: config.id, data: text })
    }

    proc.stdout?.on('data', pushLog)
    proc.stderr?.on('data', pushLog)

    proc.on('exit', (code, signal) => {
      entry.exited = true
      const reason = signal ? `signal ${signal}` : `code ${code}`
      pushLog(Buffer.from(`\r\n[Process exited with ${reason}]\r\n`))
    })

    return this.toInfo(entry)
  }

  async stop(id: string): Promise<void> {
    const entry = this.processes.get(id)
    if (!entry || entry.exited) return

    const pid = entry.proc.pid
    if (!pid) return

    await this.killTree(pid, 'SIGINT')
    if (await this.waitForExit(entry, 3000)) return

    await this.killTree(pid, 'SIGTERM')
    if (await this.waitForExit(entry, 3000)) return

    await this.killTree(pid, 'SIGKILL')
    if (await this.waitForExit(entry, 2000)) return

    if (entry.config.port) {
      await this.killByPort(entry.config.port)
    }

    entry.exited = true
  }

  private waitForExit(entry: ProcessEntry, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (entry.exited) {
        resolve(true)
        return
      }

      const timeout = setTimeout(() => {
        cleanup()
        resolve(false)
      }, timeoutMs)

      const onExit = () => {
        cleanup()
        resolve(true)
      }

      const cleanup = () => {
        clearTimeout(timeout)
        entry.proc.removeListener('exit', onExit)
      }

      entry.proc.once('exit', onExit)
    })
  }

  private async killTree(pid: number, signal: NodeJS.Signals): Promise<void> {
    const descendants = await this.getDescendants(pid)
    for (const childPid of descendants.reverse()) {
      try { process.kill(childPid, signal) } catch { /* already dead */ }
    }
    try { process.kill(pid, signal) } catch { /* already dead */ }
  }

  private async getDescendants(pid: number): Promise<number[]> {
    const result: number[] = []
    try {
      const { stdout } = await execFileAsync('pgrep', ['-P', String(pid)])
      const childPids = stdout.trim().split('\n').filter(Boolean).map(Number)
      for (const childPid of childPids) {
        result.push(childPid)
        const grandchildren = await this.getDescendants(childPid)
        result.push(...grandchildren)
      }
    } catch {
      // No children or pgrep failed
    }
    return result
  }

  async killByPort(port: number): Promise<void> {
    try {
      const { stdout } = await execFileAsync('lsof', ['-i', `:${port}`, '-t'])
      const pids = stdout.trim().split('\n').filter(Boolean).map(Number)
      for (const pid of pids) {
        try { process.kill(pid, 'SIGKILL') } catch { /* already dead */ }
      }
    } catch {
      // Nothing on this port
    }
  }

  async restart(id: string): Promise<ProcessInfo> {
    const entry = this.processes.get(id)
    if (!entry) throw new Error(`Process ${id} not found`)

    const config = entry.config
    await this.stop(id)
    return this.start(config)
  }

  async remove(id: string): Promise<void> {
    await this.stop(id)
    this.processes.delete(id)
  }

  list(): ProcessInfo[] {
    return Array.from(this.processes.values()).map(entry => this.toInfo(entry))
  }

  async stopAll(): Promise<void> {
    const stops = Array.from(this.processes.keys()).map(id => this.stop(id))
    await Promise.allSettled(stops)
  }

  private toInfo(entry: ProcessEntry): ProcessInfo {
    let status: ProcessInfo['status'] = 'running'
    if (entry.exited) status = 'stopped'
    else if (!entry.proc.pid) status = 'starting'

    return {
      id: entry.config.id,
      name: entry.config.name,
      projectType: entry.config.projectType,
      status,
      pid: entry.proc.pid,
      port: entry.config.port,
      startedAt: entry.startedAt,
      mode: entry.config.mode
    }
  }

  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('lsof', ['-i', `:${port}`, '-t'])
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }
}
