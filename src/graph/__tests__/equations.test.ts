import { describe, expect, it } from 'vitest'
import { buildEquations, type EquationSpec } from '../equations'
import { parseEquation } from '../parse'

const spec = (raw: string, id = raw): EquationSpec => ({ id, raw, colorToken: 0, visible: true })

describe('implicit multiplication', () => {
  it.each([
    ['2x', 6],
    ['x sin(x)', 3 * Math.sin(3)],
    ['x(x+1)', 12],
    ['2pi x', 6 * Math.PI],
    ['(x+1)(x-1)', 8],
    ['2e3', 2000],
  ])('%s', (raw, expected) => {
    const r = parseEquation(raw)
    expect(r.ok && r.evaluate(3)).toBeCloseTo(expected as number)
  })
})

describe('piecewise', () => {
  it('supports the ternary form and the helper', () => {
    for (const raw of ['x < 0 ? -x : x^2', 'piecewise(x < 0, -x, x^2)']) {
      const r = parseEquation(raw)
      expect(r.ok && r.evaluate(-2)).toBe(2)
      expect(r.ok && r.evaluate(3)).toBe(9)
    }
  })
})

describe('buildEquations', () => {
  it('resolves definitions in any order', () => {
    const { equations } = buildEquations([spec('f(x+1)'), spec('f(x) = a*x^2'), spec('a = 2')])
    expect(equations[0].evaluate(1)).toBe(8)
    expect(equations[1].evaluate(1)).toBe(2)
    expect(equations[2].plot).toBe(false)
    expect(equations[2].constValue).toBe(2)
  })

  it('marks dependents of a missing definition', () => {
    const { equations } = buildEquations([spec('g(x) + 1')])
    expect(equations[0].error).toBeTruthy()
    expect(equations[0].plot).toBe(false)
  })

  it('rejects a duplicate definition', () => {
    const { equations } = buildEquations([spec('a = 1', '1'), spec('a = 2', '2')])
    expect(equations[1].error).toMatch(/already defined/)
  })

  it('rejects built-in names', () => {
    expect(parseEquation('sin = 2').ok).toBe(false)
  })
})

describe('sliders', async () => {
  const { parseWithSliders, sliderOf } = await import('../sliders')
  it('auto-defines free symbols', () => {
    const r = parseWithSliders('a*sin(b*x)', {})
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sliders).toEqual(['a = 1', 'b = 1'])
  })
  it('recognises slider definitions', () => {
    expect(sliderOf('a = -2.5')).toEqual({ name: 'a', value: -2.5 })
    expect(sliderOf('a = 2*pi')).toBeNull()
  })
})

describe('definition edge cases', () => {
  it('rejects a constant that uses x', () => {
    expect(parseEquation('k = 2x').ok).toBe(false)
  })
  it('renames a function parameter', () => {
    const r = parseEquation('g(u) = u^2 + 1')
    expect(r.ok && r.evaluate(2)).toBe(5)
  })
})
