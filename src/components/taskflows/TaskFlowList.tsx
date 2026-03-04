import { Workflow } from 'lucide-react'
import { useTaskFlowStore } from '@/stores/taskFlowStore'
import { useProjectStore } from '@/stores/projectStore'
import { TaskFlowListItem } from './TaskFlowListItem'

export function TaskFlowList() {
  const taskFlows = useTaskFlowStore(s => s.taskFlows)
  const selectedFlowId = useTaskFlowStore(s => s.selectedFlowId)
  const selectFlow = useTaskFlowStore(s => s.selectFlow)
  const removeTaskFlow = useTaskFlowStore(s => s.removeTaskFlow)
  const setSelection = useProjectStore(s => s.setSelection)

  const handleSelect = (id: string) => {
    selectFlow(id)
    setSelection(null)
  }

  const handleDelete = async (id: string) => {
    try {
      await window.smoothyApi.removeTaskFlow(id)
      removeTaskFlow(id)
    } catch (err) {
      console.error('Failed to delete task flow:', err)
    }
  }

  if (taskFlows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Workflow className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No task flows yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Create one to orchestrate multi-project launches</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 p-1">
      {taskFlows.map(flow => (
        <TaskFlowListItem
          key={flow.id}
          flow={flow}
          isSelected={selectedFlowId === flow.id}
          onSelect={() => handleSelect(flow.id)}
          onDelete={() => handleDelete(flow.id)}
        />
      ))}
    </div>
  )
}
