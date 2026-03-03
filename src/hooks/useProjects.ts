import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'

export function useProjects() {
  const setFolderProjects = useProjectStore(s => s.setFolderProjects)
  const setGroups = useProjectStore(s => s.setGroups)

  useEffect(() => {
    const load = async () => {
      try {
        const [projects, groups] = await Promise.all([
          window.sparkApi.listFolderProjects(),
          window.sparkApi.listGroups()
        ])
        setFolderProjects(projects)
        setGroups(groups)
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    load()
  }, [setFolderProjects, setGroups])
}
