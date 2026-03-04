import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square, Plus, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TaskFlowStepCard } from './TaskFlowStepCard'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import { useBranchStatusTracker } from '@/hooks/useBranchStatusTracker'
import type { TaskFlow, TaskFlowStep } from '@/types'

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
  const nameInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Track branch statuses for all steps in the active flow
  useBranchStatusTracker(flow?.steps ?? [])

  useEffect(() => {
    if (flow) setName(flow.name)
  }, [flow?.id])

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

  const handleAddStep = () => {
    const newStep: TaskFlowStep = {
      id: generateStepId(),
      type: 'process',
      projectId: '',
      subProjectId: '',
      branch: null,
      mode: 'watch',
      profiles: [],
      branchStrategy: 'checkout',
      portOverride: null,
      order: flow.steps.length
    }
    debouncedSave({ steps: [...flow.steps, newStep] })
    // Auto-expand the new step
    toggleStepExpanded(newStep.id)
  }

  const handleStepChange = (stepId: string, updates: Partial<TaskFlowStep>) => {
    const updatedSteps = flow.steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
    debouncedSave({ steps: updatedSteps })
  }

  const handleRemoveStep = (stepId: string) => {
    const updatedSteps = flow.steps
      .filter(s => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i }))
    debouncedSave({ steps: updatedSteps })
  }

  const handleRunStep = async (stepId: string) => {
    try {
      await window.smoothyApi.runTaskFlowStep(flow.id, stepId)
    } catch (err) {
      console.error('Failed to run step:', err)
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
              disabled={flow.steps.length === 0 || flow.steps.every(s => !s.subProjectId)}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Run All
            </Button>
          )}
        </div>
      </div>

      {/* Steps list */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-2">
          {flow.steps.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No steps configured</p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Add steps to define which services to start, on which branches, with which profiles
              </p>
              <Button variant="outline" size="sm" onClick={handleAddStep}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Step
              </Button>
            </div>
          ) : (
            <>
              {flow.steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((step, i) => (
                  <TaskFlowStepCard
                    key={step.id}
                    step={step}
                    stepNumber={i + 1}
                    progress={stepProgress[step.id]}
                    branchStatus={branchStatuses[step.id]}
                    expanded={expandedStepIds.has(step.id)}
                    flowName={flow.name}
                    onChange={(updates) => handleStepChange(step.id, updates)}
                    onRemove={() => handleRemoveStep(step.id)}
                    onToggleExpand={() => toggleStepExpanded(step.id)}
                    onRunStep={() => handleRunStep(step.id)}
                    isExecuting={isRunning}
                  />
                ))}

              {/* Add step button */}
              {!isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={handleAddStep}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Step
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
