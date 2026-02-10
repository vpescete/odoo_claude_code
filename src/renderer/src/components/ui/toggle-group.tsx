import * as React from 'react'
import { cn } from '@/lib/utils'

interface ToggleGroupProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}

const ToggleGroupContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
}>({ value: '', onValueChange: () => {} })

function ToggleGroup({ value, onValueChange, className, children }: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange }}>
      <div
        data-slot="toggle-group"
        className={cn(
          'bg-muted text-muted-foreground inline-flex items-center gap-0.5 rounded-lg p-0.5',
          className
        )}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}

interface ToggleGroupItemProps {
  value: string
  className?: string
  children: React.ReactNode
  'aria-label'?: string
}

function ToggleGroupItem({ value, className, children, ...props }: ToggleGroupItemProps) {
  const ctx = React.useContext(ToggleGroupContext)
  const isActive = ctx.value === value

  return (
    <button
      data-slot="toggle-group-item"
      data-state={isActive ? 'on' : 'off'}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'hover:bg-muted hover:text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { ToggleGroup, ToggleGroupItem }
