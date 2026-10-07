export interface C {
  re: number
  im: number
}

export const I: C = { re: 0, im: 1 }

export function toC(v: number | C | { re: number; im: number }): C {
  if (typeof v === 'number') return { re: v, im: 0 }
  return { re: v.re, im: v.im }
}

export function cAbs(z: C): number {
  return Math.hypot(z.re, z.im)
}

export function cArg(z: C): number {
  return Math.atan2(z.im, z.re)
}

export function cAdd(a: C, b: C): C {
  return { re: a.re + b.re, im: a.im + b.im }
}

export function cSub(a: C, b: C): C {
  return { re: a.re - b.re, im: a.im - b.im }
}

export function cNeg(a: C): C {
  return { re: -a.re, im: -a.im }
}

export function cMul(a: C, b: C): C {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}

export function cDiv(a: C, b: C): C {
  const d = b.re * b.re + b.im * b.im
  if (d === 0) return { re: NaN, im: NaN }
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}

export function cExp(z: C): C {
  const e = Math.exp(z.re)
  return { re: e * Math.cos(z.im), im: e * Math.sin(z.im) }
}

export function cLog(z: C): C {
  return { re: Math.log(cAbs(z)), im: cArg(z) }
}

/** exp(w * Log(z)) principal branch */
export function cPow(base: C, exp: C): C {
  if (base.re === 0 && base.im === 0) {
    if (exp.re === 0 && exp.im === 0) return { re: 1, im: 0 }
    if (exp.re > 0) return { re: 0, im: 0 }
    return { re: NaN, im: NaN }
  }
  const logBase = cLog(base)
  const w = cMul(exp, logBase)
  return cExp(w)
}

export function cSin(z: C): C {
  // sin(a+bi) = sin a cosh b + i cos a sinh b
  return { re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im) }
}

function isFiniteC(z: C): boolean {
  return Number.isFinite(z.re) && Number.isFinite(z.im)
}

// --- Lanczos complex Gamma (g=7, 9 coeffs) ---
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
]
const LANCZOS_G = 7

export function complexGamma(z: C): C {
  // Reflection for Re < 0.5: Gamma(z) = pi / (sin(pi z) Gamma(1-z))
  if (z.re < 0.5) {
    const oneMinus = { re: 1 - z.re, im: -z.im }
    const g = complexGamma(oneMinus)
    const piZ: C = { re: Math.PI * z.re, im: Math.PI * z.im }
    const sinPiZ = cSin(piZ)
    const denom = cMul(sinPiZ, g)
    const num: C = { re: Math.PI, im: 0 }
    return cDiv(num, denom)
  }
  const zz = { re: z.re - 1, im: z.im }
  let x: C = { re: LANCZOS[0], im: 0 }
  for (let k = 1; k < LANCZOS.length; k++) {
    const denom = cAdd(zz, { re: k, im: 0 })
    const term = cDiv({ re: LANCZOS[k], im: 0 }, denom)
    x = cAdd(x, term)
  }
  const t = { re: zz.re + LANCZOS_G + 0.5, im: zz.im }
  const half: C = { re: 0.5, im: 0 }
  const powPart = cPow(t, cAdd(zz, half))
  const expPart = cExp(cNeg(t))
  const sqrt2pi = Math.sqrt(2 * Math.PI)
  return cMul(cMul({ re: sqrt2pi, im: 0 }, powPart), cMul(expPart, x))
}

export function gammaReal(x: number): number | null {
  if (!Number.isFinite(x)) return null
  // Poles at 0, -1, -2, ...
  if (x <= 0 && Number.isInteger(x)) return null
  const g = complexGamma({ re: x, im: 0 })
  if (!isFiniteC(g) || Math.abs(g.im) > 1e-8 * Math.max(1, Math.abs(g.re))) {
    // Genuine complex result shouldn't happen for real input (except overflow)
    if (!Number.isFinite(g.re)) return null
  }
  return Number.isFinite(g.re) ? g.re : null
}

// --- Dirichlet eta / zeta ---

const DEFAULT_TERMS = 200
const COARSE_TERMS = 80

export function zetaTerms(coarse: boolean): number {
  return coarse ? COARSE_TERMS : DEFAULT_TERMS
}

