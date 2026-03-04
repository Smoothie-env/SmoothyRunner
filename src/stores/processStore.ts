import { create } from 'zustand'
import type { ProcessInfo, DockerContainer } from '@/types'

const MAX_LOG_LINES = 10000
const DEFAULT_PANEL_HEIGHT = 250

interface ProcessState {
  processes: ProcessInfo[]
  dockerContainers: DockerContainer[]
  activeLogId: string | null
  processLogs: Record<string, string[]>
  tabNames: Record<string, string>
  bottomPanelOpen: boolean
  bottomPanelHeight: number
  activeProcessTab: string | null

  setProcesses: (processes: ProcessInfo[]) => void
  updateProcess: (id: string, updates: Partial<ProcessInfo>) => void
  setDockerContainers: (containers: DockerContainer[]) => void
  setActiveLogId: (id: string | null) => void
  appendProcessLog: (id: string, data: string) => void
  clearProcessLogs: (id: string) => void
  removeProcessLogs: (id: string) => void
  removeProcess: (id: string) => void
  setBottomPanelOpen: (open: boolean) => void
  setBottomPanelHeight: (h: number) => void
  setActiveProcessTab: (id: string | null) => void
  setTabName: (id: string, name: string) => void
}

export const useProcessStore = create<ProcessState>((set) => ({
  processes: [],
  dockerContainers: [],
  activeLogId: null,
  processLogs: {},
  tabNames: {},
  bottomPanelOpen: false,
  bottomPanelHeight: DEFAULT_PANEL_HEIGHT,
  activeProcessTab: null,

  setProcesses: (processes) => set({ processes }),
  updateProcess: (id, updates) => set((s) => ({
    processes: s.processes.map(p => p.id === id ? { ...p, ...updates } : p)
  })),
  setDockerContainers: (containers) => set({ dockerContainers: containers }),
  setActiveLogId: (id) => set({ activeLogId: id }),

  appendProcessLog: (id, data) => set((s) => {
    const existing = s.processLogs[id] || []
    const next = [...existing, data]
    const trimmed = next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next
    return { processLogs: { ...s.processLogs, [id]: trimmed } }
  }),

  clearProcessLogs: (id) => set((s) => ({
    processLogs: { ...s.processLogs, [id]: [] }
  })),

  removeProcessLogs: (id) => set((s) => {
    const { [id]: _, ...rest } = s.processLogs
    return { processLogs: rest }
  }),

  removeProcess: (id) => set((s) => {
    const { [id]: _, ...rest } = s.processLogs
    const { [id]: _name, ...restNames } = s.tabNames
    const processes = s.processes.filter(p => p.id !== id)
    const remainingIds = new Set([...Object.keys(rest), ...processes.map(p => p.id)])

    if (remainingIds.size === 0) {
      return { processLogs: rest, tabNames: restNames, processes, activeProcessTab: null, bottomPanelOpen: false }
    }

    const needSwitch = s.activeProcessTab === id
    const activeProcessTab = needSwitch
      ? Array.from(remainingIds)[0] || null
      : s.activeProcessTab

    return { processLogs: rest, tabNames: restNames, processes, activeProcessTab }
  }),

  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),

  setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.min(500, Math.max(100, h)) }),

  setActiveProcessTab: (id) => set({ activeProcessTab: id }),

  setTabName: (id, name) => set((s) => ({
    tabNames: { ...s.tabNames, [id]: name }
  }))
}))
