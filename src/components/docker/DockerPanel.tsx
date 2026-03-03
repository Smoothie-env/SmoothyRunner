import { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { useProcessStore } from '@/stores/processStore'
import { ServiceStatus } from './ServiceStatus'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Square, RefreshCw, Container } from 'lucide-react'
import type { DockerContainer } from '@/types'

const INFRA_SERVICES = ['mssql', 'redis', 'rabbitmq', 'postgres', 'elasticsearch', 'mongo', 'seq']
const POLL_INTERVAL = 5000

export function DockerPanel() {
  const project = useProjectStore(s => s.activeProject())
  const dockerContainers = useProcessStore(s => s.dockerContainers)
  const setDockerContainers = useProcessStore(s => s.setDockerContainers)
  const [loading, setLoading] = useState(false)
  const [profiles] = useState<string[]>(['web', 'app'])

  const composePath = project?.dockerComposePath

  const refresh = useCallback(async () => {
    if (!composePath) return
    try {
      const containers = await window.smoothyApi.dockerStatus(composePath, profiles)
      setDockerContainers(containers)
    } catch (err) {
      console.error('Docker status failed:', err)
    }
  }, [composePath, profiles, setDockerContainers])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  if (!project || !composePath) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Container className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No docker-compose.yml found</p>
        </div>
      </div>
    )
  }

  const infraContainers = dockerContainers.filter(c =>
    INFRA_SERVICES.some(s => c.service.toLowerCase().includes(s))
  )
  const appContainers = dockerContainers.filter(c =>
    !INFRA_SERVICES.some(s => c.service.toLowerCase().includes(s))
  )

  const handleStartAll = async (services: DockerContainer[]) => {
    setLoading(true)
    try {
      await window.smoothyApi.dockerUp(composePath, services.map(s => s.service), profiles)
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleStopAll = async (services: DockerContainer[]) => {
    setLoading(true)
    try {
      await window.smoothyApi.dockerDown(composePath, services.map(s => s.service), profiles)
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleStartService = async (service: string) => {
    await window.smoothyApi.dockerUp(composePath, [service], profiles)
    await refresh()
  }

  const handleStopService = async (service: string) => {
    await window.smoothyApi.dockerDown(composePath, [service], profiles)
    await refresh()
  }

  const handleRestartService = async (service: string) => {
    await window.smoothyApi.dockerRestart(composePath, [service], profiles)
    await refresh()
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Infrastructure */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Infrastructure</h3>
              <Badge variant="secondary">{infraContainers.length}</Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => handleStartAll(infraContainers)} disabled={loading}>
                <Play className="h-3 w-3 mr-1" />
                Start All
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleStopAll(infraContainers)} disabled={loading}>
                <Square className="h-3 w-3 mr-1" />
                Stop All
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {infraContainers.map(container => (
              <ServiceStatus
                key={container.name}
                container={container}
                onStart={() => handleStartService(container.service)}
                onStop={() => handleStopService(container.service)}
                onRestart={() => handleRestartService(container.service)}
              />
            ))}
            {infraContainers.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full">No infrastructure services found</p>
            )}
          </div>
        </section>

        {/* Application Services */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Application Services</h3>
              <Badge variant="secondary">{appContainers.length}</Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => handleStartAll(appContainers)} disabled={loading}>
                <Play className="h-3 w-3 mr-1" />
                Start All
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleStopAll(appContainers)} disabled={loading}>
                <Square className="h-3 w-3 mr-1" />
                Stop All
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {appContainers.map(container => (
              <ServiceStatus
                key={container.name}
                container={container}
                onStart={() => handleStartService(container.service)}
                onStop={() => handleStopService(container.service)}
                onRestart={() => handleRestartService(container.service)}
              />
            ))}
            {appContainers.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full">No application services found</p>
            )}
          </div>
        </section>

        {/* Refresh */}
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
