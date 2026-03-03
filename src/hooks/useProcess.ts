import { useEffect } from 'react'
import { useProcessStore } from '@/stores/processStore'

export function useProcessPolling() {
  const setProcesses = useProcessStore(s => s.setProcesses)

  useEffect(() => {
    const poll = async () => {
      try {
        const processes = await window.smoothyApi.listProcesses()
        setProcesses(processes)
      } catch {
        // Ignore polling errors
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [setProcesses])
}
