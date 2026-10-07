import type { CurveSamples, EvaluateFn, Segment } from './types'

/**
 * Progressive draw-on animation model (fixed plane, growing line).
 *
 * An invisible pen at (x, f(x)) moves left -> right at constant
 * world-units/sec. Only the curve stroke grows; the viewport never moves.
 * Play-once + hold: on reaching xMax the graph freezes complete.
 */

/** World units revealed per second. [-5,5] takes ~100s. Tune freely. */
export const DRAW_UNITS_PER_SEC = 0.1

/** Fixed draw range for xy real curves (infinite both sides fallback). */
export const DRAW_X_MIN = -5
export const DRAW_X_MAX = 5

/** Reveal range for reim parametric t sweep. */
export const DRAW_T_MIN = -30
export const DRAW_T_MAX = 30

/** Total play-once duration for the xy range at current speed. */
export const DRAW_DURATION = (DRAW_X_MAX - DRAW_X_MIN) / DRAW_UNITS_PER_SEC

/** Parametric sweep duration at the same world-speed (finishes earlier). */
export const DRAW_PARAM_DURATION = (DRAW_T_MAX - DRAW_T_MIN) / DRAW_UNITS_PER_SEC

/** Total play-once duration for the xy range at a given speed. */
export function drawDuration(unitsPerSec: number = DRAW_UNITS_PER_SEC): number {
  const ups = Number.isFinite(unitsPerSec) && unitsPerSec > 0 ? unitsPerSec : DRAW_UNITS_PER_SEC
  return (DRAW_X_MAX - DRAW_X_MIN) / ups
}

/** Parametric sweep duration at a given world-speed. */
export function drawParamDuration(unitsPerSec: number = DRAW_UNITS_PER_SEC): number {
  const ups = Number.isFinite(unitsPerSec) && unitsPerSec > 0 ? unitsPerSec : DRAW_UNITS_PER_SEC
  return (DRAW_T_MAX - DRAW_T_MIN) / ups
}

/** Frame rate used to quantize the head for the sampler cache key. */
export const QUANTIZE_FPS = 60

/** Head x in world coords for elapsed draw time t (seconds). Linear, clamped. */
export function drawHeadX(drawTime: number, unitsPerSec: number = DRAW_UNITS_PER_SEC): number {
  if (!Number.isFinite(drawTime) || drawTime <= 0) return DRAW_X_MIN
  const ups = Number.isFinite(unitsPerSec) && unitsPerSec > 0 ? unitsPerSec : DRAW_UNITS_PER_SEC
  const head = DRAW_X_MIN + drawTime * ups
  return head >= DRAW_X_MAX ? DRAW_X_MAX : head
}

/** Head t for the parametric sweep at elapsed draw time. */
export function drawHeadT(drawTime: number, unitsPerSec: number = DRAW_UNITS_PER_SEC): number {
  if (!Number.isFinite(drawTime) || drawTime <= 0) return DRAW_T_MIN
  const ups = Number.isFinite(unitsPerSec) && unitsPerSec > 0 ? unitsPerSec : DRAW_UNITS_PER_SEC
  const head = DRAW_T_MIN + drawTime * ups
  return head >= DRAW_T_MAX ? DRAW_T_MAX : head
}

/** Normalized progress 0..1 derived from the shared xy head (for parametric sync). */
export function drawProgress(xHead: number): number {
  const span = DRAW_X_MAX - DRAW_X_MIN
  if (!Number.isFinite(xHead)) return 0
  if (xHead <= DRAW_X_MIN) return 0
  if (xHead >= DRAW_X_MAX) return 1
  return (xHead - DRAW_X_MIN) / span
}

export function isDrawComplete(drawTime: number, unitsPerSec: number = DRAW_UNITS_PER_SEC): boolean {
  if (!Number.isFinite(drawTime)) return false
  const ups = Number.isFinite(unitsPerSec) && unitsPerSec > 0 ? unitsPerSec : DRAW_UNITS_PER_SEC
  return drawTime * ups >= DRAW_X_MAX - DRAW_X_MIN
}

/** Quantized head, stable within a frame so the sampler cache still helps. */
export function quantizeHead(xHead: number, fps: number = QUANTIZE_FPS): number {
  if (!Number.isFinite(xHead)) return 0
  return Math.round(xHead * fps)
}

/**
 * Resolve the draw range for an equation.
 *
 * Infinite both sides -> fixed [DRAW_X_MIN, DRAW_X_MAX].
 * Finite natural limits (e.g. sqrt(1-x^2)) are contained within that window
 * because sampling returns null outside the domain, so the fixed window
 * already reveals the natural domain. If a caller supplies explicit finite
 * limits wider than the draw span (or half-infinite), clamp to a sensible
 * window centered on origin, preferring the fixed fallback.
 */
