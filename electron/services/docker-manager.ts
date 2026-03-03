import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface DockerContainer {
  name: string
  service: string
  status: 'running' | 'exited' | 'starting' | 'paused' | 'unknown'
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none'
  ports: string[]
  state: string
}

export class DockerManager {
  async status(composePath: string, profiles: string[]): Promise<DockerContainer[]> {
    const args = this.buildComposeArgs(composePath, profiles)
    args.push('ps', '--format', 'json', '-a')

    try {
      const { stdout } = await execFileAsync('docker', ['compose', ...args], {
        timeout: 10000
      })

      if (!stdout.trim()) return []

      // docker compose ps --format json outputs one JSON per line
      const lines = stdout.trim().split('\n')
      return lines.map(line => {
        const c = JSON.parse(line)
        return {
          name: c.Name || c.Names || '',
          service: c.Service || '',
          status: this.parseStatus(c.State || c.Status || ''),
          health: this.parseHealth(c.Health || c.Status || ''),
          ports: this.parsePorts(c.Ports || c.Publishers || ''),
          state: c.State || c.Status || ''
        }
      })
    } catch {
      return []
    }
  }

  async up(composePath: string, services: string[], profiles: string[]): Promise<void> {
    const args = this.buildComposeArgs(composePath, profiles)
    args.push('up', '-d', ...services)
    await execFileAsync('docker', ['compose', ...args], { timeout: 120000 })
  }

  async down(composePath: string, services: string[], profiles: string[]): Promise<void> {
    const args = this.buildComposeArgs(composePath, profiles)
    if (services.length > 0) {
      args.push('stop', ...services)
    } else {
      args.push('down')
    }
    await execFileAsync('docker', ['compose', ...args], { timeout: 60000 })
  }

  async restart(composePath: string, services: string[], profiles: string[]): Promise<void> {
    const args = this.buildComposeArgs(composePath, profiles)
    args.push('restart', ...services)
    await execFileAsync('docker', ['compose', ...args], { timeout: 120000 })
  }

  async logs(composePath: string, service: string): Promise<string> {
    const args = ['-f', composePath, 'logs', '--tail', '200', service]
    try {
      const { stdout } = await execFileAsync('docker', ['compose', ...args], { timeout: 10000 })
      return stdout
    } catch {
      return ''
    }
  }

  private buildComposeArgs(composePath: string, profiles: string[]): string[] {
    const args = ['-f', composePath]
    for (const profile of profiles) {
      args.push('--profile', profile)
    }
    return args
  }

  private parseStatus(state: string): DockerContainer['status'] {
    const s = state.toLowerCase()
    if (s.includes('running') || s === 'running') return 'running'
    if (s.includes('exited') || s === 'exited') return 'exited'
    if (s.includes('starting') || s.includes('created')) return 'starting'
    if (s.includes('paused')) return 'paused'
    return 'unknown'
  }

  private parseHealth(status: string): DockerContainer['health'] {
    const s = status.toLowerCase()
    if (s.includes('healthy') && !s.includes('unhealthy')) return 'healthy'
    if (s.includes('unhealthy')) return 'unhealthy'
    if (s.includes('health: starting')) return 'starting'
    return 'none'
  }

  private parsePorts(ports: unknown): string[] {
    if (typeof ports === 'string') {
      return ports ? ports.split(',').map(p => p.trim()) : []
    }
    if (Array.isArray(ports)) {
      return ports.map(p => {
        if (typeof p === 'object' && p !== null) {
          const pub = (p as any).PublishedPort
          const target = (p as any).TargetPort
          if (pub && target) return `${pub}:${target}`
          if (target) return String(target)
        }
        return String(p)
      }).filter(Boolean)
    }
    return []
  }
}
