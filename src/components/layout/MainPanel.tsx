import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SettingsTree } from '@/components/appsettings/SettingsTree'
import { ServicePanel } from '@/components/services/ServicePanel'
import { DockerPanel } from '@/components/docker/DockerPanel'
import { ProjectFileViewer } from '@/components/projects/ProjectFileViewer'
import { FileCode, FileJson, Play, Container, Zap } from 'lucide-react'
import type { ViewTab, SubProject } from '@/types'

function isRunnableSubProject(sp: SubProject): boolean {
  return (sp.projectType === 'dotnet' && sp.kind === 'runnable')
    || (sp.projectType === 'angular' && sp.kind === 'application')
}

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
    availableTabs.push('projectFile')
    if (activeSubProject.configFiles.length > 0) {
      availableTabs.push('config')
    }
    if (isRunnableSubProject(activeSubProject)) {
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

    if (availableTabs.includes('config')) {
      setActiveTab('config')
    } else if (availableTabs.includes('projectFile')) {
      setActiveTab('projectFile')
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
            <h2 className="text-lg font-medium text-muted-foreground/50 mb-1">SmoothyRunner</h2>
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
            {availableTabs.includes('projectFile') && (
              <TabsTrigger value="projectFile">
                <FileCode className="h-3.5 w-3.5 mr-1" />
                Project File
              </TabsTrigger>
            )}
            {availableTabs.includes('config') && (
              <TabsTrigger value="config">
                <FileJson className="h-3.5 w-3.5 mr-1" />
                Config
              </TabsTrigger>
            )}
            {availableTabs.includes('services') && (
              <TabsTrigger value="services">
                <Play className="h-3.5 w-3.5 mr-1" />
                Run
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
        {activeTab === 'projectFile' && <ProjectFileViewer />}
        {activeTab === 'config' && <SettingsTree />}
        {activeTab === 'services' && <ServicePanel />}
        {activeTab === 'docker' && <DockerPanel />}
      </div>
    </div>
  )
}
