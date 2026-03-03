import { useState } from 'react'
import type { SubProject, ProcessInfo } from '@/types'
import { useProcessStore } from '@/stores/processStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Square, RotateCcw, Circle, AlertCircle } from 'lucide-react'

interface ServiceControlsProps {
  subProject: SubProject
  processInfo?: ProcessInfo
}

export function ServiceControls({ subProject, processInfo }: ServiceControlsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setProcesses = useProcessStore(s => s.setProcesses)

  const isRunning = processInfo?.status === 'running'
  const isStopped = !processInfo || processInfo.status === 'stopped'

  const refreshProcesses = async () => {
    const list = await window.sparkApi.listProcesses()
    setProcesses(list)
  }

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      await window.sparkApi.startProcess({
        id: subProject.id,
        name: subProject.name,
        type: 'dotnet',
        projectPath: subProject.dirPath,
        csprojPath: subProject.csprojPath,
        port: subProject.port
      })
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
      await window.sparkApi.stopProcess(subProject.id)
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
      await window.sparkApi.restartProcess(subProject.id)
      await refreshProcesses()
    } catch (err: any) {
      setError(err.message || 'Failed to restart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
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
            dotnet watch run — {subProject.dirPath}
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
          {error}
        </div>
      )}
    </div>
  )
}
