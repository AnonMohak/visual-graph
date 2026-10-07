import type { Viewport } from './types'

export const MIN_SCALE = 4
export const MAX_SCALE = 200000
export const DEFAULT_SCALE = 60

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function worldToScreenX(vp: Viewport, x: number): number {
  return vp.originX + x * vp.scale
}

export function worldToScreenY(vp: Viewport, y: number): number {
  return vp.originY - y * vp.scale
}

export function screenToWorldX(vp: Viewport, px: number): number {
  return (px - vp.originX) / vp.scale
}

export function screenToWorldY(vp: Viewport, py: number): number {
  return (vp.originY - py) / vp.scale
}

export function zoomAt(vp: Viewport, px: number, py: number, factor: number): void {
  const next = clampScale(vp.scale * factor)
  if (next === vp.scale) return
  const worldX = screenToWorldX(vp, px)
  const worldY = screenToWorldY(vp, py)
  vp.scale = next
  vp.originX = px - worldX * next
  vp.originY = py + worldY * next
}

export function panBy(vp: Viewport, dx: number, dy: number): void {
  vp.originX += dx
  vp.originY += dy
}

export function resetViewport(width: number, height: number): Viewport {
  return {
    scale: DEFAULT_SCALE,
    originX: width / 2,
    originY: height / 2,
  }
}

export function fitViewportY(vp: Viewport, yMin: number, yMax: number, height: number): Viewport {
  const span = yMax - yMin
  const padding = height * 0.15
  const usable = Math.max(height - padding * 2, 1)
  const scale = clampScale(usable / Math.max(span, 1e-9))
  const mid = (yMin + yMax) / 2
  return {
    scale,
    originX: vp.originX,
    originY: height / 2 + mid * scale,
  }
}

export function niceStep(scale: number): number {
  const raw = 64 / Math.max(scale, 1e-9)
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / magnitude
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10
  return step * magnitude
}

/**
 * Zoom scale for animated/static homes: pick scale so ~target major gridlines
 * fill the canvas width. Majors visible = widthPx / (niceStep(scale)*scale).
 */
export function scaleForMajors(widthPx: number, target: number = 10): number {
  const w = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 800
  const t = Number.isFinite(target) && target > 0 ? target : 10
  let best = DEFAULT_SCALE
  let bestErr = Infinity
  for (let log = Math.log10(MIN_SCALE); log <= Math.log10(MAX_SCALE); log += 0.02) {
    const s = Math.pow(10, log)
    const majors = w / (niceStep(s) * s)
    const err = Math.abs(majors - t)
    if (err < bestErr) {
      bestErr = err
      best = s
      if (err < 0.01) break
    }
  }
  return clampScale(best)
}

/**
 * Tight-zoom scale for animated mode: pick scale so ~5 major gridlines
 * fill the canvas width. Majors visible = widthPx / (niceStep(scale)*scale).
 * @deprecated Use scaleForMajors(widthPx, target) instead.
 */
export function scaleForFiveMajors(widthPx: number): number {
  return scaleForMajors(widthPx, 5)
}

/** Cubic ease-in-out for viewport tweens. */
export function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2
}

export interface TweenViewportOptions {
  durationMs?: number
  onDone?: () => void
}

/**
 * Tween a viewport from -> to over ~500ms with easeInOutCubic.
 * Returns a cancel function. Cancellable via cancel() or AbortSignal.
 * Caller must skip in animated mode (follow-cam owns the viewport there).
 */
export function tweenViewport(
  from: Viewport,
  to: Viewport,
  onUpdate: (vp: Viewport) => void,
  opts?: TweenViewportOptions & { signal?: AbortSignal }
): () => void {
  const duration = opts?.durationMs ?? 500
  const onDone = opts?.onDone
  if (duration <= 0) {
    onUpdate({ ...to })
    onDone?.()
    return () => {}
  }
  let cancelled = false
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const fromCopy = { ...from }
  let raf = 0
  const step = (now: number) => {
    if (cancelled) return
    if (opts?.signal?.aborted) return
    const elapsed = now - start
    const t = Math.min(1, elapsed / duration)
    const e = easeInOutCubic(t)
    onUpdate({
      scale: fromCopy.scale + (to.scale - fromCopy.scale) * e,
      originX: fromCopy.originX + (to.originX - fromCopy.originX) * e,
      originY: fromCopy.originY + (to.originY - fromCopy.originY) * e,
    })
    if (t < 1) {
      raf = requestAnimationFrame(step)
    } else {
      onDone?.()
    }
  }
  raf = requestAnimationFrame(step)
  const cancel = () => {
    cancelled = true
    cancelAnimationFrame(raf)
  }
  opts?.signal?.addEventListener('abort', cancel, { once: true })
  return cancel
}

export function formatNumber(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e7 || abs < 1e-4) {
    return value.toExponential(Math.min(digits, 4))
  }
  let text = value.toFixed(Math.min(12, digits))
  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '')
  }
  return text === '-0' ? '0' : text
}

export function formatTick(value: number, step: number): string {
  if (Math.abs(value) < step * 1e-6) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e7 || abs < 1e-4) return value.toExponential(1)
  const decimals = Math.max(0, Math.min(12, Math.ceil(-Math.log10(step))))
  let text = value.toFixed(decimals)
  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '')
  }
  return text === '-0' ? '0' : text
}
