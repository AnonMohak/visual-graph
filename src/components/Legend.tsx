import { useState } from 'react'
import { EyeIcon, EyeOffIcon, GripVerticalIcon, PaletteIcon, XIcon } from 'lucide-react'
import { ParamSlider } from '@/components/ParamSlider'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { EquationSpec } from '@/graph/equations'
import { sliderOf } from '@/graph/sliders'
import { useCurveStatus } from '@/graph/store'
import { isComplexKind, type ComplexComponent, type Equation, type LineDash } from '@/graph/types'
import { CHART_CLASSES, swatchClass, swatchStyle } from '@/lib/chart'
import { cn } from '@/lib/utils'

export type SpecPatch = Partial<Omit<EquationSpec, 'id'>>

interface LegendProps {
  equations: Equation[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  /** Set a slider constant to a new value. */
  onSetConst?: (id: string, value: number) => void
  /** Change text or style of one equation. */
  onUpdate?: (id: string, patch: SpecPatch) => void
  /** Move the equation `id` to the position of `targetId`. */
  onMove?: (id: string, targetId: string) => void
  className?: string
  /** Live global sampler props — badges reflect these, not stale per-equation defaults. */
  sigma?: number
  component?: ComplexComponent
}

const DASHES: LineDash[] = ['solid', 'dashed', 'dotted']

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={label} onClick={onClick} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function StylePanel({ equation, onUpdate }: { equation: Equation; onUpdate: (patch: SpecPatch) => void }) {
  return (
    <div className="flex flex-col gap-1.5 py-1 pl-[1.1rem] text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1">
        {CHART_CLASSES.map((cls, token) => (
          <button
            key={cls}
            type="button"
            aria-label={`color ${token + 1}`}
            aria-pressed={!equation.color && equation.colorToken === token}
            onClick={() => onUpdate({ colorToken: token, color: undefined })}
            className={cn(
              'size-4 rounded-full border-2',
              cls,
              !equation.color && equation.colorToken === token ? 'border-foreground' : 'border-transparent'
            )}
          />
        ))}
        <input
          type="color"
          aria-label="custom color"
          value={equation.color ?? '#888888'}
          onChange={(event) => onUpdate({ color: event.target.value })}
          className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </div>
      <div className="flex items-center gap-1">
        {DASHES.map((dash) => (
          <button
            key={dash}
            type="button"
            aria-pressed={(equation.dash ?? 'solid') === dash}
            onClick={() => onUpdate({ dash: dash === 'solid' ? undefined : dash })}
            className={cn(
              'rounded px-1.5 py-0.5 font-mono',
              (equation.dash ?? 'solid') === dash ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            {dash}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5">
        width
        <input
          type="range"
          min={1}
          max={6}
          step={0.5}
          value={equation.lineWidth ?? 2}
          aria-label="line width"
          onChange={(event) => onUpdate({ lineWidth: Number(event.target.value) })}
          className="h-5 flex-1 accent-primary"
        />
        <span className="w-6 font-mono tabular-nums">{equation.lineWidth ?? 2}</span>
      </label>
    </div>
  )
}

export function Legend({
  equations,
  onToggle,
  onDelete,
  onSetConst,
  onUpdate,
  onMove,
  className,
  sigma = 0.5,
  component = 're',
}: LegendProps) {
  const status = useCurveStatus()
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [styling, setStyling] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  if (equations.length === 0) return null

  const commitEdit = () => {
    if (editing && editing.text.trim()) onUpdate?.(editing.id, { raw: editing.text.trim() })
    setEditing(null)
  }

  return (
    <div
      className={cn(
        'absolute right-3 top-3 z-10 flex w-64 flex-col rounded-lg border bg-background/80 backdrop-blur-md',
        className
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <span>curves</span>
        <span className="font-mono tabular-nums">{equations.length}</span>
      </div>
      <Separator />
      <ScrollArea className="max-h-[45vh]">
        <ul className="flex flex-col gap-0.5 p-1">
          {equations.map((equation) => {
            const hasPoints = status[equation.id]
            const slider = sliderOf(equation.raw)
            const isEditing = editing?.id === equation.id
            return (
              <li
                key={equation.id}
                draggable={Boolean(onMove) && !isEditing}
                onDragStart={(event) => {
                  setDragId(equation.id)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  if (dragId && dragId !== equation.id) event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragId && dragId !== equation.id) onMove?.(dragId, equation.id)
                  setDragId(null)
                }}
                onDragEnd={() => setDragId(null)}
                className={cn(
                  'flex flex-col rounded-md px-1.5 py-1 transition-colors hover:bg-muted/50',
                  !equation.visible && 'opacity-50',
                  dragId === equation.id && 'opacity-40'
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {onMove && <GripVerticalIcon className="-mx-1 size-3 shrink-0 cursor-grab text-muted-foreground/60" />}
                  <span
                    className={cn('size-2.5 shrink-0 rounded-full', swatchClass(equation))}
                    style={swatchStyle(equation)}
                  />
                  {isEditing ? (
                    <input
                      autoFocus
                      aria-label="edit equation"
                      value={editing.text}
                      onChange={(event) => setEditing({ id: equation.id, text: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitEdit()
                        else if (event.key === 'Escape') setEditing(null)
                      }}
                      onBlur={commitEdit}
                      className="h-6 min-w-0 flex-1 rounded border bg-background px-1 font-mono text-xs"
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-mono text-xs"
                      title={`${equation.raw} — double-click to edit`}
                      onDoubleClick={() => onUpdate && setEditing({ id: equation.id, text: equation.raw })}
                    >
                      {equation.raw}
                    </button>
                  )}
                  {onUpdate && equation.plot && (
                    <IconButton label="style" onClick={() => setStyling((prev) => (prev === equation.id ? null : equation.id))}>
                      <PaletteIcon data-icon="inline-start" />
                    </IconButton>
                  )}
                  <IconButton label={equation.visible ? 'hide' : 'show'} onClick={() => onToggle(equation.id)}>
                    {equation.visible ? <EyeIcon data-icon="inline-start" /> : <EyeOffIcon data-icon="inline-start" />}
                  </IconButton>
                  <IconButton label="delete" onClick={() => onDelete(equation.id)}>
                    <XIcon data-icon="inline-start" />
                  </IconButton>
                </div>
                {styling === equation.id && onUpdate && (
                  <StylePanel equation={equation} onUpdate={(patch) => onUpdate(equation.id, patch)} />
                )}
                <div className="flex flex-wrap gap-1 pl-[1.1rem] pt-0.5">
                  {isComplexKind(equation.kind) && (
                    <>
                      <span className="rounded border border-primary/30 px-1 font-mono text-[10px] text-primary">
                        {equation.kind === 'complex-param' ? 'param' : component}
                      </span>
                      <span className="rounded border px-1 font-mono text-[10px] text-muted-foreground">
                        σ={sigma}
                      </span>
                    </>
                  )}
                </div>
                {slider && onSetConst && (
                  <ParamSlider
                    name={slider.name}
                    value={slider.value}
                    onChange={(value) => onSetConst(equation.id, value)}
                  />
                )}
                {equation.error && (
                  <span className="pl-[1.1rem] text-[11px] text-destructive">{equation.error}</span>
                )}
                {hasPoints === false && equation.visible && equation.plot && (
                  <span className="pl-[1.1rem] text-[11px] text-muted-foreground">
                    no real points in view
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
