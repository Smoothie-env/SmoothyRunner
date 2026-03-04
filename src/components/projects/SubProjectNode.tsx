import { useProjectStore } from '@/stores/projectStore'
import { useProcessStore } from '@/stores/processStore'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Play, BookOpen, Package, Circle, Globe } from 'lucide-react'
import type { SubProject } from '@/types'

interface SubProjectNodeProps {
  subProject: SubProject
  projectId: string
}

function KindIcon({ subProject }: { subProject: SubProject }) {
  if (subProject.projectType === 'dotnet') {
    if (subProject.kind === 'runnable') return <Play className="h-3 w-3 text-green-400 shrink-0" />
    if (subProject.kind === 'package') return <Package className="h-3 w-3 text-orange-400 shrink-0" />
    return <BookOpen className="h-3 w-3 text-blue-400 shrink-0" />
  }
  if (subProject.projectType === 'angular') {
    if (subProject.kind === 'application') return <Globe className="h-3 w-3 text-purple-400 shrink-0" />
    return <BookOpen className="h-3 w-3 text-blue-400 shrink-0" />
  }
  return <Play className="h-3 w-3 text-muted-foreground shrink-0" />
}

function SubProjectBadges({ subProject }: { subProject: SubProject }) {
  return (
    <div className="flex gap-0.5 shrink-0">
      {subProject.projectType === 'dotnet' && subProject.targetFramework && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
          {subProject.targetFramework}
        </Badge>
      )}
      {subProject.projectType === 'angular' && subProject.angularVersion && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
          ng{subProject.angularVersion.split('.')[0]}
        </Badge>
      )}
      {subProject.port && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
          :{subProject.port}
        </Badge>
      )}
      {subProject.projectType === 'dotnet' && subProject.version && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 text-orange-400">
          v{subProject.version}
        </Badge>
      )}
    </div>
  )
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
      <KindIcon subProject={subProject} />
      <span className="text-xs truncate flex-1">{subProject.name}</span>
      {isRunning && <Circle className="h-2 w-2 fill-success text-success shrink-0" />}
      <SubProjectBadges subProject={subProject} />
    </button>
  )
}
