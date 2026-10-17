import { cos, cot, csc, sec, sin, tan, asin, acos, atan } from 'mathjs'
import { parseEquation, type Env, type ParseSuccess } from './parse'
import { degreeScope, type AngleUnit } from './view'
import type { Equation, LineDash } from './types'

/** Persisted part of an equation: what the user typed plus display options. */
export interface EquationSpec {
  id: string
  raw: string
  colorToken: number
  visible: boolean
  color?: string
  dash?: LineDash
  lineWidth?: number
  /** Folder name in the legend; undefined = ungrouped. */
  group?: string
}

export interface BuildResult {
  equations: Equation[]
  env: Env
  /** Raw text of every definition, in dependency order (for the field worker). */
  defRaws: string[]
}

let specSeq = 0

export function newSpecId(): string {
  specSeq += 1
  return `eq-${Date.now().toString(36)}-${specSeq}`
}

function envSignature(env: Env): string {
  return Object.entries(env)
    .map(([name, value]) => `${name}:${typeof value === 'number' ? value : 'fn'}`)
    .join(',')
}

/**
 * Parse every spec against a shared environment of user definitions.
 * Definitions can appear in any order: they are resolved in passes until
 * no new name resolves. Specs that still fail keep their text with an error.
 */
export interface BuildOptions {
  angle?: AngleUnit
}

const RADIAN_TRIG = { sin, cos, tan, cot, sec, csc, asin, acos, atan } as unknown as Record<string, (v: unknown) => unknown>

export function buildEquations(specs: EquationSpec[], options: BuildOptions = {}): BuildResult {
  const angle = options.angle ?? 'rad'
  // Degree mode: trig overrides live in the environment every equation sees.
  const env: Env = angle === 'deg' ? degreeScope(RADIAN_TRIG) : {}
  const defRaws: string[] = []
  const resolved = new Map<string, ParseSuccess>()
  const definers = new Map<string, string>()
  let progress = true
  while (progress) {
    progress = false
    for (const spec of specs) {
      if (resolved.has(spec.id)) continue
      const parsed = parseEquation(spec.raw, env)
      if (!parsed.ok || !parsed.def) continue
      if (definers.has(parsed.def.name)) continue
      definers.set(parsed.def.name, spec.id)
      env[parsed.def.name] = parsed.def.type === 'const' ? parsed.def.value : parsed.def.fn
      defRaws.push(spec.raw)
      resolved.set(spec.id, parsed)
      progress = true
    }
  }
  const signature = `${angle}|${envSignature(env)}`
  const equations = specs.map((spec): Equation => {
    let parsed = resolved.get(spec.id)
    let error: string | undefined
    if (!parsed) {
      const result = parseEquation(spec.raw, env)
      if (result.ok && result.def && definers.get(result.def.name) !== spec.id) {
        error = `"${result.def.name}" is already defined`
      } else if (result.ok) {
        parsed = result
      } else {
        error = result.message
      }
    }
    if (!parsed) {
      return {
        ...spec,
        latex: spec.raw,
        evaluate: () => null,
        kind: 'real',
        suggestedPlane: 'xy',
        plot: false,
        error,
        rev: spec.raw,
      }
    }
    return {
      ...spec,
      raw: parsed.raw,
      latex: parsed.latex,
      evaluate: parsed.evaluate,
      evaluateComplex: parsed.evaluateComplex,
      evaluatePoint: parsed.evaluatePoint,
      evaluateXY: parsed.evaluateXY,
      relation: parsed.relation,
      area: parsed.area,
      points: parsed.points,
      tRange: parsed.tRange,
      kind: parsed.kind,
      component: parsed.component,
      sigma: parsed.sigma,
      suggestedPlane: parsed.suggestedPlane,
      plot: parsed.plot,
      defName: parsed.def?.name,
      constValue: parsed.def?.type === 'const' ? parsed.def.value : undefined,
      rev: `${parsed.raw}|${signature}`,
    }
  })
  return { equations, env, defRaws }
}

/** Build the definition environment alone from definition raws (field worker). */
export function envFromDefs(defRaws: string[]): Env {
  return buildEquations(defRaws.map((raw, k) => ({ id: `d${k}`, raw, colorToken: 0, visible: true }))).env
}

export function nextColorToken(specs: { colorToken: number }[]): number {
  const used = new Set(specs.map((spec) => spec.colorToken))
  for (let token = 0; token < 5; token++) {
    if (!used.has(token)) return token
  }
  return specs.length % 5
}
