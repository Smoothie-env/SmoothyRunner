import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import type { TaskFlowStep, TaskFlowStepProgress } from '@/types'

interface PhaseGroupProps {
  phase: number
  steps: TaskFlowStep[]
  stepProgress: Record<string, TaskFlowStepProgress>
  isLast: boolean
  children: React.ReactNode
}

function getPhaseAggregateStatus(
  steps: TaskFlowStep[],
  stepProgress: Record<string, TaskFlowStepProgress>
): 'idle' | 'running' | 'healthy' | 'error' | 'pending' {
  const statuses = steps.map(s => stepProgress[s.id]?.status)
  if (statuses.length === 0) return 'idle'
  if (statuses.some(s => s === 'error')) return 'error'
  if (statuses.every(s => s === 'healthy' || s === 'running')) return 'healthy'
  if (statuses.some(s => s && s !== 'pending' && s !== 'skipped' && s !== 'stopped')) return 'running'
  if (statuses.some(s => s === 'pending')) return 'pending'
  return 'idle'
}

const STATUS_DOT: Record<string, string> = {
  idle: 'bg-zinc-600',
  pending: 'bg-zinc-500',
  running: 'bg-blue-500 animate-pulse',
  healthy: 'bg-green-500',
  error: 'bg-red-500'
}

export function PhaseGroup({ phase, steps, stepProgress, isLast, children }: PhaseGroupProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `phase-${phase}` })
  const aggStatus = getPhaseAggregateStatus(steps, stepProgress)
  const isParallel = steps.length > 1
  const stepIds = steps.map(s => s.id)

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border border-zinc-800 bg-zinc-900/50 transition-colors',
          isOver && 'border-orange-500/50 bg-orange-500/5'
        )}
      >
        {/* Phase header */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/50">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Phase {phase + 1}
          </span>
          {isParallel && (
            <span className="text-[10px] text-orange-400/70 font-mono">
              parallel
            </span>
          )}
          {!isParallel && steps.length === 1 && (
            <span className="text-[10px] text-muted-foreground/50 font-mono">
              1 step
            </span>
          )}
          <div className="flex-1" />
          <div className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[aggStatus])} />
        </div>

        {/* Steps */}
        <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
          <div className="p-2 space-y-2">
            {children}
          </div>
        </SortableContext>
      </div>

      {/* "then" connector between phases */}
      {!isLast && (
        <PhaseGapDropZone afterPhase={phase} />
      )}
    </>
  )
}

function PhaseGapDropZone({ afterPhase }: { afterPhase: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `phase-gap-${afterPhase}` })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center justify-center py-1 transition-all',
        isOver && 'py-3'
      )}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-px h-2 bg-zinc-700" />
        <div className={cn(
          'text-[10px] font-mono px-2 py-0.5 rounded border transition-colors',
          isOver
            ? 'text-orange-400 border-orange-500/50 bg-orange-500/10'
            : 'text-zinc-600 border-zinc-800'
        )}>
          then
        </div>
        <div className="w-px h-2 bg-zinc-700" />
      </div>
    </div>
  )
}
