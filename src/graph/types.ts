import type { Complex } from 'mathjs'

export type EvaluateFn = (x: number) => number | null
export type EvaluateComplexFn = (s: Complex) => Complex | null

export type Plane = 'xy' | 'st' | 'reim'
export type EquationKind = 'real' | 'complex-slice' | 'complex-param' | 'parametric' | 'polar' | 'implicit'

/** Shaded area under a curve between a and b, with its signed value. */
export interface AreaInfo {
  a: number
  b: number
  value: number
}

export type Relation = '=' | '<' | '<=' | '>' | '>='

/** F(x, y) for implicit curves: the relation compares F with 0. */
export type EvaluateXYFn = (x: number, y: number) => number | null

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
  evaluateXY?: EvaluateXYFn
  relation?: Relation
  area?: AreaInfo
  /** Parameter range for parametric/polar curves. */
  tRange?: [number, number]
  kind: EquationKind
  component?: ComplexComponent
  sigma?: number
  suggestedPlane: Plane
  colorToken: number
  visible: boolean
  /** Custom stroke color (hex); overrides colorToken. */
  color?: string
  dash?: LineDash
  /** Stroke width in CSS pixels (default 2). */
  lineWidth?: number
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

export type LineDash = 'solid' | 'dashed' | 'dotted'

export interface Segment {
  xs: Float64Array
  ys: Float64Array
}

export interface CurveSamples {
  segments: Segment[]
  hasPoints: boolean
  /** Shaded cells for inequalities: [x0, y0, ...] world lower-left corners. */
  region?: Float64Array
  /** Cell size in world units for `region`. */
  cell?: number
  /** Cell height in world units (differs from cell with a free aspect). */
  cellY?: number
}

export interface Viewport {
  /** Pixels per world unit on x (and on y unless scaleY is set). */
  scale: number
  originX: number
  originY: number
  /** Pixels per world unit on y when the aspect ratio is free. */
  scaleY?: number
}

export function isComplexKind(kind: EquationKind): boolean {
  return kind === 'complex-slice' || kind === 'complex-param'
}
