import { useProjectStore } from '@/stores/projectStore'
import { useProcessStore } from '@/stores/processStore'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Play, BookOpen, Circle } from 'lucide-react'
import type { SubProject } from '@/types'

interface SubProjectNodeProps {
  subProject: SubProject
  projectId: string
}

export function SubProjectNode({ subProject, projectId }: SubProjectNodeProps) {
  const selection = useProjectStore(s => s.selection)
  const setSelection = useProjectStore(s => s.setSelection)
  const processes = useProcessStore(s => s.processes)

  const isActive = selection?.type === 'subproject'
    && selection.projectId === projectId
    && selection.subProjectId === subProject.id

  const isRunning = processes.some(p => p.id === subProject.id && p.status === 'running')

  const handleClick = () => {
    setSelection({ type: 'subproject', projectId, subProjectId: subProject.id })
  }

  return (
    <button
      className={cn(
        'group flex items-center gap-2 w-full text-left px-2 py-1 rounded-md transition-colors',
        isActive ? 'bg-accent' : 'hover:bg-accent/50'
      )}
      onClick={handleClick}
    >
      {/* Kind icon */}
      {subProject.kind === 'runnable' ? (
        <Play className="h-3 w-3 text-green-400 shrink-0" />
      ) : (
        <BookOpen className="h-3 w-3 text-blue-400 shrink-0" />
      )}

      {/* Name */}
      <span className="text-xs truncate flex-1">{subProject.name}</span>

      {/* Running indicator */}
      {isRunning && <Circle className="h-2 w-2 fill-success text-success shrink-0" />}

      {/* Badges */}
      <div className="flex gap-0.5 shrink-0">
        {subProject.targetFramework && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
            {subProject.targetFramework}
          </Badge>
        )}
        {subProject.port && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
            :{subProject.port}
          </Badge>
        )}
      </div>
    </button>
  )
}
