import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { ChevronRight, Folder, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectGroup } from '@/types'

interface GroupHeaderProps {
  group: ProjectGroup
  isExpanded: boolean
  onToggle: () => void
  projectCount: number
}

export function GroupHeader({ group, isExpanded, onToggle, projectCount }: GroupHeaderProps) {
  const renameGroup = useProjectStore(s => s.renameGroup)
  const removeGroup = useProjectStore(s => s.removeGroup)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(group.name)
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== group.name) {
      renameGroup(group.id, trimmed)
      window.smoothyApi.renameGroup(group.id, trimmed)
    } else {
      setRenameValue(group.name)
    }
    setIsRenaming(false)
  }

  const handleDelete = () => {
    setShowMenu(false)
    removeGroup(group.id)
    window.smoothyApi.removeGroup(group.id)
  }

  const handleStartRename = () => {
    setShowMenu(false)
    setRenameValue(group.name)
    setIsRenaming(true)
  }

  return (
    <div className="group relative">
      <div
        className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-accent/30 rounded-md"
        onClick={onToggle}
        onDoubleClick={(e) => {
          e.stopPropagation()
          handleStartRename()
        }}
      >
        <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform text-muted-foreground', isExpanded && 'rotate-90')} />
        <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" />

        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setRenameValue(group.name)
                setIsRenaming(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border border-primary/50 rounded px-1 text-xs font-medium outline-none min-w-0"
          />
        ) : (
          <span className="text-xs font-medium truncate flex-1">{group.name}</span>
        )}

        <span className="text-[10px] text-muted-foreground shrink-0">{projectCount}</span>

        <button
          className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-2 top-full z-50 bg-popover border rounded-md shadow-md py-1 min-w-[120px]"
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent text-left"
            onClick={handleStartRename}
          >
            <Pencil className="h-3 w-3" />
            Rename
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent text-left text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
