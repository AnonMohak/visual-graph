import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  clipParametricByProgress,
  clipSegmentsToHead,
  DRAW_T_MAX,
  DRAW_T_MIN,
  DRAW_UNITS_PER_SEC,
  DRAW_X_MAX,
  DRAW_X_MIN,
  drawHeadT,
  drawHeadX,
  drawProgress,
  isDrawComplete,
  quantizeHead,
} from '@/graph/animated'
import { resolveGraphColors, type GraphColors } from '@/graph/color'
import { setZetaCoarse } from '@/graph/complex'
import { computeFieldImage } from '@/graph/field'
import { drawField, drawGraph, drawParametric, type RenderCurve } from '@/graph/render'
import { sampleComplexSlice, sampleCurve, sampleParametric } from '@/graph/sampler'
import { readoutStore, statusStore } from '@/graph/store'
import type { ComplexComponent, CurveSamples, Equation, Plane, Viewport } from '@/graph/types'
import { complex as mathComplex } from 'mathjs'
import { resultToC } from '@/graph/complex'
import {
  DEFAULT_SCALE,
  clampScale,
  fitViewportY,
  formatNumber,
  panBy,
  resetViewport,
  scaleForMajors,
  screenToWorldX,
  screenToWorldY,
  tweenViewport,
  zoomAt,
} from '@/graph/viewport'
import { cn } from '@/lib/utils'
import FieldWorker from '@/graph/fieldWorker?worker'

export interface GraphApi {
  reset: () => void
  fit: () => void
  markDirty: () => void
  getViewport: () => Viewport
  setViewport: (next: Partial<Viewport>, opts?: { instant?: boolean }) => void
  switchPlane: (next: Plane) => void
  saveHome: (plane: Plane) => void
  getHomes: () => Record<Plane, Viewport | null>
  setHomes: (homes: Partial<Record<Plane, Viewport>>) => void
  applyAnimatedHome: () => void
}

interface GraphCanvasProps {
  equations: Equation[]
  snapX: number | null
  className?: string
  ref?: React.Ref<GraphApi>
  /** Progressive draw-on elapsed time in seconds (animated mode). undefined = static. */
  drawTime?: number
  /** World units revealed per second (animated mode debug speed). */
  unitsPerSec?: number
  /** When true in animated mode, free pan/zoom is allowed and follow-cam is off. */
  unlocked?: boolean
  /** Force coarse sampling (used while the animation is playing). */
  coarse?: boolean
  /** Hide hover crosshair + markers (animated mode v1). */
  disableHover?: boolean
  plane?: Plane
  sigma?: number
  component?: ComplexComponent
  /** Graph theme key (paper/neon) — invalidates cached canvas colors. */
  theme?: string
  /** Controlled field source equation id for the st plane. Null = zeta fallback. */
  fieldSourceId?: string | null
  onFieldSourceChange?: (id: string | null) => void
}

interface SampleEntry {
  sig: string
  samples: CurveSamples
}

const FINE_SPACING = 1.5
const COARSE_SPACING = 3

export function defaultHomeFor(plane: Plane, w: number, h: number): Viewport {
  const width = Number.isFinite(w) && w > 0 ? w : 800
  const height = Number.isFinite(h) && h > 0 ? h : 600
  const scale = scaleForMajors(width, 10)
  const base = { ...resetViewport(width, height), scale }
  if (plane === 'st') {
    // Center sigma=0.5 slightly left so critical strip is prominent.
    return { scale: base.scale, originX: base.originX - 0.5 * base.scale, originY: base.originY }
  }
  return base
}

/** Fraction from the left edge where the animated pen stays locked. */
export const ANIM_LOCK_X = 0.4

/**
 * Tight-zoom home for animated mode: ~10 majors across, pen snapped to
 * the x=-5 start (y centered on 0; follow-cam re-centers Y each frame).
 */
export function animatedHomeFor(plane: Plane, w: number, h: number): Viewport {
  void plane
  const width = Number.isFinite(w) && w > 0 ? w : 800
  const height = Number.isFinite(h) && h > 0 ? h : 600
  const scale = scaleForMajors(width, 10)
  const lockX = ANIM_LOCK_X * width
  const lockY = height / 2
  return {
    scale,
    originX: lockX - DRAW_X_MIN * scale,
    originY: lockY,
  }
}

