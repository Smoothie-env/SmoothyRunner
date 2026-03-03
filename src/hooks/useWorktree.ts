import { useEffect, useState } from 'react'
import type { Worktree } from '@/types'

export function useWorktrees(repoPath: string | undefined) {
  const [worktrees, setWorktrees] = useState<Worktree[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!repoPath) return
    setLoading(true)
    try {
      const list = await window.sparkApi.gitWorktreeList(repoPath)
      setWorktrees(list)
    } catch {
      setWorktrees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [repoPath])

  return { worktrees, loading, refresh: load }
}
