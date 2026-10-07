import { complex as mathComplex, type Complex } from 'mathjs'
import {
  cAbs,
  cArg,
  complexGamma,
  etaComplex,
  toC,
  zetaComplex,
  zetaTerms,
  type C,
} from './zeta'

export type { C }
export { zetaTerms }

function asC(v: unknown): C {
  if (typeof v === 'number') return { re: v, im: 0 }
  if (v && typeof v === 'object' && 're' in (v as Record<string, unknown>) && 'im' in (v as Record<string, unknown>)) {
    const o = v as { re: unknown; im: unknown }
    const re = typeof o.re === 'number' ? o.re : Number(o.re)
    const im = typeof o.im === 'number' ? o.im : Number(o.im)
    if (Number.isFinite(re) && Number.isFinite(im)) return { re, im }
  }
  return { re: NaN, im: NaN }
}

function toMath(v: C): number | Complex {
  if (!Number.isFinite(v.re) || !Number.isFinite(v.im)) {
    throw new Error('non-finite complex result')
  }
  if (v.im === 0) return v.re
  return mathComplex(v.re, v.im)
}

let coarseHint = false

export function setZetaCoarse(coarse: boolean): void {
  coarseHint = coarse
}

function currentTerms(): number {
  return zetaTerms(coarseHint)
}

export function zetaFn(s: unknown): number | Complex {
  const c = asC(s)
  const out = zetaComplex(c, { terms: currentTerms() })
  if (!out) throw new Error('zeta pole or divergence (s = 1)')
  return toMath(out)
}

export function etaFn(s: unknown): number | Complex {
  const c = asC(s)
  const out = etaComplex(c, { terms: currentTerms() })
  if (!out) throw new Error('eta divergence')
  return toMath(out)
}

export function gammaFn(z: unknown): number | Complex {
  const c = asC(z)
  if (!Number.isFinite(c.re) || !Number.isFinite(c.im)) throw new Error('gamma domain error')
  // Poles at 0, -1, -2, ...
  if (c.im === 0 && c.re <= 0 && Number.isInteger(c.re)) throw new Error('gamma pole')
  const out = complexGamma(c)
  if (!Number.isFinite(out.re) || !Number.isFinite(out.im)) throw new Error('gamma divergence')
  return toMath(out)
}

export function reFn(z: unknown): number {
  return asC(z).re
}

export function imFn(z: unknown): number {
  return asC(z).im
}

export function absFn(z: unknown): number {
  const v = z as number | Complex
  if (typeof v === 'number') return Math.abs(v)
  return cAbs(asC(v))
}

export function argFn(z: unknown): number {
  return cArg(asC(z))
}

export function conjFn(z: unknown): number | Complex {
  const c = asC(z)
  return toMath({ re: c.re, im: -c.im })
}

/** Scope entries injected for complex equations. */
export function complexScopeExtras(): Record<string, unknown> {
  return {
    zeta: zetaFn,
    gamma: gammaFn,
    eta: etaFn,
    re: reFn,
    im: imFn,
    abs: absFn,
    arg: argFn,
    conj: conjFn,
    i: mathComplex(0, 1),
  }
}

/** Convert mathjs evaluation result to our C type (null when unusable). */
export function resultToC(value: unknown): C | null {
  if (typeof value === 'number') return Number.isFinite(value) ? { re: value, im: 0 } : null
  if (value && typeof value === 'object' && 're' in (value as object) && 'im' in (value as object)) {
    const c = toC(value as C)
    if (!Number.isFinite(c.re) || !Number.isFinite(c.im)) return null
    if (Math.hypot(c.re, c.im) > 1e7) return null
    return c
  }
  return null
}

export function resultToComplex(value: unknown): Complex | null {
  const c = resultToC(value)
  if (!c) return null
  return mathComplex(c.re, c.im)
}
