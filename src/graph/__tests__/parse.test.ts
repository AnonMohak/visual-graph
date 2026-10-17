import { describe, expect, it } from 'vitest'
import { parseEquation } from '../parse'

describe('parseEquation', () => {
  it('parses a real expression', () => {
    const r = parseEquation('sin(x)/x')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.kind).toBe('real')
      expect(r.evaluate(Math.PI / 2)).toBeCloseTo(2 / Math.PI)
    }
  })

  it('strips the y = prefix', () => {
    const r = parseEquation('y = x^2')
    expect(r.ok && r.evaluate(3)).toBe(9)
  })

  it('converts unicode helpers', () => {
    const r = parseEquation('x² × π')
    expect(r.ok && r.evaluate(2)).toBeCloseTo(4 * Math.PI)
  })

  it('returns null outside the domain', () => {
    const r = parseEquation('log(x)')
    expect(r.ok && r.evaluate(-1)).toBeNull()
  })

  it('reports unbalanced parentheses', () => {
    const r = parseEquation('sin(x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/closing/)
  })

  it('suggests a close symbol', () => {
    const r = parseEquation('sinn(x)')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/sin/)
  })

  it('detects complex expressions', () => {
    const r = parseEquation('zeta(s)')
    expect(r.ok && r.kind).toBe('complex-param')
  })
})
