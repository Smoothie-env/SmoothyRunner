import fs from 'fs/promises'
import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'

/**
 * Strip JS-style comments from JSON content.
 * .NET appsettings.json files commonly use // and /* comments
 * which standard JSON.parse() cannot handle.
 */
function stripJsonComments(content: string): string {
  let result = ''
  let i = 0
  let inString = false
  let escape = false

  while (i < content.length) {
    const ch = content[i]
    const next = content[i + 1]

    if (inString) {
      result += ch
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      i++
      continue
    }

    // Start of string
    if (ch === '"') {
      inString = true
      result += ch
      i++
      continue
    }

    // Line comment
    if (ch === '/' && next === '/') {
      // Skip until end of line
      i += 2
      while (i < content.length && content[i] !== '\n') i++
      continue
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++
      i += 2 // skip */
      continue
    }

    result += ch
    i++
  }

  return result
}

export class AppsettingsManager {
  private watchers = new Map<string, FSWatcher>()
  private mainWindow: BrowserWindow

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  async read(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(stripJsonComments(content))
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
