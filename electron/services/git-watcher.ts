import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'

export class GitWatcher {
  private watchers = new Map<string, FSWatcher>()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  watchProject(repoPath: string): void {
    if (this.watchers.has(repoPath)) return

    const headPath = this.resolveGitHead(repoPath)
    if (!headPath) return

    const watcher = watch(headPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    })

    watcher.on('change', () => {
      const branch = this.readBranch(headPath)
      if (branch) {
        this.mainWindow.webContents.send('git:branchChanged', { repoPath, branch })
      }
    })

    this.watchers.set(repoPath, watcher)
  }

  unwatchProject(repoPath: string): void {
    const watcher = this.watchers.get(repoPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(repoPath)
    }
  }

  destroy(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
  }

  private resolveGitHead(repoPath: string): string | null {
    const gitPath = path.join(repoPath, '.git')
    try {
      const stat = fs.statSync(gitPath)
      if (stat.isDirectory()) {
        return path.join(gitPath, 'HEAD')
      }
    } catch {
      return null
    }

    // .git is a file (worktree) — parse gitdir
    try {
      const content = fs.readFileSync(gitPath, 'utf-8').trim()
      const match = content.match(/^gitdir:\s*(.+)$/)
      if (match) {
        const gitDir = path.isAbsolute(match[1])
          ? match[1]
          : path.resolve(repoPath, match[1])
        return path.join(gitDir, 'HEAD')
      }
    } catch {
      // ignore
    }
    return null
  }

  private readBranch(headPath: string): string | null {
    try {
      const content = fs.readFileSync(headPath, 'utf-8').trim()
      const match = content.match(/^ref:\s*refs\/heads\/(.+)$/)
      return match ? match[1] : null
    } catch {
      return null
    }
  }
}
