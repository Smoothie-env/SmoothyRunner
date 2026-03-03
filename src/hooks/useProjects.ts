import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'

export function useProjects() {
  const setFolderProjects = useProjectStore(s => s.setFolderProjects)

  useEffect(() => {
    const load = async () => {
      try {
        const projects = await window.sparkApi.listFolderProjects()
        setFolderProjects(projects)
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    load()
  }, [setFolderProjects])
}
