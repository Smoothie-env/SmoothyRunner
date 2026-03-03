import { Sidebar } from '@/components/layout/Sidebar'
import { MainPanel } from '@/components/layout/MainPanel'
import { StatusBar } from '@/components/layout/StatusBar'
import { useProjects } from '@/hooks/useProjects'
import { useProcessPolling } from '@/hooks/useProcess'

export default function App() {
  useProjects()
  useProcessPolling()

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <MainPanel />
      </div>
      <StatusBar />
    </div>
  )
}
