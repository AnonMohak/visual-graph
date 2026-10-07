import { cn } from '@/lib/utils'

export type GraphMode = 'static' | 'animated'

interface AnimatedModeToggleProps {
  mode: GraphMode
  onChange: (mode: GraphMode) => void
  className?: string
}

export function AnimatedModeToggle({ mode, onChange, className }: AnimatedModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="graph mode"
      className={cn(
        'absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background/80 p-0.5 backdrop-blur-md',
        className
      )}
    >
      {(['static', 'animated'] as const).map((option) => (
        <button
          key={option}
          role="tab"
          aria-selected={mode === option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
            mode === option
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
