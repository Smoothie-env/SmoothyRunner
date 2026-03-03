import { useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { Select, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'
import type { FolderProject, Worktree } from '@/types'

interface WorktreeSelectorProps {
  project: FolderProject
  worktrees: Worktree[]
  onSwitch: (worktreePath: string) => void
  onRefresh: () => void
}

export function WorktreeSelector({ project, worktrees, onSwitch, onRefresh }: WorktreeSelectorProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [creating, setCreating] = useState(false)

  if (worktrees.length === 0) return null

  const handleCreate = async () => {
    if (!newBranch.trim()) return
    setCreating(true)
    try {
      await window.sparkApi.gitWorktreeAdd(project.originalRootPath, newBranch.trim(), '')
      onRefresh()
      setCreateOpen(false)
      setNewBranch('')
    } catch (err) {
      console.error('Failed to create worktree:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleRemove = async (worktreePath: string) => {
    try {
      await window.sparkApi.gitWorktreeRemove(worktreePath)
      onRefresh()
    } catch (err) {
      console.error('Failed to remove worktree:', err)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Select
          value={project.rootPath}
          onValueChange={onSwitch}
          className="w-[130px]"
        >
          {worktrees.map(wt => (
            <SelectItem key={wt.path} value={wt.path}>
              {wt.branch}{wt.isMain ? ' (main)' : ''}
            </SelectItem>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setCreateOpen(true)}
          title="New worktree"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Worktree</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Branch Name</label>
              <Input
                placeholder="feature/my-feature"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Worktree for: {project.name}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newBranch.trim() || creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
