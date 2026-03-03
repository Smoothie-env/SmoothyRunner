import { useProjectStore } from '@/stores/projectStore'
import { useProcessStore } from '@/stores/processStore'
import { ServiceControls } from './ServiceControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Circle, Globe, Terminal } from 'lucide-react'

export function ServicePanel() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const project = useProjectStore(s => s.activeProject())
  const processes = useProcessStore(s => s.processes)
  const setBottomPanelOpen = useProcessStore(s => s.setBottomPanelOpen)
  const setActiveProcessTab = useProcessStore(s => s.setActiveProcessTab)

  if (!subProject || subProject.kind !== 'runnable') return null

  const processInfo = processes.find(p => p.id === subProject.id)
  const isRunning = processInfo?.status === 'running'

  const handleOpenBrowser = () => {
    if (subProject.port) {
      window.open(`http://localhost:${subProject.port}`, '_blank')
    }
  }

  const handleViewLogs = () => {
    setBottomPanelOpen(true)
    setActiveProcessTab(subProject.id)
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold">{subProject.name}</h3>
          {isRunning ? (
            <Badge variant="success">
              <Circle className="h-2 w-2 fill-current mr-1" />
              Running
            </Badge>
          ) : (
            <Badge variant="secondary">Stopped</Badge>
          )}
        </div>
      </div>

      {/* Controls with mode selector */}
      <div className="px-4 py-3 border-b">
        <ServiceControls subProject={subProject} processInfo={processInfo} project={project} />
      </div>

      {/* Info panel */}
      <div className="px-4 py-3 border-b">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Info</h4>
        <div className="grid grid-cols-2 gap-y-1.5 text-sm">
          {subProject.port && (
            <>
              <span className="text-muted-foreground text-xs">Port</span>
              <span className="text-xs">:{subProject.port}</span>
            </>
          )}
          {processInfo?.pid && (
            <>
              <span className="text-muted-foreground text-xs">PID</span>
              <span className="text-xs">{processInfo.pid}</span>
            </>
          )}
          {subProject.targetFramework && (
            <>
              <span className="text-muted-foreground text-xs">Framework</span>
              <span className="text-xs">{subProject.targetFramework}</span>
            </>
          )}
          <span className="text-muted-foreground text-xs">Path</span>
          <span className="text-xs truncate" title={subProject.dirPath}>{subProject.dirPath}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</h4>
        <div className="flex gap-2">
          {subProject.port && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenBrowser}
              disabled={!isRunning}
            >
              <Globe className="h-3.5 w-3.5 mr-1" />
              Open in Browser
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleViewLogs}>
            <Terminal className="h-3.5 w-3.5 mr-1" />
            View Logs
          </Button>
        </div>
      </div>
    </div>
  )
}
