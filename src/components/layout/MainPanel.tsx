import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SettingsTree } from '@/components/appsettings/SettingsTree'
import { ServicePanel } from '@/components/services/ServicePanel'
import { DockerPanel } from '@/components/docker/DockerPanel'
import { CsprojViewer } from '@/components/projects/CsprojViewer'
import { FileCode, FileJson, Play, Container, Zap } from 'lucide-react'
import type { ViewTab } from '@/types'

export function MainPanel() {
  const selection = useProjectStore(s => s.selection)
  const activeProject = useProjectStore(s => s.activeProject())
  const activeSubProject = useProjectStore(s => s.activeSubProject())
  const activeTab = useProjectStore(s => s.activeTab)
  const setActiveTab = useProjectStore(s => s.setActiveTab)

  // Determine available tabs based on selection
  const availableTabs: ViewTab[] = []
  let headerName = ''

  if (selection?.type === 'subproject' && activeSubProject) {
    headerName = activeSubProject.name
    availableTabs.push('csproj')
    if (activeSubProject.appsettingsFiles.length > 0) {
      availableTabs.push('appsettings')
    }
    if (activeSubProject.kind === 'runnable') {
      availableTabs.push('services')
    }
  } else if (selection?.type === 'project' && activeProject) {
    headerName = activeProject.name
    if (activeProject.hasDockerCompose) {
      availableTabs.push('docker')
    }
  }

  // Auto-select default tab when selection changes
  useEffect(() => {
    if (availableTabs.length === 0) return
    if (availableTabs.includes(activeTab)) return

    // Default: appsettings if available, else csproj
    if (availableTabs.includes('appsettings')) {
      setActiveTab('appsettings')
    } else if (availableTabs.includes('csproj')) {
      setActiveTab('csproj')
    } else {
      setActiveTab(availableTabs[0])
    }
  }, [selection?.type === 'subproject' ? (selection as any).subProjectId : selection?.projectId])

  // Welcome screen
  if (!selection) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="titlebar-drag h-12 border-b shrink-0" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Zap className="h-16 w-16 text-muted-foreground/10 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-muted-foreground/50 mb-1">Spark Project Manager</h2>
            <p className="text-sm text-muted-foreground/30">Select a project from the sidebar to get started</p>
          </div>
        </div>
      </div>
    )
  }

  // Folder project with no docker
  if (availableTabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="titlebar-drag h-12 flex items-center gap-4 px-4 border-b shrink-0">
          <span className="text-sm font-medium titlebar-no-drag">{headerName}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Zap className="h-10 w-10 text-muted-foreground/10 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/30">Select a sub-project to view its details</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header with titlebar drag + tabs */}
      <div className="titlebar-drag h-12 flex items-center gap-4 px-4 border-b shrink-0">
        <span className="text-sm font-medium titlebar-no-drag">{headerName}</span>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)} className="titlebar-no-drag">
          <TabsList>
            {availableTabs.includes('csproj') && (
              <TabsTrigger value="csproj">
                <FileCode className="h-3.5 w-3.5 mr-1" />
                .csproj
              </TabsTrigger>
            )}
            {availableTabs.includes('appsettings') && (
              <TabsTrigger value="appsettings">
                <FileJson className="h-3.5 w-3.5 mr-1" />
                Settings
              </TabsTrigger>
            )}
            {availableTabs.includes('services') && (
              <TabsTrigger value="services">
                <Play className="h-3.5 w-3.5 mr-1" />
                Services
              </TabsTrigger>
            )}
            {availableTabs.includes('docker') && (
              <TabsTrigger value="docker">
                <Container className="h-3.5 w-3.5 mr-1" />
                Docker
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'csproj' && <CsprojViewer />}
        {activeTab === 'appsettings' && <SettingsTree />}
        {activeTab === 'services' && <ServicePanel />}
        {activeTab === 'docker' && <DockerPanel />}
      </div>
    </div>
  )
}
