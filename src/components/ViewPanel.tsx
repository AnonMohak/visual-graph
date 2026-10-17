import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AngleUnit, Palette, ViewSettings } from '@/graph/view'
import { cn } from '@/lib/utils'

interface ViewPanelProps {
  view: ViewSettings
  onChange: (patch: Partial<ViewSettings>) => void
  onClose: () => void
  className?: string
}

const fieldClass = 'h-6 w-full rounded border bg-background px-1 font-mono text-xs text-foreground'

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-primary" />
      {label}
    </label>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[11px]',
              value === option.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Grid, axes, labels, scales, angle unit and palette settings. */
export function ViewPanel({ view, onChange, onClose, className }: ViewPanelProps) {
  return (
    <div
      className={cn(
        'absolute left-1/2 top-[172px] z-20 flex w-64 -translate-x-1/2 flex-col gap-2 rounded-lg border bg-background/95 p-2.5 text-xs text-muted-foreground backdrop-blur-md',
        className
      )}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span>view</span>
        <Button variant="ghost" size="icon-xs" aria-label="close view settings" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Check label="grid" checked={view.grid} onChange={(grid) => onChange({ grid })} />
        <Check label="axes" checked={view.axes} onChange={(axes) => onChange({ axes })} />
        <Check label="log x" checked={view.logX} onChange={(logX) => onChange({ logX })} />
        <Check label="log y" checked={view.logY} onChange={(logY) => onChange({ logY })} />
        <Check label="equal aspect" checked={view.equalAspect} onChange={(equalAspect) => onChange({ equalAspect })} />
      </div>
      {!view.equalAspect && (
        <span className="text-[10px]">Shift+wheel zooms y, Alt+wheel zooms x, f fits y.</span>
      )}
      <label className="flex items-center gap-2">
        grid step
        <input
          aria-label="grid step"
          placeholder="auto"
          defaultValue={view.gridStep ?? ''}
          onChange={(event) => {
            const step = Number(event.target.value)
            onChange({ gridStep: event.target.value.trim() && Number.isFinite(step) && step > 0 ? step : null })
          }}
          className={fieldClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-1">
        <label>
          x label
          <input aria-label="x axis label" value={view.xLabel} onChange={(e) => onChange({ xLabel: e.target.value })} className={fieldClass} />
        </label>
        <label>
          y label
          <input aria-label="y axis label" value={view.yLabel} onChange={(e) => onChange({ yLabel: e.target.value })} className={fieldClass} />
        </label>
      </div>
      <Segmented<AngleUnit>
        label="angles"
        value={view.angle}
        options={[
          { value: 'rad', label: 'rad' },
          { value: 'deg', label: 'deg' },
        ]}
        onChange={(angle) => onChange({ angle })}
      />
      <Segmented<Palette>
        label="palette"
        value={view.palette}
        options={[
          { value: 'default', label: 'default' },
          { value: 'contrast', label: 'contrast' },
          { value: 'colorblind', label: 'cb-safe' },
        ]}
        onChange={(palette) => onChange({ palette })}
      />
    </div>
  )
}
