import { useState, useEffect } from 'react'
import { Select, SelectItem } from '@/components/ui/select'
import { FileJson } from 'lucide-react'
import type { TaskFlowProfileRef } from '@/types'

interface StepProfilePickerProps {
  projectId: string
  configFiles: string[]
  selectedProfiles: TaskFlowProfileRef[]
  onChange: (profiles: TaskFlowProfileRef[]) => void
  refreshKey?: number
  disabled?: boolean
}

export function StepProfilePicker({ projectId, configFiles, selectedProfiles, onChange, refreshKey, disabled }: StepProfilePickerProps) {
  const [profilesByFile, setProfilesByFile] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const loadProfiles = async () => {
      const result: Record<string, string[]> = {}
      for (const filePath of configFiles) {
        try {
          const names = await window.smoothyApi.listProfiles(projectId, filePath)
          if (names.length > 0) {
            result[filePath] = names
          }
        } catch {
          // No profiles for this file
        }
      }
      setProfilesByFile(result)
    }
    if (configFiles.length > 0 && projectId) {
      loadProfiles()
    }
  }, [projectId, configFiles, refreshKey])

  const filesWithProfiles = Object.entries(profilesByFile)
  if (filesWithProfiles.length === 0) return null

  const getSelected = (filePath: string): string => {
    const ref = selectedProfiles.find(p => p.filePath === filePath)
    return ref?.profileName || '__none__'
  }

  const handleChange = (filePath: string, profileName: string) => {
    const filtered = selectedProfiles.filter(p => p.filePath !== filePath)
    if (profileName !== '__none__') {
      filtered.push({ filePath, profileName })
    }
    onChange(filtered)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Profiles</label>
      {filesWithProfiles.map(([filePath, profiles]) => {
        const fileName = filePath.split('/').pop() || filePath
        return (
          <div key={filePath} className="flex items-center gap-2">
            <FileJson className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate min-w-0 max-w-[160px]" title={filePath}>
              {fileName}
            </span>
            <Select
              value={getSelected(filePath)}
              onValueChange={(v) => handleChange(filePath, v)}
              className="flex-1"
            >
              <SelectItem value="__none__">Default</SelectItem>
              {profiles.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </Select>
          </div>
        )
      })}
    </div>
  )
}
