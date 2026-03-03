import { useEffect, useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { SubProjectNode } from './SubProjectNode'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronRight, Trash2, FolderOpen } from 'lucide-react'
import type { FolderProject, Worktree } from '@/types'

interface FolderProjectNodeProps {
  project: FolderProject
}

export function FolderProjectNode({ project }: FolderProjectNodeProps) {
  const selection = useProjectStore(s => s.selection)
  const setSelection = useProjectStore(s => s.setSelection)
  const removeFolderProject = useProjectStore(s => s.removeFolderProject)
  const updateFolderProject = useProjectStore(s => s.updateFolderProject)
  const expandedProjects = useProjectStore(s => s.expandedProjects)
  const toggleExpanded = useProjectStore(s => s.toggleExpanded)

  const [worktrees, setWorktrees] = useState<Worktree[]>([])

  const isExpanded = expandedProjects.has(project.id)
  const isProjectSelected = selection?.type === 'project' && selection.projectId === project.id
  const hasSelectedChild = selection?.type === 'subproject' && selection.projectId === project.id

  useEffect(() => {
    loadWorktrees()
  }, [project.rootPath])

  const loadWorktrees = async () => {
    try {
      const list = await window.sparkApi.gitWorktreeList(project.originalRootPath)
      setWorktrees(list)
    } catch {
      setWorktrees([])
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.sparkApi.removeFolderProject(project.id)
    removeFolderProject(project.id)
  }

  const handleWorktreeSwitch = async (worktreePath: string) => {
    const isMain = worktreePath === project.originalRootPath
    await window.sparkApi.setProjectWorktree(project.id, isMain ? null : worktreePath)

    // Rescan from new path
    try {
      const scanned = await window.sparkApi.scanFolder(worktreePath)
      updateFolderProject(project.id, {
        rootPath: worktreePath,
        activeWorktreePath: isMain ? undefined : worktreePath,
        subProjects: scanned.subProjects,
        branch: scanned.branch
      })
    } catch (err) {
      console.error('Failed to rescan after worktree switch:', err)
    }
  }

  const handleHeaderClick = () => {
    toggleExpanded(project.id)
    setSelection({ type: 'project', projectId: project.id })
  }

  return (
    <div>
      {/* Folder header */}
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          (isProjectSelected || hasSelectedChild) ? 'bg-accent/50' : 'hover:bg-accent/30'
        )}
        onClick={handleHeaderClick}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground', isExpanded && 'rotate-90')} />
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
        <span className="text-sm font-medium truncate flex-1">{project.name}</span>

        {/* Worktree selector - inline compact */}
        {worktrees.length > 1 && (
          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            <Select
              value={project.rootPath}
              onValueChange={handleWorktreeSwitch}
              className="w-[110px]"
            >
              {worktrees.map(wt => (
                <SelectItem key={wt.path} value={wt.path}>
                  {wt.branch}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}

        {/* Branch badge when no worktree selector */}
        {worktrees.length <= 1 && project.branch && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{project.branch}</span>
        )}

        {/* Remove button */}
        <button
          className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
          onClick={handleRemove}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Sub-projects */}
      {isExpanded && (
        <div className="ml-3 border-l border-border/40 pl-1">
          {project.subProjects.map(sp => (
            <SubProjectNode key={sp.id} subProject={sp} projectId={project.id} />
          ))}
          {project.subProjects.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 pl-4">No .csproj files found</p>
          )}
        </div>
      )}
    </div>
  )
}
