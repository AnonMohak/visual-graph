import { describe, expect, it } from 'vitest'
import { findFeatures, findIntersections, slopeAt, valueTable } from '../analysis'
import { sampleCurve } from '../sampler'
import type { EvaluateFn } from '../types'

const opts = { heightPx: 600, scaleX: 60, scaleY: 60 }
const features = (f: EvaluateFn, xMin: number, xMax: number) =>
  findFeatures(f, sampleCurve(f, { xMin, xMax }, opts).segments, 0, 1e-6)

describe('analysis', () => {
  it('finds roots, extrema and the inflection of x^3 - 3x', () => {
    const found = features((x) => x ** 3 - 3 * x, -3, 3)
    const of = (type: string) => found.filter((f) => f.type === type).map((f) => f.x)
    expect(of('root').sort((a, b) => a - b).map((x) => x.toFixed(4))).toEqual(['-1.7321', '0.0000', '1.7321'])
    expect(of('max')[0]).toBeCloseTo(-1, 4)
    expect(of('min')[0]).toBeCloseTo(1, 4)
    expect(of('inflection')[0]).toBeCloseTo(0, 3)
  })

  it('does not report a pole as a root', () => {
    expect(features((x) => 1 / x, -2, 2).filter((f) => f.type === 'root')).toHaveLength(0)
  })

  it('finds intersections', () => {
    const hits = findIntersections((x) => x * x, (x) => x + 2, -5, 5, 1e-6, 0)
    expect(hits.map((h) => h.x.toFixed(4)).sort()).toEqual(['-1.0000', '2.0000'])
  })

  it('computes slopes and value tables', () => {
    expect(slopeAt((x) => x * x, 3)).toBeCloseTo(6, 5)
    expect(valueTable((x) => 2 * x, 0, 1, 0.25)).toEqual([[0, 0], [0.25, 0.5], [0.5, 1], [0.75, 1.5], [1, 2]])
  })
})