/** eta(s) = sum_{n>=1} (-1)^{n-1} n^{-s}, valid Re(s) > 0 */
function etaSum(s: C, terms: number): C {
  let acc: C = { re: 0, im: 0 }
  for (let n = 1; n <= terms; n++) {
    const ln = Math.log(n)
    // n^{-s} = exp(-s ln n)
    const w: C = { re: -s.re * ln, im: -s.im * ln }
    const term = cExp(w)
    if (n % 2 === 0) acc = cSub(acc, term)
    else acc = cAdd(acc, term)
  }
  return acc
}

function pow2(a: C): C {
  // 2^a = exp(a ln2)
  const ln2 = Math.LN2
  return cExp({ re: a.re * ln2, im: a.im * ln2 })
}

function powPi(a: C): C {
  const lnp = Math.log(Math.PI)
  return cExp({ re: a.re * lnp, im: a.im * lnp })
}

function zetaPositiveRe(s: C, terms: number): C | null {
  // s != 1 assumed; zeta = eta / (1 - 2^{1-s})
  const eta = etaSum(s, terms)
  const oneMinus: C = { re: 1 - s.re, im: -s.im }
  const denom = cSub({ re: 1, im: 0 }, pow2(oneMinus))
  if (cAbs(denom) < 1e-15) return null
  return cDiv(eta, denom)
}

export interface ZetaOptions {
  terms?: number
}

export function zetaComplex(sIn: C | { re: number; im: number }, opts?: ZetaOptions): C | null {
  const s: C = { re: sIn.re, im: sIn.im }
  if (!Number.isFinite(s.re) || !Number.isFinite(s.im)) return null
  const terms = opts?.terms ?? DEFAULT_TERMS
  // Pole at 1: return null so samplers split segments.
  if (cAbs(cSub(s, { re: 1, im: 0 })) < 1e-4) return null

  // Exact fast paths for real special values.
  if (s.im === 0) {
    const x = s.re
    if (x === 0) return { re: -0.5, im: 0 }
    if (Number.isInteger(x) && x < 0 && x % 2 === 0) return { re: 0, im: 0 } // trivial zeros
  }

  if (s.re > 0) {
    const out = zetaPositiveRe(s, terms)
    if (!out || !isFiniteC(out)) return null
    // Guard runaway near pole.
    if (cAbs(out) > 1e7) return null
    // Snap tiny imag to 0 for real inputs.
    if (s.im === 0) return { re: out.re, im: 0 }
    return out
  }

  // Re <= 0, s != 0 handled by functional equation.
  // s == 0 handled above. For safety:
  if (s.re === 0 && s.im === 0) return { re: -0.5, im: 0 }

  // zeta(s) = 2^s pi^{s-1} sin(pi s/2) Gamma(1-s) zeta(1-s)
  const oneMinusS: C = { re: 1 - s.re, im: -s.im }
  const inner = zetaPositiveRe(oneMinusS, terms)
  if (!inner || !isFiniteC(inner)) return null
  const t1 = pow2(s)
  const t2 = powPi({ re: s.re - 1, im: s.im })
  const halfPiS: C = { re: (Math.PI * s.re) / 2, im: (Math.PI * s.im) / 2 }
  const t3 = cSin(halfPiS)
  const t4 = complexGamma(oneMinusS)
  if (!isFiniteC(t4)) return null
  let out = cMul(cMul(t1, t2), cMul(t3, t4))
  out = cMul(out, inner)
  if (!isFiniteC(out)) return null
  if (cAbs(out) > 1e7) return null
  if (s.im === 0) return { re: out.re, im: 0 }
  return out
}

export function zetaReal(x: number, opts?: ZetaOptions): number | null {
  if (!Number.isFinite(x)) return null
  if (x === 1) return null
  const out = zetaComplex({ re: x, im: 0 }, opts)
  if (!out || !Number.isFinite(out.re)) return null
  return out.re
}

export function etaComplex(sIn: C, opts?: ZetaOptions): C | null {
  const s = toC(sIn)
  const terms = opts?.terms ?? DEFAULT_TERMS
  // eta(1) = ln 2
  if (cAbs(cSub(s, { re: 1, im: 0 })) < 1e-12) return { re: Math.LN2, im: 0 }
  if (s.re > 0) {
    const e = etaSum(s, terms)
    return isFiniteC(e) ? e : null
  }
  const z = zetaComplex(s, opts)
  if (!z) return null
  const oneMinus: C = { re: 1 - s.re, im: -s.im }
  const factor = cSub({ re: 1, im: 0 }, pow2(oneMinus))
  const out = cMul(factor, z)
  return isFiniteC(out) ? out : null
}
