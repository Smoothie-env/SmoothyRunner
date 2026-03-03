import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  className?: string
}

export function Collapsible({ open: controlledOpen, defaultOpen = false, onOpenChange, children, className }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen

  const toggle = () => {
    const next = !isOpen
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div className={className} data-state={isOpen ? 'open' : 'closed'}>
      {typeof children === 'function' ? (children as any)({ isOpen, toggle }) : children}
    </div>
  )
}

interface CollapsibleTriggerProps {
  children: ReactNode
  className?: string
  isOpen?: boolean
  onClick?: () => void
}

export function CollapsibleTrigger({ children, className, isOpen, onClick }: CollapsibleTriggerProps) {
  return (
    <button
      className={cn('flex items-center gap-1 w-full text-left', className)}
      onClick={onClick}
    >
      <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} />
      {children}
    </button>
  )
}

export function CollapsibleContent({ children, isOpen, className }: { children: ReactNode; isOpen?: boolean; className?: string }) {
  if (!isOpen) return null
  return <div className={cn('', className)}>{children}</div>
}
