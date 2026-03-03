import { useState } from 'react'
import { Zap, Plus, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ProjectExplorer } from '@/components/projects/ProjectExplorer'
import { AddProjectDialog } from '@/components/projects/AddProjectDialog'
import { useProjectStore } from '@/stores/projectStore'

export function Sidebar() {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const folderProjects = useProjectStore(s => s.folderProjects)

  return (
    <div className="flex flex-col h-full w-[250px] border-r bg-zinc-950">
      {/* Titlebar drag area */}
      <div className="titlebar-drag h-12 flex items-center gap-2 px-4 border-b shrink-0">
        <div className="w-[68px]" /> {/* Space for traffic lights */}
        <Zap className="h-4 w-4 text-primary titlebar-no-drag" />
        <span className="text-sm font-semibold titlebar-no-drag">Spark</span>
      </div>

      {/* Projects header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 titlebar-no-drag" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Project list */}
      <ScrollArea className="flex-1 px-1">
        {folderProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">No projects added</p>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Project
            </Button>
          </div>
        ) : (
          <ProjectExplorer />
        )}
      </ScrollArea>

      <AddProjectDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  )
}
