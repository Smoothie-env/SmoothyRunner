import { spawn, execFile, type ChildProcess } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import { BrowserWindow } from 'electron'

const execFileAsync = promisify(execFile)

export type LaunchMode = 'watch' | 'release' | 'devcontainer'

export interface ProcessConfig {
  id: string
  name: string
  type: 'dotnet' | 'angular' | 'docker'
  projectPath: string
  csprojPath?: string
  port?: number
  mode?: LaunchMode
  rootPath?: string // needed for devcontainer workspace-folder
}

export interface ProcessInfo {
  id: string
  name: string
  type: string
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

    let proc: ChildProcess
    const mode = config.mode || 'watch'

    if (config.type === 'dotnet') {
      if (mode === 'devcontainer') {
        // DevContainer mode: run via devcontainer CLI
        const workspaceFolder = config.rootPath || config.projectPath
        const relativeCsproj = config.csprojPath
          ? path.relative(workspaceFolder, config.csprojPath)
          : undefined

        const execArgs = ['exec', '--workspace-folder', workspaceFolder, 'dotnet', 'run']
        if (relativeCsproj) {
          execArgs.push('--project', relativeCsproj)
        }

        // First ensure container is up
        try {
          const upProc = spawn('devcontainer', ['up', '--workspace-folder', workspaceFolder], {
            stdio: ['pipe', 'pipe', 'pipe']
          })
          // Forward up logs
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

        proc = spawn('devcontainer', execArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } else if (mode === 'release') {
        const args = ['run', '-c', 'Release']
        if (config.csprojPath) {
          args.push('--project', config.csprojPath)
        }
        proc = spawn('dotnet', args, {
          cwd: config.projectPath,
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } else {
        // watch mode (default)
        const args = ['watch', 'run']
        if (config.csprojPath) {
          args.push('--project', config.csprojPath)
        }
        proc = spawn('dotnet', args, {
          cwd: config.projectPath,
          env: { ...process.env, DOTNET_WATCH_RESTART_ON_RUDE_EDIT: 'true' },
          stdio: ['pipe', 'pipe', 'pipe']
        })
      }
    } else if (config.type === 'angular') {
      proc = spawn('npx', ['ng', 'serve'], {
        cwd: config.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      })
    } else {
      throw new Error(`Unsupported process type: ${config.type}`)
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

    // Phase 1: Graceful — SIGINT to entire tree (how Ctrl+C works)
    // dotnet watch responds to SIGINT properly, SIGTERM sometimes leaves it in "waiting" state
    await this.killTree(pid, 'SIGINT')

    if (await this.waitForExit(entry, 3000)) return

    // Phase 2: SIGTERM entire tree
    await this.killTree(pid, 'SIGTERM')

    if (await this.waitForExit(entry, 3000)) return

    // Phase 3: SIGKILL — force kill everything
    await this.killTree(pid, 'SIGKILL')

    if (await this.waitForExit(entry, 2000)) return

    // Phase 4: Nuclear — kill any process still holding the port
    if (entry.config.port) {
      await this.killByPort(entry.config.port)
    }

    // Mark as exited regardless — we've done everything we can
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
    // Collect entire descendant tree before killing anything
    const descendants = await this.getDescendants(pid)

    // Kill deepest children first, then work up to root
    for (const childPid of descendants.reverse()) {
      try { process.kill(childPid, signal) } catch { /* already dead */ }
    }

    // Kill root last
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
      type: entry.config.type,
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
