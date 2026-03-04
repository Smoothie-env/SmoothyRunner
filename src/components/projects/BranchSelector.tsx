import { useState, useRef, useEffect, useMemo } from 'react'
import { GitBranch, Loader2, Search, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import type { FolderProject } from '@/types'

interface BranchSelectorProps {
  project: FolderProject
}

export function BranchSelector({ project }: BranchSelectorProps) {
  const updateFolderProject = useProjectStore(s => s.updateFolderProject)

  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [search, setSearch] = useState('')
  const [dirtyPrompt, setDirtyPrompt] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setDirtyPrompt(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    let list = branches
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(b => b.toLowerCase().includes(q))
    }
    return list.slice().sort((a, b) => {
      if (a === project.branch) return -1
      if (b === project.branch) return 1
      if (a.length !== b.length) return a.length - b.length
      return a.localeCompare(b)
    })
  }, [branches, search, project.branch])

  const handleOpen = async () => {
    if (open) {
      setOpen(false)
      setDirtyPrompt(null)
      return
    }
    setOpen(true)
    setSearch('')
    setDirtyPrompt(null)
    setLoading(true)
    try {
      const result = await window.smoothyApi.gitBranches(project.rootPath)
      setBranches(result.local)
      setTimeout(() => searchRef.current?.focus(), 0)
    } catch {
      setBranches([])
    } finally {
      setLoading(false)
    }
  }

  const doCheckoutAndRescan = async (branch: string) => {
    await window.smoothyApi.gitCheckout(project.rootPath, branch)
    const scanned = await window.smoothyApi.scanFolder(project.rootPath)
    updateFolderProject(project.id, {
      subProjects: scanned.subProjects,
      branch
    })
  }

  const handleSelect = async (branch: string) => {
    if (branch === project.branch) {
      setOpen(false)
      return
    }

    setSwitching(true)
    try {
      const dirty = await window.smoothyApi.gitIsDirty(project.rootPath)
      if (dirty) {
        setSwitching(false)
        setDirtyPrompt(branch)
        return
      }

      await doCheckoutAndRescan(branch)
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`Branch switch failed: ${message}`)
      setOpen(false)
    } finally {
      setSwitching(false)
    }
  }

  const handleStashAndSwitch = async () => {
    if (!dirtyPrompt) return
    const branch = dirtyPrompt
    setDirtyPrompt(null)
    setSwitching(true)
    try {
      await window.smoothyApi.gitStash(project.rootPath, `auto: switch to ${branch}`)
      await doCheckoutAndRescan(branch)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      alert(`Stash & switch failed: ${message}`)
    } finally {
      setSwitching(false)
      setOpen(false)
    }
  }

  const handleDirtyCancel = () => {
    setDirtyPrompt(null)
  }

  if (!project.branch) return null

  return (
    <div className="relative" ref={ref}>
      <button
        className={cn(
          'flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 transition-colors truncate max-w-[100px]',
          'text-muted-foreground border-border/60 hover:bg-accent hover:text-foreground'
        )}
        onClick={handleOpen}
        title={project.branch}
      >
        {switching ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : (
          <GitBranch className="h-2.5 w-2.5 shrink-0" />
        )}
        <span className="truncate">{project.branch}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-max min-w-[200px] max-w-[280px] rounded-md border bg-popover shadow-md">
          {/* Dirty state prompt */}
          {dirtyPrompt ? (
            <div className="p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  Uncommitted changes. Stash and switch to <span className="font-semibold">{dirtyPrompt}</span>?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 text-xs px-2 py-1.5 rounded-md border border-border hover:bg-accent transition-colors"
                  onClick={handleDirtyCancel}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 text-xs px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                  onClick={handleStashAndSwitch}
                >
                  Stash & Switch
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Search input */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b">
                <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  placeholder="Search branches..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setOpen(false)
                  }}
                />
              </div>

              {/* Branch list */}
              <div className="max-h-[200px] overflow-y-auto p-1">
                {loading ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 px-2">
                    {search ? 'No matching branches' : 'No branches found'}
                  </p>
                ) : (
                  filtered.map(branch => (
                    <button
                      key={branch}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-default',
                        branch === project.branch && 'bg-accent font-medium'
                      )}
                      onClick={() => handleSelect(branch)}
                      title={branch}
                    >
                      <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{branch}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
