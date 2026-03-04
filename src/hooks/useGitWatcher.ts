import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'

export function useGitWatcher() {
  useEffect(() => {
    const unsub = window.smoothyApi.onBranchChanged(({ repoPath, branch }) => {
      const state = useProjectStore.getState()
      const project = state.folderProjects.find(
        p => p.rootPath === repoPath || p.originalRootPath === repoPath
      )
      if (project) {
        state.updateFolderProject(project.id, { branch })
      }
    })
    return unsub
  }, [])
}
