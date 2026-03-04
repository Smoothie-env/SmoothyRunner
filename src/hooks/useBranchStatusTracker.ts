import { useEffect, useCallback, useRef } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import type { TaskFlowStep } from '@/types'

export function useBranchStatusTracker(steps: TaskFlowStep[]) {
  const folderProjects = useProjectStore(s => s.folderProjects)
  const setBranchStatus = useTaskFlowStore(s => s.setBranchStatus)
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  const checkStep = useCallback(async (step: TaskFlowStep) => {
    const project = folderProjects.find(p => p.id === step.projectId)
    if (!project) return

    setBranchStatus(step.id, { currentBranch: null, loading: true, mismatch: false })

    try {
      const effectivePath = step.branchStrategy === 'worktree' && step.worktreePath
        ? step.worktreePath
        : project.originalRootPath
      const currentBranch = await window.smoothyApi.gitCurrentBranch(effectivePath)
      const mismatch = step.branchStrategy !== 'worktree'
        && step.branch !== null
        && step.branch !== currentBranch
      setBranchStatus(step.id, { currentBranch, loading: false, mismatch })
    } catch {
      setBranchStatus(step.id, { currentBranch: null, loading: false, mismatch: false })
    }
  }, [folderProjects, setBranchStatus])

  const refresh = useCallback(() => {
    for (const step of stepsRef.current) {
      if (step.projectId) {
        checkStep(step)
      }
    }
  }, [checkStep])

  // Initial check when steps change
  useEffect(() => {
    refresh()
  }, [steps, refresh])

  // Subscribe to branch change events for reactive updates
  useEffect(() => {
    const unsub = window.smoothyApi.onBranchChanged(({ repoPath, branch }) => {
      for (const step of stepsRef.current) {
        const project = folderProjects.find(p => p.id === step.projectId)
        if (!project) continue
        const matchesMain = project.rootPath === repoPath || project.originalRootPath === repoPath
        const matchesWorktree = step.worktreePath === repoPath
        if (matchesMain || matchesWorktree) {
          const isActivePath = step.branchStrategy === 'worktree' && step.worktreePath
            ? matchesWorktree
            : matchesMain
          if (!isActivePath) continue
          const mismatch = step.branchStrategy !== 'worktree'
            && step.branch !== null
            && step.branch !== branch
          setBranchStatus(step.id, { currentBranch: branch, loading: false, mismatch })
        }
      }
    })
    return unsub
  }, [folderProjects, setBranchStatus])

  return { refresh }
}
