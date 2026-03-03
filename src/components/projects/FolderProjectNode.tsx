import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { SubProjectNode } from './SubProjectNode'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Select, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronRight, Trash2, FolderOpen } from 'lucide-react'
import { BranchSelector } from './BranchSelector'
import type { FolderProject, Worktree } from '@/types'

function worktreeDisplayName(wt: Worktree, projectName: string): string {
  return wt.isMain ? projectName : wt.path.split('/').pop() || wt.branch
}

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
  const groups = useProjectStore(s => s.groups)

  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const isExpanded = expandedProjects.has(project.id)
  const isProjectSelected = selection?.type === 'project' && selection.projectId === project.id
  const hasSelectedChild = selection?.type === 'subproject' && selection.projectId === project.id

  useEffect(() => {
    loadWorktrees()
  }, [project.rootPath])

  const loadWorktrees = async () => {
    try {
      const list = await window.smoothyApi.gitWorktreeList(project.originalRootPath)
      setWorktrees(list)
    } catch {
      setWorktrees([])
    }
  }

  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleMoveToGroup = async (groupId: string | null) => {
    setContextMenu(null)
    await window.smoothyApi.setProjectGroup(project.id, groupId)
    updateFolderProject(project.id, { groupId: groupId || undefined })
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.smoothyApi.removeFolderProject(project.id)
    removeFolderProject(project.id)
  }

  const handleWorktreeSwitch = async (worktreePath: string) => {
    const isMain = worktreePath === project.originalRootPath
    await window.smoothyApi.setProjectWorktree(project.id, isMain ? null : worktreePath)

    // Rescan from new path
    try {
      const scanned = await window.smoothyApi.scanFolder(worktreePath)
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

  const grouped = useMemo(() => {
    const runnable = project.subProjects.filter(sp => sp.kind === 'runnable')
    const packages = project.subProjects.filter(sp => sp.kind === 'package')
    const libraries = project.subProjects.filter(sp => sp.kind === 'library')
    return { runnable, packages, libraries }
  }, [project.subProjects])

  const handleHeaderClick = () => {
    toggleExpanded(project.id)
    setSelection({ type: 'project', projectId: project.id })
  }

  const showSubRow = worktrees.length > 1 || project.branch

  return (
    <div>
      {/* Folder header */}
      <div
        className={cn(
          'group rounded-md cursor-pointer transition-colors',
          (isProjectSelected || hasSelectedChild) ? 'bg-accent/50' : 'hover:bg-accent/30'
        )}
        onClick={handleHeaderClick}
        onContextMenu={handleContextMenu}
      >
        {/* Row 1: name + trash */}
        <div className="flex items-center gap-1 px-2 pt-1.5 pb-0.5">
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground', isExpanded && 'rotate-90')} />
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          <span className="text-sm font-medium truncate flex-1">{project.name}</span>
          <button
            className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
            onClick={handleRemove}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Row 2: worktree selector + branch badge */}
        {showSubRow && (
          <div className="flex items-center gap-1.5 pl-9 pr-2 pb-1.5" onClick={e => e.stopPropagation()}>
            {worktrees.length > 1 && (
              <Select
                value={project.rootPath}
                onValueChange={handleWorktreeSwitch}
                className="max-w-[140px]"
              >
                {worktrees.map(wt => (
                  <SelectItem key={wt.path} value={wt.path}>
                    {worktreeDisplayName(wt, project.name)}
                  </SelectItem>
                ))}
              </Select>
            )}
            <BranchSelector project={project} />
          </div>
        )}
      </div>

      {/* Sub-projects — grouped: runnable → package → libraries (collapsible) */}
      {isExpanded && (
        <div className="ml-3 border-l border-border/40 pl-1">
          {grouped.runnable.map(sp => (
            <SubProjectNode key={sp.id} subProject={sp} projectId={project.id} />
          ))}
          {grouped.packages.map(sp => (
            <SubProjectNode key={sp.id} subProject={sp} projectId={project.id} />
          ))}
          {grouped.libraries.length > 0 && (
            <Collapsible>
              {({ isOpen, toggle }: { isOpen: boolean; toggle: () => void }) => (
                <>
                  <CollapsibleTrigger
                    isOpen={isOpen}
                    onClick={toggle}
                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Libraries ({grouped.libraries.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent isOpen={isOpen}>
                    {grouped.libraries.map(sp => (
                      <SubProjectNode key={sp.id} subProject={sp} projectId={project.id} />
                    ))}
                  </CollapsibleContent>
                </>
              )}
            </Collapsible>
          )}
          {project.subProjects.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 pl-4">No .csproj files found</p>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && groups.length > 0 && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-popover border rounded-md shadow-md py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {groups
            .filter(g => g.id !== project.groupId)
            .map(g => (
              <button
                key={g.id}
                className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent text-left"
                onClick={() => handleMoveToGroup(g.id)}
              >
                Move to {g.name}
              </button>
            ))}
          {project.groupId && (
            <button
              className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent text-left"
              onClick={() => handleMoveToGroup(null)}
            >
              Remove from group
            </button>
          )}
          <div className="border-t my-1" />
          <button
            className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent text-left text-destructive"
            onClick={(e) => { setContextMenu(null); handleRemove(e) }}
          >
            Delete project
          </button>
        </div>
      )}
    </div>
  )
}
