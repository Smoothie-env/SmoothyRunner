import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskFlowEnvVar, TaskFlowStep, TaskFlowPortMapping } from '@/types'

interface AppSettingsEnvEditorProps {
  appsettingsPath: string
  currentEnv: TaskFlowEnvVar[]
  onAddEnvVar: (key: string, value: string) => void
  otherSteps?: TaskFlowStep[]
}

interface ValueSuggestion {
  label: string
  value: string
}

export function AppSettingsEnvEditor({ appsettingsPath, currentEnv, onAddEnvVar, otherSteps }: AppSettingsEnvEditorProps) {
  const [keys, setKeys] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (!expanded || !appsettingsPath) return
    setLoading(true)
    window.smoothyApi.flattenAppsettings(appsettingsPath)
      .then(setKeys)
      .catch(() => setKeys([]))
      .finally(() => setLoading(false))
  }, [expanded, appsettingsPath])

  const filteredKeys = useMemo(() => {
    const existingKeys = new Set(currentEnv.map(e => e.key))
    const available = keys.filter(k => !existingKeys.has(k))
    if (!search) return available
    const lower = search.toLowerCase()
    return available.filter(k => k.toLowerCase().includes(lower))
  }, [keys, currentEnv, search])

  // Build autocomplete suggestions for values
  const valueSuggestions = useMemo<ValueSuggestion[]>(() => {
    if (!otherSteps) return []
    const suggestions: ValueSuggestion[] = []

    const dockerSteps = otherSteps.filter((s): s is import('@/types').TaskFlowDockerStep => s.type === 'docker')

    for (const step of dockerSteps) {
      const containerName = step.containerName || step.image
      if (containerName) {
        suggestions.push({ label: `${containerName} (hostname)`, value: containerName })
      }
      for (const port of step.ports) {
        suggestions.push({
          label: `${containerName || 'container'}:${port.containerPort}`,
          value: `${containerName}:${port.containerPort}`
        })
      }
    }

    // Common patterns
    if (selectedKey?.includes('RabbitMQ') || selectedKey?.includes('rabbit')) {
      const rabbitService = dockerSteps.find(s => s.image?.includes('rabbit') || s.containerName?.includes('rabbit'))
      const host = rabbitService?.containerName || 'rabbitmq'
      suggestions.unshift({ label: 'RabbitMQ connection', value: `amqp://guest:guest@${host}:5672` })
    }

    if (selectedKey?.includes('ConnectionString') || selectedKey?.includes('Database') || selectedKey?.includes('SqlServer')) {
      const sqlService = dockerSteps.find(s => s.image?.includes('mssql') || s.image?.includes('sqlserver') || s.containerName?.includes('sql'))
      const host = sqlService?.containerName || 'mssql'
      suggestions.unshift({ label: 'SQL Server connection', value: `Server=${host};Database=MyDb;User Id=sa;Password=YourPassword;TrustServerCertificate=true` })
    }

    if (selectedKey?.includes('Redis') || selectedKey?.includes('redis')) {
      const redisService = dockerSteps.find(s => s.image?.includes('redis') || s.containerName?.includes('redis'))
      const host = redisService?.containerName || 'redis'
      suggestions.unshift({ label: 'Redis connection', value: `${host}:6379` })
    }

    return suggestions
  }, [otherSteps, selectedKey])

  const handleAddKey = (key: string) => {
    setSelectedKey(key)
    setEditValue('')
  }

  const handleConfirmAdd = () => {
    if (selectedKey) {
      onAddEnvVar(selectedKey, editValue)
      setSelectedKey(null)
      setEditValue('')
    }
  }

  if (!appsettingsPath) return null

  return (
    <div className="border border-zinc-800 rounded mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-zinc-300 transition-colors"
      >
        <Settings2 className="h-3 w-3" />
        AppSettings Env Mapping
        <span className="text-muted-foreground/50 ml-auto">{expanded ? 'collapse' : 'expand'}</span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-2 space-y-2">
          {loading ? (
            <div className="text-[10px] text-muted-foreground py-2 text-center">Loading keys...</div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search appsettings keys..."
                  className="w-full h-6 pl-7 pr-2 text-[10px] bg-zinc-900 border border-zinc-800 rounded outline-none focus:border-zinc-600"
                />
              </div>

              {/* Key adding form */}
              {selectedKey && (
                <div className="rounded border border-orange-500/30 bg-orange-500/5 p-2 space-y-1.5">
                  <div className="text-[10px] font-mono text-orange-400">{selectedKey}</div>
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="Enter value..."
                    className="w-full h-6 px-2 text-[10px] bg-zinc-900 border border-zinc-800 rounded outline-none focus:border-zinc-600"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleConfirmAdd()
                      if (e.key === 'Escape') setSelectedKey(null)
                    }}
                  />
                  {valueSuggestions.length > 0 && (
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-muted-foreground/50">Suggestions:</span>
                      {valueSuggestions.slice(0, 4).map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setEditValue(s.value)}
                          className="block w-full text-left text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-zinc-800 truncate text-muted-foreground"
                          title={s.value}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => setSelectedKey(null)}
                      className="text-[10px] px-2 py-0.5 rounded border border-zinc-700 hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmAdd}
                      className="text-[10px] px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Available keys */}
              <div className="max-h-[150px] overflow-y-auto space-y-0.5">
                {filteredKeys.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/50 py-1 text-center">
                    {keys.length === 0 ? 'No keys found' : 'All keys already mapped'}
                  </div>
                ) : (
                  filteredKeys.map(key => (
                    <button
                      key={key}
                      onClick={() => handleAddKey(key)}
                      className={cn(
                        'w-full text-left flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-zinc-800 transition-colors',
                        selectedKey === key ? 'bg-zinc-800 text-orange-400' : 'text-muted-foreground'
                      )}
                    >
                      <Plus className="h-2.5 w-2.5 shrink-0 opacity-50" />
                      <span className="truncate">{key}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
