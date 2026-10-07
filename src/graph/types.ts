import type { Complex } from 'mathjs'

export type EvaluateFn = (x: number) => number | null
export type EvaluateComplexFn = (s: Complex) => Complex | null

export type Plane = 'xy' | 'st' | 'reim'
export type EquationKind = 'real' | 'complex-slice' | 'complex-param'
export type ComplexComponent = 're' | 'im' | 'abs' | 'arg'

export interface Equation {
  id: string
  raw: string
  latex: string
  evaluate: EvaluateFn
  evaluateComplex?: EvaluateComplexFn
  kind: EquationKind
  component?: ComplexComponent
  sigma?: number
  suggestedPlane: Plane
  colorToken: number
  visible: boolean
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
