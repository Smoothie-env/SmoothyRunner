import { useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'

export function useCsprojContent() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const setCsprojContent = useProjectStore(s => s.setCsprojContent)
  const setCsprojLoading = useProjectStore(s => s.setCsprojLoading)

  useEffect(() => {
    if (!subProject) {
      setCsprojContent(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setCsprojLoading(true)
      try {
        const content = await window.smoothyApi.readFileContent(subProject.csprojPath)
        if (!cancelled) setCsprojContent(content)
      } catch (err) {
        console.error('Failed to read csproj:', err)
        if (!cancelled) setCsprojContent(null)
      } finally {
        if (!cancelled) setCsprojLoading(false)
      }
    }
    load()

    return () => { cancelled = true }
  }, [subProject?.csprojPath, setCsprojContent, setCsprojLoading])
}
