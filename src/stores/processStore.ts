import { create } from 'zustand'
import type { ProcessInfo, DockerContainer } from '@/types'

interface ProcessState {
  processes: ProcessInfo[]
  dockerContainers: DockerContainer[]
  activeLogId: string | null

  setProcesses: (processes: ProcessInfo[]) => void
  updateProcess: (id: string, updates: Partial<ProcessInfo>) => void
  setDockerContainers: (containers: DockerContainer[]) => void
  setActiveLogId: (id: string | null) => void
}

export const useProcessStore = create<ProcessState>((set) => ({
  processes: [],
  dockerContainers: [],
  activeLogId: null,

  setProcesses: (processes) => set({ processes }),
  updateProcess: (id, updates) => set((s) => ({
    processes: s.processes.map(p => p.id === id ? { ...p, ...updates } : p)
  })),
  setDockerContainers: (containers) => set({ dockerContainers: containers }),
  setActiveLogId: (id) => set({ activeLogId: id })
}))
