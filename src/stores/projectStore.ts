import { create } from 'zustand'
import type { FolderProject, SubProject, SidebarSelection, ViewTab, ProjectGroup } from '@/types'

interface ProjectState {
  folderProjects: FolderProject[]
  groups: ProjectGroup[]
  selection: SidebarSelection
  activeTab: ViewTab
  scanning: boolean
  configData: Record<string, unknown> | null
  activeConfigFile: string | null
  configDirty: boolean
  activeProfile: string | null
  projectFileContent: string | null
  projectFileLoading: boolean
  projectFileDirty: boolean
  expandedProjects: Set<string>

  setFolderProjects: (projects: FolderProject[]) => void
  addFolderProject: (project: FolderProject) => void
  removeFolderProject: (id: string) => void
  updateFolderProject: (id: string, updates: Partial<FolderProject>) => void
  setGroups: (groups: ProjectGroup[]) => void
  addGroup: (group: ProjectGroup) => void
  removeGroup: (id: string) => void
  renameGroup: (id: string, name: string) => void
  setSelection: (selection: SidebarSelection) => void
  setActiveTab: (tab: ViewTab) => void
  setScanning: (scanning: boolean) => void
  setConfigData: (data: Record<string, unknown> | null) => void
  setActiveConfigFile: (file: string | null) => void
  setConfigDirty: (dirty: boolean) => void
  setActiveProfile: (name: string | null) => void
  setProjectFileContent: (content: string | null) => void
  setProjectFileLoading: (loading: boolean) => void
  setProjectFileDirty: (dirty: boolean) => void
  toggleExpanded: (projectId: string) => void

  activeProject: () => FolderProject | undefined
  activeSubProject: () => SubProject | undefined
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  folderProjects: [],
  groups: [],
  selection: null,
  activeTab: 'projectFile',
  scanning: false,
  configData: null,
  activeConfigFile: null,
  configDirty: false,
  activeProfile: null,
  projectFileContent: null,
  projectFileLoading: false,
  projectFileDirty: false,
  expandedProjects: new Set<string>(),

  setFolderProjects: (folderProjects) => set({ folderProjects }),
  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
  removeGroup: (id) => set((s) => ({
    groups: s.groups.filter(g => g.id !== id),
    folderProjects: s.folderProjects.map(p => p.groupId === id ? { ...p, groupId: undefined } : p)
  })),
  renameGroup: (id, name) => set((s) => ({
    groups: s.groups.map(g => g.id === id ? { ...g, name } : g)
  })),
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
    configData: null,
    activeConfigFile: null,
    configDirty: false,
    activeProfile: null,
    projectFileContent: null,
    projectFileDirty: false
  }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setScanning: (scanning) => set({ scanning }),
  setConfigData: (data) => set({ configData: data }),
  setActiveConfigFile: (file) => set({ activeConfigFile: file, activeProfile: null }),
  setConfigDirty: (dirty) => set({ configDirty: dirty }),
  setActiveProfile: (name) => set({ activeProfile: name }),
  setProjectFileContent: (content) => set({ projectFileContent: content }),
  setProjectFileLoading: (loading) => set({ projectFileLoading: loading }),
  setProjectFileDirty: (dirty) => set({ projectFileDirty: dirty }),
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
