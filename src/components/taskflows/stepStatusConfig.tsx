import { Circle, Loader2, AlertCircle, Minus, Container, CircleOff } from 'lucide-react'

export const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  pending: { icon: <Circle className="h-3 w-3 text-muted-foreground" />, label: 'Pending', className: 'text-muted-foreground' },
  checkout: { icon: <Loader2 className="h-3 w-3 animate-spin text-orange-400" />, label: 'Switching branch...', className: 'text-orange-400' },
  'applying-profile': { icon: <Loader2 className="h-3 w-3 animate-spin text-blue-400" />, label: 'Applying config...', className: 'text-blue-400' },
  starting: { icon: <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />, label: 'Starting...', className: 'text-yellow-400' },
  running: { icon: <Circle className="h-3 w-3 fill-green-500 text-green-500" />, label: 'Running', className: 'text-green-500' },
  error: { icon: <AlertCircle className="h-3 w-3 text-destructive" />, label: 'Error', className: 'text-destructive' },
  skipped: { icon: <Minus className="h-3 w-3 text-muted-foreground" />, label: 'Skipped', className: 'text-muted-foreground' },
  pulling: { icon: <Loader2 className="h-3 w-3 animate-spin text-purple-400" />, label: 'Pulling image...', className: 'text-purple-400' },
  'waiting-health': { icon: <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />, label: 'Waiting for health...', className: 'text-cyan-400' },
  healthy: { icon: <Container className="h-3 w-3 text-green-500" />, label: 'Healthy', className: 'text-green-500' },
  stopped: { icon: <CircleOff className="h-3 w-3 text-muted-foreground" />, label: 'Stopped', className: 'text-muted-foreground' }
}
