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
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm hover:bg-accent"
        onClick={() => setOpen(!open)}
      >
        <span className={value ? '' : 'text-muted-foreground'}>{selectedLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
          {items.map(item => (
            <button
              key={item.value}
              className={cn(
                'flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-default',
                item.value === value && 'bg-accent'
              )}
              onClick={() => {
                onValueChange(item.value)
                setOpen(false)
              }}
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
