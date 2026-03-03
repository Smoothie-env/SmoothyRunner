import { useProjectStore } from '@/stores/projectStore'
import { useCsprojContent } from '@/hooks/useCsprojContent'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Copy, RefreshCw, FileCode } from 'lucide-react'
import { useState } from 'react'

function highlightXml(xml: string): JSX.Element[] {
  const lines = xml.split('\n')
  return lines.map((line, i) => {
    // Apply regex-based highlighting
    const highlighted = line
      // XML comments
      .replace(/(<!--.*?-->)/g, '<span class="text-zinc-500">$1</span>')
      // Tag names
      .replace(/(&lt;\/?)([\w.:]+)/g, '$1<span class="text-blue-400">$2</span>')
      .replace(/(<\/?)([\w.:]+)/g, '$1<span class="text-blue-400">$2</span>')
      // Attribute values (strings in quotes)
      .replace(/(".*?")/g, '<span class="text-green-400">$1</span>')
      // Attribute names
      .replace(/\s([\w:]+)=/g, ' <span class="text-purple-400">$1</span>=')

    return (
      <div key={i} className="flex">
        <span className="inline-block w-8 text-right mr-3 text-zinc-600 select-none text-[11px]">{i + 1}</span>
        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    )
  })
}

export function CsprojViewer() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const csprojContent = useProjectStore(s => s.csprojContent)
  const csprojLoading = useProjectStore(s => s.csprojLoading)
  const setCsprojContent = useProjectStore(s => s.setCsprojContent)
  const setCsprojLoading = useProjectStore(s => s.setCsprojLoading)
  const [copied, setCopied] = useState(false)

  useCsprojContent()

  const handleCopy = async () => {
    if (!csprojContent) return
    await navigator.clipboard.writeText(csprojContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = async () => {
    if (!subProject) return
    setCsprojLoading(true)
    try {
      const content = await window.sparkApi.readFileContent(subProject.csprojPath)
      setCsprojContent(content)
    } catch (err) {
      console.error('Failed to reload csproj:', err)
    } finally {
      setCsprojLoading(false)
    }
  }

  if (!subProject) return null

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <FileCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground truncate flex-1">{subProject.csprojPath.split('/').pop()}</span>
        <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh" className="h-7 w-7">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy" className="h-7 w-7">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {copied && <span className="text-xs text-green-400">Copied</span>}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {csprojLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : csprojContent ? (
          <pre className="px-4 py-3 text-xs font-mono leading-5 whitespace-pre">
            {highlightXml(csprojContent)}
          </pre>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Failed to load file</p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
