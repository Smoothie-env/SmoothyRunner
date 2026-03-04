import { type ReactNode, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  placeholder?: string
  className?: string
}

export function Select({ value, onValueChange, children, placeholder, className }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Extract labels from children
  let selectedLabel = placeholder || 'Select...'
  const items: { value: string; label: string }[] = []

  const extractItems = (nodes: ReactNode) => {
    if (!nodes) return
    const arr = Array.isArray(nodes) ? nodes : [nodes]
    for (const child of arr) {
      if (child && typeof child === 'object' && 'props' in child) {
        if (child.props.value !== undefined) {
          items.push({ value: child.props.value, label: child.props.children as string })
          if (child.props.value === value) {
            selectedLabel = child.props.children as string
          }
        }
        if (child.props.children) {
          extractItems(child.props.children)
        }
      }
    }
  }
  extractItems(children)

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        className="flex h-7 w-full items-center justify-between gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm hover:bg-accent overflow-hidden"
        onClick={() => setOpen(!open)}
        title={selectedLabel}
      >
        <span className={cn('truncate min-w-0', !value && 'text-muted-foreground')}>{selectedLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-max max-w-[280px] rounded-md border bg-popover p-1 shadow-md">
          {items.map(item => (
            <button
              key={item.value}
              className={cn(
                'flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-default truncate',
                item.value === value && 'bg-accent'
              )}
              onClick={() => {
                onValueChange(item.value)
                setOpen(false)
              }}
              title={item.label}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  return null // Consumed by parent Select
}
