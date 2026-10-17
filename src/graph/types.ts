import type { Complex } from 'mathjs'

export type EvaluateFn = (x: number) => number | null
export type EvaluateComplexFn = (s: Complex) => Complex | null

export type Plane = 'xy' | 'st' | 'reim'
export type EquationKind = 'real' | 'complex-slice' | 'complex-param' | 'parametric' | 'polar'

/** Parametric/polar point at parameter t (polar: t is θ). */
export type EvaluatePointFn = (t: number) => [number, number] | null
export type ComplexComponent = 're' | 'im' | 'abs' | 'arg'

export interface Equation {
  id: string
  raw: string
  latex: string
  evaluate: EvaluateFn
  evaluateComplex?: EvaluateComplexFn
  evaluatePoint?: EvaluatePointFn
  /** Parameter range for parametric/polar curves. */
  tRange?: [number, number]
  kind: EquationKind
  component?: ComplexComponent
  sigma?: number
  suggestedPlane: Plane
  colorToken: number
  visible: boolean
  /** False for constant definitions (`a = 2`) and equations that failed to parse. */
  plot: boolean
  /** Name this equation defines (`a` in `a = 2`, `f` in `f(x) = ...`). */
  defName?: string
  /** Current value of a constant definition. */
  constValue?: number
  /** Parse error after a dependency changed (e.g. its definition was deleted). */
  error?: string
  /** Changes whenever the curve's values may change; part of the sample cache key. */
  rev: string
}

export interface Segment {
  xs: Float64Array
  ys: Float64Array
}

export interface CurveSamples {
  segments: Segment[]
  hasPoints: boolean
}

export interface Viewport {
  scale: number
  originX: number
  originY: number
}

export function isComplexKind(kind: EquationKind): boolean {
  return kind === 'complex-slice' || kind === 'complex-param'
}
