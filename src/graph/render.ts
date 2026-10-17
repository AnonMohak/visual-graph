import { slopeAt, type Feature } from './analysis'
import type { GraphColors } from './color'
import type { ViewSettings } from './view'
import type { AreaInfo, CurveSamples, EvaluateFn, LineDash, Viewport } from './types'
import { formatNumber, formatTick, niceStep, screenToWorldX, screenToWorldY, worldToScreenX, worldToScreenY, yScale } from './viewport'

export interface RenderCurve {
  id: string
  colorIndex: number
  visible: boolean
  samples: CurveSamples
  evaluate: EvaluateFn
  /** Custom stroke color; overrides colorIndex. */
  color?: string
  dash?: LineDash
  lineWidth?: number
  /** Shaded area between the curve and the x-axis. */
  area?: AreaInfo
  /** Strict inequality: draw the boundary dashed. */
  strict?: boolean
}

export interface AxisLabels {
  x: string
  y: string
}

export interface RenderState {
  width: number
  height: number
  dpr: number
  viewport: Viewport
  colors: GraphColors
  curves: RenderCurve[]
  hover: { x: number; y: number } | null
  snapX: number | null
  /** Axis labels: x vs t vs sigma vs Re (default x/y). */
  labels?: AxisLabels
  /** Field background for st plane (domain-coloring bitmap). */
  field?: ImageBitmap | HTMLCanvasElement | null
  /** Sigma reference line for reim plane (vertical Re=... marker text). */
  sigmaRef?: number | null
  /** When true, hover crosshair/markers/chips are skipped (animated mode). */
  disableHover?: boolean
  /** Roots, extrema, inflections and intersections to mark. */
  features?: Feature[]
  /** Draw the tangent line of each curve at the hover x. */
  tangent?: boolean
  /** Grid/axes visibility, custom grid step and labels, log axes. */
  view?: RenderView
}

export type RenderView = Pick<ViewSettings, 'grid' | 'axes' | 'gridStep' | 'logX' | 'logY' | 'xLabel' | 'yLabel'>

export const ZERO_TS = [14.1347, 21.022, 25.0109]

const MONO_FONT = '"Geist Mono Variable", ui-monospace, monospace'
const MAX_MINOR_LINES = 4000
const MAX_LABELS = 400

/** Major tick step for one axis: fixed by the user, decades on log axes, else from zoom. */
function majorStep(scale: number, log: boolean, fixed: number | null | undefined): number {
  const auto = niceStep(scale)
  if (log) return Math.max(1, Math.round(auto))
  if (fixed && fixed > 0) {
    // Keep a fixed step readable: double it until majors are >= 16px apart.
    let step = fixed
    while (step * scale < 16) step *= 2
    return step
  }
  return auto
}

interface AxisSteps {
  x: number
  y: number
}

function axisSteps(state: RenderState): AxisSteps {
  const vp = state.viewport
  const view = state.view
  return {
    x: majorStep(vp.scale, Boolean(view?.logX), view?.gridStep),
    y: majorStep(yScale(vp), Boolean(view?.logY), view?.gridStep),
  }
}

/** World positions of grid lines on one axis between lo and hi. */
function gridLines(lo: number, hi: number, step: number, logMinor: boolean, pixelsPerDecade: number): number[] {
  const out: number[] = []
  if (logMinor) {
    // Log minors at log10(k) inside each decade, only when decades are wide enough.
    if (pixelsPerDecade < 60) return out
    for (let n = Math.floor(lo); n <= Math.ceil(hi); n++) {
      for (let k = 2; k <= 9; k++) {
        const v = n + Math.log10(k)
        if (v >= lo && v <= hi) out.push(v)
      }
    }
    return out
  }
  if ((hi - lo) / step > MAX_MINOR_LINES / 2) return out
  for (let i = Math.ceil(lo / step); i <= Math.floor(hi / step); i++) out.push(i * step)
  return out
}

