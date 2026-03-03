import { useEffect } from 'react'
import { useProcessStore } from '@/stores/processStore'

export function useProcessLogCollector() {
  useEffect(() => {
    const unsubscribe = window.sparkApi.onProcessLog(({ id, data }) => {
      useProcessStore.getState().appendProcessLog(id, data)
    })
    return unsubscribe
  }, [])
}
