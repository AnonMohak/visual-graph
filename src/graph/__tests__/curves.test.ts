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
