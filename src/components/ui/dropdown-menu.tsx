import { type ReactNode, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface DropdownMenuProps {
  children: ReactNode
}

export function DropdownMenu({ children }: DropdownMenuProps) {
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

  return (
    <div className="relative" ref={ref}>
      {typeof children === 'function'
        ? (children as any)({ open, setOpen })
        : children
      }
    </div>
  )
}

export function DropdownMenuTrigger({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button className={cn('', className)} onClick={onClick}>
      {children}
    </button>
  )
}

export function DropdownMenuContent({ children, open, className }: { children: ReactNode; open?: boolean; className?: string }) {
  if (!open) return null
  return (
    <div className={cn(
      'absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md',
      className
    )}>
      {children}
    </div>
  )
}

export function DropdownMenuItem({ children, onClick, className, destructive }: { children: ReactNode; onClick?: () => void; className?: string; destructive?: boolean }) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent cursor-default',
        destructive && 'text-destructive hover:text-destructive',
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />
}
