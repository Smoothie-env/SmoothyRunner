import { useEffect } from 'react'
import { useTaskFlowStore } from '@/stores/taskFlowStore'

export function useTaskFlows() {
  const setTaskFlows = useTaskFlowStore(s => s.setTaskFlows)

  useEffect(() => {
    const load = async () => {
      try {
        const flows = await window.smoothyApi.listTaskFlows()
        setTaskFlows(flows)
      } catch (err) {
        console.error('Failed to load task flows:', err)
      }
    }
    load()
  }, [setTaskFlows])
}
