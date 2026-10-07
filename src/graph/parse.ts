import { complex as mathComplex, parse as mathParse, type Complex } from 'mathjs'
import { complexScopeExtras, resultToC, resultToComplex } from './complex'
import type { ComplexComponent, EquationKind, EvaluateComplexFn, EvaluateFn, Plane } from './types'

export interface ParseSuccess {
  ok: true
  raw: string
  expr: string
  latex: string
  evaluate: EvaluateFn
  evaluateComplex?: EvaluateComplexFn
  kind: EquationKind
  component: ComplexComponent
  sigma: number
  suggestedPlane: Plane
}

export interface ParseFailure {
  ok: false
  raw: string
  message: string
  position?: number
}

export type ParseResult = ParseSuccess | ParseFailure

const KNOWN_SYMBOLS = [
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'exp',
  'log',
  'log2',
  'log10',
  'sqrt',
  'cbrt',
  'abs',
  'sign',
  'round',
  'floor',
  'ceil',
  'min',
  'max',
  'pow',
  'mod',
  'pi',
  'e',
  'x',
  'i',
  's',
  'z',
  't',
  'zeta',
  'gamma',
  'eta',
  're',
  'im',
  'arg',
  'conj',
]

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[b.length]
}

function didYouMean(name: string): string | null {
  const lower = name.toLowerCase()
  const budget = name.length <= 4 ? 1 : 2
  let best: string | null = null
  let bestDist = budget + 1
  for (const candidate of KNOWN_SYMBOLS) {
    const dist = levenshtein(lower, candidate)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return bestDist <= budget ? best : null
}

interface Normalized {
  expr: string
  map: number[]
}

function normalize(input: string): Normalized {
  const chars: string[] = []
  const map: number[] = []
  const push = (str: string, index: number) => {
    for (const ch of str) {
      chars.push(ch)
      map.push(index)
    }
  }
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    // Preserve commas: mathjs uses them as argument separators
    // (max(1,2), min(x,0), pow(x,2)). Map stays 1:1 for error positions.
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue
    if (ch === ',') push(',', i)
    else if (ch === '−') push('-', i)
    else if (ch === '×') push('*', i)
    else if (ch === '÷') push('/', i)
    else if (ch === '²') push('^2', i)
    else if (ch === '³') push('^3', i)
    else if (ch === 'π') push('pi', i)
    else push(ch, i)
  }
  const text = chars.join('')
  const prefix = /^(?:y|f\(x\))=/i.exec(text)
  const start = prefix ? prefix[0].length : 0
  return { expr: text.slice(start), map: map.slice(start) }
}

/**
 * Normalize s/z to internal x (1-char -> 1-char so error positions are stable).
 * Standalone s/z tokens become x; function names like zeta are untouched
 * because \b boundaries fail inside words.
 */
function normalizeComplexVars(expr: string): string {
  return expr.replace(/\b[sz]\b/g, (m) => (m === m.toUpperCase() ? 'X' : 'x')).replace(/\bX\b/g, 'x')
}

function rawIndex(map: number[], position: number, input: string): number {
  if (position < 0 || position >= map.length) return input.length
  return map[position]
}

