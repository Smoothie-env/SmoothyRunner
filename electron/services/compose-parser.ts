import fs from 'fs/promises'
import crypto from 'crypto'
import yaml from 'js-yaml'

export interface ComposeService {
  name: string
  image?: string
  build?: { context?: string; dockerfile?: string }
  ports: { hostPort: number; containerPort: number }[]
  environment: { key: string; value: string }[]
  volumes: { hostPath: string; containerPath: string }[]
  dependsOn: string[]
  hasHealthcheck: boolean
  containerName?: string
}

export interface ComposeParseResult {
  filePath: string
  fileHash: string
  services: ComposeService[]
  phases: Record<string, number>
}

interface ComposeFileSchema {
  services?: Record<string, ComposeServiceSchema>
}

interface ComposeServiceSchema {
  image?: string
  build?: string | { context?: string; dockerfile?: string }
  ports?: (string | { published?: number; target?: number })[]
  environment?: Record<string, string> | string[]
  volumes?: string[]
  depends_on?: string[] | Record<string, unknown>
  healthcheck?: Record<string, unknown>
  container_name?: string
}

export class ComposeParser {
  async parse(filePath: string): Promise<ComposeParseResult> {
    const content = await fs.readFile(filePath, 'utf-8')
    const fileHash = this.hashContent(content)
    const doc = yaml.load(content) as ComposeFileSchema

    if (!doc || !doc.services) {
      return { filePath, fileHash, services: [], phases: {} }
    }

    const services: ComposeService[] = []

    for (const [name, svc] of Object.entries(doc.services)) {
      services.push(this.parseService(name, svc))
    }

    const phases = this.computePhases(services)

    return { filePath, fileHash, services, phases }
  }

  async computeHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8')
    return this.hashContent(content)
  }

  async flattenAppsettingsKeys(appsettingsPath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(appsettingsPath, 'utf-8')
      const data = JSON.parse(content)
      const keys: string[] = []
      this.flattenObject(data, '', keys)
      return keys
    } catch {
      return []
    }
  }

  private flattenObject(obj: Record<string, unknown>, prefix: string, result: string[]): void {
    for (const [key, value] of Object.entries(obj)) {
      const flatKey = prefix ? `${prefix}__${key}` : key
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.flattenObject(value as Record<string, unknown>, flatKey, result)
      } else {
        result.push(flatKey)
      }
    }
  }

  private parseService(name: string, svc: ComposeServiceSchema): ComposeService {
    const ports = this.parsePorts(svc.ports)
    const environment = this.parseEnvironment(svc.environment)
    const volumes = this.parseVolumes(svc.volumes)
    const dependsOn = this.parseDependsOn(svc.depends_on)
    const build = this.parseBuild(svc.build)

    return {
      name,
      image: svc.image,
      build: build ?? undefined,
      ports,
      environment,
      volumes,
      dependsOn,
      hasHealthcheck: !!svc.healthcheck,
      containerName: svc.container_name
    }
  }

  private parseBuild(build: string | { context?: string; dockerfile?: string } | undefined): { context?: string; dockerfile?: string } | null {
    if (!build) return null
    if (typeof build === 'string') {
      return { context: build }
    }
    return { context: build.context, dockerfile: build.dockerfile }
  }

  private parsePorts(ports?: (string | { published?: number; target?: number })[]): { hostPort: number; containerPort: number }[] {
    if (!ports) return []
    const result: { hostPort: number; containerPort: number }[] = []

    for (const port of ports) {
      if (typeof port === 'string') {
        // "8080:80" or "80"
        const parts = port.split(':')
        if (parts.length >= 2) {
          const hostPort = parseInt(parts[0], 10)
          const containerPort = parseInt(parts[1], 10)
          if (!isNaN(hostPort) && !isNaN(containerPort)) {
            result.push({ hostPort, containerPort })
          }
        } else {
          const p = parseInt(parts[0], 10)
          if (!isNaN(p)) {
            result.push({ hostPort: p, containerPort: p })
          }
        }
      } else if (typeof port === 'object') {
        if (port.published != null && port.target != null) {
          result.push({ hostPort: port.published, containerPort: port.target })
        }
      }
    }

    return result
  }

  private parseEnvironment(env?: Record<string, string> | string[]): { key: string; value: string }[] {
    if (!env) return []

    if (Array.isArray(env)) {
      return env.map(e => {
        const eqIdx = e.indexOf('=')
        if (eqIdx >= 0) {
          return { key: e.slice(0, eqIdx), value: e.slice(eqIdx + 1) }
        }
        return { key: e, value: '' }
      })
    }

    return Object.entries(env).map(([key, value]) => ({
      key,
      value: String(value ?? '')
    }))
  }

  private parseVolumes(volumes?: string[]): { hostPath: string; containerPath: string }[] {
    if (!volumes) return []
    const result: { hostPath: string; containerPath: string }[] = []

    for (const vol of volumes) {
      const parts = vol.split(':')
      if (parts.length >= 2) {
        result.push({ hostPath: parts[0], containerPath: parts[1] })
      }
    }

    return result
  }

  private parseDependsOn(dependsOn?: string[] | Record<string, unknown>): string[] {
    if (!dependsOn) return []
    if (Array.isArray(dependsOn)) return dependsOn
    return Object.keys(dependsOn)
  }

  private computePhases(services: ComposeService[]): Record<string, number> {
    // Kahn's algorithm for topological sort → assign phase numbers
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()
    const serviceNames = new Set(services.map(s => s.name))

    for (const svc of services) {
      inDegree.set(svc.name, 0)
      adjacency.set(svc.name, [])
    }

    for (const svc of services) {
      for (const dep of svc.dependsOn) {
        if (serviceNames.has(dep)) {
          adjacency.get(dep)!.push(svc.name)
          inDegree.set(svc.name, (inDegree.get(svc.name) || 0) + 1)
        }
      }
    }

    const phases: Record<string, number> = {}
    const queue: string[] = []

    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name)
        phases[name] = 0
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      const currentPhase = phases[current]

      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1
        inDegree.set(neighbor, newDegree)

        // Phase is max of all dependency phases + 1
        phases[neighbor] = Math.max(phases[neighbor] ?? 0, currentPhase + 1)

        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }

    // Any services not assigned (cyclic deps) get max phase + 1
    const maxPhase = Math.max(0, ...Object.values(phases))
    for (const svc of services) {
      if (!(svc.name in phases)) {
        phases[svc.name] = maxPhase + 1
      }
    }

    return phases
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }
}
