import type { TaskFlowStep } from '@/types'

export interface PhaseGroup {
  phase: number
  steps: TaskFlowStep[]
}

export function groupStepsByPhase(steps: TaskFlowStep[]): PhaseGroup[] {
  const map = new Map<number, TaskFlowStep[]>()
  for (const step of steps) {
    const phase = step.phase ?? 0
    const group = map.get(phase) || []
    group.push(step)
    map.set(phase, group)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([phase, phaseSteps]) => ({
      phase,
      steps: phaseSteps.sort((a, b) => a.order - b.order)
    }))
}

export function normalizePhases(steps: TaskFlowStep[]): TaskFlowStep[] {
  const groups = groupStepsByPhase(steps)
  const result: TaskFlowStep[] = []
  for (let i = 0; i < groups.length; i++) {
    for (let j = 0; j < groups[i].steps.length; j++) {
      result.push({ ...groups[i].steps[j], phase: i, order: j })
    }
  }
  return result
}
