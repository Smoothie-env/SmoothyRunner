import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, Plus } from 'lucide-react'
import { Select, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsNode } from '@/components/appsettings/SettingsNode'
import type { SubProject, TaskFlowProfileRef } from '@/types'

interface StepConfigEditorProps {
  projectId: string
  subProject: SubProject
  selectedProfiles?: TaskFlowProfileRef[]
  refreshKey?: number
  onProfileSaved?: () => void
}

function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const result = { ...obj }
  let current: Record<string, unknown> = result
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    current[key] = { ...(current[key] as Record<string, unknown>) }
    current = current[key] as Record<string, unknown>
  }
  current[path[path.length - 1]] = value
  return result
}

export function StepConfigEditor({ projectId, subProject, selectedProfiles, refreshKey, onProfileSaved }: StepConfigEditorProps) {
  const [selectedFile, setSelectedFile] = useState(subProject.configFiles[0] || '')
  const [configData, setConfigData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showSaveProfile, setShowSaveProfile] = useState(false)
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    if (!selectedFile) return
    const loadConfig = async () => {
      setLoading(true)
      try {
        const activeProfile = selectedProfiles?.find(p => p.filePath === selectedFile)
        if (activeProfile) {
          const result = await window.smoothyApi.applyProfile(
            projectId, selectedFile, activeProfile.profileName, subProject.projectType
          )
          if (result.merged) {
            setConfigData(result.merged)
            setDirty(false)
            return
          }
        }
        const data = await window.smoothyApi.readConfig(selectedFile, subProject.projectType)
        setConfigData(data as Record<string, unknown>)
        setDirty(false)
      } catch (err) {
        console.error('Failed to load config:', err)
        setConfigData(null)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [selectedFile, subProject.projectType, selectedProfiles, refreshKey])

  const loadProfiles = async () => {
    if (!selectedFile) return
    await window.smoothyApi.listProfiles(projectId, selectedFile)
  }

  const handleChange = useCallback((path: string[], value: unknown) => {
    if (!configData) return
    setConfigData(prev => prev ? setNestedValue(prev, path, value) : prev)
    setDirty(true)
  }, [configData])

  const handleSave = async () => {
    if (!configData || !selectedFile) return
    setSaving(true)
    try {
      await window.smoothyApi.writeConfig(selectedFile, configData, subProject.projectType)
      setDirty(false)
    } catch (err) {
      console.error('Failed to save config:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAsProfile = async () => {
    if (!configData || !selectedFile || !profileName.trim()) return
    setSaving(true)
    try {
      await window.smoothyApi.saveProfile(
        projectId,
        selectedFile,
        profileName.trim(),
        configData,
        subProject.projectType
      )
      setShowSaveProfile(false)
      setProfileName('')
      await loadProfiles()
      onProfileSaved?.()
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-md p-2 space-y-2 bg-zinc-900/50">
      {/* Config file selector */}
      {subProject.configFiles.length > 1 && (
        <Select
          value={selectedFile}
          onValueChange={setSelectedFile}
          placeholder="Select config file..."
        >
          {subProject.configFiles.map(f => {
            const fileName = f.split('/').pop() || f
            return <SelectItem key={f} value={f}>{fileName}</SelectItem>
          })}
        </Select>
      )}

      {/* Config tree */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : configData ? (
        <div className="max-h-[300px] overflow-y-auto">
          {Object.entries(configData).map(([key, value]) => (
            <SettingsNode
              key={key}
              name={key}
              value={value}
              path={[key]}
              onChange={handleChange}
              depth={0}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">No config loaded</p>
      )}

      {/* Action buttons */}
      {configData && (
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>

          {showSaveProfile ? (
            <div className="flex items-center gap-1">
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Profile name..."
                className="h-6 text-xs w-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAsProfile()
                  if (e.key === 'Escape') {
                    setShowSaveProfile(false)
                    setProfileName('')
                  }
                }}
                autoFocus
              />
              <Button
                size="sm"
                variant="default"
                className="h-6 text-xs"
                onClick={handleSaveAsProfile}
                disabled={!profileName.trim() || saving}
              >
                Save
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={() => setShowSaveProfile(true)}
            >
              <Plus className="h-3 w-3" />
              Save as Profile
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
