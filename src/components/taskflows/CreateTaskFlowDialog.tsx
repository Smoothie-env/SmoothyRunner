import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import type { TaskFlow } from '@/types'

interface CreateTaskFlowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTaskFlowDialog({ open, onOpenChange }: CreateTaskFlowDialogProps) {
  const [name, setName] = useState('')
  const addTaskFlow = useTaskFlowStore(s => s.addTaskFlow)
  const selectFlow = useTaskFlowStore(s => s.selectFlow)

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return

    const now = new Date().toISOString()
    const flow: TaskFlow = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: trimmed,
      steps: [],
      createdAt: now,
      updatedAt: now
    }

    try {
      await window.smoothyApi.addTaskFlow(flow)
      addTaskFlow(flow)
      selectFlow(flow.id)
      handleClose()
    } catch (err) {
      console.error('Failed to create task flow:', err)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setName('')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task Flow</DialogTitle>
          <DialogDescription>
            Create a multi-project orchestration recipe.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task flow name..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
          }}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
