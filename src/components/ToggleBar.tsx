import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

export interface ToggleOption {
  key: string
  label: string
  title?: string
  active: boolean
}

interface ToggleBarProps {
  label: string
  options: ToggleOption[]
  onToggle: (key: string) => void
  className?: string
}

/** Row of independent on/off buttons in the floating-pill style. */
export function ToggleBar({ label, options, onToggle, className }: ToggleBarProps) {
  const t = useT()
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        'flex items-center gap-0.5 rounded-lg border bg-background/80 p-0.5 backdrop-blur-md',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={option.active}
          title={option.title}
          onClick={() => onToggle(option.key)}
          className={cn(
            'rounded-md px-2.5 py-1 font-mono text-xs transition-colors',
            option.active
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {t(option.label)}
        </button>
      ))}
    </div>
  )
}
