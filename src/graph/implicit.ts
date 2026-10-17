import type { CurveSamples, Relation, Segment, Viewport } from './types'
import { screenToWorldX, screenToWorldY } from './viewport'


/** Corner values larger than this are treated as a pole, not a crossing. */
const POLE = 1e6

function holds(value: number, relation: Relation): boolean {
  switch (relation) {
    case '<':
      return value < 0
    case '<=':
      return value <= 0
    case '>':
      return value > 0
    case '>=':
      return value >= 0
    default:
      return false
  }
}

/**
 * Sample F(x, y) = 0 on a screen-aligned grid with marching squares.
 * For inequalities, also collect the grid cells where the relation holds.
 */
export function sampleImplicit(
  evaluateXY: (x: number, y: number) => number | null,
  relation: Relation,
  vp: Viewport,
  width: number,
  height: number,
  cellPx: number
): CurveSamples {
  const nx = Math.ceil(width / cellPx) + 1
  const ny = Math.ceil(height / cellPx) + 1
  const cell = cellPx / vp.scale
  const x0 = screenToWorldX(vp, 0)
  const yTop = screenToWorldY(vp, 0)
  const values = new Float64Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    const wy = yTop - j * cell
    for (let i = 0; i < nx; i++) {
      const v = evaluateXY(x0 + i * cell, wy)
      values[j * nx + i] = v === null || !Number.isFinite(v) ? NaN : v
    }
  }

  const segments: Segment[] = []
  const region: number[] = []
  const shade = relation !== '='
  // Linear interpolation of the zero along an edge, as a fraction from a to b.
  const lerp = (a: number, b: number) => a / (a - b)
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const tl = values[j * nx + i]
      const tr = values[j * nx + i + 1]
      const br = values[(j + 1) * nx + i + 1]
      const bl = values[(j + 1) * nx + i]
      const cx = x0 + i * cell
      const cy = yTop - j * cell
      if (shade) {
        const mid = (tl + tr + br + bl) / 4
        if (Number.isFinite(mid) && holds(mid, relation)) region.push(cx, cy - cell)
      }
      if (!Number.isFinite(tl + tr + br + bl)) continue
      if (Math.max(Math.abs(tl), Math.abs(tr), Math.abs(br), Math.abs(bl)) > POLE) continue
      const code = (tl > 0 ? 8 : 0) | (tr > 0 ? 4 : 0) | (br > 0 ? 2 : 0) | (bl > 0 ? 1 : 0)
      if (code === 0 || code === 15) continue
      const top: [number, number] = [cx + lerp(tl, tr) * cell, cy]
      const right: [number, number] = [cx + cell, cy - lerp(tr, br) * cell]
      const bottom: [number, number] = [cx + lerp(bl, br) * cell, cy - cell]
      const left: [number, number] = [cx, cy - lerp(tl, bl) * cell]
      const lines: [number, number][][] = []
      switch (code) {
        case 1:
        case 14:
          lines.push([left, bottom])
          break
        case 2:
        case 13:
          lines.push([bottom, right])
          break
        case 3:
        case 12:
          lines.push([left, right])
          break
        case 4:
        case 11:
          lines.push([top, right])
          break
        case 6:
        case 9:
          lines.push([top, bottom])
          break
        case 7:
        case 8:
          lines.push([left, top])
          break
        case 5:
          lines.push([left, top], [bottom, right])
          break
        case 10:
          lines.push([left, bottom], [top, right])
          break
      }
      for (const [a, b] of lines) {
        segments.push({ xs: Float64Array.of(a[0], b[0]), ys: Float64Array.of(a[1], b[1]) })
      }
    }
  }
  return {
    segments,
    hasPoints: segments.length > 0 || region.length > 0,
    region: shade ? Float64Array.from(region) : undefined,
    cell,
  }
}
