import type { GraphColors } from './color'
import type { CurveSamples, EvaluateFn, Viewport } from './types'
import { formatNumber, formatTick, niceStep, screenToWorldX, screenToWorldY, worldToScreenX, worldToScreenY } from './viewport'

export interface RenderCurve {
  id: string
  colorIndex: number
  visible: boolean
  samples: CurveSamples
  evaluate: EvaluateFn
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
}

export const ZERO_TS = [14.1347, 21.022, 25.0109]

const MONO_FONT = '"Geist Mono Variable", ui-monospace, monospace'
const MAX_MINOR_LINES = 4000
const MAX_LABELS = 400

function drawGrid(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  step: number,
  color: string
): void {
  const { width, height, viewport: vp, dpr } = state
  const crisp = (value: number) => Math.round(value * dpr) / dpr + 0.5 / dpr
  const xMin = screenToWorldX(vp, 0)
  const xMax = screenToWorldX(vp, width)
  const yMin = screenToWorldY(vp, height)
  const yMax = screenToWorldY(vp, 0)
  const verticals = Math.ceil(xMax / step) - Math.ceil(xMin / step)
  const horizontals = Math.ceil(yMax / step) - Math.ceil(yMin / step)
  if (verticals + horizontals > MAX_MINOR_LINES) return

  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = Math.ceil(xMin / step); i <= Math.floor(xMax / step); i++) {
    const sx = crisp(worldToScreenX(vp, i * step))
    if (sx < -1 || sx > width + 1) continue
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
  }
  for (let i = Math.ceil(yMin / step); i <= Math.floor(yMax / step); i++) {
    const sy = crisp(worldToScreenY(vp, i * step))
    if (sy < -1 || sy > height + 1) continue
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
  }
  ctx.stroke()
}

function drawAxesAndLabels(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { width, height, viewport: vp, colors, dpr } = state
  const crisp = (value: number) => Math.round(value * dpr) / dpr + 0.5 / dpr
  const axisY = worldToScreenY(vp, 0)
  const axisX = worldToScreenX(vp, 0)
  const yAxisVisible = axisX >= 0 && axisX <= width
  const xAxisVisible = axisY >= 0 && axisY <= height

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

  const step = niceStep(vp.scale)
  const xMin = screenToWorldX(vp, 0)
  const xMax = screenToWorldX(vp, width)
  const yMin = screenToWorldY(vp, height)
  const yMax = screenToWorldY(vp, 0)

  ctx.font = `11px ${MONO_FONT}`
  ctx.fillStyle = colors.label

  const xLabelY = xAxisVisible ? axisY + 5 : height - 7
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  let labels = 0
  for (let i = Math.ceil(xMin / step); i <= Math.floor(xMax / step) && labels < MAX_LABELS; i++) {
    const value = i * step
    const sx = worldToScreenX(vp, value)
    if (sx < 26 || sx > width - 26) continue
    if (yAxisVisible && Math.abs(sx - axisX) < 18) continue
    ctx.fillText(formatTick(value, step), sx, xLabelY)
    labels++
  }

  const yLabelX = yAxisVisible ? axisX - 7 : 7
  ctx.textAlign = yAxisVisible ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  labels = 0
  for (let i = Math.ceil(yMin / step); i <= Math.floor(yMax / step) && labels < MAX_LABELS; i++) {
    const value = i * step
    const sy = worldToScreenY(vp, value)
    if (sy < 8 || sy > height - 8) continue
    if (xAxisVisible && Math.abs(sy - axisY) < 12) continue
    ctx.fillText(formatTick(value, step), yLabelX, sy)
    labels++
  }

  // Axis names (x vs t vs sigma vs Re).
  const names = state.labels
  if (names) {
    ctx.fillStyle = colors.label
    ctx.font = `11px ${MONO_FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(names.x, width - 8, height - 8)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(names.y, 8, 8)
  }
}

function drawCurves(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { viewport: vp, colors } = state
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const curve of state.curves) {
    if (!curve.visible) continue
    const color = colors.charts[curve.colorIndex % colors.charts.length]
    ctx.save()
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
    const color = colors.charts[curve.colorIndex % colors.charts.length]
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
  const { width, height, viewport: vp, colors, dpr } = state
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

  const major = niceStep(vp.scale)
  drawGrid(ctx, state, major / 5, colors.gridMinor)
  drawGrid(ctx, state, major, colors.gridMajor)
  drawAxesAndLabels(ctx, state)
  if (state.field) drawZeroMarkers(ctx, state)
  drawCurves(ctx, state)
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
