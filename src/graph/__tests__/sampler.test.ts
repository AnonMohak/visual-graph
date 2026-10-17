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

describe('viewport aspect', async () => {
  const { zoomAt, screenToWorldX, screenToWorldY, fitViewportY } = await import('../viewport')
  it('keeps the point under the cursor fixed when zooming one axis', () => {
    const vp: import('../types').Viewport = { scale: 50, originX: 100, originY: 100 }
    const before = [screenToWorldX(vp, 30), screenToWorldY(vp, 70)]
    zoomAt(vp, 30, 70, 2, 'y')
    expect(vp.scale).toBe(50)
    expect(vp.scaleY).toBe(100)
    expect(screenToWorldX(vp, 30)).toBeCloseTo(before[0])
    expect(screenToWorldY(vp, 70)).toBeCloseTo(before[1])
  })
  it('fits only y in free aspect', () => {
    const fitted = fitViewportY({ scale: 50, originX: 0, originY: 0 }, 0, 100, 700, true)
    expect(fitted.scale).toBe(50)
    expect(fitted.scaleY).toBeCloseTo(4.9)
  })
})
