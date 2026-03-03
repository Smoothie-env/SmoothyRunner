import { useProjectStore } from '@/stores/projectStore'
import { useCsprojContent } from '@/hooks/useCsprojContent'
import { Button } from '@/components/ui/button'
import { Copy, RefreshCw, FileCode, Save } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

export function CsprojViewer() {
  const subProject = useProjectStore(s => s.activeSubProject())
  const csprojContent = useProjectStore(s => s.csprojContent)
  const csprojLoading = useProjectStore(s => s.csprojLoading)
  const csprojDirty = useProjectStore(s => s.csprojDirty)
  const setCsprojContent = useProjectStore(s => s.setCsprojContent)
  const setCsprojLoading = useProjectStore(s => s.setCsprojLoading)
  const setCsprojDirty = useProjectStore(s => s.setCsprojDirty)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const loadedContentRef = useRef<string>('')

  useCsprojContent()

  const getEditorContent = useCallback((): string => {
    if (!viewRef.current) return ''
    return viewRef.current.state.doc.toString()
  }, [])

  const handleSave = useCallback(async () => {
    if (!subProject || !csprojDirty) return
    const content = getEditorContent()
    setSaving(true)
    try {
      await window.smoothyApi.writeFileContent(subProject.csprojPath, content)
      loadedContentRef.current = content
      setCsprojDirty(false)
      setCsprojContent(content)
    } catch (err) {
      console.error('Failed to save csproj:', err)
    } finally {
      setSaving(false)
    }
  }, [subProject, csprojDirty, getEditorContent, setCsprojDirty, setCsprojContent])

  const handleCopy = async () => {
    const content = getEditorContent()
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = async () => {
    if (!subProject) return
    setCsprojLoading(true)
    try {
      const content = await window.smoothyApi.readFileContent(subProject.csprojPath)
      setCsprojContent(content)
      setCsprojDirty(false)
      loadedContentRef.current = content
      if (viewRef.current) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: content
          }
        })
      }
    } catch (err) {
      console.error('Failed to reload csproj:', err)
    } finally {
      setCsprojLoading(false)
    }
  }

  // Create/update CodeMirror editor when content loads
  useEffect(() => {
    if (!editorRef.current || csprojContent === null || csprojLoading) return

    loadedContentRef.current = csprojContent

    // If editor already exists, replace its content
    if (viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString()
      if (currentDoc !== csprojContent) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: csprojContent
          }
        })
      }
      setCsprojDirty(false)
      return
    }

    const saveBinding = keymap.of([{
      key: 'Mod-s',
      run: () => {
        handleSave()
        return true
      }
    }])

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newContent = update.state.doc.toString()
        const isDirty = newContent !== loadedContentRef.current
        setCsprojDirty(isDirty)
      }
    })

    const state = EditorState.create({
      doc: csprojContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        foldGutter(),
        highlightSelectionMatches(),
        xml(),
        oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        saveBinding,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap
        ]),
        updateListener,
        EditorView.theme({
          '&': { height: '100%', fontSize: '12px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace' },
          '.cm-content': { padding: '8px 0' },
          '.cm-gutters': { minWidth: '40px' }
        })
      ]
    })

    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [csprojContent, csprojLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!subProject) return null

  const fileName = subProject.csprojPath.split('/').pop() ?? subProject.csprojPath.split('\\').pop()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <FileCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground truncate">{fileName}</span>
        {csprojDirty && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
            Unsaved
          </span>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          disabled={!csprojDirty || saving}
          title="Save (Ctrl+S)"
          className="h-7 w-7"
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh" className="h-7 w-7">
          <RefreshCw className={`h-3.5 w-3.5 ${csprojLoading ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy" className="h-7 w-7">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {copied && <span className="text-xs text-green-400">Copied</span>}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {csprojLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : csprojContent !== null ? (
          <div ref={editorRef} className="h-full" />
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Failed to load file</p>
          </div>
        )}
      </div>
    </div>
  )
}
