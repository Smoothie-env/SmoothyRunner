import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProjectStore } from '@/stores/projectStore'
import { FolderOpen, Loader2, Play, BookOpen } from 'lucide-react'
import type { FolderProject } from '@/types'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const [scannedProject, setScannedProject] = useState<FolderProject | null>(null)
  const [scanning, setScanning] = useState(false)
  const [selectedDir, setSelectedDir] = useState<string | null>(null)
  const addFolderProject = useProjectStore(s => s.addFolderProject)

  const handleSelectFolder = async () => {
    const dir = await window.sparkApi.selectDirectory()
    if (!dir) return

    setSelectedDir(dir)
    setScanning(true)
    try {
      const project = await window.sparkApi.scanFolder(dir)
      setScannedProject(project)
    } catch (err) {
      console.error('Scan failed:', err)
    } finally {
      setScanning(false)
    }
  }

  const handleConfirm = async () => {
    if (!scannedProject) return
    await window.sparkApi.addFolderProject(scannedProject)
    addFolderProject(scannedProject)
    handleClose()
  }

  const handleClose = () => {
    onOpenChange(false)
    setScannedProject(null)
    setSelectedDir(null)
  }

  const runnableCount = scannedProject?.subProjects.filter(sp => sp.kind === 'runnable').length ?? 0
  const libraryCount = scannedProject?.subProjects.filter(sp => sp.kind === 'library').length ?? 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Folder Project</DialogTitle>
          <DialogDescription>
            Select a folder to add as a project. All .csproj files inside will be discovered.
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
            <p className="text-sm text-muted-foreground mb-3">No .csproj files found in this folder</p>
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
                {runnableCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3 text-green-400" />
                    {runnableCount} runnable
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

            <div className="space-y-1">
              {scannedProject.subProjects.map(sp => (
                <div key={sp.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  {sp.kind === 'runnable' ? (
                    <Play className="h-3 w-3 text-green-400 shrink-0" />
                  ) : (
                    <BookOpen className="h-3 w-3 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate flex-1">{sp.name}</span>
                  <div className="flex gap-1 shrink-0">
                    {sp.targetFramework && <Badge variant="secondary" className="text-[10px]">{sp.targetFramework}</Badge>}
                    {sp.port && <Badge variant="secondary" className="text-[10px]">:{sp.port}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
