import { useEffect } from 'react'
import { useProcessStore } from '@/stores/processStore'

export function useDockerStatus(composePath: string | undefined, profiles: string[] = []) {
  const setDockerContainers = useProcessStore(s => s.setDockerContainers)

  useEffect(() => {
    if (!composePath) return

    const poll = async () => {
      try {
        const containers = await window.smoothyApi.dockerStatus(composePath, profiles)
        setDockerContainers(containers)
      } catch {
        // Ignore
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [composePath, setDockerContainers])
}
