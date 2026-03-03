import { useEffect, useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProfileEditor } from './ProfileEditor'
import { ChevronDown, Check, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProfileSelector() {
  const project = useProjectStore(s => s.activeProject())
  const [profiles, setProfiles] = useState<string[]>([])
  const [activeProfile, setActiveProfile] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [modified, setModified] = useState(false)

  useEffect(() => {
    if (!project) return
    loadProfiles()
  }, [project?.id])

  const loadProfiles = async () => {
    if (!project) return
    const list = await window.sparkApi.listProfiles(project.id)
    setProfiles(list)
  }

  const handleApply = async (name: string) => {
    if (!project) return
    const result = await window.sparkApi.applyProfile(project.id, name)
    if (result.success) {
      setActiveProfile(name)
      setModified(false)
      setOpen(false)
      // Reload appsettings
      const activeFile = useProjectStore.getState().activeAppsettingsFile
      if (activeFile) {
        const data = await window.sparkApi.readAppsettings(activeFile)
        useProjectStore.getState().setAppsettingsData(data as Record<string, unknown>)
        useProjectStore.getState().setAppsettingsDirty(false)
      }
    }
  }

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!project) return
    await window.sparkApi.deleteProfile(project.id, name)
    if (activeProfile === name) setActiveProfile(null)
    await loadProfiles()
  }

  const handleProfileSaved = () => {
    loadProfiles()
    setEditorOpen(false)
  }

  if (!project) return null

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setOpen(!open)}
        >
          {activeProfile || 'Profiles'}
          {modified && <Badge variant="warning" className="ml-1 text-[10px] px-1 py-0">modified</Badge>}
          <ChevronDown className="h-3 w-3" />
        </Button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
            {profiles.length === 0 ? (
              <div className="px-2 py-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">No profiles yet</p>
              </div>
            ) : (
              profiles.map(name => (
                <button
                  key={name}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent group',
                    name === activeProfile && 'bg-accent'
                  )}
                  onClick={() => handleApply(name)}
                >
                  {name === activeProfile && <Check className="h-3.5 w-3.5 text-primary" />}
                  <span className={cn(name !== activeProfile && 'ml-5.5')}>{name}</span>
                  <button
                    className="ml-auto opacity-0 group-hover:opacity-100 hover:text-destructive"
                    onClick={(e) => handleDelete(name, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))
            )}
            <div className="border-t mt-1 pt-1">
              <button
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => { setEditorOpen(true); setOpen(false) }}
              >
                <Plus className="h-3.5 w-3.5" />
                Save Current as Profile
              </button>
            </div>
          </div>
        )}
      </div>

      <ProfileEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={handleProfileSaved}
      />
    </>
  )
}
