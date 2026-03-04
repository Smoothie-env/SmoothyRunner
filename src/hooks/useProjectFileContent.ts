import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import type { SubProject } from '@/types'

function getProjectFilePath(subProject: SubProject): string | undefined {
  if (subProject.projectType === 'dotnet') return subProject.csprojPath
  if (subProject.projectType === 'angular') return subProject.angularJsonPath
  return undefined
}

export function useProjectFileContent() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const setProjectFileContent = useProjectStore(s => s.setProjectFileContent)
  const setProjectFileLoading = useProjectStore(s => s.setProjectFileLoading)

  const filePath = subProject ? getProjectFilePath(subProject) : undefined

  useEffect(() => {
    if (!filePath) {
      setProjectFileContent(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setProjectFileLoading(true)
      try {
        const content = await window.smoothyApi.readFileContent(filePath)
        if (!cancelled) setProjectFileContent(content)
      } catch (err) {
        console.error('Failed to read project file:', err)
        if (!cancelled) setProjectFileContent(null)
      } finally {
        if (!cancelled) setProjectFileLoading(false)
      }
    }
    load()

    return () => { cancelled = true }
  }, [filePath, setProjectFileContent, setProjectFileLoading])
}
