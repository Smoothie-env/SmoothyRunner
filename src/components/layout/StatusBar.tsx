import { useProcessStore } from '@/stores/processStore'
import { useProjectStore } from '@/stores/projectStore'
import { Circle } from 'lucide-react'

export function StatusBar() {
  const processes = useProcessStore(s => s.processes)
  const dockerContainers = useProcessStore(s => s.dockerContainers)
  const folderProjects = useProjectStore(s => s.folderProjects)
  const bottomPanelOpen = useProcessStore(s => s.bottomPanelOpen)
  const setBottomPanelOpen = useProcessStore(s => s.setBottomPanelOpen)

  const runningProcesses = processes.filter(p => p.status === 'running').length
  const runningContainers = dockerContainers.filter(c => c.status === 'running').length

  const handleProcessClick = () => {
    setBottomPanelOpen(!bottomPanelOpen)
  }

  return (
    <div className="h-6 border-t bg-zinc-950 flex items-center px-3 gap-4 text-xs text-muted-foreground shrink-0">
      <span>{folderProjects.length} project{folderProjects.length !== 1 ? 's' : ''}</span>

      {runningProcesses > 0 && (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={handleProcessClick}
        >
          <Circle className="h-2 w-2 fill-success text-success" />
          {runningProcesses} process{runningProcesses !== 1 ? 'es' : ''}
        </button>
      )}

      {runningContainers > 0 && (
        <span className="flex items-center gap-1">
          <Circle className="h-2 w-2 fill-blue-500 text-blue-500" />
          {runningContainers} container{runningContainers !== 1 ? 's' : ''}
        </span>
      )}

      <span className="ml-auto">Spark v1.0.0</span>
    </div>
  )
}
