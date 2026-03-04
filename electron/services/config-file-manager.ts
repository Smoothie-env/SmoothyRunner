import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { getHandler } from './project-types/registry'
import type { ProjectType } from './project-types/project-type-handler'

export class ConfigFileManager {
  private watchers = new Map<string, FSWatcher>()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  async read(filePath: string, projectType: ProjectType): Promise<unknown> {
    const handler = getHandler(projectType)
    return handler.getConfigFileHandler().read(filePath)
  }

  async write(filePath: string, data: unknown, projectType: ProjectType): Promise<void> {
    // Temporarily pause watcher to avoid self-triggered notifications
    const watcher = this.watchers.get(filePath)
    if (watcher) {
      await watcher.close()
      this.watchers.delete(filePath)
    }

    const handler = getHandler(projectType)
    await handler.getConfigFileHandler().write(filePath, data as Record<string, unknown>)

    // Re-enable watcher after a short delay
    if (watcher) {
      setTimeout(() => this.watch(filePath), 500)
    }
  }

  async watch(filePath: string): Promise<void> {
    if (this.watchers.has(filePath)) return

    const fsWatcher = watch(filePath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    fsWatcher.on('change', () => {
      this.mainWindow.webContents.send('config:changed', { filePath })
    })

    this.watchers.set(filePath, fsWatcher)
  }

  async unwatch(filePath: string): Promise<void> {
    const watcher = this.watchers.get(filePath)
    if (watcher) {
      await watcher.close()
      this.watchers.delete(filePath)
    }
  }

  destroy(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
  }
}