function friendlyError(err: unknown, input: string, map: number[]): ParseFailure {
  const message = err instanceof Error ? err.message : String(err)
  const firstLine = message.split('\n')[0]
  const charMatch = /\(char (\d+)\)/.exec(message)
  const position = charMatch ? rawIndex(map, Number(charMatch[1]), input) : undefined

  const fail = (text: string): ParseFailure => ({
    ok: false,
    raw: input,
    message: text,
    position,
  })

  const symbolMatch = /^Undefined symbol (\S+)/.exec(firstLine)
  if (symbolMatch) {
    const name = symbolMatch[1]
    if (/^(zeta|gamma|eta)$/i.test(name)) {
      return fail(`"${name}" needs complex support — try zeta(s) in the σ-t plane`)
    }
    const suggestion = didYouMean(name)
    return fail(
      suggestion ? `unknown symbol "${name}" — did you mean ${suggestion}?` : `unknown symbol "${name}"`
    )
  }
  const funcMatch = /^Undefined function (\S+)/.exec(firstLine)
  if (funcMatch) {
    const name = funcMatch[1]
    if (/^(zeta|gamma|eta)$/i.test(name)) {
      return fail(`"${name}" needs complex support — try zeta(s) in the σ-t plane`)
    }
    const suggestion = didYouMean(name)
    return fail(
      suggestion ? `unknown function "${name}" — did you mean ${suggestion}?` : `unknown function "${name}"`
    )
  }
  const callMatch = /^'(.+?)' is not a function/.exec(firstLine)
  if (callMatch) {
    return fail(`"${callMatch[1]}" is not a function — insert * to multiply, e.g. 2*(x+1)`)
  }
  if (/^Unexpected type of argument in function/.test(firstLine)) {
    return fail('check the arguments — functions need parentheses, e.g. sin(x)')
  }
  if (/^Parenthesis \) expected/.test(firstLine)) {
    return fail('missing closing )')
  }
  if (/^Unexpected end of expression/.test(firstLine)) {
    return fail('unexpected end of expression')
  }
  if (/^Value expected/.test(firstLine)) {
    return fail('incomplete expression')
  }
  const syntaxMatch = /^Syntax error in part "(.*?)"/.exec(firstLine)
  if (syntaxMatch) {
    return fail(`syntax error near "${syntaxMatch[1]}"`)
  }
  const partMatch = /^Unexpected part "(.*?)"/.exec(firstLine)
  if (partMatch) {
    return fail(`unexpected "${partMatch[1]}"`)
  }
  if (/^Invalid left hand side of assignment/.test(firstLine)) {
    return fail('use "y = ..." or just the expression')
  }
  return fail(firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine)
}

function balanceCheck(expr: string, input: string, map: number[]): ParseFailure | null {
  let depth = 0
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < 0) {
        return {
          ok: false,
          raw: input,
          message: 'unexpected ")"',
          position: rawIndex(map, i, input),
        }
      }
    }
  }
  if (depth > 0) {
    let open = -1
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '(') {
        open = i
        break
      }
    }
    return {
      ok: false,
      raw: input,
      message: 'missing closing )',
      position: rawIndex(map, open, input),
    }
  }
  return null
}

