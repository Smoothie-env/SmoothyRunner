import type { ProjectType, ProjectTypeHandler } from './project-type-handler'
import { DotnetHandler } from './dotnet-handler'
import { AngularHandler } from './angular-handler'

const handlers: ProjectTypeHandler[] = [
  new DotnetHandler(),
  new AngularHandler()
]

const handlerMap = new Map<ProjectType, ProjectTypeHandler>(
  handlers.map(h => [h.type, h])
)

export function getHandler(type: ProjectType): ProjectTypeHandler {
  const handler = handlerMap.get(type)
  if (!handler) throw new Error(`No handler registered for project type: ${type}`)
  return handler
}

export function getAllHandlers(): ProjectTypeHandler[] {
  return handlers
}
