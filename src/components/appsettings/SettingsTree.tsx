import { useEffect, useState, useCallback, useRef } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { SettingsNode } from './SettingsNode'
import { ProfileSelector } from './ProfileSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save, RefreshCw, FileJson, AlertCircle, Search, ChevronsUpDown, ChevronsDownUp, Undo2 } from 'lucide-react'

export function SettingsTree() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const appsettingsData = useProjectStore(s => s.appsettingsData)
  const activeFile = useProjectStore(s => s.activeAppsettingsFile)
  const dirty = useProjectStore(s => s.appsettingsDirty)
  const setAppsettingsData = useProjectStore(s => s.setAppsettingsData)
  const setActiveFile = useProjectStore(s => s.setActiveAppsettingsFile)
  const setDirty = useProjectStore(s => s.setAppsettingsDirty)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [externalChange, setExternalChange] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandSignal, setExpandSignal] = useState<{ action: 'expand' | 'collapse'; v: number }>({ action: 'collapse', v: 0 })
  const snapshotRef = useRef<Record<string, unknown> | null>(null)

  const loadSettings = useCallback(async (filePath: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await window.sparkApi.readAppsettings(filePath)
      setAppsettingsData(data as Record<string, unknown>)
      snapshotRef.current = structuredClone(data as Record<string, unknown>)
      setDirty(false)
      setExternalChange(false)
      await window.sparkApi.watchAppsettings(filePath)
    } catch (err: any) {
      console.error('Failed to read appsettings:', err)
      setAppsettingsData(null)
      setLoadError(err.message || 'Failed to read file')
    } finally {
      setLoading(false)
    }
  }, [setAppsettingsData, setDirty])

  // Auto-select Development file and load on subproject change
  useEffect(() => {
    if (!subProject || subProject.appsettingsFiles.length === 0) {
      setActiveFile(null)
      setAppsettingsData(null)
      return
    }

    const devFile = subProject.appsettingsFiles.find(f => f.includes('Development'))
      || subProject.appsettingsFiles[0]

    if (devFile) {
      setActiveFile(devFile)
      loadSettings(devFile)
    }

    return () => {
      if (devFile) {
        window.sparkApi.unwatchAppsettings(devFile)
      }
    }
  }, [subProject?.id, loadSettings, setActiveFile, setAppsettingsData])

  // Listen for external changes
  useEffect(() => {
    const unsubscribe = window.sparkApi.onAppsettingsChanged(({ filePath }) => {
      if (filePath === activeFile) {
        setExternalChange(true)
      }
    })
    return unsubscribe
  }, [activeFile])

  const handleFileChange = (filePath: string) => {
    if (activeFile) {
      window.sparkApi.unwatchAppsettings(activeFile)
    }
    setActiveFile(filePath)
    loadSettings(filePath)
  }

  const handleSave = async () => {
    if (!activeFile || !appsettingsData) return
    await window.sparkApi.writeAppsettings(activeFile, appsettingsData)
    setDirty(false)
  }

  const handleReload = () => {
    if (activeFile) {
      loadSettings(activeFile)
    }
  }

  const handleRevert = () => {
    if (!snapshotRef.current) return
    setAppsettingsData(structuredClone(snapshotRef.current))
    setDirty(false)
  }

  const handleValueChange = (path: string[], value: unknown) => {
    if (!appsettingsData) return

    const newData = structuredClone(appsettingsData)
    let current: any = newData
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]]
    }
    current[path[path.length - 1]] = value
    setAppsettingsData(newData)
    setDirty(true)
  }

  if (!subProject) return null

  if (subProject.appsettingsFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileJson className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No appsettings files found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <Select
          value={activeFile || ''}
          onValueChange={handleFileChange}
          className="w-[260px]"
        >
          {subProject.appsettingsFiles.map(f => {
            const name = f.split('/').pop() || f
            return <SelectItem key={f} value={f}>{name}</SelectItem>
          })}
        </Select>

        <ProfileSelector />

        <div className="h-5 w-px bg-border mx-1" />

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keys..."
            className="h-7 w-[180px] pl-7 text-xs"
          />
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpandSignal({ action: 'expand', v: Date.now() })}
          title="Expand All"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpandSignal({ action: 'collapse', v: Date.now() })}
          title="Collapse All"
        >
          <ChevronsDownUp className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRevert}
          disabled={!dirty}
          title="Revert changes"
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {externalChange && (
          <Badge variant="warning" className="cursor-pointer" onClick={handleReload}>
            External change detected — click to reload
          </Badge>
        )}

        {dirty && <Badge variant="warning">Unsaved</Badge>}

        <Button variant="ghost" size="icon" onClick={handleReload} title="Reload">
          <RefreshCw className="h-4 w-4" />
        </Button>

        <Button variant="default" size="sm" onClick={handleSave} disabled={!dirty}>
          <Save className="h-3.5 w-3.5 mr-1" />
          Save
        </Button>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1 px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={handleReload}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          </div>
        ) : appsettingsData ? (
          <div className="space-y-1">
            {Object.entries(appsettingsData).map(([key, value]) => (
              <SettingsNode
                key={key}
                name={key}
                value={value}
                path={[key]}
                onChange={handleValueChange}
                defaultOpen={key === 'ConnectionStrings'}
                expandSignal={expandSignal}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        ) : null}
      </ScrollArea>
    </div>
  )
}