function drawGrid(ctx: CanvasRenderingContext2D, state: RenderState, steps: AxisSteps, minor: boolean, color: string): void {
  const { width, height, viewport: vp, dpr, view } = state
  const crisp = (value: number) => Math.round(value * dpr) / dpr + 0.5 / dpr
  const xMin = screenToWorldX(vp, 0)
  const xMax = screenToWorldX(vp, width)
  const yMin = screenToWorldY(vp, height)
  const yMax = screenToWorldY(vp, 0)
  const logX = Boolean(view?.logX)
  const logY = Boolean(view?.logY)
  const xs = gridLines(xMin, xMax, minor ? steps.x / 5 : steps.x, minor && logX, vp.scale)
  const ys = gridLines(yMin, yMax, minor ? steps.y / 5 : steps.y, minor && logY, yScale(vp))

  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const x of xs) {
    const sx = crisp(worldToScreenX(vp, x))
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
  }
  for (const y of ys) {
    const sy = crisp(worldToScreenY(vp, y))
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
  }
  ctx.stroke()
}

function tickText(value: number, step: number, log: boolean): string {
  return log ? formatNumber(10 ** value, 4) : formatTick(value, step)
}

function drawAxesAndLabels(ctx: CanvasRenderingContext2D, state: RenderState, steps: AxisSteps): void {
  const { width, height, viewport: vp, colors, dpr, view } = state
  const crisp = (value: number) => Math.round(value * dpr) / dpr + 0.5 / dpr
  const showAxes = view?.axes ?? true
  // Log axes have no zero line; ticks go along the edges.
  const axisY = view?.logY ? -1 : worldToScreenY(vp, 0)
  const axisX = view?.logX ? -1 : worldToScreenX(vp, 0)
  const yAxisVisible = axisX >= 0 && axisX <= width
  const xAxisVisible = axisY >= 0 && axisY <= height

  if (showAxes) {
    ctx.strokeStyle = colors.axis
    ctx.lineWidth = 1
    ctx.beginPath()
    if (xAxisVisible) {
      const y = crisp(axisY)
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    if (yAxisVisible) {
      const x = crisp(axisX)
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    ctx.stroke()

    const xMin = screenToWorldX(vp, 0)
    const xMax = screenToWorldX(vp, width)
    const yMin = screenToWorldY(vp, height)
    const yMax = screenToWorldY(vp, 0)

    ctx.font = `11px ${MONO_FONT}`
    ctx.fillStyle = colors.label

    const xLabelY = xAxisVisible ? axisY + 5 : height - 7 - 11
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    let labels = 0
    for (let i = Math.ceil(xMin / steps.x); i <= Math.floor(xMax / steps.x) && labels < MAX_LABELS; i++) {
      const value = i * steps.x
      const sx = worldToScreenX(vp, value)
      if (sx < 26 || sx > width - 26) continue
      if (yAxisVisible && Math.abs(sx - axisX) < 18) continue
      ctx.fillText(tickText(value, steps.x, Boolean(view?.logX)), sx, xLabelY)
      labels++
    }

    const yLabelX = yAxisVisible ? axisX - 7 : 7
    ctx.textAlign = yAxisVisible ? 'right' : 'left'
    ctx.textBaseline = 'middle'
    labels = 0
    for (let i = Math.ceil(yMin / steps.y); i <= Math.floor(yMax / steps.y) && labels < MAX_LABELS; i++) {
      const value = i * steps.y
      const sy = worldToScreenY(vp, value)
      if (sy < 8 || sy > height - 8) continue
      if (xAxisVisible && Math.abs(sy - axisY) < 12) continue
      ctx.fillText(tickText(value, steps.y, Boolean(view?.logY)), yLabelX, sy)
      labels++
    }
  }

  // Axis names (x vs t vs sigma vs Re), overridden by custom labels.
  const names = state.labels
  const xName = view?.xLabel || names?.x
  const yName = view?.yLabel || names?.y
  if (xName || yName) {
    ctx.fillStyle = colors.label
    ctx.font = `11px ${MONO_FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    if (xName) ctx.fillText(xName, width - 8, height - 8)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    if (yName) ctx.fillText(yName, 8, 8)
  }
}

function drawArea(ctx: CanvasRenderingContext2D, state: RenderState, curve: RenderCurve, color: string): void {
  const area = curve.area
  if (!area) return
  const { viewport: vp, width } = state
  const left = Math.max(area.a, screenToWorldX(vp, -2))
  const right = Math.min(area.b, screenToWorldX(vp, width + 2))
  if (left >= right) return
  const steps = Math.max(2, Math.ceil((right - left) * vp.scale))
  const axisY = worldToScreenY(vp, 0)
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = 0.22
  ctx.beginPath()
  ctx.moveTo(worldToScreenX(vp, left), axisY)
  for (let k = 0; k <= steps; k++) {
    const x = left + ((right - left) * k) / steps
    const y = curve.evaluate(x)
    ctx.lineTo(worldToScreenX(vp, x), y === null ? axisY : worldToScreenY(vp, y))
  }
  ctx.lineTo(worldToScreenX(vp, right), axisY)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.font = `11px ${MONO_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = color
  const mid = (left + right) / 2
  ctx.fillText(`∫ = ${formatNumber(area.value, 5)}`, worldToScreenX(vp, mid), axisY - 6)
  ctx.restore()
}

function drawCurves(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { viewport: vp, colors } = state
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const curve of state.curves) {
    if (!curve.visible) continue
    const color = curve.color ?? colors.charts[curve.colorIndex % colors.charts.length]
    ctx.save()
    const region = curve.samples.region
    const cell = curve.samples.cell
    if (region && cell) {
      // One path for all shaded cells; +0.5px overlap hides seams between cells.
      const cellY = curve.samples.cellY ?? cell
      const sizeX = cell * vp.scale + 0.5
      const sizeY = cellY * yScale(vp) + 0.5
      ctx.fillStyle = color
      ctx.globalAlpha = 0.18
      ctx.beginPath()
      for (let k = 0; k < region.length; k += 2) {
        ctx.rect(worldToScreenX(vp, region[k]), worldToScreenY(vp, region[k + 1] + cellY), sizeX, sizeY)
      }
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (curve.area) drawArea(ctx, state, curve, color)
    const points = curve.samples.points
    if (points) {
      const radius = (curve.lineWidth ?? 2) + 1.5
      ctx.fillStyle = color
      ctx.beginPath()
      for (let k = 0; k < points.xs.length; k++) {
        const sx = worldToScreenX(vp, points.xs[k])
        const sy = worldToScreenY(vp, points.ys[k])
        ctx.moveTo(sx + radius, sy)
        ctx.arc(sx, sy, radius, 0, Math.PI * 2)
      }
      ctx.fill()
    }
    const width = curve.lineWidth ?? 2
    ctx.lineWidth = width
    if (curve.dash === 'dashed') ctx.setLineDash([width * 4, width * 3])
    else if (curve.dash === 'dotted') ctx.setLineDash([0.1, width * 2.5])
    else if (curve.strict) ctx.setLineDash([6, 5])
    // Subtle glow: same-hue shadow, low blur so thin curves stay crisp.
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.beginPath()
    for (const segment of curve.samples.segments) {
      for (let i = 0; i < segment.xs.length; i++) {
        const sx = worldToScreenX(vp, segment.xs[i])
        const sy = worldToScreenY(vp, segment.ys[i])
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
    }
    ctx.stroke()
    ctx.restore()
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const hover = state.hover
  if (!hover || state.disableHover) return
  const { width, height, colors, dpr } = state
  const crisp = (value: number) => Math.round(value * dpr) / dpr + 0.5 / dpr
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.globalAlpha = 0.45
  ctx.strokeStyle = colors.accent
  ctx.lineWidth = 1
  ctx.beginPath()
  const hx = crisp(hover.x)
  const hy = crisp(hover.y)
  ctx.moveTo(hx, 0)
  ctx.lineTo(hx, height)
  ctx.moveTo(0, hy)
  ctx.lineTo(width, hy)
  ctx.stroke()
  ctx.restore()
}

function drawSnap(ctx: CanvasRenderingContext2D, state: RenderState): void {
  if (state.snapX === null) return
  const { width, height, viewport: vp, colors, dpr } = state
  const sx = worldToScreenX(vp, state.snapX)
  if (sx < -1 || sx > width + 1) return
  const crispX = Math.round(sx * dpr) / dpr + 0.5 / dpr

  ctx.save()
  ctx.strokeStyle = colors.accent
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(crispX, 0)
  ctx.lineTo(crispX, height)
  ctx.stroke()

  const axisName = state.labels?.x ?? 'x'
  const label = `${axisName}=${formatNumber(state.snapX, 3)}`
  ctx.globalAlpha = 1
  ctx.font = `10px ${MONO_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const metrics = ctx.measureText(label)
  const boxWidth = metrics.width + 10
  const boxHeight = 16
  let boxX = crispX + 5
  if (boxX + boxWidth > width - 4) boxX = crispX - 5 - boxWidth
  const boxY = 6
  ctx.globalAlpha = 0.16
  ctx.fillStyle = colors.accent
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4)
    ctx.fill()
  } else {
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight)
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = colors.accent
  ctx.fillText(label, boxX + 5, boxY + 3)
  ctx.restore()
}

function drawMarkers(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { viewport: vp, colors, height, width } = state
  const hoverWorld = !state.disableHover && state.hover ? screenToWorldX(vp, state.hover.x) : null
  const snapWorld = state.snapX
  if (hoverWorld === null && snapWorld === null) return

  for (const curve of state.curves) {
    if (!curve.visible) continue
    const color = curve.color ?? colors.charts[curve.colorIndex % colors.charts.length]
    const worlds: { wx: number; isHover: boolean }[] = []
    if (hoverWorld !== null) worlds.push({ wx: hoverWorld, isHover: true })
    if (snapWorld !== null) worlds.push({ wx: snapWorld, isHover: false })
    for (const { wx, isHover } of worlds) {
      const y = curve.evaluate(wx)
      if (y === null || !Number.isFinite(y)) continue
      const sy = worldToScreenY(vp, y)
      if (sy < -12 || sy > height + 12) continue
      const sxs = worldToScreenX(vp, wx)
      // Pulse ring on hover: soft outer halo + crisp dot.
      if (isHover) {
        ctx.save()
        ctx.globalAlpha = 0.35
        ctx.beginPath()
        ctx.arc(sxs, sy, 8, 0, Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
      ctx.beginPath()
      ctx.arc(sxs, sy, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = colors.background
      ctx.stroke()
      // Value chip next to hover markers (skip when hover disabled).
      if (isHover) {
        const text = formatNumber(y, 3)
        ctx.save()
        ctx.font = `10px ${MONO_FONT}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const metrics = ctx.measureText(text)
        const boxW = metrics.width + 10
        const boxH = 15
        let boxX = sxs + 10
        if (boxX + boxW > width - 4) boxX = sxs - 10 - boxW
        const boxY = Math.min(Math.max(sy - boxH - 8, 4), height - boxH - 4)
        ctx.globalAlpha = 0.85
        ctx.fillStyle = colors.background
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath()
          ctx.roundRect(boxX, boxY, boxW, boxH, 4)
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.strokeStyle = color
          ctx.lineWidth = 1
          ctx.stroke()
        } else {
          ctx.fillRect(boxX, boxY, boxW, boxH)
          ctx.globalAlpha = 1
        }
        ctx.globalAlpha = 1
        ctx.fillStyle = color
        ctx.fillText(text, boxX + 5, boxY + boxH / 2)
        ctx.restore()
      }
    }
  }
}

const FEATURE_LABEL: Record<Feature['type'], string> = {
  root: 'root',
  max: 'max',
  min: 'min',
  inflection: 'inflection',
  intersection: 'intersection',
}

function drawChip(ctx: CanvasRenderingContext2D, state: RenderState, text: string, x: number, y: number, color: string): void {
  const { width, height, colors } = state
  ctx.save()
  ctx.font = `10px ${MONO_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const boxW = ctx.measureText(text).width + 10
  const boxH = 15
  let boxX = x + 10
  if (boxX + boxW > width - 4) boxX = x - 10 - boxW
  const boxY = Math.min(Math.max(y - boxH - 8, 4), height - boxH - 4)
  ctx.globalAlpha = 0.9
  ctx.fillStyle = colors.background
  ctx.fillRect(boxX, boxY, boxW, boxH)
  ctx.globalAlpha = 1
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1)
  ctx.fillStyle = color
  ctx.fillText(text, boxX + 5, boxY + boxH / 2)
  ctx.restore()
}

function drawFeatures(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const features = state.features
  if (!features?.length) return
  const { viewport: vp, colors } = state
  const hover = state.disableHover ? null : state.hover
  let nearest: { feature: Feature; sx: number; sy: number } | null = null
  let nearestDist = 10
  for (const feature of features) {
    const sx = worldToScreenX(vp, feature.x)
    const sy = worldToScreenY(vp, feature.y)
    const color = feature.type === 'intersection' ? colors.accent : (feature.color ?? colors.charts[feature.colorIndex % colors.charts.length])
    ctx.beginPath()
    ctx.arc(sx, sy, 4, 0, Math.PI * 2)
    ctx.fillStyle = colors.background
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = color
    ctx.stroke()
    if (hover) {
      const dist = Math.hypot(sx - hover.x, sy - hover.y)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = { feature, sx, sy }
      }
    }
  }
  if (nearest) {
    const { feature, sx, sy } = nearest
    const color = feature.type === 'intersection' ? colors.accent : (feature.color ?? colors.charts[feature.colorIndex % colors.charts.length])
    drawChip(ctx, state, `${FEATURE_LABEL[feature.type]} (${formatNumber(feature.x, 4)}, ${formatNumber(feature.y, 4)})`, sx, sy, color)
  }
}

function drawTangents(ctx: CanvasRenderingContext2D, state: RenderState): void {
  if (!state.tangent || !state.hover || state.disableHover) return
  const { viewport: vp, colors, width } = state
  const x = screenToWorldX(vp, state.hover.x)
  for (const curve of state.curves) {
    if (!curve.visible) continue
    const y = curve.evaluate(x)
    const m = y === null ? null : slopeAt(curve.evaluate, x)
    if (y === null || m === null || !Number.isFinite(m)) continue
    const color = curve.color ?? colors.charts[curve.colorIndex % colors.charts.length]
    const x0 = screenToWorldX(vp, 0)
    const x1 = screenToWorldX(vp, width)
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.8
    ctx.lineWidth = 1.25
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, worldToScreenY(vp, y + m * (x0 - x)))
    ctx.lineTo(width, worldToScreenY(vp, y + m * (x1 - x)))
    ctx.stroke()
    ctx.restore()
    drawChip(ctx, state, `m=${formatNumber(m, 4)}`, worldToScreenX(vp, x), worldToScreenY(vp, y) + 34, color)
  }
}

function drawSigmaRef(ctx: CanvasRenderingContext2D, state: RenderState): void {
  if (state.sigmaRef === null || state.sigmaRef === undefined) return
  const { colors, height } = state
  ctx.save()
  ctx.font = `11px ${MONO_FONT}`
  ctx.fillStyle = colors.label
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`σ=${state.sigmaRef}`, 8, height - 24)
  ctx.restore()
}

function drawZeroMarkers(ctx: CanvasRenderingContext2D, state: RenderState): void {
  // Nontrivial-zero guide line: critical line sigma=0.5 + first zeros.
  // Hover shows a tooltip chip; there is intentionally no click action.
  const { viewport: vp, width, height } = state
  const sx = worldToScreenX(vp, 0.5)
  if (sx >= 0 && sx <= width) {
    ctx.save()
    ctx.setLineDash([2, 4])
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = state.colors.accent
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
    ctx.stroke()
    ctx.restore()
  }
  ctx.save()
  ctx.fillStyle = state.colors.accent
  const dots: { x: number; y: number; t: number }[] = []
  for (const t of ZERO_TS) {
    for (const tt of [t, -t]) {
      const sy = worldToScreenY(vp, tt)
      if (sy < -6 || sy > height + 6) continue
      if (sx < -6 || sx > width + 6) continue
      ctx.beginPath()
      ctx.arc(sx, sy, 3, 0, Math.PI * 2)
      ctx.globalAlpha = 0.8
      ctx.fill()
      dots.push({ x: sx, y: sy, t: tt })
    }
  }
  ctx.restore()
  // Hover tooltip for the nearest zero (display only, no click).
  const hover = state.disableHover ? null : state.hover
  if (!hover || !dots.length) return
  let best: { x: number; y: number; t: number } | null = null
  let bestDist = 16
  for (const d of dots) {
    const dist = Math.hypot(d.x - hover.x, d.y - hover.y)
    if (dist < bestDist) {
      bestDist = dist
      best = d
    }
  }
  if (!best) return
  const label = `zero t≈${formatNumber(best.t, 4)}`
  ctx.save()
  ctx.font = `10px ${MONO_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const metrics = ctx.measureText(label)
  const boxW = metrics.width + 12
  const boxH = 16
  let boxX = best.x + 10
  if (boxX + boxW > width - 4) boxX = best.x - 10 - boxW
  const boxY = Math.min(Math.max(best.y - boxH / 2, 4), height - boxH - 4)
  ctx.globalAlpha = 0.9
  ctx.fillStyle = state.colors.background
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(boxX, boxY, boxW, boxH, 4)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = state.colors.accent
    ctx.lineWidth = 1
    ctx.stroke()
  } else {
    ctx.fillRect(boxX, boxY, boxW, boxH)
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = state.colors.accent
  ctx.fillText(label, boxX + 6, boxY + boxH / 2)
  ctx.restore()
}

export function drawGraph(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { width, height, colors, dpr } = state
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, width, height)

  if (state.field) {
    try {
      if (state.field instanceof ImageBitmap) {
        ctx.drawImage(state.field, 0, 0, width, height)
      } else {
        ctx.drawImage(state.field, 0, 0, width, height)
      }
    } catch {
      // stale field bitmap — fall through to grid
    }
  }

  const steps = axisSteps(state)
  if (state.view?.grid ?? true) {
    drawGrid(ctx, state, steps, true, colors.gridMinor)
    drawGrid(ctx, state, steps, false, colors.gridMajor)
  }
  drawAxesAndLabels(ctx, state, steps)
  if (state.field) drawZeroMarkers(ctx, state)
  drawCurves(ctx, state)
  drawTangents(ctx, state)
  drawFeatures(ctx, state)
  drawCrosshair(ctx, state)
  drawSnap(ctx, state)
  drawMarkers(ctx, state)
  drawSigmaRef(ctx, state)
}

/** Parametric output renderer: same stroke path, Re/Im labels, sigma reference. */
export function drawParametric(ctx: CanvasRenderingContext2D, state: RenderState): void {
  drawGraph(
    ctx,
    state.labels
      ? state
      : { ...state, labels: { x: 'Re', y: 'Im' } }
  )
}

/** Domain-coloring field renderer: ImageData layer + grid/axes/zero markers. */
export function drawField(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  field: ImageBitmap | HTMLCanvasElement | null
): void {
  drawGraph(ctx, { ...state, field, labels: state.labels ?? { x: 'σ', y: 't' } })
}