function finiteReal(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const COMPLEX_FN_RE = /(zeta|gamma|eta)/i
const VAR_S_Z_RE = /\b[sz]\b/
const VAR_T_RE = /\bt\b/
const VAR_I_RE = /\bi\b/

function looksComplexSyntax(expr: string): boolean {
  return COMPLEX_FN_RE.test(expr) || VAR_S_Z_RE.test(expr) || VAR_I_RE.test(expr)
}

function toTexSafe(expr: string, fallback: string): string {
  try {
    return mathParse(expr).toTex()
  } catch {
    return fallback
  }
}

export function parseEquation(input: string): ParseResult {
  const raw = input.trim()
  if (!raw) {
    return { ok: false, raw, message: 'empty expression' }
  }
  const { expr, map } = normalize(raw)
  if (!expr) {
    return { ok: false, raw, message: 'empty expression' }
  }
  try {
    const balance = balanceCheck(expr, raw, map)
    if (balance) return balance

    const usesSZ = VAR_S_Z_RE.test(expr)
    const usesT = VAR_T_RE.test(expr)
    const syntaxComplex = looksComplexSyntax(expr)

    // Internal expression: s/z normalized to x (1:1 length, map stays valid).
    const internalExpr = normalizeComplexVars(expr)

    const node = mathParse(internalExpr)
    let latex: string
    try {
      latex = node.toTex()
    } catch {
      latex = expr
    }

    const compiled = node.compile()
    const extras = complexScopeExtras()

    const probeReal = (x: number): unknown => {
      const scope: Record<string, unknown> = { x, t: x, s: x, z: x, pi: Math.PI, e: Math.E, ...extras }
      return compiled.evaluate(scope)
    }

    const probeComplex = (s: Complex): unknown => {
      const t = s.im
      const scope: Record<string, unknown> = {
        x: s,
        t,
        s,
        z: s,
        i: mathComplex(0, 1),
        pi: Math.PI,
        e: Math.E,
        ...extras,
      }
      return compiled.evaluate(scope)
    }

    // Probe 1: real x=1.5 (fallback x=7 for domain errors like log).
    let realOk = false
    try {
      const v = probeReal(1.5)
      if (finiteReal(v)) realOk = true
      else {
        // Complex-valued at real x counts as complex, not failure.
        const c = resultToC(v)
        if (c) realOk = false
        else {
          try {
            const v2 = probeReal(7)
            if (finiteReal(v2)) realOk = true
          } catch {
            // fall through to complex probe
          }
        }
      }
    } catch {
      try {
        const v2 = probeReal(7)
        if (finiteReal(v2)) realOk = true
      } catch {
        realOk = false
      }
    }

    // Probe 2: complex s = 0.5 + 14i.
    let complexOk = false
    let complexSample: unknown = null
    try {
      complexSample = probeComplex(mathComplex(0.5, 14))
      if (resultToC(complexSample)) complexOk = true
      else if (finiteReal(complexSample)) complexOk = true
    } catch {
      complexOk = false
    }

    let kind: EquationKind = 'real'
    let suggestedPlane: Plane = 'xy'
    if (!realOk && complexOk) {
      kind = usesSZ ? 'complex-param' : 'complex-slice'
      suggestedPlane = 'st'
    } else if (realOk && syntaxComplex && (complexOk || usesSZ || usesT)) {
      // e.g. zeta(0.5+i*t): real probe may succeed at t=1.5 (zeta(0.5+1.5i) is finite
      // complex, not real) — actually realOk stays false there. This branch covers
      // expressions valid in both worlds; prefer complex when syntax says so.
      kind = usesSZ ? 'complex-param' : 'complex-slice'
      suggestedPlane = 'st'
    } else if (!realOk && !complexOk) {
      // Neither probe worked — surface the real-probe error for caret placement.
      try {
        probeReal(1.5)
      } catch (errAgain) {
        try {
          probeReal(7)
        } catch {
          return friendlyError(errAgain, raw, map)
        }
      }
      // Probes returned non-finite without throwing (e.g. 1/(x-3) at x=1.5 is fine,
      // but something like sqrt(x)*... ). Try to evaluate at another point before failing.
      return friendlyError(new Error('no finite values in view — check the domain'), raw, map)
    }

    const sigma = 0.5
    const component: ComplexComponent = 're'

    if (kind === 'real') {
      const evaluate: EvaluateFn = (x) => {
        try {
          const value = probeReal(x)
          return finiteReal(value) ? value : null
        } catch {
          return null
        }
      }
      return { ok: true, raw, expr, latex, evaluate, kind, component, sigma, suggestedPlane }
    }

    // Complex kinds: real slice evaluator returns Re(component) at sigma fixed,
    // interpreting the free variable as t. evaluateComplex evaluates at s.
    const evaluateComplex: EvaluateComplexFn = (s) => {
      try {
        const v = probeComplex(s)
        return resultToComplex(v)
      } catch {
        return null
      }
    }

    const evaluate: EvaluateFn = (t) => {
      // xy-plane reuse: x relabeled to t, sigma fixed at default.
      // Component applied with default 're'; UI overrides via sampler directly.
      try {
        const s = mathComplex(sigma, t)
        const v = probeComplex(s)
        const c = resultToC(v)
        if (!c) return null
        return Number.isFinite(c.re) ? c.re : null
      } catch {
        return null
      }
    }

    return {
      ok: true,
      raw,
      expr,
      latex: toTexSafe(internalExpr, latex),
      evaluate,
      evaluateComplex,
      kind,
      component,
      sigma,
      suggestedPlane,
    }
  } catch (err) {
    return friendlyError(err, raw, map)
  }
}
