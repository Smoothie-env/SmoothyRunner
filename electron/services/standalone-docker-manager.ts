import { execFile, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function execWithRetry(
  cmd: string,
  args: string[],
  retries = 3,
  backoff = 300
): Promise<{ stdout: string; stderr: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await execFileAsync(cmd, args)
    } catch (err: any) {
      if (err.code === 'EAGAIN' && attempt < retries) {
        await delay(backoff * (attempt + 1))
        continue
      }
      throw err
    }
  }
  throw new Error('execWithRetry: exhausted retries')
}

export interface StandaloneDockerRunConfig {
  image: string
  tag: string
  containerName: string
  ports: { hostPort: number; containerPort: number }[]
  env: { key: string; value: string }[]
  volumes: { hostPath: string; containerPath: string }[]
}

export class StandaloneDockerManager {
  private logProcesses = new Map<string, ChildProcess>()

  async run(config: StandaloneDockerRunConfig): Promise<void> {
    const args = ['run', '-d', '--name', config.containerName]

    for (const p of config.ports) {
      args.push('-p', `${p.hostPort}:${p.containerPort}`)
    }

    for (const e of config.env) {
      args.push('-e', `${e.key}=${e.value}`)
    }

    for (const v of config.volumes) {
      args.push('-v', `${v.hostPath}:${v.containerPath}`)
    }

    args.push(`${config.image}:${config.tag}`)

    await execWithRetry('docker', args)
  }

  async stop(containerName: string): Promise<void> {
    try {
      await execWithRetry('docker', ['stop', containerName])
    } catch {
      // Container may not be running
    }
  }

  async remove(containerName: string): Promise<void> {
    try {
      await execWithRetry('docker', ['rm', '-f', containerName])
    } catch {
      // Container may not exist
    }
  }

  async healthStatus(containerName: string): Promise<string> {
    try {
      const { stdout } = await execWithRetry('docker', [
        'inspect',
        '--format',
        '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}',
        containerName
      ])
      return stdout.trim()
    } catch {
      return 'unknown'
    }
  }

  async isRunning(containerName: string): Promise<boolean> {
    try {
      const { stdout } = await execWithRetry('docker', [
        'inspect',
        '--format',
        '{{.State.Running}}',
        containerName
      ])
      return stdout.trim() === 'true'
    } catch {
      return false
    }
  }

  async logs(containerName: string, tail: number = 100): Promise<string> {
    try {
      const { stdout } = await execWithRetry('docker', [
        'logs',
        '--tail',
        String(tail),
        containerName
      ])
      return stdout
    } catch (err: any) {
      return err.stderr || err.message || 'Failed to get logs'
    }
  }

  followLogs(containerName: string, onData: (data: string) => void): void {
    this.stopFollowLogs(containerName)

    const proc = spawn('docker', ['logs', '-f', '--tail', '200', containerName], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    proc.stdout?.on('data', (chunk: Buffer) => onData(chunk.toString()))
    proc.stderr?.on('data', (chunk: Buffer) => onData(chunk.toString()))
    proc.on('exit', () => {
      this.logProcesses.delete(containerName)
    })

    this.logProcesses.set(containerName, proc)
  }

  stopFollowLogs(containerName: string): void {
    const proc = this.logProcesses.get(containerName)
    if (proc) {
      try { proc.kill() } catch { /* already dead */ }
      this.logProcesses.delete(containerName)
    }
  }

  stopAllLogFollowers(): void {
    for (const [name, proc] of this.logProcesses) {
      try { proc.kill() } catch { /* already dead */ }
    }
    this.logProcesses.clear()
  }
}
