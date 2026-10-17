import { describe, expect, it } from 'vitest'
import { buildEquations } from '../equations'
import { DEFAULT_VIEW, sanitizeView, transformForAxes } from '../view'

const spec = (raw: string) => ({ id: raw, raw, colorToken: 0, visible: true })

describe('view settings', () => {
  it('sanitizes untrusted settings', () => {
    expect(sanitizeView(null)).toEqual(DEFAULT_VIEW)
    const view = sanitizeView({ grid: false, gridStep: -1, palette: 'evil', angle: 'deg' })
    expect(view.grid).toBe(false)
    expect(view.gridStep).toBeNull()
    expect(view.palette).toBe('default')
    expect(view.angle).toBe('deg')
  })

  it('evaluates trig in degrees', () => {
    const { equations } = buildEquations([spec('sin(x)'), spec('asin(x)')], { angle: 'deg' })
    expect(equations[0].evaluate(90)).toBeCloseTo(1)
    expect(equations[1].evaluate(1)).toBeCloseTo(90)
    expect(equations[0].rev).not.toBe(buildEquations([spec('sin(x)')]).equations[0].rev)
  })

  it('plots in log space', () => {
    const [eq] = buildEquations([spec('x^2')]).equations
    const logged = transformForAxes(eq, true, true)
    // u = log10(x) = 1 -> x = 10 -> y = 100 -> v = 2
    expect(logged.evaluate(1)).toBeCloseTo(2)
    const negative = buildEquations([spec('x - 5')]).equations[0]
    expect(transformForAxes(negative, false, true).evaluate(1)).toBeNull()
  })
})
