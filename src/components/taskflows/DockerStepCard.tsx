import { useState } from 'react'
import {
  X, Play, Square, Settings, ChevronDown, ChevronRight, Plus, Trash2, Container, GripVertical
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DOCKER_PRESETS } from '@/lib/dockerPresets'
import { STATUS_CONFIG } from './stepStatusConfig'
import type { TaskFlowDockerStep, TaskFlowStepProgress } from '@/types'

interface DockerStepCardProps {
  step: TaskFlowDockerStep
  stepNumber: number
  progress?: TaskFlowStepProgress
  expanded: boolean
  onChange: (updates: Partial<TaskFlowDockerStep>) => void
  onRemove: () => void
  onToggleExpand: () => void
  onRunStep: () => void
  onStopStep: () => void
  isExecuting: boolean
  dragListeners?: Record<string, Function>
  dragAttributes?: Record<string, any>
}

export function DockerStepCard({
  step, stepNumber, progress, expanded,
  onChange, onRemove, onToggleExpand, onRunStep, onStopStep, isExecuting,
  dragListeners, dragAttributes
}: DockerStepCardProps) {
  const [presetOpen, setPresetOpen] = useState(false)

  const statusInfo = progress ? STATUS_CONFIG[progress.status] || STATUS_CONFIG.pending : null

  const isContainerRunning = progress
    && (progress.status === 'running' || progress.status === 'healthy'
      || progress.status === 'starting' || progress.status === 'pulling'
      || progress.status === 'waiting-health')

  const portsSummary = step.ports.length > 0
    ? step.ports.map(p => `${p.hostPort}:${p.containerPort}`).join(', ')
    : null

  const handleLoadPreset = (presetId: string) => {
    const preset = DOCKER_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    onChange({
      image: preset.image,
      tag: preset.tag,
      ports: [...preset.ports],
      env: [...preset.env],
      volumes: [...preset.volumes],
      healthCheckEnabled: preset.healthCheckEnabled,
      healthTimeoutSeconds: preset.healthTimeoutSeconds,
      containerName: step.containerName || '',
      presetId: preset.id
    })
    setPresetOpen(false)
  }

  // Port mapping handlers
  const addPort = () => onChange({ ports: [...step.ports, { hostPort: 0, containerPort: 0 }] })
  const removePort = (i: number) => onChange({ ports: step.ports.filter((_, idx) => idx !== i) })
  const updatePort = (i: number, field: 'hostPort' | 'containerPort', value: number) => {
    const updated = step.ports.map((p, idx) => idx === i ? { ...p, [field]: value } : p)
    onChange({ ports: updated })
  }

  // Env var handlers
  const addEnv = () => onChange({ env: [...step.env, { key: '', value: '' }] })
  const removeEnv = (i: number) => onChange({ env: step.env.filter((_, idx) => idx !== i) })
  const updateEnv = (i: number, field: 'key' | 'value', value: string) => {
    const updated = step.env.map((e, idx) => idx === i ? { ...e, [field]: value } : e)
    onChange({ env: updated })
  }

  // Volume handlers
  const addVolume = () => onChange({ volumes: [...step.volumes, { hostPath: '', containerPath: '' }] })
  const removeVolume = (i: number) => onChange({ volumes: step.volumes.filter((_, idx) => idx !== i) })
  const updateVolume = (i: number, field: 'hostPath' | 'containerPath', value: string) => {
    const updated = step.volumes.map((v, idx) => idx === i ? { ...v, [field]: value } : v)
    onChange({ volumes: updated })
  }

  return (
    <div className={cn(
      'rounded-lg border bg-card transition-colors',
      isExecuting && 'opacity-80',
      progress?.status === 'error' && 'border-destructive/50',
      progress?.status === 'healthy' && 'border-green-500/50',
      progress?.status === 'stopped' && 'border-muted-foreground/30'
    )}>
      {/* Collapsed Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Drag handle */}
        {!isExecuting && dragListeners && (
          <div
            {...dragListeners}
            {...dragAttributes}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
        )}

        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        }

        {/* Step number */}
        <span className="text-[10px] font-mono text-muted-foreground bg-zinc-800 rounded px-1.5 py-0.5 shrink-0">
          #{stepNumber}
        </span>

        {/* Status indicator */}
        {statusInfo && (
          <div className={cn('flex items-center gap-1 shrink-0', statusInfo.className)}>
            {statusInfo.icon}
          </div>
        )}

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Container className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-sm font-medium truncate">
              {step.image ? `${step.image}:${step.tag || 'latest'}` : 'Not configured'}
            </span>

            {/* Health status badge */}
            {progress?.status === 'healthy' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-400 border-green-400/30">
                Healthy
              </Badge>
            )}
            {progress?.status === 'waiting-health' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-cyan-400 border-cyan-400/30">
                Checking...
              </Badge>
            )}
            {progress?.status === 'stopped' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30">
                Stopped
              </Badge>
            )}

            {/* Ports summary */}
            {portsSummary && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {portsSummary}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-400 border-blue-400/30">
              Docker
            </Badge>
            {step.containerName && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="truncate font-mono">{step.containerName}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          {step.image && (
            isContainerRunning ? (
              <button
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20 transition-colors"
                onClick={onStopStep}
                title="Stop this container"
              >
                <Square className="h-3 w-3 text-destructive" />
              </button>
            ) : (
              <button
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-green-500/20 transition-colors"
                onClick={onRunStep}
                title="Run this step"
              >
                <Play className="h-3 w-3 text-green-500" />
              </button>
            )
          )}
          <button
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors"
            onClick={onToggleExpand}
            title="Settings"
          >
            <Settings className="h-3 w-3 text-muted-foreground" />
          </button>
          {!isContainerRunning && (
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20 transition-colors"
              onClick={onRemove}
              title="Remove step"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {progress?.error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded mx-3 mb-2 px-2 py-1.5">
          {progress.error}
        </div>
      )}

      {/* Expanded form */}
      {expanded && (
        <div className={cn('border-t px-3 py-3 space-y-3', isExecuting && 'opacity-60 pointer-events-none')}>
          {/* Preset picker */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Preset</label>
            <div className="relative">
              <button
                onClick={() => setPresetOpen(!presetOpen)}
                className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs text-left flex items-center justify-between"
              >
                <span className={step.presetId ? 'text-foreground' : 'text-muted-foreground'}>
                  {step.presetId
                    ? DOCKER_PRESETS.find(p => p.id === step.presetId)?.name || 'Custom'
                    : 'Load preset...'
                  }
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
              {presetOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    {DOCKER_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors',
                          step.presetId === preset.id && 'bg-accent'
                        )}
                        onClick={() => handleLoadPreset(preset.id)}
                      >
                        <span className="font-medium">{preset.name}</span>
                        <span className="text-muted-foreground ml-2">{preset.image}:{preset.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Image + Tag */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Image</label>
              <input
                value={step.image}
                onChange={e => onChange({ image: e.target.value })}
                placeholder="e.g. redis"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tag</label>
              <input
                value={step.tag}
                onChange={e => onChange({ tag: e.target.value })}
                placeholder="latest"
                className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs"
              />
            </div>
          </div>

          {/* Container name */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Container Name</label>
            <input
              value={step.containerName}
              onChange={e => onChange({ containerName: e.target.value })}
              placeholder="Auto-generated if empty"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs"
            />
          </div>

          {/* Port mappings */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ports</label>
              <button onClick={addPort} className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {step.ports.map((port, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={port.hostPort || ''}
                  onChange={e => updatePort(i, 'hostPort', parseInt(e.target.value) || 0)}
                  placeholder="Host"
                  className="h-7 w-20 rounded-md border border-input bg-transparent px-2 text-xs"
                />
                <span className="text-xs text-muted-foreground">:</span>
                <input
                  type="number"
                  value={port.containerPort || ''}
                  onChange={e => updatePort(i, 'containerPort', parseInt(e.target.value) || 0)}
                  placeholder="Container"
                  className="h-7 w-20 rounded-md border border-input bg-transparent px-2 text-xs"
                />
                <button onClick={() => removePort(i)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20">
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          {/* Env vars */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Environment</label>
              <button onClick={addEnv} className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {step.env.map((envVar, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={envVar.key}
                  onChange={e => updateEnv(i, 'key', e.target.value)}
                  placeholder="KEY"
                  className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs font-mono"
                />
                <span className="text-xs text-muted-foreground">=</span>
                <input
                  value={envVar.value}
                  onChange={e => updateEnv(i, 'value', e.target.value)}
                  placeholder="value"
                  className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs"
                />
                <button onClick={() => removeEnv(i)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20">
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          {/* Volumes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Volumes</label>
              <button onClick={addVolume} className="text-[10px] text-blue-400 hover:underline flex items-center gap-0.5">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {step.volumes.map((vol, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={vol.hostPath}
                  onChange={e => updateVolume(i, 'hostPath', e.target.value)}
                  placeholder="Host path"
                  className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs font-mono"
                />
                <span className="text-xs text-muted-foreground">:</span>
                <input
                  value={vol.containerPath}
                  onChange={e => updateVolume(i, 'containerPath', e.target.value)}
                  placeholder="Container path"
                  className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs font-mono"
                />
                <button onClick={() => removeVolume(i)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20">
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          {/* Health check */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Health Check</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={step.healthCheckEnabled}
                  onChange={e => onChange({ healthCheckEnabled: e.target.checked })}
                  className="rounded"
                />
                Enabled
              </label>
              {step.healthCheckEnabled && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Timeout:</span>
                  <input
                    type="number"
                    value={step.healthTimeoutSeconds}
                    onChange={e => onChange({ healthTimeoutSeconds: parseInt(e.target.value) || 60 })}
                    className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
