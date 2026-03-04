import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Play, Square, Plus, Workflow, ChevronDown, Container, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TaskFlowStepCard } from './TaskFlowStepCard'
import { DockerStepCard } from './DockerStepCard'
import { PhaseGroup } from './PhaseGroup'
import { SortableStepWrapper } from './SortableStepWrapper'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import { useBranchStatusTracker } from '@/hooks/useBranchStatusTracker'
import { groupStepsByPhase, normalizePhases } from '@/lib/phaseUtils'
import { cn } from '@/lib/utils'
import type { TaskFlow, TaskFlowStep, TaskFlowProcessStep, TaskFlowDockerStep } from '@/types'

function generateStepId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function TaskFlowEditor() {
  const selectedFlowId = useTaskFlowStore(s => s.selectedFlowId)
  const taskFlows = useTaskFlowStore(s => s.taskFlows)
  const updateTaskFlowStore = useTaskFlowStore(s => s.updateTaskFlow)
  const executionStatus = useTaskFlowStore(s => s.executionStatus)
  const stepProgress = useTaskFlowStore(s => s.stepProgress)
  const setExecutionStatus = useTaskFlowStore(s => s.setExecutionStatus)
  const clearProgress = useTaskFlowStore(s => s.clearProgress)
  const expandedStepIds = useTaskFlowStore(s => s.expandedStepIds)
  const toggleStepExpanded = useTaskFlowStore(s => s.toggleStepExpanded)
  const branchStatuses = useTaskFlowStore(s => s.branchStatuses)

  const flow = taskFlows.find(f => f.id === selectedFlowId)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [addStepOpen, setAddStepOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const addStepRef = useRef<HTMLDivElement>(null)

  // Track branch statuses for process steps only
  const processSteps = useMemo(
    () => (flow?.steps ?? []).filter((s): s is TaskFlowProcessStep => s.type === 'process'),
    [flow?.steps]
  )
  useBranchStatusTracker(processSteps)

  // Group steps by phase (memoized)
  const phaseGroups = useMemo(
    () => groupStepsByPhase(flow?.steps ?? []),
    [flow?.steps]
  )

  useEffect(() => {
    if (flow) setName(flow.name)
  }, [flow?.id])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const debouncedSave = useCallback((updates: Partial<TaskFlow>) => {
    if (!flow) return
    clearTimeout(saveTimerRef.current)
    updateTaskFlowStore(flow.id, updates)
    saveTimerRef.current = setTimeout(() => {
      window.smoothyApi.updateTaskFlow(flow.id, updates).catch(console.error)
    }, 500)
  }, [flow?.id, updateTaskFlowStore])

  if (!flow) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="titlebar-drag h-12 border-b shrink-0" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Workflow className="h-16 w-16 text-muted-foreground/10 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground/30">Select a task flow from the sidebar</p>
          </div>
        </div>
      </div>
    )
  }

  const isRunning = executionStatus === 'running' || executionStatus === 'partial-error'

  const handleNameSave = () => {
    setEditingName(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== flow.name) {
      debouncedSave({ name: trimmed })
    } else {
      setName(flow.name)
    }
  }

  const handleAddProcessStep = () => {
    const maxPhase = flow.steps.length > 0
      ? Math.max(...flow.steps.map(s => s.phase ?? 0))
      : -1
    const newStep: TaskFlowProcessStep = {
      id: generateStepId(),
      type: 'process',
      projectId: '',
      subProjectId: '',
      branch: null,
      mode: 'watch',
      profiles: [],
      branchStrategy: 'checkout',
      portOverride: null,
      phase: maxPhase + 1,
      order: 0
    }
    const updatedSteps = normalizePhases([...flow.steps, newStep])
    debouncedSave({ steps: updatedSteps })
    toggleStepExpanded(newStep.id)
    setAddStepOpen(false)
  }

  const handleAddDockerStep = () => {
    const maxPhase = flow.steps.length > 0
      ? Math.max(...flow.steps.map(s => s.phase ?? 0))
      : -1
    const newStep: TaskFlowDockerStep = {
      id: generateStepId(),
      type: 'docker',
      image: '',
      tag: 'latest',
      containerName: '',
      ports: [],
      env: [],
      volumes: [],
      healthCheckEnabled: true,
      healthTimeoutSeconds: 60,
      phase: maxPhase + 1,
      order: 0
    }
    const updatedSteps = normalizePhases([...flow.steps, newStep])
    debouncedSave({ steps: updatedSteps })
    toggleStepExpanded(newStep.id)
    setAddStepOpen(false)
  }

  const handleStepChange = (stepId: string, updates: Partial<TaskFlowProcessStep> | Partial<TaskFlowDockerStep>) => {
    const updatedSteps = flow.steps.map(s =>
      s.id === stepId ? { ...s, ...updates } as TaskFlowStep : s
    )
    debouncedSave({ steps: updatedSteps })
  }

  const handleRemoveStep = (stepId: string) => {
    const filtered = flow.steps.filter(s => s.id !== stepId)
    const updatedSteps = normalizePhases(filtered)
    debouncedSave({ steps: updatedSteps })
  }

  const handleRunStep = async (stepId: string) => {
    try {
      await window.smoothyApi.runTaskFlowStep(flow.id, stepId)
    } catch (err) {
      console.error('Failed to run step:', err)
    }
  }

  const handleStopStep = async (stepId: string) => {
    try {
      await window.smoothyApi.stopTaskFlowStep(flow.id, stepId)
    } catch (err) {
      console.error('Failed to stop step:', err)
    }
  }

  const handleRun = async () => {
    setExecutionStatus('running')
    try {
      await window.smoothyApi.runTaskFlow(flow.id)
    } catch (err) {
      console.error('Failed to run task flow:', err)
      setExecutionStatus('idle')
    }
  }

  const handleStop = async () => {
    try {
      await window.smoothyApi.stopTaskFlow(flow.id)
    } catch (err) {
      console.error('Failed to stop task flow:', err)
    }
    clearProgress()
  }

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeStep = flow.steps.find(s => s.id === active.id)
    if (!activeStep) return

    const overId = over.id as string

    // Case 3: Drop on phase gap → create new phase
    if (overId.startsWith('phase-gap-')) {
      const afterPhase = parseInt(overId.replace('phase-gap-', ''), 10)
      const newPhase = afterPhase + 0.5 // Will be normalized
      const updatedSteps = flow.steps.map(s =>
        s.id === activeStep.id ? { ...s, phase: newPhase, order: 0 } : s
      )
      debouncedSave({ steps: normalizePhases(updatedSteps) })
      return
    }

    // Case 2: Drop on phase group → move step to that phase
    if (overId.startsWith('phase-')) {
      const targetPhase = parseInt(overId.replace('phase-', ''), 10)
      if (activeStep.phase === targetPhase) return
      const phaseSteps = flow.steps.filter(s => s.phase === targetPhase)
      const updatedSteps = flow.steps.map(s =>
        s.id === activeStep.id ? { ...s, phase: targetPhase, order: phaseSteps.length } : s
      )
      debouncedSave({ steps: normalizePhases(updatedSteps) })
      return
    }

    // Case 1: Drop on another step → reorder
    const overStep = flow.steps.find(s => s.id === overId)
    if (!overStep) return

    if (activeStep.phase === overStep.phase) {
      // Same phase: reorder within
      const group = phaseGroups.find(g => g.phase === activeStep.phase)
      if (!group) return
      const ids = group.steps.map(s => s.id)
      const oldIndex = ids.indexOf(activeStep.id)
      const newIndex = ids.indexOf(overStep.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...ids]
      reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, activeStep.id)

      const updatedSteps = flow.steps.map(s => {
        const idx = reordered.indexOf(s.id)
        if (idx !== -1 && s.phase === activeStep.phase) {
          return { ...s, order: idx }
        }
        return s
      })
      debouncedSave({ steps: normalizePhases(updatedSteps) })
    } else {
      // Different phase: move to target step's phase
      const targetPhase = overStep.phase
      const phaseSteps = flow.steps.filter(s => s.phase === targetPhase && s.id !== activeStep.id)
      const overIndex = phaseSteps.findIndex(s => s.id === overStep.id)
      const updatedSteps = flow.steps.map(s => {
        if (s.id === activeStep.id) {
          return { ...s, phase: targetPhase, order: overIndex >= 0 ? overIndex : phaseSteps.length }
        }
        return s
      })
      debouncedSave({ steps: normalizePhases(updatedSteps) })
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  const activeStep = activeId ? flow.steps.find(s => s.id === activeId) : null

  // Compute global step number for display
  const allSortedSteps = useMemo(() => {
    const result: TaskFlowStep[] = []
    for (const group of phaseGroups) {
      result.push(...group.steps)
    }
    return result
  }, [phaseGroups])

  const getStepNumber = (stepId: string) => {
    const idx = allSortedSteps.findIndex(s => s.id === stepId)
    return idx >= 0 ? idx + 1 : 0
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="titlebar-drag h-12 flex items-center gap-3 px-4 border-b shrink-0">
        <Workflow className="h-4 w-4 text-primary titlebar-no-drag shrink-0" />
        {editingName ? (
          <input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSave()
              if (e.key === 'Escape') {
                setName(flow.name)
                setEditingName(false)
              }
            }}
            className="bg-transparent border-b border-primary text-sm font-medium outline-none titlebar-no-drag"
            autoFocus
          />
        ) : (
          <button
            className="text-sm font-medium titlebar-no-drag hover:text-primary transition-colors truncate"
            onClick={() => {
              setEditingName(true)
              setTimeout(() => nameInputRef.current?.focus(), 0)
            }}
          >
            {flow.name}
          </button>
        )}

        <div className="flex-1" />

        {/* Run / Stop */}
        <div className="titlebar-no-drag">
          {isRunning ? (
            <Button variant="destructive" size="sm" onClick={handleStop}>
              <Square className="h-3.5 w-3.5 mr-1" />
              Stop All
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleRun}
              disabled={flow.steps.length === 0 || flow.steps.every(s =>
                s.type === 'process' ? !s.subProjectId : s.type === 'docker' ? !s.image : true
              )}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Run All
            </Button>
          )}
        </div>
      </div>

      {/* Steps list */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          {flow.steps.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No steps configured</p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Add steps to define which services to start, on which branches, with which profiles
              </p>
              <div className="relative inline-block" ref={addStepRef}>
                <Button variant="outline" size="sm" onClick={() => setAddStepOpen(!addStepOpen)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Step
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                {addStepOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1 w-48 rounded-md border bg-popover shadow-md p-1">
                    <button className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2" onClick={handleAddProcessStep}>
                      <Play className="h-3 w-3" /> Process Step
                    </button>
                    <button className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2" onClick={handleAddDockerStep}>
                      <Container className="h-3 w-3" /> Docker Container
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="space-y-0">
                {phaseGroups.map((group, gi) => (
                  <PhaseGroup
                    key={group.phase}
                    phase={group.phase}
                    steps={group.steps}
                    stepProgress={stepProgress}
                    isLast={gi === phaseGroups.length - 1}
                  >
                    {group.steps.map((step) => (
                      <SortableStepWrapper key={step.id} id={step.id} disabled={isRunning}>
                        {({ listeners, attributes }) => (
                          step.type === 'docker' ? (
                            <DockerStepCard
                              step={step}
                              stepNumber={getStepNumber(step.id)}
                              progress={stepProgress[step.id]}
                              expanded={expandedStepIds.has(step.id)}
                              onChange={(updates) => handleStepChange(step.id, updates)}
                              onRemove={() => handleRemoveStep(step.id)}
                              onToggleExpand={() => toggleStepExpanded(step.id)}
                              onRunStep={() => handleRunStep(step.id)}
                              onStopStep={() => handleStopStep(step.id)}
                              isExecuting={isRunning}
                              dragListeners={listeners}
                              dragAttributes={attributes}
                            />
                          ) : (
                            <TaskFlowStepCard
                              step={step}
                              stepNumber={getStepNumber(step.id)}
                              progress={stepProgress[step.id]}
                              branchStatus={branchStatuses[step.id]}
                              expanded={expandedStepIds.has(step.id)}
                              flowName={flow.name}
                              onChange={(updates) => handleStepChange(step.id, updates)}
                              onRemove={() => handleRemoveStep(step.id)}
                              onToggleExpand={() => toggleStepExpanded(step.id)}
                              onRunStep={() => handleRunStep(step.id)}
                              isExecuting={isRunning}
                              dragListeners={listeners}
                              dragAttributes={attributes}
                            />
                          )
                        )}
                      </SortableStepWrapper>
                    ))}
                  </PhaseGroup>
                ))}
              </div>

              {/* Drag overlay — collapsed preview */}
              <DragOverlay>
                {activeStep && (
                  <div className="rounded-lg border bg-card shadow-lg opacity-90 px-3 py-2 flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                    {activeStep.type === 'docker' ? (
                      <>
                        <Container className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-sm font-medium">
                          {activeStep.image ? `${activeStep.image}:${activeStep.tag || 'latest'}` : 'Docker'}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-medium">
                        {activeStep.subProjectId || 'Process Step'}
                      </span>
                    )}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* Add step button */}
          {flow.steps.length > 0 && !isRunning && (
            <div className="relative mt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => setAddStepOpen(!addStepOpen)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Step
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
              {addStepOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full z-50 mb-1 w-48 rounded-md border bg-popover shadow-md p-1">
                  <button className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2" onClick={handleAddProcessStep}>
                    <Play className="h-3 w-3" /> Process Step
                  </button>
                  <button className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2" onClick={handleAddDockerStep}>
                    <Container className="h-3 w-3" /> Docker Container
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
