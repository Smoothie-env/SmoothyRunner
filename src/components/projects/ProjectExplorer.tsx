import { useProjectStore } from '@/stores/projectStore'
import { FolderProjectNode } from './FolderProjectNode'

export function ProjectExplorer() {
  const folderProjects = useProjectStore(s => s.folderProjects)

  return (
    <div className="flex flex-col gap-0.5 pb-2">
      {folderProjects.map(project => (
        <FolderProjectNode key={project.id} project={project} />
      ))}
    </div>
  )
}
