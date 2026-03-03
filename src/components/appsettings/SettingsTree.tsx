import { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { SettingsNode } from './SettingsNode'
import { ProfileSelector } from './ProfileSelector'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Save, RefreshCw, FileJson } from 'lucide-react'

export function SettingsTree() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const appsettingsData = useProjectStore(s => s.appsettingsData)
  const activeFile = useProjectStore(s => s.activeAppsettingsFile)
  const dirty = useProjectStore(s => s.appsettingsDirty)
  const setAppsettingsData = useProjectStore(s => s.setAppsettingsData)
  const setActiveFile = useProjectStore(s => s.setActiveAppsettingsFile)
  const setDirty = useProjectStore(s => s.setAppsettingsDirty)
  const [loading, setLoading] = useState(false)
  const [externalChange, setExternalChange] = useState(false)

  const loadSettings = useCallback(async (filePath: string) => {
    setLoading(true)
    try {
      const data = await window.sparkApi.readAppsettings(filePath)
      setAppsettingsData(data as Record<string, unknown>)
      setDirty(false)
      setExternalChange(false)
      await window.sparkApi.watchAppsettings(filePath)
    } catch (err) {
      console.error('Failed to read appsettings:', err)
    } finally {
      setLoading(false)
    }
  }, [setAppsettingsData, setDirty])

  // Auto-select Development file
  useEffect(() => {
    if (!subProject || subProject.appsettingsFiles.length === 0) {
      setActiveFile(null)
      setAppsettingsData(null)
      return
    }

    const devFile = subProject.appsettingsFiles.find(f => f.includes('Development'))
      || subProject.appsettingsFiles[0]

    if (devFile && devFile !== activeFile) {
      setActiveFile(devFile)
      loadSettings(devFile)
    }

    return () => {
      if (activeFile) {
        window.sparkApi.unwatchAppsettings(activeFile)
      }
    }
  }, [subProject?.id])

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
              />
            ))}
          </div>
        ) : null}
      </ScrollArea>
    </div>
  )
}
