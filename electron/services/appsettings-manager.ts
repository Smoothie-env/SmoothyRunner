import fs from 'fs/promises'
import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'

export class AppsettingsManager {
  private watchers = new Map<string, FSWatcher>()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  async read(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  }

  async write(filePath: string, data: unknown): Promise<void> {
    // Temporarily pause watcher to avoid self-triggered notifications
    const watcher = this.watchers.get(filePath)
    if (watcher) {
      await watcher.close()
      this.watchers.delete(filePath)
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

    // Re-enable watcher after a short delay
    if (watcher) {
      setTimeout(() => this.watch(filePath), 500)
    }
  }

  async watch(filePath: string): Promise<void> {
    if (this.watchers.has(filePath)) return

    const watcher = watch(filePath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    watcher.on('change', () => {
      this.mainWindow.webContents.send('appsettings:changed', { filePath })
    })

    this.watchers.set(filePath, watcher)
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
