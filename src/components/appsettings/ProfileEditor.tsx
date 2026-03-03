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
  const appsettingsData = useProjectStore(s => s.appsettingsData)

  const handleSave = async () => {
    if (!project || !appsettingsData || !name.trim()) return

    setSaving(true)
    try {
      // Save the current appsettings state as an overlay profile
      await window.sparkApi.saveProfile(project.id, name.trim(), appsettingsData)
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
            Save the current appsettings state as a named profile for quick switching
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
              This will snapshot the current appsettings values. When you apply this profile later,
              it will overwrite the Development settings file with these values.
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
