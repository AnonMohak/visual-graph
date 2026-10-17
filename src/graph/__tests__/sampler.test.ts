import { describe, expect, it } from 'vitest'
import { sampleCurve } from '../sampler'

const opts = { heightPx: 600, scaleX: 60, scaleY: 60 }

describe('sampleCurve', () => {
  it('samples a continuous curve as one segment', () => {
    const s = sampleCurve((x) => x * x, { xMin: -2, xMax: 2 }, opts)
    expect(s.hasPoints).toBe(true)
    expect(s.segments).toHaveLength(1)
  })

  it('splits on undefined values', () => {
    const s = sampleCurve((x) => (x > -0.5 && x < 0.5 ? null : x), { xMin: -2, xMax: 2 }, opts)
    expect(s.segments).toHaveLength(2)
  })

  it('splits on large jumps', () => {
    const s = sampleCurve((x) => 1 / (x - 0.001), { xMin: -2, xMax: 2 }, opts)
    expect(s.segments.length).toBeGreaterThanOrEqual(2)
  })

  it('reports no points for an empty curve', () => {
    expect(sampleCurve(() => null, { xMin: 0, xMax: 1 }, opts).hasPoints).toBe(false)
  })
})
