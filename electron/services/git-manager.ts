import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

export interface Worktree {
  path: string
  branch: string
  head: string
  isBare: boolean
  isMain: boolean
}

export class GitManager {
  async currentBranch(repoPath: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath })
    return stdout.trim()
  }

  async listBranches(repoPath: string): Promise<{ local: string[]; remote: string[] }> {
    const { stdout: localOutput } = await execFileAsync('git', ['branch', '--format=%(refname:short)'], { cwd: repoPath })
    const { stdout: remoteOutput } = await execFileAsync('git', ['branch', '-r', '--format=%(refname:short)'], { cwd: repoPath })

    return {
      local: localOutput.trim().split('\n').filter(Boolean),
      remote: remoteOutput.trim().split('\n').filter(Boolean)
    }
  }

  async worktreeList(repoPath: string): Promise<Worktree[]> {
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], { cwd: repoPath })
    const worktrees: Worktree[] = []
    let current: Partial<Worktree> = {}

    for (const line of stdout.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as Worktree)
        }
        current = { path: line.slice(9), isBare: false, isMain: false }
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice(5)
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '')
      } else if (line === 'bare') {
        current.isBare = true
      } else if (line === '') {
        // Empty line separates worktrees
      }
    }

    if (current.path) {
      worktrees.push(current as Worktree)
    }

    // Mark the first one as main
    if (worktrees.length > 0) {
      worktrees[0].isMain = true
    }

    return worktrees
  }

  async worktreeAdd(repoPath: string, branch: string, worktreePath: string): Promise<void> {
    // Generate path using naming convention: {RepoName}--{branch-slug}
    const repoName = path.basename(repoPath)
    const branchSlug = branch.replace(/\//g, '-')
    const targetPath = worktreePath || path.join(path.dirname(repoPath), `${repoName}--${branchSlug}`)

    // Check if branch exists
    try {
      await execFileAsync('git', ['rev-parse', '--verify', branch], { cwd: repoPath })
      // Branch exists, check it out
      await execFileAsync('git', ['worktree', 'add', targetPath, branch], { cwd: repoPath })
    } catch {
      // Branch doesn't exist, create it
      await execFileAsync('git', ['worktree', 'add', targetPath, '-b', branch], { cwd: repoPath })
    }
  }

  async checkout(repoPath: string, branch: string): Promise<void> {
    await execFileAsync('git', ['checkout', branch], { cwd: repoPath })
  }

  async isDirty(repoPath: string): Promise<boolean> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: repoPath })
    return stdout.trim().length > 0
  }

  async dirtyCount(repoPath: string): Promise<number> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: repoPath })
    const lines = stdout.trim().split('\n').filter(Boolean)
    return lines.length
  }

  async stash(repoPath: string, message?: string): Promise<void> {
    const args = ['stash', 'push', '--include-untracked']
    if (message) args.push('-m', message)
    await execFileAsync('git', args, { cwd: repoPath })
  }

  async stashPop(repoPath: string): Promise<void> {
    await execFileAsync('git', ['stash', 'pop'], { cwd: repoPath })
  }

  async worktreeRemove(worktreePath: string): Promise<void> {
    // Find the main repo from the worktree
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], { cwd: worktreePath })
    const gitDir = stdout.trim()
    const repoPath = path.dirname(gitDir)

    await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], { cwd: repoPath })
  }
}
