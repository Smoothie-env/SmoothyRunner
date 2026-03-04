import { create } from 'zustand'
import type { TaskFlow, TaskFlowStepProgress, StepBranchStatus } from '@/types'

type ExecutionStatus = 'idle' | 'running' | 'completed' | 'partial-error'

interface TaskFlowState {
  taskFlows: TaskFlow[]
  selectedFlowId: string | null
  executionStatus: ExecutionStatus
  stepProgress: Record<string, TaskFlowStepProgress>
  expandedStepIds: Set<string>
  branchStatuses: Record<string, StepBranchStatus>

  setTaskFlows: (flows: TaskFlow[]) => void
  addTaskFlow: (flow: TaskFlow) => void
  updateTaskFlow: (id: string, updates: Partial<TaskFlow>) => void
  removeTaskFlow: (id: string) => void
  selectFlow: (id: string | null) => void
  setExecutionStatus: (status: ExecutionStatus) => void
  updateStepProgress: (stepId: string, progress: TaskFlowStepProgress) => void
  clearProgress: () => void
  toggleStepExpanded: (stepId: string) => void
  setBranchStatus: (stepId: string, status: StepBranchStatus) => void
  clearBranchStatuses: () => void
}

export const useTaskFlowStore = create<TaskFlowState>((set) => ({
  taskFlows: [],
  selectedFlowId: null,
  executionStatus: 'idle',
  stepProgress: {},
  expandedStepIds: new Set<string>(),
  branchStatuses: {},

  setTaskFlows: (taskFlows) => set({ taskFlows }),

  addTaskFlow: (flow) => set((s) => ({
    taskFlows: [...s.taskFlows, flow]
  })),

  updateTaskFlow: (id, updates) => set((s) => ({
    taskFlows: s.taskFlows.map(f => f.id === id ? { ...f, ...updates } : f)
  })),

  removeTaskFlow: (id) => set((s) => ({
    taskFlows: s.taskFlows.filter(f => f.id !== id),
    selectedFlowId: s.selectedFlowId === id ? null : s.selectedFlowId
  })),

  selectFlow: (id) => set({
    selectedFlowId: id,
    stepProgress: {},
    executionStatus: 'idle',
    expandedStepIds: new Set<string>(),
    branchStatuses: {}
  }),

  setExecutionStatus: (executionStatus) => set({ executionStatus }),

  updateStepProgress: (stepId, progress) => set((s) => ({
    stepProgress: { ...s.stepProgress, [stepId]: progress }
  })),

  clearProgress: () => set({ stepProgress: {}, executionStatus: 'idle' }),

  toggleStepExpanded: (stepId) => set((s) => {
    const next = new Set(s.expandedStepIds)
    if (next.has(stepId)) {
      next.delete(stepId)
    } else {
      next.add(stepId)
    }
    return { expandedStepIds: next }
  }),

  setBranchStatus: (stepId, status) => set((s) => ({
    branchStatuses: { ...s.branchStatuses, [stepId]: status }
  })),

  clearBranchStatuses: () => set({ branchStatuses: {} })
}))
