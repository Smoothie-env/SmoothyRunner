import type { SubProject, LaunchMode, FolderProject } from '@/types'

export function buildProcessConfig(subProject: SubProject, mode: LaunchMode, project?: FolderProject) {
  return {
    id: subProject.id,
    name: subProject.name,
    projectType: subProject.projectType,
    projectPath: subProject.dirPath,
    projectFilePath: subProject.projectType === 'dotnet' ? subProject.csprojPath
      : subProject.projectType === 'angular' ? subProject.angularJsonPath
      : undefined,
    port: subProject.port,
    mode,
    rootPath: project?.rootPath,
    subProject
  }
}
