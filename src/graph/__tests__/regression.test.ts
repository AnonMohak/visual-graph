import { describe, expect, it } from 'vitest'
import { parseEquation } from '../parse'
import { fitToRaw, parseCsv, pointsToRaw, polyFit } from '../regression'

describe('csv', () => {
  it('reads comma, tab and space separated values and skips headers', () => {
    expect(parseCsv('x,y\n1,2\n2\t4\n3 6.5\nbad line\n')).toEqual([
      [1, 2],
      [2, 4],
      [3, 6.5],
    ])
  })
})

describe('regression', () => {
  it('fits a line exactly', () => {
    const fit = polyFit([[0, 1], [1, 3], [2, 5]], 1)!
    expect(fit.coefficients[0]).toBeCloseTo(1)
    expect(fit.coefficients[1]).toBeCloseTo(2)
    expect(fit.r2).toBeCloseTo(1)
    expect(fitToRaw(fit)).toBe('y = 2x + 1')
  })

  it('fits a shifted quadratic', () => {
    const points = [100, 101, 102, 103, 104].map((x) => [x, (x - 102) ** 2 - 3] as [number, number])
    const fit = polyFit(points, 2)!
    const raw = fitToRaw(fit)
    const parsed = parseEquation(raw)
    expect(parsed.ok && parsed.evaluate(102)).toBeCloseTo(-3, 3)
    expect(parsed.ok && parsed.evaluate(104)).toBeCloseTo(1, 3)
  })

  it('needs enough points', () => {
    expect(polyFit([[0, 1], [1, 2]], 2)).toBeNull()
  })
})

describe('point lists', () => {
  it('parses a list of points', () => {
    const raw = pointsToRaw([[1, 2], [3, -4.5]])
    expect(raw).toBe('(1, 2), (3, -4.5)')
    const r = parseEquation(raw)
    expect(r).toMatchObject({ ok: true, kind: 'points', points: [[1, 2], [3, -4.5]] })
  })

  it('treats one numeric tuple as a point', () => {
    expect(parseEquation('(2, 3)')).toMatchObject({ ok: true, kind: 'points' })
  })

  it('keeps parametric tuples parametric', () => {
    expect(parseEquation('(cos(t), sin(t))')).toMatchObject({ kind: 'parametric' })
  })
})
