import type { DockerContainer } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Play, Square, RotateCcw, Circle, Heart } from 'lucide-react'

interface ServiceStatusProps {
  container: DockerContainer
  onStart: () => void
  onStop: () => void
  onRestart: () => void
}

const STATUS_COLORS = {
  running: 'text-success',
  exited: 'text-destructive',
  starting: 'text-warning',
  paused: 'text-warning',
  unknown: 'text-muted-foreground'
} as const

const HEALTH_COLORS = {
  healthy: 'text-success',
  unhealthy: 'text-destructive',
  starting: 'text-warning',
  none: 'text-muted-foreground'
} as const

export function ServiceStatus({ container, onStart, onStop, onRestart }: ServiceStatusProps) {
  const isRunning = container.status === 'running'

  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Circle className={cn('h-2.5 w-2.5 fill-current shrink-0', STATUS_COLORS[container.status])} />
          <span className="text-sm font-medium truncate">{container.service}</span>
        </div>
        {container.health && container.health !== 'none' && (
          <Heart className={cn('h-3.5 w-3.5 shrink-0', HEALTH_COLORS[container.health])} />
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="capitalize">{container.status}</span>
        {container.ports.length > 0 && (
          <span className="truncate">{container.ports.join(', ')}</span>
        )}
      </div>

      <div className="flex gap-1 mt-1">
        {!isRunning ? (
          <Button variant="outline" size="sm" className="h-6 text-xs flex-1" onClick={onStart}>
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="h-6 text-xs flex-1" onClick={onRestart}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Restart
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onStop}>
              <Square className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
