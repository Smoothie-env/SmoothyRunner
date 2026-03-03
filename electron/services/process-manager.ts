import { spawn, execFile, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow } from 'electron'

const execFileAsync = promisify(execFile)

export interface ProcessConfig {
  id: string
  name: string
  type: 'dotnet' | 'angular' | 'docker'
  projectPath: string
  csprojPath?: string
  port?: number
}

export interface ProcessInfo {
  id: string
  name: string
  type: string
  status: 'running' | 'stopped' | 'starting' | 'error'
  pid?: number
  port?: number
  startedAt?: string
}

const LOG_BUFFER_SIZE = 10000

export class ProcessManager {
  private processes = new Map<string, { proc: ChildProcess; config: ProcessConfig; logs: string[] }>()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  async start(config: ProcessConfig): Promise<ProcessInfo> {
    // Check if already running
    if (this.processes.has(config.id)) {
      const existing = this.processes.get(config.id)!
      if (existing.proc.exitCode === null) {
        return this.toInfo(config, existing.proc)
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

    if (config.type === 'dotnet') {
      const args = ['watch', 'run']
      if (config.csprojPath) {
        args.push('--project', config.csprojPath)
      }
      proc = spawn('dotnet', args, {
        cwd: config.projectPath,
        env: { ...process.env, DOTNET_WATCH_RESTART_ON_RUDE_EDIT: 'true' },
        stdio: ['pipe', 'pipe', 'pipe']
      })
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
    const entry = { proc, config, logs }
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

    proc.on('exit', (code) => {
      const exitMsg = `\r\n[Process exited with code ${code}]\r\n`
      pushLog(Buffer.from(exitMsg))
    })

    return this.toInfo(config, proc)
  }

  async stop(id: string): Promise<void> {
    const entry = this.processes.get(id)
    if (!entry || entry.proc.exitCode !== null) return

    entry.proc.kill('SIGTERM')

    // Wait up to 5s for graceful shutdown, then SIGKILL
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (entry.proc.exitCode === null) {
          entry.proc.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      entry.proc.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  async restart(id: string): Promise<ProcessInfo> {
    const entry = this.processes.get(id)
    if (!entry) throw new Error(`Process ${id} not found`)

    const config = entry.config
    await this.stop(id)
    return this.start(config)
  }

  list(): ProcessInfo[] {
    return Array.from(this.processes.entries()).map(([, entry]) =>
      this.toInfo(entry.config, entry.proc)
    )
  }

  async stopAll(): Promise<void> {
    const stops = Array.from(this.processes.keys()).map(id => this.stop(id))
    await Promise.allSettled(stops)
  }

  private toInfo(config: ProcessConfig, proc: ChildProcess): ProcessInfo {
    let status: ProcessInfo['status'] = 'running'
    if (proc.exitCode !== null) status = 'stopped'
    else if (!proc.pid) status = 'starting'

    return {
      id: config.id,
      name: config.name,
      type: config.type,
      status,
      pid: proc.pid,
      port: config.port,
      startedAt: new Date().toISOString()
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
