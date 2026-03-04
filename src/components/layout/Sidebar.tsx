import { useState, useRef, useEffect } from 'react'
import { Zap, Plus, FolderOpen, FolderPlus, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ProjectExplorer } from '@/components/projects/ProjectExplorer'
import { AddProjectDialog } from '@/components/projects/AddProjectDialog'
import { TaskFlowList } from '@/components/taskflows/TaskFlowList'
import { CreateTaskFlowDialog } from '@/components/taskflows/CreateTaskFlowDialog'
import { useProjectStore } from '@/stores/projectStore'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import { cn } from '@/lib/utils'

interface SidebarProps {
  width: number
}

export function Sidebar({ width }: SidebarProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [createFlowOpen, setCreateFlowOpen] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const folderProjects = useProjectStore(s => s.folderProjects)
  const addGroup = useProjectStore(s => s.addGroup)
  const sidebarView = useProjectStore(s => s.sidebarView)
  const setSidebarView = useProjectStore(s => s.setSidebarView)
  const selectFlow = useTaskFlowStore(s => s.selectFlow)
  const setSelection = useProjectStore(s => s.setSelection)

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
      const group = await window.smoothyApi.addGroup(name)
      addGroup(group)
    } catch (err) {
      console.error('Failed to create group:', err)
    }
    setCreatingGroup(false)
    setNewGroupName('')
  }

  const handleViewSwitch = (view: 'projects' | 'taskflows') => {
    setSidebarView(view)
    if (view === 'taskflows') {
      setSelection(null)
    } else {
      selectFlow(null)
    }
  }

  return (
    <div className="flex flex-col h-full shrink-0 border-r bg-zinc-950" style={{ width }}>
      {/* Titlebar drag area */}
      <div className="titlebar-drag h-12 flex items-center gap-2 px-4 border-b shrink-0">
        <div className="w-[68px]" /> {/* Space for traffic lights */}
        <Zap className="h-4 w-4 text-primary titlebar-no-drag" />
        <span className="text-sm font-semibold titlebar-no-drag">SmoothyRunner</span>
      </div>

      {/* View toggle + actions */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        {/* Toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-zinc-800/50 rounded-md">
          <button
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider transition-colors',
              sidebarView === 'projects' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handleViewSwitch('projects')}
          >
            Projects
          </button>
          <button
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider transition-colors',
              sidebarView === 'taskflows' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handleViewSwitch('taskflows')}
          >
            Flows
          </button>
        </div>

        {/* Context actions */}
        <div className="flex items-center gap-0.5">
          {sidebarView === 'projects' ? (
            <>
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
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 titlebar-no-drag"
              title="New Task Flow"
              onClick={() => setCreateFlowOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Inline new group input (projects view only) */}
      {sidebarView === 'projects' && creatingGroup && (
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

      {/* Content */}
      <ScrollArea className="flex-1 px-1">
        {sidebarView === 'projects' ? (
          folderProjects.length === 0 ? (
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
          )
        ) : (
          <TaskFlowList />
        )}
      </ScrollArea>

      <AddProjectDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <CreateTaskFlowDialog open={createFlowOpen} onOpenChange={setCreateFlowOpen} />
    </div>
  )
}