export function resolveDrawRange(
  naturalMin?: number,
  naturalMax?: number
): { xMin: number; xMax: number } {
  const fallback = { xMin: DRAW_X_MIN, xMax: DRAW_X_MAX }
  if (naturalMin === undefined || naturalMax === undefined) return fallback
  if (!Number.isFinite(naturalMin) || !Number.isFinite(naturalMax)) return fallback
  if (naturalMax <= naturalMin) return fallback
  const span = DRAW_X_MAX - DRAW_X_MIN
  const width = naturalMax - naturalMin
  if (width > span) {
    // Huge finite range: clamp to a span-wide window centered on origin
    // if it contains the origin, else fall back to the fixed range.
    if (naturalMin <= 0 && naturalMax >= 0) {
      const half = span / 2
      const lo = Math.max(naturalMin, -half)
      const hi = Math.min(naturalMax, half)
      if (hi - lo >= span / 4) return { xMin: lo, xMax: hi }
    }
    return fallback
  }
  return { xMin: naturalMin, xMax: naturalMax }
}

/**
 * Clip sampled segments to x <= xHead, preserving discontinuity breaks.
 * Interpolates a partial point at the head for smoothness; no head dot.
 */
export function clipSegmentsToHead(samples: CurveSamples, xHead: number): CurveSamples {
  if (xHead >= DRAW_X_MAX) return samples
  const segments: Segment[] = []
  let hasPoints = false
  for (const seg of samples.segments) {
    const { xs, ys } = seg
    if (xs.length === 0) continue
    if (xs[0] > xHead) continue
    let end = xs.length
    // Binary search first index with x > xHead.
    let lo = 0
    let hi = xs.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (xs[mid] <= xHead) lo = mid + 1
      else hi = mid
    }
    end = lo
    if (end >= xs.length) {
      segments.push(seg)
      hasPoints = hasPoints || xs.length >= 2
      continue
    }
    if (end === 0) continue
    const keptX = Array.from(xs.slice(0, end))
    const keptY = Array.from(ys.slice(0, end))
    // Partial interpolation at head (linear between surrounding samples).
    // Strictly ahead of the last kept point — no zero-length dot at xMin.
    if (end < xs.length && end > 0 && xHead > xs[end - 1]) {
      const x0 = xs[end - 1]
      const x1 = xs[end]
      if (Number.isFinite(x0) && Number.isFinite(x1) && x1 > x0) {
        const y0 = ys[end - 1]
        const y1 = ys[end]
        if (Number.isFinite(y0) && Number.isFinite(y1)) {
          const f = (xHead - x0) / (x1 - x0)
          keptX.push(xHead)
          keptY.push(y0 + (y1 - y0) * f)
        }
      }
    }
    if (keptX.length >= 2) {
      segments.push({ xs: Float64Array.from(keptX), ys: Float64Array.from(keptY) })
      hasPoints = true
    }
  }
  return { segments, hasPoints }
}

/**
 * Clip parametric samples (t-uniform, xs = Re values) by normalized progress
 * 0..1. Keeps the same left-to-right reveal on t without connecting jumps.
 */
export function clipParametricByProgress(samples: CurveSamples, progress: number): CurveSamples {
  if (progress >= 1) return samples
  if (progress <= 0) return { segments: [], hasPoints: false }
  // Total point budget across segments (t-uniform sampling).
  let total = 0
  for (const seg of samples.segments) total += seg.xs.length
  if (total === 0) return samples
  const budget = Math.floor(total * progress)
  if (budget < 2) return { segments: [], hasPoints: false }
  const segments: Segment[] = []
  let used = 0
  let hasPoints = false
  for (const seg of samples.segments) {
    if (used >= budget) break
    const remaining = budget - used
    if (seg.xs.length <= remaining) {
      segments.push(seg)
      if (seg.xs.length >= 2) hasPoints = true
      used += seg.xs.length
    } else {
      // Partial segment: keep prefix + interpolated head point.
      if (remaining >= 2) {
        const keptX = Array.from(seg.xs.slice(0, remaining))
        const keptY = Array.from(seg.ys.slice(0, remaining))
        const x0 = seg.xs[remaining - 1]
        const x1 = seg.xs[remaining]
        const y0 = seg.ys[remaining - 1]
        const y1 = seg.ys[remaining]
        if (
          Number.isFinite(x0) &&
          Number.isFinite(x1) &&
          Number.isFinite(y0) &&
          Number.isFinite(y1)
        ) {
          keptX.push((x0 + x1) / 2)
          keptY.push((y0 + y1) / 2)
        }
        segments.push({ xs: Float64Array.from(keptX), ys: Float64Array.from(keptY) })
        hasPoints = true
      }
      break
    }
  }
  return { segments, hasPoints }
}

/** Legacy helper kept for typing: identity (no auto-shift). */
export function identityEvaluate(base: EvaluateFn): EvaluateFn {
  return base
}

export const ANIMATED_EXAMPLES = [
  'sin(x)',
  'sin(x)/x',
  'x^3-3x',
  'exp(-x^2)*sin(5*x)',
]

/** Hint shown when the user tries to author time explicitly. */
export function usesTimeVariable(input: string): boolean {
  return /\b(time|t)\b/.test(input)
}