function sampleBounds(vp: Viewport, width: number): { xMin: number; xMax: number; b0: number; b1: number } {
  const xMin = screenToWorldX(vp, 0)
  const xMax = screenToWorldX(vp, width)
  const bucket = Math.max((xMax - xMin) / 8, 1e-12)
  const b0 = Math.floor(xMin / bucket)
  const b1 = Math.ceil(xMax / bucket)
  return { xMin: b0 * bucket, xMax: b1 * bucket, b0, b1 }
}

function viewSignature(
  vp: Viewport,
  width: number,
  height: number,
  spacing: number,
  extra: { plane: Plane; sigma: number; component: ComplexComponent; drawTime?: number; unitsPerSec?: number }
): string {
  // Animated mode: fixed world draw range — cache on scale + quantized head,
  // never on viewport origin (plane does not move).
  if (extra.drawTime !== undefined) {
    const head = drawHeadX(extra.drawTime, extra.unitsPerSec ?? DRAW_UNITS_PER_SEC)
    return `anim|${extra.plane}|${extra.sigma}|${extra.component}|${Math.round(vp.scale * 10)}|${height}|${spacing}|${quantizeHead(head)}`
  }
  const bounds = sampleBounds(vp, width)
  return `${extra.plane}|${extra.sigma}|${extra.component}|${Math.round(vp.scale * 10)}|${bounds.b0}|${bounds.b1}|${height}|${spacing}|static`
}

