import { useState, useCallback } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { FolderProjectNode } from './FolderProjectNode'
import { GroupHeader } from './GroupHeader'

export function ProjectExplorer() {
  const folderProjects = useProjectStore(s => s.folderProjects)
  const groups = useProjectStore(s => s.groups)

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(groups.map(g => g.id)))

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // No groups at all — flat list as before
  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-0.5 pb-2">
        {folderProjects.map(project => (
          <FolderProjectNode key={project.id} project={project} />
        ))}
      </div>
    )
  }

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order)
  const ungroupedProjects = folderProjects.filter(p => !p.groupId)

  return (
    <div className="flex flex-col gap-0.5 pb-2">
      {sortedGroups.map(group => {
        const groupProjects = folderProjects.filter(p => p.groupId === group.id)
        const isExpanded = expandedGroups.has(group.id)

        return (
          <div key={group.id}>
            <GroupHeader
              group={group}
              isExpanded={isExpanded}
              onToggle={() => toggleGroup(group.id)}
              projectCount={groupProjects.length}
            />
            {isExpanded && (
              <div className="ml-2 border-l border-border/30 pl-0.5">
                {groupProjects.map(project => (
                  <FolderProjectNode key={project.id} project={project} />
                ))}
                {groupProjects.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 px-4 py-1">No projects</p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {ungroupedProjects.length > 0 && (
        <div>
          <div className="px-2 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
            Ungrouped
          </div>
          {ungroupedProjects.map(project => (
            <FolderProjectNode key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
