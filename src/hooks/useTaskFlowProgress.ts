import { useEffect } from 'react'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import { useProcessStore } from '@/stores/processStore'
import type { TaskFlowStepStatus } from '@/types'

export function useTaskFlowProgress() {
  const updateStepProgress = useTaskFlowStore(s => s.updateStepProgress)
  const setExecutionStatus = useTaskFlowStore(s => s.setExecutionStatus)
  const selectedFlowId = useTaskFlowStore(s => s.selectedFlowId)
  const taskFlows = useTaskFlowStore(s => s.taskFlows)

  useEffect(() => {
    const unsub = window.smoothyApi.onTaskFlowProgress((data) => {
      if (data.flowId !== selectedFlowId) return

      // Handle flow-level completion event (status 'completed' is runner-internal, not a step status)
      if (data.stepId === '__flow__') {
        if ((data.status as string) === 'completed') {
          setExecutionStatus('idle')
        }
        return
      }

      const status = data.status as TaskFlowStepStatus

      updateStepProgress(data.stepId, {
        stepId: data.stepId,
        status,
        error: data.error
      })

      // Determine overall execution status from individual step statuses
      if (status === 'running' || status === 'healthy') {
        setExecutionStatus('running')
      } else if (status === 'error') {
        setExecutionStatus('partial-error')
      }

      // Auto-open bottom panel when a step starts producing logs
      if (status === 'starting' || status === 'pulling') {
        const processStore = useProcessStore.getState()
        if (!processStore.bottomPanelOpen) {
          processStore.setBottomPanelOpen(true)
        }
        processStore.setActiveProcessTab(data.stepId)

        // Set tab name for Docker steps
        const flow = taskFlows.find(f => f.id === data.flowId)
        if (flow) {
          const step = flow.steps.find(s => s.id === data.stepId)
          if (step && step.type === 'docker') {
            const label = step.containerName || `${step.image}:${step.tag || 'latest'}`
            processStore.setTabName(data.stepId, label)
          }
        }
      }
    })

    return unsub
  }, [updateStepProgress, setExecutionStatus, selectedFlowId, taskFlows])
}
