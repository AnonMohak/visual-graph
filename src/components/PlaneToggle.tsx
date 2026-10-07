import { cn } from '@/lib/utils'
import type { Plane } from '@/graph/types'

interface PlaneToggleProps {
  plane: Plane
  onChange: (plane: Plane) => void
  className?: string
}

const OPTIONS: { value: Plane; label: string; title: string }[] = [
  { value: 'xy', label: 'xy', title: 'standard y = f(x)' },
  { value: 'st', label: 'σ-t', title: 'complex domain field (σ + i t)' },
  { value: 'reim', label: 'Re-Im', title: 'parametric output at fixed σ' },
]

export function PlaneToggle({ plane, onChange, className }: PlaneToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="complex plane"
      className={cn(
        'absolute left-1/2 top-[52px] z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background/80 p-0.5 backdrop-blur-md',
        className
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={plane === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1 font-mono text-xs transition-colors',
            plane === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
