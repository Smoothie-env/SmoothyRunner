import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ChevronRight, Braces, Hash, Type, ToggleLeft, List } from 'lucide-react'

interface SettingsNodeProps {
  name: string
  value: unknown
  path: string[]
  onChange: (path: string[], value: unknown) => void
  defaultOpen?: boolean
  depth?: number
}

export function SettingsNode({ name, value, path, onChange, defaultOpen = false, depth = 0 }: SettingsNodeProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [editing, setEditing] = useState(false)

  // Object
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      <div>
        <button
          className="flex items-center gap-1.5 w-full text-left py-1 px-1 rounded hover:bg-accent/50 group"
          onClick={() => setOpen(!open)}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
          <Braces className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground ml-1">({entries.length})</span>
        </button>
        {open && (
          <div>
            {entries.map(([key, val]) => (
              <SettingsNode
                key={key}
                name={key}
                value={val}
                path={[...path, key]}
                onChange={onChange}
                defaultOpen={key === 'ConnectionStrings'}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Array
  if (Array.isArray(value)) {
    return (
      <div>
        <button
          className="flex items-center gap-1.5 w-full text-left py-1 px-1 rounded hover:bg-accent/50"
          onClick={() => setOpen(!open)}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
          <List className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground ml-1">[{value.length}]</span>
        </button>
        {open && (
          <div>
            {value.map((item, index) => (
              <SettingsNode
                key={index}
                name={`[${index}]`}
                value={item}
                path={[...path, String(index)]}
                onChange={onChange}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Boolean
  if (typeof value === 'boolean') {
    return (
      <div
        className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <div className="w-3.5" /> {/* Spacer for alignment */}
        <ToggleLeft className="h-3.5 w-3.5 text-green-400 shrink-0" />
        <span className="text-sm text-muted-foreground w-[200px] shrink-0 truncate">{name}</span>
        <Switch
          checked={value}
          onCheckedChange={(checked) => onChange(path, checked)}
        />
      </div>
    )
  }

  // Number
  if (typeof value === 'number') {
    return (
      <div
        className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <div className="w-3.5" />
        <Hash className="h-3.5 w-3.5 text-orange-400 shrink-0" />
        <span className="text-sm text-muted-foreground w-[200px] shrink-0 truncate">{name}</span>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(path, parseFloat(e.target.value) || 0)}
          className="h-7 w-[120px] text-xs"
        />
      </div>
    )
  }

  // String (default)
  const strValue = String(value ?? '')
  const isLongString = strValue.length > 60

  return (
    <div
      className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-accent/50"
      style={{ paddingLeft: `${depth * 16 + 4}px` }}
    >
      <div className="w-3.5" />
      <Type className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      <span className="text-sm text-muted-foreground w-[200px] shrink-0 truncate">{name}</span>
      {isLongString && editing ? (
        <textarea
          value={strValue}
          onChange={(e) => onChange(path, e.target.value)}
          onBlur={() => setEditing(false)}
          className="flex-1 min-h-[60px] rounded-md border border-input bg-transparent px-2 py-1 text-xs font-mono resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          autoFocus
        />
      ) : isLongString ? (
        <button
          className="flex-1 text-left text-xs font-mono text-foreground truncate bg-secondary/50 rounded px-2 py-1 hover:bg-secondary"
          onClick={() => setEditing(true)}
          title={strValue}
        >
          {strValue}
        </button>
      ) : (
        <Input
          value={strValue}
          onChange={(e) => onChange(path, e.target.value)}
          className="h-7 flex-1 text-xs font-mono"
        />
      )}
    </div>
  )
}
