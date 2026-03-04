import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Select, SelectItem } from '@/components/ui/select'
import { useProjectStore } from '@/stores/projectStore'
import { FolderOpen, Loader2, Play, BookOpen, Package, Globe } from 'lucide-react'
import type { FolderProject, SubProject } from '@/types'

function isRunnable(sp: SubProject): boolean {
  return (sp.projectType === 'dotnet' && sp.kind === 'runnable')
    || (sp.projectType === 'angular' && sp.kind === 'application')
}

function isPackage(sp: SubProject): boolean {
  return sp.projectType === 'dotnet' && sp.kind === 'package'
}

function isLibrary(sp: SubProject): boolean {
  return (sp.projectType === 'dotnet' && sp.kind === 'library')
    || (sp.projectType === 'angular' && sp.kind === 'library')
}

function SubProjectRow({ sp }: { sp: SubProject }) {
  let icon
  if (sp.projectType === 'angular') {
    icon = sp.kind === 'application'
      ? <Globe className="h-3 w-3 text-purple-400 shrink-0" />
      : <BookOpen className="h-3 w-3 text-blue-400 shrink-0" />
  } else {
    icon = sp.kind === 'runnable'
      ? <Play className="h-3 w-3 text-green-400 shrink-0" />
      : sp.kind === 'package'
        ? <Package className="h-3 w-3 text-orange-400 shrink-0" />
        : <BookOpen className="h-3 w-3 text-blue-400 shrink-0" />
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
      {icon}
      <span className="truncate flex-1">{sp.name}</span>
      <div className="flex gap-1 shrink-0">
        {sp.projectType === 'dotnet' && sp.targetFramework && (
          <Badge variant="secondary" className="text-[10px]">{sp.targetFramework}</Badge>
        )}
        {sp.projectType === 'angular' && sp.angularVersion && (
          <Badge variant="secondary" className="text-[10px]">ng{sp.angularVersion.split('.')[0]}</Badge>
        )}
        {sp.port && <Badge variant="secondary" className="text-[10px]">:{sp.port}</Badge>}
        {sp.projectType === 'dotnet' && sp.version && (
          <Badge variant="secondary" className="text-[10px] text-orange-400">v{sp.version}</Badge>
        )}
      </div>
    </div>
  )
}

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const [scannedProject, setScannedProject] = useState<FolderProject | null>(null)
  const [scanning, setScanning] = useState(false)
  const [selectedDir, setSelectedDir] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('__none__')
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const addFolderProject = useProjectStore(s => s.addFolderProject)
  const groups = useProjectStore(s => s.groups)
  const addGroup = useProjectStore(s => s.addGroup)

  const handleSelectFolder = async () => {
    const dir = await window.smoothyApi.selectDirectory()
    if (!dir) return

    setSelectedDir(dir)
    setScanning(true)
    try {
      const project = await window.smoothyApi.scanFolder(dir)
      setScannedProject(project)
    } catch (err) {
      console.error('Scan failed:', err)
    } finally {
      setScanning(false)
    }
  }

  const handleConfirm = async () => {
    if (!scannedProject) return

    let groupId: string | undefined = undefined
    if (showNewGroupInput && newGroupName.trim()) {
      const newGroup = await window.smoothyApi.addGroup(newGroupName.trim())
      addGroup(newGroup)
      groupId = newGroup.id
    } else if (selectedGroupId !== '__none__') {
      groupId = selectedGroupId
    }

    const projectWithGroup = { ...scannedProject, groupId }
    await window.smoothyApi.addFolderProject(projectWithGroup)
    addFolderProject(projectWithGroup)
    handleClose()
  }

  const handleClose = () => {
    onOpenChange(false)
    setScannedProject(null)
    setSelectedDir(null)
    setSelectedGroupId('__none__')
    setNewGroupName('')
    setShowNewGroupInput(false)
  }

  const grouped = useMemo(() => {
    if (!scannedProject) return { services: [], packages: [], libraries: [] }
    return {
      services: scannedProject.subProjects.filter(isRunnable),
      packages: scannedProject.subProjects.filter(isPackage),
      libraries: scannedProject.subProjects.filter(isLibrary),
    }
  }, [scannedProject])

  const serviceCount = grouped.services.length
  const packageCount = grouped.packages.length
  const libraryCount = grouped.libraries.length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Folder Project</DialogTitle>
          <DialogDescription>
            Select a folder to add as a project. .NET and Angular projects will be discovered.
          </DialogDescription>
        </DialogHeader>

        {!selectedDir ? (
          <Button variant="outline" className="w-full h-24 flex-col gap-2" onClick={handleSelectFolder}>
            <FolderOpen className="h-6 w-6" />
            <span>Choose Folder</span>
          </Button>
        ) : scanning ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Scanning {selectedDir}...</span>
          </div>
        ) : scannedProject && scannedProject.subProjects.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">No projects found in this folder</p>
            <Button variant="outline" size="sm" onClick={handleSelectFolder}>
              Try Another Folder
            </Button>
          </div>
        ) : scannedProject ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">{scannedProject.name}</span>
              </div>
              <div className="flex gap-3 text-sm text-muted-foreground">
                {serviceCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3 text-green-400" />
                    {serviceCount} {serviceCount === 1 ? 'service' : 'services'}
                  </span>
                )}
                {packageCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3 text-orange-400" />
                    {packageCount} {packageCount === 1 ? 'package' : 'packages'}
                  </span>
                )}
                {libraryCount > 0 && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3 text-blue-400" />
                    {libraryCount} {libraryCount === 1 ? 'library' : 'libraries'}
                  </span>
                )}
              </div>
              {scannedProject.solutionFile && (
                <p className="text-xs text-muted-foreground mt-2">
                  Solution: {scannedProject.solutionFile.split('/').pop()}
                </p>
              )}
              {scannedProject.hasDockerCompose && (
                <Badge variant="secondary" className="mt-2 text-[10px]">docker-compose</Badge>
              )}
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {grouped.services.map(sp => (
                  <SubProjectRow key={sp.id} sp={sp} />
                ))}
                {grouped.packages.map(sp => (
                  <SubProjectRow key={sp.id} sp={sp} />
                ))}
                {grouped.libraries.length > 0 && (
                  <Collapsible>
                    {({ isOpen, toggle }: { isOpen: boolean; toggle: () => void }) => (
                      <>
                        <CollapsibleTrigger
                          isOpen={isOpen}
                          onClick={toggle}
                          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                        >
                          {grouped.libraries.length} {grouped.libraries.length === 1 ? 'library' : 'libraries'}
                        </CollapsibleTrigger>
                        <CollapsibleContent isOpen={isOpen}>
                          {grouped.libraries.map(sp => (
                            <SubProjectRow key={sp.id} sp={sp} />
                          ))}
                        </CollapsibleContent>
                      </>
                    )}
                  </Collapsible>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : null}

        {scannedProject && scannedProject.subProjects.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Group</label>
            {!showNewGroupInput ? (
              <Select
                value={selectedGroupId}
                onValueChange={(v) => {
                  if (v === '__new__') {
                    setShowNewGroupInput(true)
                    setSelectedGroupId('__none__')
                  } else {
                    setSelectedGroupId(v)
                  }
                }}
              >
                <SelectItem value="__none__">No Group</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
                <SelectItem value="__new__">+ New Group</SelectItem>
              </Select>
            ) : (
              <div className="flex gap-2">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name"
                  className="flex-1 bg-transparent border rounded px-2 py-1 text-sm outline-none focus:border-primary"
                  autoFocus
                />
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowNewGroupInput(false)
                  setNewGroupName('')
                }}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          {scannedProject && scannedProject.subProjects.length > 0 && (
            <Button onClick={handleConfirm}>
              Add Project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