export function GraphCanvas({
  equations,
  snapX,
  className,
  ref,
  drawTime,
  unitsPerSec = DRAW_UNITS_PER_SEC,
  unlocked = false,
  coarse = false,
  disableHover = false,
  plane = 'xy',
  sigma = 0.5,
  component = 're',
  theme = 'neon',
  fieldSourceId: controlledFieldId,
  onFieldSourceChange,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fieldCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<Viewport>({ scale: DEFAULT_SCALE, originX: 0, originY: 0 })
  const homesRef = useRef<Record<Plane, Viewport | null>>({ xy: null, st: null, reim: null })
  const planeRef = useRef<Plane>(plane)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const viewportInitializedRef = useRef(false)
  const colorsRef = useRef<GraphColors | null>(null)
  const frameRef = useRef<number | null>(null)
  const hoverFrameRef = useRef<number | null>(null)
  const hoverScreenRef = useRef<{ x: number; y: number } | null>(null)
  const hoverTextRef = useRef<string | null>(null)
  const samplesRef = useRef(new Map<string, SampleEntry>())
  const dragRef = useRef({ active: false, id: -1, x: 0, y: 0 })
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const draggingRef = useRef(false)
  const equationsRef = useRef(equations)
  const snapRef = useRef(snapX)
  const drawTimeRef = useRef(drawTime)
  const unitsPerSecRef = useRef(unitsPerSec)
  const unlockedRef = useRef(unlocked)
  const coarseRef = useRef(coarse)
  const disableHoverRef = useRef(disableHover)
  const planePropRef = useRef(plane)
  const sigmaRef = useRef(sigma)
  const componentRef = useRef(component)
  const fieldImageRef = useRef<{ sig: string; canvas: HTMLCanvasElement } | null>(null)
  const fieldJobRef = useRef(0)
  const workerRef = useRef<Worker | null>(null)
  const tweenCancelRef = useRef<(() => void) | null>(null)
  const themeRef = useRef(theme)
  const [innerFieldId, setInnerFieldId] = useState<string | null>(null)

  planePropRef.current = plane
  sigmaRef.current = sigma
  componentRef.current = component
  if (themeRef.current !== theme) {
    themeRef.current = theme
    colorsRef.current = null
  }
  const fieldSourceId = controlledFieldId !== undefined ? controlledFieldId : innerFieldId
  const setFieldSourceId = (id: string | null) => {
    if (controlledFieldId === undefined) setInnerFieldId(id)
    onFieldSourceChange?.(id)
  }

  const publishStatus = (next: Record<string, boolean>) => {
    const prev = statusStore.get()
    const keys = Object.keys(next)
    const same =
      keys.length === Object.keys(prev).length && keys.every((key) => key in prev && prev[key] === next[key])
    if (!same) statusStore.set(next)
  }

  const complexEquations = (list: Equation[]) =>
    list.filter((eq) => eq.kind !== 'real' && eq.evaluateComplex)

  const resolveFieldEq = (): Equation | null => {
    const list = equationsRef.current
    const complexes = complexEquations(list)
    if (!complexes.length) return null
    if (fieldSourceId) {
      const picked = complexes.find((eq) => eq.id === fieldSourceId)
      if (picked) return picked.visible ? picked : picked
    }
    return complexes.find((eq) => eq.visible) ?? complexes[0] ?? null
  }

  const requestField = (
    fieldSig: string,
    w: number,
    h: number,
    vp: Viewport,
    fieldEq: Equation | null
  ) => {
    // Throttle: reuse cached bitmap when signature matches.
    if (fieldImageRef.current?.sig === fieldSig) return
    const raw = fieldEq?.raw ?? null
    const fieldEqId = fieldEq?.id ?? null
    const coarseNow = coarseRef.current || draggingRef.current
    const terms = coarseNow ? 80 : 200
    const step = coarseNow ? 3 : 2
    // Try worker; fall back to sync compute.
    try {
      workerRef.current ??= new FieldWorker()
      const worker = workerRef.current
      const jobId = ++fieldJobRef.current
      const onMsg = (event: MessageEvent<{ jobId: number; buffer: ArrayBuffer; width: number; height: number }>) => {
        if (event.data.jobId !== fieldJobRef.current) return
        const { buffer, width: bw, height: bh } = event.data
        try {
          const clamped = new Uint8ClampedArray(buffer)
          const img = new ImageData(clamped, bw, bh)
          let canvas = fieldImageRef.current?.canvas
          if (!canvas) canvas = document.createElement('canvas')
          canvas.width = bw
          canvas.height = bh
          const cctx = canvas.getContext('2d')
          if (cctx) {
            cctx.putImageData(img, 0, 0)
            fieldImageRef.current = { sig: fieldSig, canvas }
            markDirty()
          }
        } catch {
          // ignore corrupt worker payload
        }
        worker.removeEventListener('message', onMsg as EventListener)
      }
      worker.addEventListener('message', onMsg as EventListener)
      worker.postMessage({ jobId, raw, width: w, height: h, viewport: { ...vp }, terms, step })
      return
    } catch {
      // Worker unavailable — synchronous fallback below.
    }
    try {
      setZetaCoarse(coarseNow)
      // Fixed: look up by stable equation id, not raw text (duplicate raws collide).
      let evaluate: Parameters<typeof computeFieldImage>[3] = null
      if (fieldEqId) {
        const eq = equationsRef.current.find((e) => e.id === fieldEqId)
        if (eq?.evaluateComplex) evaluate = eq.evaluateComplex
      } else if (fieldEq?.evaluateComplex) {
        evaluate = fieldEq.evaluateComplex
      }
      const img = computeFieldImage(w, h, vp, evaluate, { terms, step })
      let canvas = fieldImageRef.current?.canvas ?? document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const cctx = canvas.getContext('2d')
      if (cctx) {
        cctx.putImageData(img, 0, 0)
        fieldImageRef.current = { sig: fieldSig, canvas }
      }
    } catch {
      // field stays empty
    }
  }

  const buildCurves = (spacing: number): RenderCurve[] => {
    const { w, h } = sizeRef.current
    const vp = viewportRef.current
    const drawTime = drawTimeRef.current
    const animated = drawTime !== undefined
    const ups = unitsPerSecRef.current ?? DRAW_UNITS_PER_SEC
    const cache = samplesRef.current
    const pl = planeRef.current
    const sigBase = viewSignature(vp, w, h, spacing, {
      plane: pl,
      sigma: sigmaRef.current,
      component: componentRef.current,
      drawTime,
      unitsPerSec: ups,
    })
    const bounds = sampleBounds(vp, w)
    const status: Record<string, boolean> = {}
    const active = new Set<string>()
    const curves: RenderCurve[] = []

    if (pl === 'st') {
      // Field plane: no 1D curves; animation never touches the st field.
      for (const eq of equationsRef.current) {
        active.add(eq.id)
        status[eq.id] = eq.visible
      }
      for (const key of cache.keys()) {
        if (!active.has(key)) cache.delete(key)
      }
      publishStatus(status)
      return curves
    }

    // Shared draw head for animated mode (fixed plane, growing line only).
    const xHead = animated ? drawHeadX(drawTime as number, ups) : DRAW_X_MAX
    const progress = animated ? drawProgress(xHead) : 1
    // Full-sample cache key: fixed world range, scale-dependent density only.
    // Viewport origin never invalidates samples; head clipping is cheap.
    const fullBase = animated
      ? `anim-full|${pl}|${sigmaRef.current}|${componentRef.current}|${Math.round(vp.scale * 10)}|${h}|${spacing}`
      : null

    if (pl === 'reim') {
      const tMin = animated ? DRAW_T_MIN : -30
      const tMax = animated ? DRAW_T_MAX : 30
      for (const equation of equationsRef.current) {
        active.add(equation.id)
        if (!equation.evaluateComplex || equation.kind === 'real') {
          status[equation.id] = false
          continue
        }
        if (animated && fullBase) {
          const fullSig = `${fullBase}|${equation.id}`
          let entry = cache.get(equation.id)
          if (!entry || entry.sig !== fullSig) {
            entry = {
              sig: fullSig,
              samples: sampleParametric(equation.evaluateComplex, sigmaRef.current, { tMin, tMax }, {
                heightPx: h,
                scaleX: vp.scale,
                scaleY: vp.scale,
                spacingPx: spacing,
              }),
            }
            cache.set(equation.id, entry)
          }
          status[equation.id] = entry.samples.hasPoints
          const clipped = clipParametricByProgress(entry.samples, progress)
          curves.push({
            id: equation.id,
            colorIndex: equation.colorToken,
            visible: equation.visible,
            samples: clipped,
            evaluate: equation.evaluate,
          })
          continue
        }
        const sig = `${sigBase}|${equation.id}`
        let entry = cache.get(equation.id)
        if (!entry || entry.sig !== sig) {
          entry = {
            sig,
            samples: sampleParametric(equation.evaluateComplex, sigmaRef.current, { tMin, tMax }, {
              heightPx: h,
              scaleX: vp.scale,
              scaleY: vp.scale,
              spacingPx: spacing,
            }),
          }
          cache.set(equation.id, entry)
        }
        status[equation.id] = entry.samples.hasPoints
        // RenderCurve.evaluate unused for parametric markers; provide real slice eval.
        curves.push({
          id: equation.id,
          colorIndex: equation.colorToken,
          visible: equation.visible,
          samples: entry.samples,
          evaluate: equation.evaluate,
        })
      }
      for (const key of cache.keys()) {
        if (!active.has(key)) cache.delete(key)
      }
      publishStatus(status)
      return curves
    }

    // xy plane: real curves + complex slices (x relabeled to t).
    // Animated: fixed draw range [DRAW_X_MIN, DRAW_X_MAX] in world coords.
    const drawRange = animated ? { xMin: DRAW_X_MIN, xMax: DRAW_X_MAX } : bounds
    const list = equationsRef.current.map((equation) => {
      active.add(equation.id)
      if (equation.kind === 'real') {
        const evaluate = equation.evaluate
        if (animated && fullBase) {
          const fullSig = `${fullBase}|${equation.id}`
          let entry = cache.get(equation.id)
          if (!entry || entry.sig !== fullSig) {
            entry = {
              sig: fullSig,
              samples: sampleCurve(evaluate, drawRange, {
                heightPx: h,
                scaleX: vp.scale,
                scaleY: vp.scale,
                spacingPx: spacing,
              }),
            }
            cache.set(equation.id, entry)
          }
          status[equation.id] = entry.samples.hasPoints
          return {
            id: equation.id,
            colorIndex: equation.colorToken,
            visible: equation.visible,
            samples: clipSegmentsToHead(entry.samples, xHead),
            evaluate,
          }
        }
        let entry = cache.get(equation.id)
        if (!entry || entry.sig !== sigBase + equation.id) {
          entry = {
            sig: sigBase + equation.id,
            samples: sampleCurve(evaluate, bounds, {
              heightPx: h,
              scaleX: vp.scale,
              scaleY: vp.scale,
              spacingPx: spacing,
            }),
          }
          cache.set(equation.id, entry)
        }
        status[equation.id] = entry.samples.hasPoints
        return {
          id: equation.id,
          colorIndex: equation.colorToken,
          visible: equation.visible,
          samples: entry.samples,
          evaluate,
        }
      }
      // complex-slice / complex-param rendered as 1D slice at fixed sigma.
      if (!equation.evaluateComplex) {
        status[equation.id] = false
        return {
          id: equation.id,
          colorIndex: equation.colorToken,
          visible: equation.visible,
          samples: { segments: [], hasPoints: false },
          evaluate: equation.evaluate,
        }
      }
      if (animated && fullBase) {
        const fullSig = `${fullBase}|${equation.id}`
        let entry = cache.get(equation.id)
        if (!entry || entry.sig !== fullSig) {
          entry = {
            sig: fullSig,
            samples: sampleComplexSlice(
              equation.evaluateComplex,
              sigmaRef.current,
              componentRef.current,
              drawRange,
              {
                heightPx: h,
                scaleX: vp.scale,
                scaleY: vp.scale,
                spacingPx: spacing,
              }
            ),
          }
          cache.set(equation.id, entry)
        }
        status[equation.id] = entry.samples.hasPoints
        return {
          id: equation.id,
          colorIndex: equation.colorToken,
          visible: equation.visible,
          samples: clipSegmentsToHead(entry.samples, xHead),
          evaluate: equation.evaluate,
        }
      }
      const sig = `${sigBase}|${equation.id}`
      let entry = cache.get(equation.id)
      if (!entry || entry.sig !== sig) {
        entry = {
          sig,
          samples: sampleComplexSlice(
            equation.evaluateComplex,
            sigmaRef.current,
            componentRef.current,
            bounds,
            {
              heightPx: h,
              scaleX: vp.scale,
              scaleY: vp.scale,
              spacingPx: spacing,
            }
          ),
        }
        cache.set(equation.id, entry)
      }
      status[equation.id] = entry.samples.hasPoints
      return {
        id: equation.id,
        colorIndex: equation.colorToken,
        visible: equation.visible,
        samples: entry.samples,
        evaluate: equation.evaluate,
      }
    })
    for (const key of cache.keys()) {
      if (!active.has(key)) cache.delete(key)
    }
    publishStatus(status)
    return list
  }

  const updateFollowCam = () => {
    const drawTime = drawTimeRef.current
    if (drawTime === undefined) return
    // Post-complete: free navigation, follow-cam off, curves stay full.
    if (unlockedRef.current) return
    if (isDrawComplete(drawTime, unitsPerSecRef.current ?? DRAW_UNITS_PER_SEC)) return
    // Empty: nothing visible to track — leave the viewport frozen.
    if (!equationsRef.current.some((eq) => eq.visible)) return
    const pl = planeRef.current
    if (pl === 'st') return
    const { w, h } = sizeRef.current
    if (w === 0 || h === 0) return
    const vp = viewportRef.current
    const ups = unitsPerSecRef.current ?? DRAW_UNITS_PER_SEC
    const lockX = ANIM_LOCK_X * w
    const lockY = h / 2
    if (pl === 'reim') {
      const tHead = drawHeadT(drawTime, ups)
      let hx: number | null = null
      let hy: number | null = null
      for (const eq of equationsRef.current) {
        if (!eq.visible || !eq.evaluateComplex) continue
        try {
          const v = eq.evaluateComplex(mathComplex(sigmaRef.current, tHead))
          const c = resultToC(v)
          if (c && Number.isFinite(c.re) && Number.isFinite(c.im)) {
            hx = c.re
            hy = c.im
            break
          }
        } catch {
          // try next equation
        }
      }
      if (hx === null || hy === null) return
      vp.originX = lockX - hx * vp.scale
      vp.originY = lockY + hy * vp.scale
      return
    }
    const xHead = drawHeadX(drawTime, ups)
    let yHead: number | null = null
    for (const eq of equationsRef.current) {
      if (!eq.visible) continue
      try {
        const y = eq.evaluate(xHead)
        if (typeof y === 'number' && Number.isFinite(y)) {
          yHead = y
          break
        }
      } catch {
        // try next equation
      }
    }
    vp.originX = lockX - xHead * vp.scale
    if (yHead !== null) vp.originY = lockY + yHead * vp.scale
  }

  const applyAnimatedHome = () => {
    const { w, h } = sizeRef.current
    const width = w || 800
    const height = h || 600
    const home = animatedHomeFor(planeRef.current, width, height)
    // Snap Y to f(xHead) at the start so the pen begins centered.
    const pl = planeRef.current
    if (pl === 'xy') {
      let yHead: number | null = null
      for (const eq of equationsRef.current) {
        if (!eq.visible) continue
        try {
          const y = eq.evaluate(DRAW_X_MIN)
          if (typeof y === 'number' && Number.isFinite(y)) {
            yHead = y
            break
          }
        } catch {
          // ignore
        }
      }
      if (yHead !== null) home.originY = height / 2 + yHead * home.scale
    } else if (pl === 'reim') {
      let hx: number | null = null
      let hy: number | null = null
      for (const eq of equationsRef.current) {
        if (!eq.visible || !eq.evaluateComplex) continue
        try {
          const v = eq.evaluateComplex(mathComplex(sigmaRef.current, DRAW_T_MIN))
          const c = resultToC(v)
          if (c && Number.isFinite(c.re) && Number.isFinite(c.im)) {
            hx = c.re
            hy = c.im
            break
          }
        } catch {
          // ignore
        }
      }
      if (hx !== null && hy !== null) {
        home.originX = ANIM_LOCK_X * width - hx * home.scale
        home.originY = height / 2 + hy * home.scale
      }
    }
    cancelTween()
    viewportRef.current = home
    viewportInitializedRef.current = true
    samplesRef.current.clear()
    markDirty()
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h, dpr } = sizeRef.current
    if (w === 0 || h === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    colorsRef.current ??= resolveGraphColors()
    updateFollowCam()
    const pl = planeRef.current
    const spacing = coarseRef.current || draggingRef.current ? COARSE_SPACING : FINE_SPACING
    if (pl === 'st') {
      const vp = viewportRef.current
      const fieldEq = resolveFieldEq()
      // Field signature keyed by stable equation id (fallback zeta), not raw text.
      const fieldSig = `${Math.round(vp.scale * 10)}|${Math.round(vp.originX)}|${Math.round(vp.originY)}|${w}|${h}|${fieldEq?.id ?? 'zeta'}|${spacing}`
      requestField(fieldSig, w, h, vp, fieldEq)
      const fieldCanvas = fieldImageRef.current?.sig === fieldSig ? fieldImageRef.current.canvas : null
      // Publish a trivial status for legend.
      const status: Record<string, boolean> = {}
      for (const eq of equationsRef.current) status[eq.id] = eq.visible
      publishStatus(status)
      drawField(ctx, {
        width: w,
        height: h,
        dpr,
        viewport: { ...vp },
        colors: colorsRef.current,
        curves: [],
        hover: disableHoverRef.current ? null : hoverScreenRef.current,
        snapX: null,
        labels: { x: 'σ', y: 't' },
        disableHover: disableHoverRef.current,
      }, fieldCanvas)
      return
    }
    const curves = buildCurves(spacing)
    const labels = pl === 'reim' ? { x: 'Re', y: 'Im' } : equationsRef.current.some((e) => e.kind !== 'real')
      ? { x: 't', y: 'y' }
      : { x: 'x', y: 'y' }
    const base = {
      width: w,
      height: h,
      dpr,
      viewport: viewportRef.current,
      colors: colorsRef.current,
      curves,
      hover: disableHoverRef.current ? null : hoverScreenRef.current,
      snapX: snapRef.current,
      labels,
      sigmaRef: pl === 'reim' ? sigmaRef.current : null,
      disableHover: disableHoverRef.current,
    }
    if (pl === 'reim') drawParametric(ctx, base)
    else drawGraph(ctx, base)
  }

  const scheduleDraw = () => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      draw()
    })
  }

  const markDirty = () => scheduleDraw()

  const cancelTween = () => {
    tweenCancelRef.current?.()
    tweenCancelRef.current = null
  }

  const animateTo = (target: Viewport, onDone?: () => void) => {
    // No tween in animated mode: follow-cam owns the viewport.
    if (drawTimeRef.current !== undefined) {
      viewportRef.current = { ...target }
      viewportInitializedRef.current = true
      markDirty()
      onDone?.()
      return
    }
    cancelTween()
    const from = { ...viewportRef.current }
    // Snap when already there to avoid a 500ms no-op.
    if (from.scale === target.scale && from.originX === target.originX && from.originY === target.originY) {
      viewportInitializedRef.current = true
      markDirty()
      onDone?.()
      return
    }
    tweenCancelRef.current = tweenViewport(from, target, (vp) => {
      viewportRef.current = vp
      viewportInitializedRef.current = true
      markDirty()
    }, {
      durationMs: 500,
      onDone: () => {
        tweenCancelRef.current = null
        onDone?.()
      },
    })
  }

  const setHover = (screen: { x: number; y: number } | null) => {
    if (disableHoverRef.current) {
      if (screen !== null) return
    }
    hoverScreenRef.current = screen
    markDirty()
    if (hoverFrameRef.current !== null) return
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null
      const point = hoverScreenRef.current
      if (!point) {
        if (hoverTextRef.current !== null) {
          hoverTextRef.current = null
          readoutStore.set({ hoverX: null, hoverY: null, hoverZ: null })
        }
        return
      }
      const worldX = screenToWorldX(viewportRef.current, point.x)
      const worldY = screenToWorldY(viewportRef.current, point.y)
      const text = formatNumber(worldX, 4)
      if (text !== hoverTextRef.current) {
        hoverTextRef.current = text
        const pl = planeRef.current
        readoutStore.set({
          hoverX: worldX,
          hoverY: worldY,
          hoverZ: pl === 'st' ? { re: worldX, im: worldY } : null,
        })
      }
    })
  }

  const resize = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const first = sizeRef.current.w === 0
    sizeRef.current = { w, h, dpr }
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    if (first && !viewportInitializedRef.current) {
      viewportRef.current = defaultHomeFor(planeRef.current, w, h)
      viewportInitializedRef.current = true
    }
    markDirty()
  }

  const homeFor = (pl: Plane): Viewport => {
    const saved = homesRef.current[pl]
    if (saved) return { ...saved }
    const { w, h } = sizeRef.current
    return defaultHomeFor(pl, w || 800, h || 600)
  }

  const reset = () => {
    // Double-click / 0 returns to current plane home (500ms ease, instant in animated).
    if (drawTimeRef.current !== undefined) {
      applyAnimatedHome()
      return
    }
    cancelTween()
    animateTo(homeFor(planeRef.current))
  }

  const saveHome = (pl: Plane) => {
    homesRef.current[pl] = { ...viewportRef.current }
  }

  const switchPlane = (next: Plane) => {
    const prev = planeRef.current
    if (prev === next) return
    cancelTween()
    homesRef.current[prev] = { ...viewportRef.current }
    planeRef.current = next
    const target = homesRef.current[next]
    let dest: Viewport
    if (target) dest = { ...target }
    else {
      const { w, h } = sizeRef.current
      dest = defaultHomeFor(next, w || 800, h || 600)
    }
    samplesRef.current.clear()
    fieldImageRef.current = null
    readoutStore.set({ hoverX: null, hoverY: null, hoverZ: null })
    animateTo(dest)
  }

  // Keep planeRef in sync when App drives the plane prop (e.g. share restore).
  useEffect(() => {
    if (planePropRef.current !== planeRef.current) {
      switchPlane(planePropRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plane])

  const fit = () => {
    const { w, h } = sizeRef.current
    if (w === 0 || h === 0) return
    if (planeRef.current === 'st') {
      reset()
      return
    }
    const curves = buildCurves(FINE_SPACING)
    let min = Infinity
    let max = -Infinity
    for (const curve of curves) {
      if (!curve.visible) continue
      for (const segment of curve.samples.segments) {
        for (const y of segment.ys) {
          if (y < min) min = y
          if (y > max) max = y
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      reset()
      return
    }
    animateTo(fitViewportY(viewportRef.current, min, max, h))
  }

  useImperativeHandle(
    ref,
    () => ({
      reset,
      fit,
      markDirty,
      getViewport: () => ({ ...viewportRef.current }),
      setViewport: (next, opts?: { instant?: boolean }) => {
        const current = viewportRef.current
        const dest: Viewport = {
          scale: next.scale !== undefined ? clampScale(next.scale) : current.scale,
          originX: next.originX !== undefined ? next.originX : current.originX,
          originY: next.originY !== undefined ? next.originY : current.originY,
        }
        if (opts?.instant || drawTimeRef.current !== undefined) {
          cancelTween()
          viewportRef.current = dest
          viewportInitializedRef.current = true
          markDirty()
          return
        }
        // Share-restore / programmatic moves ease over 500ms.
        animateTo(dest)
      },
      switchPlane,
      saveHome,
      getHomes: () => ({ ...homesRef.current }),
      setHomes: (homes) => {
        for (const [k, v] of Object.entries(homes)) {
          if (v) homesRef.current[k as Plane] = { ...v }
        }
      },
      applyAnimatedHome,
    }),
    []
  )

  useEffect(() => {
    equationsRef.current = equations
    snapRef.current = snapX
    drawTimeRef.current = drawTime
    unitsPerSecRef.current = unitsPerSec
    unlockedRef.current = unlocked
    coarseRef.current = coarse
    disableHoverRef.current = disableHover
    markDirty()
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    colorsRef.current = resolveGraphColors()

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (drawTimeRef.current !== undefined && !unlockedRef.current) return
      cancelTween()
      const rect = canvas.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
      const factor = Math.exp(-event.deltaY * unit * 0.0015)
      zoomAt(viewportRef.current, event.clientX - rect.left, event.clientY - rect.top, factor)
      markDirty()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const observer = new ResizeObserver(() => resize())
    observer.observe(canvas)
    resize()
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => markDirty())
    }

    return () => {
      canvas.removeEventListener('wheel', onWheel)
      observer.disconnect()
      cancelTween()
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current)
        hoverFrameRef.current = null
      }
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawTimeRef.current !== undefined && !unlockedRef.current) return
    cancelTween()
    const canvas = canvasRef.current
    if (!canvas) return
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId)
    const point = localPoint(event)
    pointersRef.current.set(event.pointerId, point)
    if (pointersRef.current.size === 1) {
      dragRef.current = { active: true, id: event.pointerId, x: point.x, y: point.y }
      draggingRef.current = true
      canvas.style.cursor = 'grabbing'
    } else if (pointersRef.current.size >= 2) {
      dragRef.current.active = false
      const [a, b] = [...pointersRef.current.values()]
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      }
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawTimeRef.current !== undefined && !unlockedRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const point = localPoint(event)
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, point)

    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      if (pinch.dist > 0 && dist > 0) {
        zoomAt(viewportRef.current, cx, cy, dist / pinch.dist)
      }
      panBy(viewportRef.current, cx - pinch.cx, cy - pinch.cy)
      pinchRef.current = { dist, cx, cy }
      markDirty()
      return
    }

    if (dragRef.current.active && event.pointerId === dragRef.current.id) {
      const dx = point.x - dragRef.current.x
      const dy = point.y - dragRef.current.y
      dragRef.current.x = point.x
      dragRef.current.y = point.y
      if (dx !== 0 || dy !== 0) {
        panBy(viewportRef.current, dx, dy)
        markDirty()
      }
      return
    }

    if (event.pointerType === 'mouse' && !disableHoverRef.current) setHover(point)
  }

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    pointersRef.current.delete(event.pointerId)
    if (canvas && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // pointer capture may already be released
      }
    }
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      dragRef.current = { active: false, id: -1, x: 0, y: 0 }
      draggingRef.current = false
      if (canvas) canvas.style.cursor = ''
      markDirty()
    } else if (dragRef.current.id === event.pointerId) {
      const [nextId, nextPoint] = [...pointersRef.current.entries()][0]
      dragRef.current = { active: true, id: nextId, x: nextPoint.x, y: nextPoint.y }
    }
  }

  const handleDoubleClick = () => {
    if (drawTimeRef.current !== undefined && !unlockedRef.current) return
    reset()
  }

  const stComplexes = complexEquations(equations)
  const showFieldPicker = plane === 'st' && stComplexes.length > 1
  const activeFieldId = fieldSourceId && stComplexes.some((eq) => eq.id === fieldSourceId)
    ? fieldSourceId
    : ((stComplexes.find((eq) => eq.visible) ?? stComplexes[0])?.id ?? null)
  // Keep selection valid when equations change (fallback zeta = null).
  useEffect(() => {
    if (fieldSourceId && !equations.some((eq) => eq.id === fieldSourceId && eq.kind !== 'real')) {
      setFieldSourceId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equations])

  return (
    <>
      <canvas ref={fieldCanvasRef} className="hidden" aria-hidden />
      <canvas
        ref={canvasRef}
        className={cn('absolute inset-0 h-full w-full touch-none cursor-grab', className)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={handleDoubleClick}
      />
      {showFieldPicker && (
        <label className="absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border bg-background/85 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-md">
          field
          <select
            aria-label="field source"
            value={activeFieldId ?? ''}
            onChange={(event) => {
              setFieldSourceId(event.target.value || null)
              fieldImageRef.current = null
              markDirty()
            }}
            className="h-6 max-w-44 rounded border bg-background px-1 font-mono text-xs text-foreground"
          >
            {stComplexes.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.raw}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )
}
