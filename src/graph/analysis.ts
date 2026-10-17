import type { EvaluateFn, Segment } from './types'

export type FeatureType = 'root' | 'max' | 'min' | 'inflection' | 'intersection'

export interface Feature {
  type: FeatureType
  x: number
  y: number
  colorIndex: number
  color?: string
}

const ITERATIONS = 50

/** Bisection on g over [a, b] where g(a) and g(b) have opposite signs. */
function bisect(g: (x: number) => number | null, a: number, b: number): number | null {
  let ga = g(a)
  if (ga === null) return null
  for (let k = 0; k < ITERATIONS; k++) {
    const m = (a + b) / 2
    const gm = g(m)
    if (gm === null) return null
    if (gm === 0) return m
    if (Math.sign(gm) === Math.sign(ga)) {
      a = m
      ga = gm
    } else {
      b = m
    }
  }
  return (a + b) / 2
}

function derivative(f: EvaluateFn, x: number): number | null {
  const h = 1e-6 * Math.max(1, Math.abs(x))
  const a = f(x - h)
  const b = f(x + h)
  return a === null || b === null ? null : (b - a) / (2 * h)
}

function secondDerivative(f: EvaluateFn, x: number): number | null {
  const h = 1e-4 * Math.max(1, Math.abs(x))
  const a = f(x - h)
  const m = f(x)
  const b = f(x + h)
  return a === null || m === null || b === null ? null : (a - 2 * m + b) / (h * h)
}

/** Slope of f at x, or null where f is undefined. */
export function slopeAt(f: EvaluateFn, x: number): number | null {
  return derivative(f, x)
}

/**
 * Roots, local extrema and inflection points from already-sampled segments.
 * Candidates come from sign changes in the samples, then bisection refines them.
 * `tolerance` is the largest |f| accepted at a root (rejects pole sign flips).
 */
export function findFeatures(f: EvaluateFn, segments: Segment[], colorIndex: number, tolerance: number): Feature[] {
  const out: Feature[] = []
  for (const { xs, ys } of segments) {
    const n = xs.length
    for (let k = 0; k + 1 < n; k++) {
      if (ys[k] === 0) out.push({ type: 'root', x: xs[k], y: 0, colorIndex })
      else if (Math.sign(ys[k]) === -Math.sign(ys[k + 1])) {
        const x = bisect(f, xs[k], xs[k + 1])
        const y = x === null ? null : f(x)
        if (x !== null && y !== null && Math.abs(y) < tolerance) out.push({ type: 'root', x, y: 0, colorIndex })
      }
      if (k + 2 < n) {
        const d0 = ys[k + 1] - ys[k]
        const d1 = ys[k + 2] - ys[k + 1]
        if (d0 !== 0 && Math.sign(d0) === -Math.sign(d1)) {
          const x = bisect((v) => derivative(f, v), xs[k], xs[k + 2])
          const y = x === null ? null : f(x)
          if (x !== null && y !== null) out.push({ type: d0 > 0 ? 'max' : 'min', x, y, colorIndex })
        }
      }
      if (k + 3 < n) {
        const c0 = ys[k + 2] - 2 * ys[k + 1] + ys[k]
        const c1 = ys[k + 3] - 2 * ys[k + 2] + ys[k + 1]
        // Ignore curvature noise near zero (straight lines, float rounding).
        const scale = Math.max(Math.abs(c0), Math.abs(c1))
        if (scale > 1e-9 && Math.sign(c0) === -Math.sign(c1)) {
          const x = bisect((v) => secondDerivative(f, v), xs[k + 1], xs[k + 2])
          const y = x === null ? null : f(x)
          if (x !== null && y !== null) out.push({ type: 'inflection', x, y, colorIndex })
        }
      }
    }
  }
  return dedupe(out)
}

/** Intersections of f and g on [xMin, xMax] (sign changes of f - g, refined). */
export function findIntersections(
  f: EvaluateFn,
  g: EvaluateFn,
  xMin: number,
  xMax: number,
  tolerance: number,
  colorIndex: number,
  samples = 600
): Feature[] {
  const h = (x: number) => {
    const a = f(x)
    const b = g(x)
    return a === null || b === null ? null : a - b
  }
  const out: Feature[] = []
  const step = (xMax - xMin) / samples
  let prev = h(xMin)
  for (let k = 1; k <= samples; k++) {
    const x1 = xMin + k * step
    const cur = h(x1)
    if (cur === 0) {
      const y = f(x1)
      if (y !== null) out.push({ type: 'intersection', x: x1, y, colorIndex })
    } else if (prev !== null && cur !== null && Math.sign(prev) === -Math.sign(cur)) {
      const x = bisect(h, x1 - step, x1)
      const d = x === null ? null : h(x)
      const y = x === null ? null : f(x)
      if (x !== null && d !== null && y !== null && Math.abs(d) < tolerance) {
        out.push({ type: 'intersection', x, y, colorIndex })
      }
    }
    prev = cur
  }
  return dedupe(out)
}

function dedupe(features: Feature[]): Feature[] {
  const out: Feature[] = []
  for (const feature of features) {
    const near = out.some(
      (other) =>
        other.type === feature.type &&
        Math.abs(other.x - feature.x) < 1e-6 * Math.max(1, Math.abs(feature.x))
    )
    if (!near) out.push(feature)
  }
  return out
}

/** Rows of (x, f(x)) from start to end inclusive; at most `limit` rows. */
export function valueTable(f: EvaluateFn, start: number, end: number, step: number, limit = 500): [number, number | null][] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) return []
  const rows: [number, number | null][] = []
  for (let k = 0; rows.length < limit; k++) {
    const x = Number((start + k * step).toPrecision(12))
    if (x > end + step * 1e-9) break
    rows.push([x, f(x)])
  }
  return rows
}
