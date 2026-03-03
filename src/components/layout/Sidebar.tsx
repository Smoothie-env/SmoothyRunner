import { useState, useRef, useEffect } from 'react'
import { Zap, Plus, FolderOpen, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ProjectExplorer } from '@/components/projects/ProjectExplorer'
import { AddProjectDialog } from '@/components/projects/AddProjectDialog'
import { useProjectStore } from '@/stores/projectStore'

interface SidebarProps {
  width: number
}

export function Sidebar({ width }: SidebarProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const folderProjects = useProjectStore(s => s.folderProjects)
  const addGroup = useProjectStore(s => s.addGroup)

  useEffect(() => {
    if (creatingGroup && inputRef.current) {
      inputRef.current.focus()
    }
  }, [creatingGroup])

  const handleCreateGroup = async () => {
    const name = newGroupName.trim()
    if (!name) {
      setCreatingGroup(false)
      setNewGroupName('')
      return
    }
    try {
      const group = await window.sparkApi.addGroup(name)
      addGroup(group)
    } catch (err) {
      console.error('Failed to create group:', err)
    }
    setCreatingGroup(false)
    setNewGroupName('')
  }

  return (
    <div className="flex flex-col h-full shrink-0 border-r bg-zinc-950" style={{ width }}>
      {/* Titlebar drag area */}
      <div className="titlebar-drag h-12 flex items-center gap-2 px-4 border-b shrink-0">
        <div className="w-[68px]" /> {/* Space for traffic lights */}
        <Zap className="h-4 w-4 text-primary titlebar-no-drag" />
        <span className="text-sm font-semibold titlebar-no-drag">Spark</span>
      </div>

      {/* Projects header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 titlebar-no-drag"
            title="New Group"
            onClick={() => setCreatingGroup(true)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 titlebar-no-drag"
            title="Add Project"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Inline new group input */}
      {creatingGroup && (
        <div className="px-3 pb-2 shrink-0">
          <input
            ref={inputRef}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onBlur={handleCreateGroup}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup()
              if (e.key === 'Escape') {
                setCreatingGroup(false)
                setNewGroupName('')
              }
            }}
            placeholder="Group name..."
            className="w-full bg-zinc-900 border border-primary/50 rounded px-2 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
      )}

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
