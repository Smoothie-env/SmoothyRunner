import { useProjectStore } from '@/stores/projectStore'
import { useProcessStore } from '@/stores/processStore'
import { ServiceControls } from './ServiceControls'
import { LogViewer } from './LogViewer'

export function ServicePanel() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const processes = useProcessStore(s => s.processes)

  if (!subProject || subProject.kind !== 'runnable') return null

  const processInfo = processes.find(p => p.id === subProject.id)

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="px-4 py-3 border-b shrink-0">
        <ServiceControls subProject={subProject} processInfo={processInfo} />
      </div>

      {/* Log viewer */}
      <div className="flex-1 min-h-0">
        <LogViewer processId={subProject.id} />
      </div>
    </div>
  )
}
