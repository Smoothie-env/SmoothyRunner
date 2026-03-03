# Spark Project Manager

Desktop tool for managing .NET microservice projects — folder-based project tree, appsettings editor, service runner, Docker Compose control, and git worktree switching.

## Stack

- **Electron 33** + **electron-vite 3**
- **React 19** + **TypeScript 5.7**
- **Zustand 5** — state management
- **Tailwind CSS 4** — styling
- **xterm.js** — terminal/log viewer
- **fast-xml-parser** — .csproj parsing
- **chokidar** — file watching

## Architecture

```
spark-project-manager/
├── electron/               # Main process
│   ├── main.ts             # App entry, window creation
│   ├── preload.ts          # Context bridge (sparkApi)
│   ├── ipc/
│   │   └── registry.ts     # IPC handler registration
│   └── services/
│       ├── project-scanner.ts   # Folder scanning, .csproj discovery
│       ├── config-manager.ts    # Persistent config (~/.spark-project-manager/)
│       ├── profile-manager.ts   # Appsettings profile save/apply
│       ├── appsettings-manager.ts
│       ├── process-manager.ts   # dotnet watch run
│       ├── docker-manager.ts    # docker compose commands
│       └── git-manager.ts       # git branch/worktree operations
├── src/                    # Renderer process
│   ├── types/index.ts      # FolderProject, SubProject, SidebarSelection
│   ├── stores/
│   │   ├── projectStore.ts # Folder projects, selection, csproj content
│   │   └── processStore.ts # Running processes, docker containers
│   ├── hooks/
│   │   ├── useProjects.ts      # Load projects on mount
│   │   └── useCsprojContent.ts # Load .csproj XML for active sub-project
│   └── components/
│       ├── layout/         # Sidebar, MainPanel, StatusBar
│       ├── projects/       # ProjectExplorer, FolderProjectNode, SubProjectNode, AddProjectDialog, CsprojViewer
│       ├── appsettings/    # SettingsTree, SettingsNode, ProfileSelector, ProfileEditor
│       ├── services/       # ServicePanel, ServiceControls, LogViewer
│       ├── docker/         # DockerPanel, ServiceStatus
│       ├── worktree/       # WorktreeSelector
│       └── ui/             # Button, Badge, Dialog, Select, ScrollArea, Tabs, etc.
└── out/                    # Build output (gitignored)
```

### Data Model

**FolderProject** — a directory added by the user (e.g. `Raiser_Application/`). Contains:
- **SubProject[]** — each `.csproj` found inside, classified as `runnable` (has Program.cs) or `library`
- Docker Compose info, solution file, git branch, active worktree path

SubProjects are **not persisted** — they are rescanned on each app load. Only folder-level config is saved to `~/.spark-project-manager/spark-projects.json`.

## Commands

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Build distributable (macOS/Windows/Linux)
npx electron-builder build
```

## Config

Persisted at `~/.spark-project-manager/spark-projects.json`:

```json
{
  "folderProjects": [
    {
      "id": "abc123",
      "name": "Raiser_Application",
      "rootPath": "/Users/user/Volo/Git/Raiser_Application",
      "originalRootPath": "/Users/user/Volo/Git/Raiser_Application",
      "hasDockerCompose": false
    }
  ],
  "profiles": {}
}
```

Automatic migration from the old flat `projects[]` format is supported.

## Usage

1. Launch the app (`npm run dev`)
2. Click **"+"** in the sidebar → select a folder containing .csproj files
3. The folder appears in the sidebar as a tree with all discovered sub-projects
4. Click a sub-project to view its `.csproj` XML, appsettings editor, or run it
5. Use the worktree dropdown on a folder node to switch between git worktrees
