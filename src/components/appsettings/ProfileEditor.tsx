import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProjectStore } from '@/stores/projectStore'

interface ProfileEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function ProfileEditor({ open, onOpenChange, onSaved }: ProfileEditorProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const project = useProjectStore(s => s.activeProject())
  const subProject = useProjectStore(s => s.activeSubProject())
  const configData = useProjectStore(s => s.configData)
  const activeFile = useProjectStore(s => s.activeConfigFile)

  const projectType = subProject?.projectType

  const handleSave = async () => {
    if (!project || !configData || !activeFile || !name.trim() || !projectType) return

    setSaving(true)
    try {
      await window.smoothyApi.saveProfile(project.id, activeFile, name.trim(), configData, projectType)
      onSaved()
      setName('')
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Profile</DialogTitle>
          <DialogDescription>
            Save the current configuration state as a named profile for quick switching
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Profile Name</label>
            <Input
              placeholder="e.g. Local Docker, Dev Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              Only the differences from the original file will be stored. When applied,
              the profile will be merged onto the baseline without writing to disk.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
