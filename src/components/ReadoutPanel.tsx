import { useState } from 'react'
import { complex as mathComplex } from 'mathjs'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { resultToC } from '@/graph/complex'
import { useReadout } from '@/graph/store'
import type { ComplexComponent, Equation, Plane } from '@/graph/types'
import { formatNumber } from '@/graph/viewport'
import { CHART_CLASSES } from '@/lib/chart'
import { cn } from '@/lib/utils'

interface ReadoutPanelProps {
  equations: Equation[]
  snapX: number | null
  onSnapXChange: (value: number | null) => void
  getStepSize?: () => number
  className?: string
  plane?: Plane
  sigma?: number
  component?: ComplexComponent
}

function parseSnap(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function toInputValue(value: number): string {
  return String(Number(value.toPrecision(12)))
}

function formatValue(value: number | null): string {
  return value === null ? '—' : formatNumber(value, 4)
}

function ReadoutRow({
  equation,
  value,
  accent = false,
}: {
  equation: Equation
  value: number | null
  accent?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <span className={cn('size-2 shrink-0 rounded-full', CHART_CLASSES[equation.colorToken % 5])} />
      <span className={cn('min-w-0 flex-1 truncate', !equation.visible && 'text-muted-foreground')}>
        {equation.raw}
      </span>
      <span
        className={cn(
          'w-20 shrink-0 text-right font-mono tabular-nums',
          accent ? 'text-graph-accent' : 'text-foreground',
          value === null && 'text-muted-foreground'
        )}
      >
        {formatValue(value)}
      </span>
    </div>
  )
}

function complexDetails(
  equation: Equation,
  sigma: number,
  t: number
): { re: number | null; im: number | null; abs: number | null; arg: number | null } {
  if (!equation.evaluateComplex) return { re: null, im: null, abs: null, arg: null }
  try {
    const v = equation.evaluateComplex(mathComplex(sigma, t))
    const c = resultToC(v)
    if (!c) return { re: null, im: null, abs: null, arg: null }
    return { re: c.re, im: c.im, abs: Math.hypot(c.re, c.im), arg: Math.atan2(c.im, c.re) }
  } catch {
    return { re: null, im: null, abs: null, arg: null }
  }
}

export function ReadoutPanel({
  equations,
  snapX,
  onSnapXChange,
  getStepSize,
  className,
  plane = 'xy',
  sigma = 0.5,
  component: _component = 're',
}: ReadoutPanelProps) {
  void _component
  const { hoverX, hoverY, hoverZ } = useReadout()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const committed = snapX === null ? '' : toInputValue(snapX)
  const text = editing ? draft : committed
  const hasHover = hoverX !== null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const step = getStepSize?.() ?? 1
    const base = parseSnap(text) ?? 0
    const next = Number((Math.round(base / step + direction) * step).toPrecision(12))
    setDraft(toInputValue(next))
    onSnapXChange(next)
  }

  // --- st plane: sigma + i t + zeta ---
  if (plane === 'st') {
    const s = hoverZ ?? (hoverX != null && hoverY != null ? { re: hoverX, im: hoverY } : null)
    return (
      <div
        className={cn(
          'absolute left-3 top-3 z-10 flex w-64 flex-col gap-2 rounded-lg border bg-background/80 p-2 backdrop-blur-md',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">s = σ + i t</span>
          <span className="font-mono tabular-nums text-muted-foreground">
            {s ? `${formatNumber(s.re, 3)}+${formatNumber(s.im, 3)}i` : '—'}
          </span>
        </div>
        {equations.length === 0 && <div className="text-xs text-muted-foreground/70">field: ζ(s)</div>}
        {equations.map((equation) => {
          if (equation.kind === 'real' || !s) {
            return <ReadoutRow key={equation.id} equation={equation} value={null} />
          }
          const d = complexDetails(equation, s.re, s.im)
          return (
            <div key={equation.id} className="flex flex-col gap-0.5 text-xs">
              <ReadoutRow equation={equation} value={d.re} />
              <div className="pl-4 font-mono text-[11px] text-muted-foreground">
                im {formatValue(d.im)} · |.| {formatValue(d.abs)} · arg {formatValue(d.arg)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // --- reim plane: Re, Im at t ---
  if (plane === 'reim') {
    const t = hoverX ?? snapX ?? 0
    return (
      <div
        className={cn(
          'absolute left-3 top-3 z-10 flex w-64 flex-col gap-2 rounded-lg border bg-background/80 p-2 backdrop-blur-md',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">t at σ={formatNumber(sigma, 3)}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{formatNumber(t, 4)}</span>
        </div>
        {equations.map((equation) => {
          const d = complexDetails(equation, sigma, t)
          return (
            <div key={equation.id} className="flex flex-col gap-0.5 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', CHART_CLASSES[equation.colorToken % 5])} />
                <span className="min-w-0 flex-1 truncate">{equation.raw}</span>
              </div>
              <div className="pl-4 font-mono text-[11px]">
                Re {formatValue(d.re)} · Im {formatValue(d.im)}
              </div>
            </div>
          )
        })}
        {equations.length === 0 && <div className="text-xs text-muted-foreground/70">no equations yet</div>}
      </div>
    )
  }

  // --- xy plane (+ slices): y(x), slice shows t,Re,Im,|.|,arg ---
  const hoverLabel = hasHover ? `x=${formatNumber(hoverX, 4)}` : '—'
  const anyComplex = equations.some((e) => e.kind !== 'real')

  return (
    <div
      className={cn(
        'absolute left-3 top-3 z-10 flex w-64 flex-col gap-2 rounded-lg border bg-background/80 p-2 backdrop-blur-md',
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">{anyComplex ? 't' : 'hover'}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{hoverLabel}</span>
        </div>
        {equations.length === 0 ? (
          <div className="text-xs text-muted-foreground/70">no equations yet</div>
        ) : (
          equations.map((equation) => {
            if (equation.kind === 'real') {
              return (
                <ReadoutRow
                  key={equation.id}
                  equation={equation}
                  value={hasHover ? equation.evaluate(hoverX) : null}
                />
              )
            }
            if (!hasHover) return <ReadoutRow key={equation.id} equation={equation} value={null} />
            const d = complexDetails(equation, sigma, hoverX)
            return (
              <div key={equation.id} className="flex flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <span className={cn('size-2 shrink-0 rounded-full', CHART_CLASSES[equation.colorToken % 5])} />
                  <span className="min-w-0 flex-1 truncate">{equation.raw}</span>
                  <span className="font-mono text-[11px]">t={formatNumber(hoverX, 3)}</span>
                </div>
                <div className="pl-4 font-mono text-[11px] text-muted-foreground">
                  Re {formatValue(d.re)} · Im {formatValue(d.im)} · |.| {formatValue(d.abs)} · arg{' '}
                  {formatValue(d.arg)}
                </div>
              </div>
            )
          })
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">snap</span>
          <InputGroup className="h-6 w-28">
            <InputGroupAddon align="inline-start" className="text-graph-accent">
              x=
            </InputGroupAddon>
            <InputGroupInput
              data-snap-input=""
              value={text}
              onChange={(event) => {
                setDraft(event.target.value)
                onSnapXChange(parseSnap(event.target.value))
              }}
              onFocus={() => {
                setEditing(true)
                setDraft(committed)
              }}
              onBlur={() => {
                setEditing(false)
                if (parseSnap(text) === null) {
                  setDraft('')
                  onSnapXChange(null)
                }
              }}
              onKeyDown={handleKeyDown}
              inputMode="decimal"
              placeholder="0"
              aria-label="snap x position"
              className="h-6 font-mono text-xs caret-graph-accent"
            />
          </InputGroup>
        </div>
        {snapX !== null &&
          equations.map((equation) => {
            if (equation.kind === 'real') {
              return (
                <ReadoutRow key={equation.id} equation={equation} value={equation.evaluate(snapX)} accent />
              )
            }
            const d = complexDetails(equation, sigma, snapX)
            return (
              <div key={equation.id} className="pl-1 font-mono text-[11px] text-graph-accent">
                Re {formatValue(d.re)} · Im {formatValue(d.im)}
              </div>
            )
          })}
      </div>
    </div>
  )
}
