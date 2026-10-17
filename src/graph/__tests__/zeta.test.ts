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
