import { useState, useEffect, useMemo, useRef } from 'react'
import {
  X, Loader2, Circle, AlertCircle, Eye, Rocket, GitBranch, Minus,
  Play, Settings, ChevronDown, ChevronRight, Check, AlertTriangle, GitFork, Search, Archive
} from 'lucide-react'
import { Select, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StepProfilePicker } from './StepProfilePicker'
import { StepConfigEditor } from './StepConfigEditor'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { TaskFlowStep, TaskFlowStepProgress, StepBranchStatus, SubProject } from '@/types'

interface TaskFlowStepCardProps {
  step: TaskFlowStep
  stepNumber: number
  progress?: TaskFlowStepProgress
  branchStatus?: StepBranchStatus
  expanded: boolean
  flowName: string
  onChange: (updates: Partial<TaskFlowStep>) => void
  onRemove: () => void
  onToggleExpand: () => void
  onRunStep: () => void
  isExecuting: boolean
}

function isRunnableSubProject(sp: SubProject): boolean {
  return (sp.projectType === 'dotnet' && sp.kind === 'runnable')
    || (sp.projectType === 'angular' && sp.kind === 'application')
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  pending: { icon: <Circle className="h-3 w-3 text-muted-foreground" />, label: 'Pending', className: 'text-muted-foreground' },
  checkout: { icon: <Loader2 className="h-3 w-3 animate-spin text-orange-400" />, label: 'Switching branch...', className: 'text-orange-400' },
  'applying-profile': { icon: <Loader2 className="h-3 w-3 animate-spin text-blue-400" />, label: 'Applying config...', className: 'text-blue-400' },
  starting: { icon: <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />, label: 'Starting...', className: 'text-yellow-400' },
  running: { icon: <Circle className="h-3 w-3 fill-green-500 text-green-500" />, label: 'Running', className: 'text-green-500' },
  error: { icon: <AlertCircle className="h-3 w-3 text-destructive" />, label: 'Error', className: 'text-destructive' },
  skipped: { icon: <Minus className="h-3 w-3 text-muted-foreground" />, label: 'Skipped', className: 'text-muted-foreground' }
}

