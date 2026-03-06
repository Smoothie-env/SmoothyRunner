import { useState, useEffect } from 'react'
import { Container, FileUp, Layers } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectItem } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type {
  ComposeParseResult,
  ComposeService,
  ComposeServiceMapping,
  ComposeSourceConfig,
  TaskFlowDockerStep,
  TaskFlowProcessStep,
  TaskFlowStep
} from '@/types'

interface ComposeImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (steps: TaskFlowStep[], composeSource: ComposeSourceConfig) => void
  existingMappings?: Record<string, ComposeServiceMapping>
}

function generateStepId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function ComposeImportDialog({ open, onOpenChange, onImport, existingMappings }: ComposeImportDialogProps) {
  const [parseResult, setParseResult] = useState<ComposeParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [mappings, setMappings] = useState<Record<string, ComposeServiceMapping>>({})
  const folderProjects = useProjectStore(s => s.folderProjects)

  useEffect(() => {
    if (open && !parseResult) {
      handlePickFile()
    }
  }, [open])

  useEffect(() => {
    if (parseResult && existingMappings) {
      setMappings({ ...existingMappings })
    }
  }, [parseResult, existingMappings])

  const handlePickFile = async () => {
    setLoading(true)
    try {
      const result = await window.smoothyApi.parseCompose()
      if (!result) {
        onOpenChange(false)
        return
      }
      setParseResult(result)

      // Initialize default mappings
      const defaultMappings: Record<string, ComposeServiceMapping> = {}
      for (const svc of result.services) {
        if (existingMappings?.[svc.name]) {
          defaultMappings[svc.name] = existingMappings[svc.name]
        } else {
          defaultMappings[svc.name] = { type: svc.build ? 'project' : 'docker' }
        }
      }
      setMappings(defaultMappings)
    } catch (err) {
      console.error('Failed to parse compose file:', err)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleMappingChange = (serviceName: string, value: string) => {
    if (value === 'docker') {
      setMappings(prev => ({ ...prev, [serviceName]: { type: 'docker' } }))
    } else {
      // value = "projectId:subProjectId"
      const [projectId, subProjectId] = value.split(':')
      setMappings(prev => ({
        ...prev,
        [serviceName]: { type: 'project', projectId, subProjectId }
      }))
    }
  }

  const handleImport = () => {
    if (!parseResult) return

    const steps: TaskFlowStep[] = []

    for (const svc of parseResult.services) {
      const mapping = mappings[svc.name] || { type: 'docker' }
      const phase = parseResult.phases[svc.name] ?? 0
      const order = steps.filter(s => s.phase === phase).length

      if (mapping.type === 'project' && mapping.projectId && mapping.subProjectId) {
        const step: TaskFlowProcessStep = {
          id: generateStepId(),
          type: 'process',
          projectId: mapping.projectId,
          subProjectId: mapping.subProjectId,
          branch: null,
          mode: svc.build ? 'devcontainer' : 'watch',
          profiles: [],
          branchStrategy: 'checkout',
          portOverride: svc.ports[0]?.hostPort ?? null,
          phase,
          order
        }
        steps.push(step)
      } else {
        const step: TaskFlowDockerStep = {
          id: generateStepId(),
          type: 'docker',
          image: svc.image || '',
          tag: 'latest',
          containerName: svc.containerName || svc.name,
          ports: svc.ports,
          env: svc.environment,
          volumes: svc.volumes,
          healthCheckEnabled: svc.hasHealthcheck,
          healthTimeoutSeconds: 60,
          phase,
          order
        }
        steps.push(step)
      }
    }

    const composeSource: ComposeSourceConfig = {
      filePath: parseResult.filePath,
      lastSyncHash: parseResult.fileHash,
      serviceMappings: mappings
    }

    onImport(steps, composeSource)
    onOpenChange(false)
    setParseResult(null)
  }

  const handleClose = () => {
    onOpenChange(false)
    setParseResult(null)
  }

  // Build project options for the select dropdown
  const projectOptions: { value: string; label: string; hasDevContainer: boolean }[] = []
  for (const proj of folderProjects) {
    for (const sub of proj.subProjects) {
      projectOptions.push({
        value: `${proj.id}:${sub.id}`,
        label: `${proj.name} / ${sub.name}`,
        hasDevContainer: proj.hasDevContainer
      })
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Parsing compose file...</div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!parseResult) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Import from Docker Compose
            </span>
          </DialogTitle>
          <DialogDescription>
            Map services to projects or keep as standalone Docker containers
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] -mx-6 px-6">
          <div className="space-y-2">
            {parseResult.services.map(svc => (
              <ServiceMappingRow
                key={svc.name}
                service={svc}
                phase={parseResult.phases[svc.name] ?? 0}
                mapping={mappings[svc.name] || { type: 'docker' }}
                projectOptions={projectOptions}
                onChange={(value) => handleMappingChange(svc.name, value)}
              />
            ))}
          </div>

          {/* Phase preview */}
          <div className="mt-4 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Phase assignment (from depends_on)
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(
                parseResult.services.reduce<Record<number, string[]>>((acc, svc) => {
                  const phase = parseResult.phases[svc.name] ?? 0
                  if (!acc[phase]) acc[phase] = []
                  acc[phase].push(svc.name)
                  return acc
                }, {})
              )
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([phase, names]) => (
                  <div key={phase} className="rounded border border-zinc-800 px-2 py-1">
                    <span className="text-[10px] font-mono text-muted-foreground">Phase {Number(phase) + 1}: </span>
                    <span className="text-[10px] font-mono text-zinc-300">{names.join(', ')}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          <Button size="sm" onClick={handleImport}>
            <FileUp className="h-3 w-3 mr-1" />
            Import {parseResult.services.length} services
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ServiceMappingRowProps {
  service: ComposeService
  phase: number
  mapping: ComposeServiceMapping
  projectOptions: { value: string; label: string; hasDevContainer: boolean }[]
  onChange: (value: string) => void
}

function ServiceMappingRow({ service, phase, mapping, projectOptions, onChange }: ServiceMappingRowProps) {
  const currentValue = mapping.type === 'project' && mapping.projectId && mapping.subProjectId
    ? `${mapping.projectId}:${mapping.subProjectId}`
    : 'docker'

  // For build-only services, only show projects with devcontainer
  const filteredOptions = service.build
    ? projectOptions.filter(o => o.hasDevContainer)
    : projectOptions

  return (
    <div className="rounded border border-zinc-800 p-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Container className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        <span className="text-xs font-medium">{service.name}</span>
        <span className="text-[10px] text-muted-foreground/50 font-mono">P{phase + 1}</span>
        <div className="flex-1" />
        {service.image && (
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
            {service.image}
          </span>
        )}
        {service.build && (
          <span className="text-[10px] text-orange-400/70 font-mono">
            build: {service.build.context || '.'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">Map to:</span>
        <Select
          value={currentValue}
          onValueChange={onChange}
          placeholder="Standalone Docker"
          className="flex-1"
        >
          <SelectItem value="docker">Standalone Docker</SelectItem>
          {filteredOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </Select>
        {service.build && !filteredOptions.length && (
          <span className="text-[10px] text-yellow-500/70">Requires devcontainer</span>
        )}
      </div>

      {/* Port summary */}
      {service.ports.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {service.ports.map((p, i) => (
            <span key={i} className="text-[10px] font-mono text-muted-foreground bg-zinc-800 rounded px-1">
              {p.hostPort}:{p.containerPort}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
