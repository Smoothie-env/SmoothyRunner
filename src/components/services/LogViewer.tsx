import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Search, ArrowDown } from 'lucide-react'

interface LogViewerProps {
  processId: string
}

export function LogViewer({ processId }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    setLogs([])

    const unsubscribe = window.smoothyApi.onProcessLog(({ id, data }) => {
      if (id === processId) {
        setLogs(prev => {
          const next = [...prev, data]
          // Keep max 10k entries
          if (next.length > 10000) {
            return next.slice(next.length - 10000)
          }
          return next
        })
      }
    })

    return unsubscribe
  }, [processId])

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }

  const handleClear = () => setLogs([])

  const filteredLogs = searchText
    ? logs.filter(line => line.toLowerCase().includes(searchText.toLowerCase()))
    : logs

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSearch(!showSearch)}>
          <Search className="h-3.5 w-3.5" />
        </Button>
        {showSearch && (
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search logs..."
            className="h-6 text-xs w-[200px]"
            autoFocus
          />
        )}
        <div className="flex-1" />
        {!autoScroll && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAutoScroll(true)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Log output */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-2 font-mono text-xs leading-5 select-text"
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-muted-foreground/30 text-center py-8">
            {logs.length === 0 ? 'No output yet — start the service to see logs' : 'No matches'}
          </div>
        ) : (
          filteredLogs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all hover:bg-accent/20">
              {colorize(line)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Simple ANSI-to-class colorizer for common .NET output patterns
function colorize(text: string): string {
  // Strip ANSI codes for now — full xterm.js can be added later
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}
