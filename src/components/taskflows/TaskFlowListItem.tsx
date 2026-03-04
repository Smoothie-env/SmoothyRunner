import { Workflow, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TaskFlow } from '@/types'

interface TaskFlowListItemProps {
  flow: TaskFlow
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function TaskFlowListItem({ flow, isSelected, onSelect, onDelete }: TaskFlowListItemProps) {
  return (
    <button
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      )}
      onClick={onSelect}
    >
      <Workflow className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="flex-1 truncate">{flow.name}</span>
      <Badge variant="secondary" className="text-[10px] shrink-0">
        {flow.steps.length}
      </Badge>
      <button
        className="h-5 w-5 shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        title="Delete"
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </button>
    </button>
  )
}
