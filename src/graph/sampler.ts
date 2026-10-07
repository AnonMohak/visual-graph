import { complex as mathComplex } from 'mathjs'
import { resultToC } from './complex'
import type { ComplexComponent, CurveSamples, EvaluateComplexFn, EvaluateFn, Segment } from './types'

export interface SampleRange {
  xMin: number
  xMax: number
}

export interface SampleOptions {
  heightPx: number
  scaleX: number
  scaleY: number
  spacingPx?: number
  jumpFactor?: number
  maxPoints?: number
}

const MIN_POINTS = 2
const DEFAULT_SPACING = 1.5
const DEFAULT_JUMP_FACTOR = 0.75
const DEFAULT_MAX_POINTS = 4000

export function sampleCurve(
  evaluate: EvaluateFn,
  range: SampleRange,
  options: SampleOptions
): CurveSamples {
  const spacing = options.spacingPx ?? DEFAULT_SPACING
  const jumpFactor = options.jumpFactor ?? DEFAULT_JUMP_FACTOR
  const maxPoints = options.maxPoints ?? DEFAULT_MAX_POINTS
  const span = range.xMax - range.xMin
  const widthPx = span * options.scaleX
  const count = Math.min(maxPoints, Math.max(MIN_POINTS, Math.round(widthPx / spacing)))
  const step = span / (count - 1)
  const jumpThreshold = options.heightPx * jumpFactor

  const segments: Segment[] = []
  let xs: number[] = []
  let ys: number[] = []
  let previousY: number | null = null
  let hasPoints = false

  const flush = () => {
    if (xs.length >= 2) {
      segments.push({ xs: Float64Array.from(xs), ys: Float64Array.from(ys) })
      hasPoints = true
    }
    xs = []
    ys = []
    previousY = null
  }

  for (let i = 0; i < count; i++) {
    const x = range.xMin + step * i
    const y = evaluate(x)
    if (y === null || !Number.isFinite(y)) {
      flush()
      continue
    }
    if (previousY !== null && Math.abs(y - previousY) * options.scaleY > jumpThreshold) {
      flush()
    }
    xs.push(x)
    ys.push(y)
    previousY = y
  }
  flush()

  return { segments, hasPoints }
}

export function componentValue(
  c: { re: number; im: number } | null,
  component: ComplexComponent
): number | null {
  if (!c || !Number.isFinite(c.re) || !Number.isFinite(c.im)) return null
  switch (component) {
    case 're':
      return c.re
    case 'im':
      return c.im
    case 'abs':
      return Math.hypot(c.re, c.im)
    case 'arg':
      return Math.atan2(c.im, c.re)
  }
}

/** 1D complex slice at fixed sigma: t -> component(f(sigma + i t)). Delegates to sampleCurve. */
export function sampleComplexSlice(
  evaluateComplex: EvaluateComplexFn,
  sigma: number,
  component: ComplexComponent,
  range: SampleRange,
  opts: SampleOptions
): CurveSamples {
  const realEval: EvaluateFn = (t) => {
    try {
      const v = evaluateComplex(mathComplex(sigma, t))
      return componentValue(resultToC(v), component)
    } catch {
      return null
    }
  }
  return sampleCurve(realEval, range, opts)
}

export interface ParametricRange {
  tMin: number
  tMax: number
}

/** Parametric sweep at fixed sigma: t -> (Re f, Im f). Splits on poles/jumps. */
export function sampleParametric(
  evaluateComplex: EvaluateComplexFn,
  sigma: number,
  range: ParametricRange,
  opts: SampleOptions
): CurveSamples {
  const spacing = opts.spacingPx ?? 1.5
  const jumpFactor = opts.jumpFactor ?? 0.75
  const maxPoints = opts.maxPoints ?? 4000
  const span = range.tMax - range.tMin
  const widthPx = span * opts.scaleX
  const count = Math.min(maxPoints, Math.max(2, Math.round(widthPx / spacing)))
  const step = span / (count - 1)
  const jumpThreshold = opts.heightPx * jumpFactor

  const segments: Segment[] = []
  let xs: number[] = []
  let ys: number[] = []
  let prevX: number | null = null
  let prevY: number | null = null
  let hasPoints = false

  const flush = () => {
    if (xs.length >= 2) {
      segments.push({ xs: Float64Array.from(xs), ys: Float64Array.from(ys) })
      hasPoints = true
    }
    xs = []
    ys = []
    prevX = null
    prevY = null
  }

  for (let k = 0; k < count; k++) {
    const t = range.tMin + step * k
    let cx: number | null = null
    let cy: number | null = null
    try {
      const v = evaluateComplex(mathComplex(sigma, t))
      const c = resultToC(v)
      if (c) {
        cx = c.re
        cy = c.im
      }
    } catch {
      cx = null
    }
    if (cx === null || cy === null || !Number.isFinite(cx) || !Number.isFinite(cy)) {
      flush()
      continue
    }
    if (prevX !== null && prevY !== null) {
      const dx = (cx - prevX) * opts.scaleX
      const dy = (cy - prevY) * opts.scaleY
      if (Math.hypot(dx, dy) > jumpThreshold) {
        flush()
      }
    }
    xs.push(cx)
    ys.push(cy)
    prevX = cx
    prevY = cy
  }
  flush()
  return { segments, hasPoints }
}
