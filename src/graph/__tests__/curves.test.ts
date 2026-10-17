import { describe, expect, it } from 'vitest'
import { parseEquation } from '../parse'
import { samplePoints } from '../sampler'

describe('parametric and polar', () => {
  it('parses a parametric circle', () => {
    const r = parseEquation('(cos(t), sin(t))')
    expect(r.ok && r.kind).toBe('parametric')
    if (r.ok) {
      const p = r.evaluatePoint!(Math.PI / 2)!
      expect(p[0]).toBeCloseTo(0)
      expect(p[1]).toBeCloseTo(1)
    }
  })

  it('parses a polar cardioid with θ', () => {
    const r = parseEquation('r = 1 + cos(θ)')
    expect(r.ok && r.kind).toBe('polar')
    if (r.ok) expect(r.evaluatePoint!(0)![0]).toBeCloseTo(2)
  })

  it('reports unknown names inside a tuple', () => {
    expect(parseEquation('(cos(t), sinn(t))').ok).toBe(false)
  })

  it('samples a closed curve as one segment', () => {
    const r = parseEquation('(cos(t), sin(t))')
    if (!r.ok) throw new Error('parse failed')
    const s = samplePoints(r.evaluatePoint!, { tMin: 0, tMax: 2 * Math.PI }, { heightPx: 600, scaleX: 60, scaleY: 60 })
    expect(s.segments).toHaveLength(1)
  })
})

describe('implicit curves', async () => {
  const { sampleImplicit } = await import('../implicit')
  const vp = { scale: 50, originX: 200, originY: 200 }

  it('parses a circle and traces it', () => {
    const r = parseEquation('x^2 + y^2 = 1')
    expect(r.ok && r.kind).toBe('implicit')
    if (!r.ok) return
    expect(r.evaluateXY!(1, 0)).toBeCloseTo(0)
    const s = sampleImplicit(r.evaluateXY!, '=', vp, 400, 400, 4)
    expect(s.segments.length).toBeGreaterThan(20)
    for (const seg of s.segments) expect(Math.hypot(seg.xs[0], seg.ys[0])).toBeCloseTo(1, 1)
  })

  it('shades an inequality region', () => {
    const r = parseEquation('y < sin(x)')
    expect(r.ok && r.relation).toBe('<')
    if (!r.ok) return
    const s = sampleImplicit(r.evaluateXY!, '<', vp, 400, 400, 8)
    expect(s.region!.length).toBeGreaterThan(0)
  })

  it('treats x = 3 and y = x + y as implicit', () => {
    expect(parseEquation('x = 3').ok).toBe(true)
    const r = parseEquation('y = x*y + 1')
    expect(r.ok && r.kind).toBe('implicit')
  })

  it('keeps ternaries and explicit y = forms', () => {
    expect(parseEquation('x < 0 ? -x : x').ok && parseEquation('x < 0 ? -x : x')).toMatchObject({ kind: 'real' })
    expect(parseEquation('y = x^2')).toMatchObject({ kind: 'real' })
  })

  it('adds sliders for implicit free symbols', async () => {
    const { parseWithSliders } = await import('../sliders')
    const r = parseWithSliders('x^2 + y^2 = a', {})
    expect(r.ok && r.sliders).toEqual(['a = 1'])
  })
})
