import type { Equation } from './types'

export type AngleUnit = 'rad' | 'deg'
export type Palette = 'default' | 'contrast' | 'colorblind'

export interface ViewSettings {
  grid: boolean
  axes: boolean
  /** Axis titles; empty uses the plane's default (x/y, t, σ, Re/Im). */
  xLabel: string
  yLabel: string
  /** Major grid spacing in world units; null picks one from the zoom level. */
  gridStep: number | null
  equalAspect: boolean
  logX: boolean
  logY: boolean
  angle: AngleUnit
  palette: Palette
}

export const DEFAULT_VIEW: ViewSettings = {
  grid: true,
  axes: true,
  xLabel: '',
  yLabel: '',
  gridStep: null,
  equalAspect: true,
  logX: false,
  logY: false,
  angle: 'rad',
  palette: 'default',
}

const STORAGE_KEY = 'graph.view.v1'

/** Fill missing or invalid fields of untrusted settings with defaults. */
export function sanitizeView(raw: unknown): ViewSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VIEW }
  const r = raw as Record<string, unknown>
  const bool = (key: keyof ViewSettings) =>
    typeof r[key] === 'boolean' ? (r[key] as boolean) : (DEFAULT_VIEW[key] as boolean)
  const text = (key: 'xLabel' | 'yLabel') => (typeof r[key] === 'string' ? (r[key] as string).slice(0, 40) : '')
  const step = Number(r.gridStep)
  return {
    grid: bool('grid'),
    axes: bool('axes'),
    xLabel: text('xLabel'),
    yLabel: text('yLabel'),
    gridStep: r.gridStep !== null && Number.isFinite(step) && step > 0 ? step : null,
    equalAspect: bool('equalAspect'),
    logX: bool('logX'),
    logY: bool('logY'),
    angle: r.angle === 'deg' ? 'deg' : 'rad',
    palette: r.palette === 'contrast' || r.palette === 'colorblind' ? r.palette : 'default',
  }
}

export function loadView(): ViewSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? sanitizeView(JSON.parse(stored)) : { ...DEFAULT_VIEW }
  } catch {
    return { ...DEFAULT_VIEW }
  }
}

export function saveView(view: ViewSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view))
  } catch {
    // Storage unavailable — settings stay for this session only.
  }
}

/** Plot coordinate for a data value on a log axis (null for values <= 0). */
export function toLog(value: number): number | null {
  return value > 0 ? Math.log10(value) : null
}

/**
 * Wrap an equation so it plots in log space: the canvas works in
 * u = log10(x) and/or v = log10(y), and tick labels show 10^u.
 * Complex equations are left unchanged.
 */
export function transformForAxes(eq: Equation, logX: boolean, logY: boolean): Equation {
  if (!logX && !logY) return eq
  const fromX = (u: number) => (logX ? 10 ** u : u)
  const fromY = (v: number) => (logY ? 10 ** v : v)
  const toX = (x: number) => (logX ? toLog(x) : x)
  const toY = (y: number) => (logY ? toLog(y) : y)
  const rev = `${eq.rev}|log${Number(logX)}${Number(logY)}`
  if (eq.evaluateXY) {
    const f = eq.evaluateXY
    return { ...eq, rev, evaluateXY: (u, v) => f(fromX(u), fromY(v)) }
  }
  if (eq.points) {
    const points: [number, number][] = []
    for (const [x, y] of eq.points) {
      const u = toX(x)
      const v = toY(y)
      if (u !== null && v !== null) points.push([u, v])
    }
    return { ...eq, rev, points }
  }
  if (eq.evaluatePoint) {
    const f = eq.evaluatePoint
    return {
      ...eq,
      rev,
      evaluatePoint: (t) => {
        const p = f(t)
        if (!p) return null
        const x = toX(p[0])
        const y = toY(p[1])
        return x === null || y === null ? null : [x, y]
      },
    }
  }
  if (eq.kind !== 'real') return eq
  const f = eq.evaluate
  return {
    ...eq,
    rev,
    area: undefined,
    evaluate: (u) => {
      const y = f(fromX(u))
      return y === null ? null : toY(y)
    },
  }
}

const DEG = Math.PI / 180

/** Trig functions in degrees; non-number inputs (complex) fall back to radians. */
export function degreeScope(radians: Record<string, (v: unknown) => unknown>): Record<string, (v: unknown) => unknown> {
  const wrapIn = (name: string, fn: (v: number) => number) => (v: unknown) =>
    typeof v === 'number' ? fn(v * DEG) : radians[name](v)
  const wrapOut = (name: string, fn: (v: number) => number) => (v: unknown) =>
    typeof v === 'number' ? fn(v) / DEG : radians[name](v)
  return {
    sin: wrapIn('sin', Math.sin),
    cos: wrapIn('cos', Math.cos),
    tan: wrapIn('tan', Math.tan),
    cot: wrapIn('cot', (v) => 1 / Math.tan(v)),
    sec: wrapIn('sec', (v) => 1 / Math.cos(v)),
    csc: wrapIn('csc', (v) => 1 / Math.sin(v)),
    asin: wrapOut('asin', Math.asin),
    acos: wrapOut('acos', Math.acos),
    atan: wrapOut('atan', Math.atan),
  }
}
