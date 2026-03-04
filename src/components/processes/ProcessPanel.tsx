import { useProcessStore } from '@/stores/processStore'
import { ProcessLogViewer } from './ProcessLogViewer'
import { Button } from '@/components/ui/button'
import { X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCallback } from 'react'

export function ProcessPanel() {
  const bottomPanelOpen = useProcessStore(s => s.bottomPanelOpen)
  const processLogs = useProcessStore(s => s.processLogs)
  const processes = useProcessStore(s => s.processes)
  const activeProcessTab = useProcessStore(s => s.activeProcessTab)
  const setActiveProcessTab = useProcessStore(s => s.setActiveProcessTab)
  const setBottomPanelOpen = useProcessStore(s => s.setBottomPanelOpen)
  const removeProcess = useProcessStore(s => s.removeProcess)

  const handleCloseTab = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await window.smoothyApi.removeProcess(id)
    removeProcess(id)
  }, [removeProcess])

  if (!bottomPanelOpen) return null

  // Build tab list from processes that have logs or are running
  const tabIds = new Set<string>()
  for (const id of Object.keys(processLogs)) tabIds.add(id)
  for (const p of processes) tabIds.add(p.id)
  const tabs = Array.from(tabIds)

  // Auto-select first tab if current is invalid
  const currentTab = activeProcessTab && tabIds.has(activeProcessTab) ? activeProcessTab : tabs[0] || null

  if (tabs.length === 0) {
    return (
      <div className="border-t bg-zinc-950 flex items-center justify-center py-4">
        <span className="text-xs text-muted-foreground/50">No processes started yet</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 absolute right-2 top-1"
          onClick={() => setBottomPanelOpen(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="border-t bg-zinc-950 flex flex-col min-h-0 h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b shrink-0 overflow-x-auto">
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
          {tabs.map(id => {
            const proc = processes.find(p => p.id === id)
            const isRunning = proc?.status === 'running'
            const isActive = id === currentTab

            return (
              <button
                key={id}
                className={cn(
                  'group flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap border-r shrink-0 transition-colors',
                  isActive ? 'bg-zinc-900 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-zinc-900/50'
                )}
                onClick={() => setActiveProcessTab(id)}
              >
                <Circle className={cn('h-2 w-2', isRunning ? 'fill-success text-success' : 'fill-zinc-600 text-zinc-600')} />
                {proc?.name || id}
                <span
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity ml-1"
                  onClick={(e) => handleCloseTab(e, id)}
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              </button>
            )
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 mr-1"
          onClick={() => setBottomPanelOpen(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Log content */}
      <div className="flex-1 min-h-0">
        {currentTab && <ProcessLogViewer processId={currentTab} />}
      </div>
    </div>
  )
}
