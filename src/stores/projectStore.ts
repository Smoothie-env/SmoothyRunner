import { create } from 'zustand'
import type { FolderProject, SubProject, SidebarSelection, ViewTab } from '@/types'

interface ProjectState {
  folderProjects: FolderProject[]
  selection: SidebarSelection
  activeTab: ViewTab
  scanning: boolean
  appsettingsData: Record<string, unknown> | null
  activeAppsettingsFile: string | null
  appsettingsDirty: boolean
  csprojContent: string | null
  csprojLoading: boolean
  expandedProjects: Set<string>

  setFolderProjects: (projects: FolderProject[]) => void
  addFolderProject: (project: FolderProject) => void
  removeFolderProject: (id: string) => void
  updateFolderProject: (id: string, updates: Partial<FolderProject>) => void
  setSelection: (selection: SidebarSelection) => void
  setActiveTab: (tab: ViewTab) => void
  setScanning: (scanning: boolean) => void
  setAppsettingsData: (data: Record<string, unknown> | null) => void
  setActiveAppsettingsFile: (file: string | null) => void
  setAppsettingsDirty: (dirty: boolean) => void
  setCsprojContent: (content: string | null) => void
  setCsprojLoading: (loading: boolean) => void
  toggleExpanded: (projectId: string) => void

  activeProject: () => FolderProject | undefined
  activeSubProject: () => SubProject | undefined
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  folderProjects: [],
  selection: null,
  activeTab: 'csproj',
  scanning: false,
  appsettingsData: null,
  activeAppsettingsFile: null,
  appsettingsDirty: false,
  csprojContent: null,
  csprojLoading: false,
  expandedProjects: new Set<string>(),

  setFolderProjects: (folderProjects) => set({ folderProjects }),
  addFolderProject: (project) => set((s) => ({
    folderProjects: [...s.folderProjects, project],
    expandedProjects: new Set([...s.expandedProjects, project.id])
  })),
  removeFolderProject: (id) => set((s) => {
    const newExpanded = new Set(s.expandedProjects)
    newExpanded.delete(id)
    const isSelected = s.selection && s.selection.projectId === id
    return {
      folderProjects: s.folderProjects.filter(p => p.id !== id),
      selection: isSelected ? null : s.selection,
      expandedProjects: newExpanded
    }
  }),
  updateFolderProject: (id, updates) => set((s) => ({
    folderProjects: s.folderProjects.map(p => p.id === id ? { ...p, ...updates } : p)
  })),
  setSelection: (selection) => set({
    selection,
    appsettingsData: null,
    activeAppsettingsFile: null,
    appsettingsDirty: false,
    csprojContent: null
  }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setScanning: (scanning) => set({ scanning }),
  setAppsettingsData: (data) => set({ appsettingsData: data }),
  setActiveAppsettingsFile: (file) => set({ activeAppsettingsFile: file }),
  setAppsettingsDirty: (dirty) => set({ appsettingsDirty: dirty }),
  setCsprojContent: (content) => set({ csprojContent: content }),
  setCsprojLoading: (loading) => set({ csprojLoading: loading }),
  toggleExpanded: (projectId) => set((s) => {
    const next = new Set(s.expandedProjects)
    if (next.has(projectId)) next.delete(projectId)
    else next.add(projectId)
    return { expandedProjects: next }
  }),

  activeProject: () => {
    const state = get()
    if (!state.selection) return undefined
    return state.folderProjects.find(p => p.id === state.selection!.projectId)
  },

  activeSubProject: () => {
    const state = get()
    if (!state.selection || state.selection.type !== 'subproject') return undefined
    const project = state.folderProjects.find(p => p.id === state.selection!.projectId)
    if (!project) return undefined
    const sel = state.selection as { type: 'subproject'; projectId: string; subProjectId: string }
    return project.subProjects.find(sp => sp.id === sel.subProjectId)
  }
}))