export function TaskFlowStepCard({
  step, stepNumber, progress, branchStatus, expanded, flowName,
  onChange, onRemove, onToggleExpand, onRunStep, isExecuting
}: TaskFlowStepCardProps) {
  const folderProjects = useProjectStore(s => s.folderProjects)
  const updateFolderProject = useProjectStore(s => s.updateFolderProject)
  const [branches, setBranches] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [dirtyPrompt, setDirtyPrompt] = useState<string | null>(null)
  const [showConfigEditor, setShowConfigEditor] = useState(false)
  const [profileRefreshKey, setProfileRefreshKey] = useState(0)

  // Branch search state
  const [branchSearch, setBranchSearch] = useState('')
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  const branchSearchRef = useRef<HTMLInputElement>(null)
  const branchDropdownRef = useRef<HTMLDivElement>(null)

  // Dirty count state
  const [dirtyCount, setDirtyCount] = useState(0)
  const [stashing, setStashing] = useState(false)

  // Worktree state
  const [worktreeExists, setWorktreeExists] = useState(false)
  const [worktreeLoading, setWorktreeLoading] = useState(false)

  const selectedProject = folderProjects.find(p => p.id === step.projectId)
  const runnableSubProjects = useMemo(() => {
    if (!selectedProject) return []
    return selectedProject.subProjects.filter(isRunnableSubProject)
  }, [selectedProject])

  const selectedSubProject = selectedProject?.subProjects.find(sp => sp.id === step.subProjectId)

  // Load branches when project changes
  useEffect(() => {
    if (!selectedProject) {
      setBranches([])
      return
    }
    const loadBranches = async () => {
      setLoadingBranches(true)
      try {
        const result = await window.smoothyApi.gitBranches(selectedProject.rootPath)
        setBranches(result.local)
      } catch {
        setBranches([])
      } finally {
        setLoadingBranches(false)
      }
    }
    loadBranches()
  }, [selectedProject?.rootPath])

  // Load dirty count for checkout mode
  useEffect(() => {
    if (!selectedProject || step.branchStrategy !== 'checkout') {
      setDirtyCount(0)
      return
    }
    const loadDirtyCount = async () => {
      try {
        const count = await window.smoothyApi.gitDirtyCount(selectedProject.rootPath)
        setDirtyCount(count)
      } catch {
        setDirtyCount(0)
      }
    }
    loadDirtyCount()
  }, [selectedProject?.rootPath, step.branchStrategy])

  // Check worktree existence
  const sanitizedFlowName = flowName.replace(/\s+/g, '_')
  const expectedWorktreePath = selectedProject
    ? `${selectedProject.originalRootPath}--${sanitizedFlowName}`
    : ''
  const worktreeDirName = expectedWorktreePath.split('/').pop() || ''

  useEffect(() => {
    if (!selectedProject || step.branchStrategy !== 'worktree') {
      setWorktreeExists(false)
      return
    }
    const checkWorktree = async () => {
      try {
        const worktrees = await window.smoothyApi.gitWorktreeList(selectedProject.originalRootPath)
        setWorktreeExists(worktrees.some(w => w.path === expectedWorktreePath))
      } catch {
        setWorktreeExists(false)
      }
    }
    checkWorktree()
  }, [selectedProject?.originalRootPath, step.branchStrategy, expectedWorktreePath])

  // Branch search — filtered branches
  const filteredBranches = useMemo(() => {
    let list = branches
    if (branchSearch) {
      const q = branchSearch.toLowerCase()
      list = list.filter(b => b.toLowerCase().includes(q))
    }
    const current = branchStatus?.currentBranch
    return list.slice().sort((a, b) => {
      if (a === current) return -1
      if (b === current) return 1
      return a.localeCompare(b)
    })
  }, [branches, branchSearch, branchStatus?.currentBranch])

  // Click outside to close branch dropdown
  useEffect(() => {
    if (!branchDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setBranchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [branchDropdownOpen])

  const statusInfo = progress ? STATUS_CONFIG[progress.status] || STATUS_CONFIG.pending : null

  // Branch display helpers
  const currentBranch = branchStatus?.currentBranch
  const targetBranch = step.branch
  const hasMismatch = branchStatus?.mismatch ?? false

  // Profile summary for collapsed view
  const profileSummary = step.profiles.length > 0
    ? step.profiles.map(p => p.profileName).join(', ')
    : null

  // Branch switch logic (reused from BranchSelector pattern)
  const doCheckoutAndRescan = async (branch: string) => {
    if (!selectedProject) return
    await window.smoothyApi.gitCheckout(selectedProject.rootPath, branch)
    const scanned = await window.smoothyApi.scanFolder(selectedProject.rootPath)
    updateFolderProject(selectedProject.id, { subProjects: scanned.subProjects, branch })
  }

  const handleSwitchNow = async () => {
    if (!selectedProject || !targetBranch) return
    setSwitching(true)
    try {
      if (step.branchStrategy === 'worktree') {
        const worktreePath = `${selectedProject.originalRootPath}--${targetBranch.replace(/\//g, '-')}`
        await window.smoothyApi.gitWorktreeAdd(selectedProject.originalRootPath, targetBranch, worktreePath)
        await window.smoothyApi.setProjectWorktree(selectedProject.id, worktreePath)
      } else {
        const dirty = await window.smoothyApi.gitIsDirty(selectedProject.rootPath)
        if (dirty) {
          setSwitching(false)
          setDirtyPrompt(targetBranch)
          return
        }
        await doCheckoutAndRescan(targetBranch)
      }
    } catch (err: any) {
      console.error('Branch switch failed:', err)
    } finally {
      setSwitching(false)
    }
  }

  const handleStashAndSwitch = async () => {
    if (!selectedProject || !dirtyPrompt) return
    setSwitching(true)
    setDirtyPrompt(null)
    try {
      await window.smoothyApi.gitStash(selectedProject.rootPath, `taskflow: switch to ${dirtyPrompt}`)
      await doCheckoutAndRescan(dirtyPrompt)
    } catch (err: any) {
      console.error('Stash and switch failed:', err)
    } finally {
      setSwitching(false)
    }
  }

  // Stash handler for dirty count section
  const handleStash = async () => {
    if (!selectedProject) return
    setStashing(true)
    try {
      await window.smoothyApi.gitStash(selectedProject.rootPath, `taskflow: stash from step #${stepNumber}`)
      const count = await window.smoothyApi.gitDirtyCount(selectedProject.rootPath)
      setDirtyCount(count)
    } catch (err: any) {
      console.error('Stash failed:', err)
    } finally {
      setStashing(false)
    }
  }

  // Worktree handlers
  const handleCreateWorktree = async () => {
    if (!selectedProject || !step.branch) return
    setWorktreeLoading(true)
    try {
      await window.smoothyApi.gitWorktreeAdd(selectedProject.originalRootPath, step.branch, expectedWorktreePath)
      await window.smoothyApi.setProjectWorktree(selectedProject.id, expectedWorktreePath)
      setWorktreeExists(true)
    } catch (err: any) {
      console.error('Create worktree failed:', err)
    } finally {
      setWorktreeLoading(false)
    }
  }

  const handleRemoveWorktree = async () => {
    if (!selectedProject) return
    setWorktreeLoading(true)
    try {
      await window.smoothyApi.gitWorktreeRemove(expectedWorktreePath)
      await window.smoothyApi.setProjectWorktree(selectedProject.id, null)
      setWorktreeExists(false)
    } catch (err: any) {
      console.error('Remove worktree failed:', err)
    } finally {
      setWorktreeLoading(false)
    }
  }

  return (
    <div className={cn(
      'rounded-lg border bg-card transition-colors',
      isExecuting && 'opacity-80',
      progress?.status === 'error' && 'border-destructive/50',
      progress?.status === 'running' && 'border-green-500/50',
      hasMismatch && !progress && 'border-orange-500/30'
    )}>
      {/* Collapsed Header — always visible */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Expand chevron */}
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        }

        {/* Step number */}
        <span className="text-[10px] font-mono text-muted-foreground bg-zinc-800 rounded px-1.5 py-0.5 shrink-0">
          #{stepNumber}
        </span>

        {/* Status indicator during execution */}
        {statusInfo && (
          <div className={cn('flex items-center gap-1 shrink-0', statusInfo.className)}>
            {statusInfo.icon}
          </div>
        )}

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Service name + branch info + mode */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {selectedSubProject?.name || (step.subProjectId ? step.subProjectId : 'Not configured')}
            </span>

            {/* Branch info */}
            {selectedProject && (
              <div className="flex items-center gap-1 shrink-0">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                {targetBranch ? (
                  <>
                    {hasMismatch ? (
                      <span className="text-[11px] text-orange-400 flex items-center gap-0.5">
                        {currentBranch || '?'} → {targetBranch}
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-[11px] text-green-500 flex items-center gap-0.5">
                        {targetBranch}
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {currentBranch || 'keep'}
                  </span>
                )}
              </div>
            )}

            {/* Mode badge */}
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 shrink-0',
                step.mode === 'watch' ? 'text-blue-400 border-blue-400/30' : 'text-orange-400 border-orange-400/30'
              )}
            >
              {step.mode === 'watch' ? 'Watch' : 'Release'}
            </Badge>

            {/* Port badge */}
            {(step.portOverride || selectedSubProject?.port) && (
              <span className="text-[10px] text-muted-foreground font-mono">
                :{step.portOverride || selectedSubProject?.port}
              </span>
            )}
          </div>

          {/* Line 2: Project name + profile summary */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{selectedProject?.name || 'No project'}</span>
            {profileSummary && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="truncate">{profileSummary}</span>
              </>
            )}
            {step.branchStrategy === 'worktree' && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-0.5">
                  <GitFork className="h-3 w-3" />
                  worktree
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          {!isExecuting && step.subProjectId && (
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-green-500/20 transition-colors"
              onClick={onRunStep}
              title="Run this step"
            >
              <Play className="h-3 w-3 text-green-500" />
            </button>
          )}
          <button
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors"
            onClick={onToggleExpand}
            title="Settings"
          >
            <Settings className="h-3 w-3 text-muted-foreground" />
          </button>
          {!isExecuting && (
            <button
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20 transition-colors"
              onClick={onRemove}
              title="Remove step"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {progress?.error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded mx-3 mb-2 px-2 py-1.5">
          {progress.error}
        </div>
      )}

      {/* Dirty prompt dialog */}
      {dirtyPrompt && (
        <div className="mx-3 mb-2 p-2 bg-orange-500/10 border border-orange-500/30 rounded-md text-xs space-y-2">
          <p className="text-orange-400">Working directory has uncommitted changes. Stash and switch?</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleStashAndSwitch}>
              Stash & Switch
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setDirtyPrompt(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Expanded form */}
      {expanded && (
        <div className={cn('border-t px-3 py-3 space-y-3', isExecuting && 'opacity-60 pointer-events-none')}>
          {/* Project selector */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Project</label>
            <Select
              value={step.projectId || ''}
              onValueChange={(v) => onChange({ projectId: v, subProjectId: '', branch: null, profiles: [] })}
              placeholder="Select project..."
            >
              {folderProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </Select>
          </div>

          {/* Service selector */}
          {selectedProject && runnableSubProjects.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Service</label>
              <Select
                value={step.subProjectId || ''}
                onValueChange={(v) => onChange({ subProjectId: v, profiles: [] })}
                placeholder="Select service..."
              >
                {runnableSubProjects.map(sp => (
                  <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                ))}
              </Select>
            </div>
          )}

          {/* Branch section */}
          {selectedProject && (
            <div className="space-y-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Branch</label>

              {/* Current branch (read-only) */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Current:</span>
                <span className={cn(
                  'font-mono',
                  branchStatus?.loading ? 'text-muted-foreground' : 'text-foreground'
                )}>
                  {branchStatus?.loading ? 'Loading...' : (currentBranch || 'unknown')}
                </span>
              </div>

              {/* Target branch selector — searchable dropdown */}
              <div className="relative" ref={branchDropdownRef}>
                <button
                  onClick={() => { setBranchDropdownOpen(!branchDropdownOpen); setBranchSearch('') }}
                  className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs text-left truncate flex items-center justify-between"
                >
                  <span className={step.branch ? 'text-foreground' : 'text-muted-foreground'}>
                    {step.branch || 'Keep current'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
                {branchDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] rounded-md border bg-popover shadow-md">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b">
                      <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <input
                        ref={branchSearchRef}
                        placeholder="Search branches..."
                        value={branchSearch}
                        onChange={e => setBranchSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') setBranchDropdownOpen(false) }}
                        className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                      <button
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors',
                          !step.branch && 'bg-accent'
                        )}
                        onClick={() => { onChange({ branch: null }); setBranchDropdownOpen(false) }}
                      >
                        Keep current
                      </button>
                      {loadingBranches ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredBranches.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2 py-1.5">No branches found</p>
                      ) : (
                        filteredBranches.map(b => (
                          <button
                            key={b}
                            className={cn(
                              'w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors truncate',
                              step.branch === b && 'bg-accent'
                            )}
                            onClick={() => { onChange({ branch: b }); setBranchDropdownOpen(false) }}
                          >
                            {b === currentBranch && (
                              <span className="text-green-500 mr-1">*</span>
                            )}
                            {b}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Strategy toggle + Switch Now */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 p-0.5 bg-zinc-800/50 rounded-md">
                  <button
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
                      step.branchStrategy === 'checkout' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => onChange({ branchStrategy: 'checkout' })}
                  >
                    <GitBranch className="h-3 w-3" />
                    Checkout
                  </button>
                  <button
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
                      step.branchStrategy === 'worktree' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => onChange({ branchStrategy: 'worktree' })}
                  >
                    <GitFork className="h-3 w-3" />
                    Worktree
                  </button>
                </div>

                {hasMismatch && targetBranch && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                    onClick={handleSwitchNow}
                    disabled={switching}
                  >
                    {switching ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Switch Now
                  </Button>
                )}
              </div>

              {/* Checkout mode — dirty info + stash */}
              {step.branchStrategy === 'checkout' && dirtyCount > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-orange-400">{dirtyCount} uncommitted</span>
                  <button
                    onClick={handleStash}
                    disabled={stashing}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:underline disabled:opacity-50"
                  >
                    {stashing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                    Stash
                  </button>
                </div>
              )}

              {/* Worktree mode — create/status/remove */}
              {step.branchStrategy === 'worktree' && selectedProject && (
                worktreeLoading ? (
                  <div className="flex items-center gap-2 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Working...</span>
                  </div>
                ) : worktreeExists ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-500 font-mono truncate">{worktreeDirName}</span>
                    <button
                      onClick={handleRemoveWorktree}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : step.branch ? (
                  <button
                    onClick={handleCreateWorktree}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Create Worktree
                  </button>
                ) : null
              )}
            </div>
          )}

          {/* Port override */}
          {selectedSubProject && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Port</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={step.portOverride ?? selectedSubProject.port ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null
                    onChange({ portOverride: val })
                  }}
                  placeholder={`${selectedSubProject.port || 'auto'}`}
                  className="h-7 w-24 rounded-md border border-input bg-transparent px-2 text-xs"
                />
                {step.portOverride && (
                  <button onClick={() => onChange({ portOverride: null })} className="text-xs text-muted-foreground hover:text-foreground">
                    Reset
                  </button>
                )}
                {!step.portOverride && selectedSubProject.port && (
                  <span className="text-[10px] text-muted-foreground">default</span>
                )}
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mode</label>
            <div className="flex items-center gap-1 p-0.5 bg-zinc-800/50 rounded-md w-fit">
              <button
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
                  step.mode === 'watch' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onChange({ mode: 'watch' })}
              >
                <Eye className="h-3 w-3" />
                Watch
              </button>
              <button
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
                  step.mode === 'release' ? 'bg-zinc-700 text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onChange({ mode: 'release' })}
              >
                <Rocket className="h-3 w-3" />
                Release
              </button>
            </div>
          </div>

          {/* Profile picker */}
          {selectedSubProject && selectedSubProject.configFiles.length > 0 && (
            <StepProfilePicker
              projectId={step.projectId}
              configFiles={selectedSubProject.configFiles}
              selectedProfiles={step.profiles}
              onChange={(profiles) => {
                onChange({ profiles })
                setProfileRefreshKey(k => k + 1)
              }}
              refreshKey={profileRefreshKey}
            />
          )}

          {/* Edit Config button + inline editor */}
          {selectedSubProject && selectedSubProject.configFiles.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowConfigEditor(!showConfigEditor)}
              >
                <Settings className="h-3 w-3 mr-1" />
                {showConfigEditor ? 'Hide Config' : 'Edit Config'}
              </Button>

              {showConfigEditor && (
                <StepConfigEditor
                  projectId={step.projectId}
                  subProject={selectedSubProject}
                  selectedProfiles={step.profiles}
                  refreshKey={profileRefreshKey}
                  onProfileSaved={() => setProfileRefreshKey(k => k + 1)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
