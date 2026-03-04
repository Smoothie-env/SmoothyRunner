import { useState } from 'react'
import type { SubProject, ProcessInfo, LaunchMode, FolderProject } from '@/types'
import { useProcessStore } from '@/stores/processStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Square, RotateCcw, Circle, AlertCircle, Terminal, Eye, Rocket, Container, Skull } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ServiceControlsProps {
  subProject: SubProject
  processInfo?: ProcessInfo
  project?: FolderProject
}

const MODE_LABELS: Record<LaunchMode, string> = {
  watch: 'Watch',
  release: 'Release',
  devcontainer: 'Container'
}

function getModeCommand(mode: LaunchMode, subProject: SubProject): string {
  if (subProject.projectType === 'angular') {
    switch (mode) {
      case 'watch': return 'ng serve'
      case 'release': return 'ng build --production'
      case 'devcontainer': return 'devcontainer exec ... ng serve'
    }
  }
  switch (mode) {
    case 'watch': return 'dotnet watch run'
    case 'release': return 'dotnet run -c Release'
    case 'devcontainer': return 'devcontainer exec ... dotnet run'
  }
}

function buildProcessConfig(subProject: SubProject, mode: LaunchMode, project?: FolderProject) {
  return {
    id: subProject.id,
    name: subProject.name,
    projectType: subProject.projectType,
    projectPath: subProject.dirPath,
    projectFilePath: subProject.projectType === 'dotnet' ? subProject.csprojPath
      : subProject.projectType === 'angular' ? subProject.angularJsonPath
      : undefined,
    port: subProject.port,
    mode,
    rootPath: project?.rootPath,
    subProject
  }
}

export function ServiceControls({ subProject, processInfo, project }: ServiceControlsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<LaunchMode>('watch')
  const setProcesses = useProcessStore(s => s.setProcesses)
  const setBottomPanelOpen = useProcessStore(s => s.setBottomPanelOpen)
  const setActiveProcessTab = useProcessStore(s => s.setActiveProcessTab)

  const isRunning = processInfo?.status === 'running'
  const isStopped = !processInfo || processInfo.status === 'stopped'
  const hasDevContainer = project?.hasDevContainer ?? false

  const refreshProcesses = async () => {
    const list = await window.smoothyApi.listProcesses()
    setProcesses(list)
  }

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      await window.smoothyApi.startProcess(buildProcessConfig(subProject, mode, project))
      await refreshProcesses()
    } catch (err: any) {
      setError(err.message || 'Failed to start')
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    setError(null)
    try {
      await window.smoothyApi.stopProcess(subProject.id)
      await refreshProcesses()
    } catch (err: any) {
      setError(err.message || 'Failed to stop')
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = async () => {
    setLoading(true)
    setError(null)
    try {
      await window.smoothyApi.restartProcess(subProject.id)
      await refreshProcesses()
    } catch (err: any) {
      setError(err.message || 'Failed to restart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex items-center gap-1 p-0.5 bg-zinc-800/50 rounded-md w-fit">
        <button
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
            mode === 'watch' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setMode('watch')}
          disabled={isRunning}
        >
          <Eye className="h-3 w-3" />
          Watch
        </button>
        <button
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
            mode === 'release' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setMode('release')}
          disabled={isRunning}
        >
          <Rocket className="h-3 w-3" />
          {subProject.projectType === 'angular' ? 'Build' : 'Release'}
        </button>
        {hasDevContainer && (
          <button
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
              mode === 'devcontainer' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setMode('devcontainer')}
            disabled={isRunning}
          >
            <Container className="h-3 w-3" />
            Container
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{subProject.name}</h3>
            {isRunning ? (
              <Badge variant="success">
                <Circle className="h-2 w-2 fill-current mr-1" />
                Running
              </Badge>
            ) : (
              <Badge variant="secondary">Stopped</Badge>
            )}
            {subProject.port && (
              <Badge variant="outline">:{subProject.port}</Badge>
            )}
            {processInfo?.pid && (
              <span className="text-xs text-muted-foreground">PID: {processInfo.pid}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getModeCommand(mode, subProject)} — {subProject.dirPath}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {isStopped ? (
            <Button size="sm" onClick={handleStart} disabled={loading}>
              <Play className="h-3.5 w-3.5 mr-1" />
              Start
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleRestart} disabled={loading}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Restart
              </Button>
              <Button variant="destructive" size="sm" onClick={handleStop} disabled={loading}>
                <Square className="h-3.5 w-3.5 mr-1" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          {portFromError(error) && (
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0 ml-2"
              disabled={loading}
              onClick={async () => {
                const port = portFromError(error)
                if (!port) return
                setLoading(true)
                try {
                  await window.smoothyApi.killPort(port)
                  setError(null)
                  await window.smoothyApi.startProcess(buildProcessConfig(subProject, mode, project))
                  await refreshProcesses()
                } catch (err: any) {
                  setError(err.message || 'Failed after killing port')
                } finally {
                  setLoading(false)
                }
              }}
            >
              <Skull className="h-3.5 w-3.5 mr-1" />
              Kill Port & Retry
            </Button>
          )}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          setBottomPanelOpen(true)
          setActiveProcessTab(subProject.id)
        }}
      >
        <Terminal className="h-3.5 w-3.5 mr-1" />
        View Logs
      </Button>
    </div>
  )
}

function portFromError(error: string): number | null {
  const match = error.match(/Port (\d+) is already in use/)
  return match ? parseInt(match[1], 10) : null
}
