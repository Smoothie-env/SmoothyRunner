import { useState, useRef, useCallback, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MainPanel } from '@/components/layout/MainPanel'
import { StatusBar } from '@/components/layout/StatusBar'
import { ProcessPanel } from '@/components/processes/ProcessPanel'
import { useProjects } from '@/hooks/useProjects'
import { useProcessPolling } from '@/hooks/useProcess'
import { useGitWatcher } from '@/hooks/useGitWatcher'
import { useProcessLogCollector } from '@/hooks/useProcessLogCollector'
import { useTaskFlows } from '@/hooks/useTaskFlows'
import { useTaskFlowProgress } from '@/hooks/useTaskFlowProgress'
import { useProcessStore } from '@/stores/processStore'

const SIDEBAR_MIN = 200
const SIDEBAR_MAX = 500
const SIDEBAR_DEFAULT = 250
const PANEL_MIN = 100
const PANEL_MAX = 500

export default function App() {
  useProjects()
  useProcessPolling()
  useGitWatcher()
  useProcessLogCollector()
  useTaskFlows()
  useTaskFlowProgress()

  const bottomPanelOpen = useProcessStore(s => s.bottomPanelOpen)
  const bottomPanelHeight = useProcessStore(s => s.bottomPanelHeight)
  const setBottomPanelHeight = useProcessStore(s => s.setBottomPanelHeight)

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const isDraggingSidebar = useRef(false)

  const handleSidebarMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingSidebar.current) return
    setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX)))
  }, [])

  const handleSidebarMouseUp = useCallback(() => {
    isDraggingSidebar.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', handleSidebarMouseMove)
    document.removeEventListener('mouseup', handleSidebarMouseUp)
  }, [handleSidebarMouseMove])

  const handleSidebarMouseDown = useCallback(() => {
    isDraggingSidebar.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleSidebarMouseMove)
    document.addEventListener('mouseup', handleSidebarMouseUp)
  }, [handleSidebarMouseMove, handleSidebarMouseUp])

  // Bottom panel resize
  const isDraggingPanel = useRef(false)
  const panelStartY = useRef(0)
  const panelStartHeight = useRef(0)

  const handlePanelMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPanel.current) return
    const delta = panelStartY.current - e.clientY
    const newHeight = Math.min(PANEL_MAX, Math.max(PANEL_MIN, panelStartHeight.current + delta))
    setBottomPanelHeight(newHeight)
  }, [setBottomPanelHeight])

  const handlePanelMouseUp = useCallback(() => {
    isDraggingPanel.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', handlePanelMouseMove)
    document.removeEventListener('mouseup', handlePanelMouseUp)
  }, [handlePanelMouseMove])

  const handlePanelMouseDown = useCallback(() => {
    isDraggingPanel.current = true
    panelStartY.current = 0
    panelStartHeight.current = bottomPanelHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e: MouseEvent) => {
      if (!panelStartY.current) {
        panelStartY.current = e.clientY
      }
      const delta = panelStartY.current - e.clientY
      const newHeight = Math.min(PANEL_MAX, Math.max(PANEL_MIN, panelStartHeight.current + delta))
      setBottomPanelHeight(newHeight)
    }
    const onUp = () => {
      isDraggingPanel.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [bottomPanelHeight, setBottomPanelHeight])

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleSidebarMouseMove)
      document.removeEventListener('mouseup', handleSidebarMouseUp)
    }
  }, [handleSidebarMouseMove, handleSidebarMouseUp])

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1 min-h-0">
        <Sidebar width={sidebarWidth} />
        <div
          className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/30 transition-colors"
          onMouseDown={handleSidebarMouseDown}
        />
        <MainPanel />
      </div>
      {bottomPanelOpen && (
        <>
          <div
            className="h-1 shrink-0 cursor-row-resize bg-transparent hover:bg-primary/30 transition-colors"
            onMouseDown={handlePanelMouseDown}
          />
          <div style={{ height: bottomPanelHeight }} className="shrink-0">
            <ProcessPanel />
          </div>
        </>
      )}
      <StatusBar />
    </div>
  )
}
