import { describe, expect, it } from 'vitest'
import { complexGamma, zetaComplex } from '../zeta'

describe('zeta', () => {
  it('zeta(2) = pi^2/6', () => {
    const z = zetaComplex({ re: 2, im: 0 })
    expect(z?.re).toBeCloseTo(Math.PI ** 2 / 6, 4)
  })

  it('zeta(-1) = -1/12', () => {
    const z = zetaComplex({ re: -1, im: 0 })
    expect(z?.re).toBeCloseTo(-1 / 12, 4)
  })

  it('vanishes near the first nontrivial zero', () => {
    const z = zetaComplex({ re: 0.5, im: 14.134725 })
    expect(Math.hypot(z!.re, z!.im)).toBeLessThan(0.05)
  })

  it('gamma(5) = 24', () => {
    expect(complexGamma({ re: 5, im: 0 }).re).toBeCloseTo(24, 6)
  })
})

describe('more complex functions', async () => {
  const { betaComplex, lambdaComplex, xiComplex, ZETA_ZEROS } = await import('../zeta')
  it('beta(1) = pi/4 and beta(0) = 1/2', () => {
    expect(betaComplex({ re: 1, im: 0 }, { terms: 2000 })!.re).toBeCloseTo(Math.PI / 4, 4)
    expect(betaComplex({ re: 0, im: 0 }, { terms: 2000 })!.re).toBeCloseTo(0.5, 3)
  })
  it('lambda(2) = pi^2/8', () => {
    expect(lambdaComplex({ re: 2, im: 0 })!.re).toBeCloseTo(Math.PI ** 2 / 8, 3)
  })
  it('xi is real on the critical line and xi(0) = 1/2', () => {
    const v = xiComplex({ re: 0.5, im: 10 })!
    expect(Math.abs(v.im)).toBeLessThan(1e-3 * Math.max(1, Math.abs(v.re)))
    expect(xiComplex({ re: 0, im: 0 })!.re).toBe(0.5)
  })
  it('lists 30 zeros in increasing order', () => {
    expect(ZETA_ZEROS).toHaveLength(30)
    expect([...ZETA_ZEROS].sort((a, b) => a - b)).toEqual(ZETA_ZEROS)
  })
})
