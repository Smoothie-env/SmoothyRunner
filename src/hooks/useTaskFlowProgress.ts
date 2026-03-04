import { useEffect } from 'react'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import type { TaskFlowStepStatus } from '@/types'

export function useTaskFlowProgress() {
  const updateStepProgress = useTaskFlowStore(s => s.updateStepProgress)
  const setExecutionStatus = useTaskFlowStore(s => s.setExecutionStatus)
  const selectedFlowId = useTaskFlowStore(s => s.selectedFlowId)

  useEffect(() => {
    const unsub = window.smoothyApi.onTaskFlowProgress((data) => {
      if (data.flowId !== selectedFlowId) return

      const status = data.status as TaskFlowStepStatus

      // Handle flow-level completion event
      if (data.stepId === '__flow__') {
        if (status === 'completed') {
          setExecutionStatus('idle')
        }
        return
      }

      updateStepProgress(data.stepId, {
        stepId: data.stepId,
        status,
        error: data.error
      })

      // Determine overall execution status from individual step statuses
      if (status === 'running') {
        setExecutionStatus('running')
      } else if (status === 'error') {
        setExecutionStatus('partial-error')
      }
    })

    return unsub
  }, [updateStepProgress, setExecutionStatus, selectedFlowId])
}
