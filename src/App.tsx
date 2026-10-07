import { useEffect, useRef, useState } from 'react'
import { AddAnimatedModal } from '@/components/AddAnimatedModal'
import { AnimDebugPanel } from '@/components/AnimDebugPanel'
import { AnimatedControls } from '@/components/AnimatedControls'
import { AnimatedModeToggle, type GraphMode } from '@/components/AnimatedModeToggle'
import { CommandBar, type CommandBarApi } from '@/components/CommandBar'
import { EmptyGraph } from '@/components/EmptyGraph'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GraphCanvas, type GraphApi } from '@/components/GraphCanvas'
import { Legend } from '@/components/Legend'
import { PlaneToggle } from '@/components/PlaneToggle'
import { ReadoutPanel } from '@/components/ReadoutPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DRAW_UNITS_PER_SEC, drawDuration, isDrawComplete } from '@/graph/animated'
import { parseEquation } from '@/graph/parse'
import { decodeShareState, encodeShareState, shareVpToViewport } from '@/graph/share'
import type { ComplexComponent, Equation, Plane, Viewport } from '@/graph/types'
import { niceStep } from '@/graph/viewport'

let equationSeq = 0

function makeEquation(raw: string, colorToken: number): Equation | null {
  const parsed = parseEquation(raw)
  if (!parsed.ok) return null
  equationSeq += 1
  return {
    id: `eq-${equationSeq}`,
    raw: parsed.raw,
    latex: parsed.latex,
    evaluate: parsed.evaluate,
    evaluateComplex: parsed.evaluateComplex,
    kind: parsed.kind,
    component: parsed.component,
    sigma: parsed.sigma,
    suggestedPlane: parsed.suggestedPlane,
    colorToken,
    visible: true,
  }
}

const STORAGE_KEY_V2 = 'graph.equations.v2'
const STORAGE_KEY_V1 = 'graph.equations.v1'

function equationsFromRaws(raws: string[], vis?: number[], col?: number[]): Equation[] {
  const loaded: Equation[] = []
  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i]
    const colVal = col?.[i]
    const colorToken = colVal !== undefined && Number.isFinite(colVal)
      ? Math.min(4, Math.max(0, Math.round(colVal)))
      : loaded.length % 5
    const equation = makeEquation(raw, colorToken)
    if (equation) {
      if (vis?.[i] === 0) equation.visible = false
      loaded.push(equation)
    }
  }
  return loaded
}

interface PersistedV2 {
  eq: string[]
  plane?: Plane
  sigma?: number
  comp?: ComplexComponent
  vis?: number[]
  col?: number[]
}

function loadPersisted(): { equations: Equation[]; plane: Plane; sigma: number; comp: ComplexComponent } {
  const fallback = { equations: [] as Equation[], plane: 'xy' as Plane, sigma: 0.5, comp: 're' as ComplexComponent }
  // URL hash takes precedence on load (share deep-links).
  const hash = window.location.hash
  if (hash && hash.length > 1) {
    const state = decodeShareState(hash)
    if (state) {
      return {
        equations: equationsFromRaws(state.eq, state.vis, state.col),
        plane: state.plane ?? 'xy',
        sigma: typeof state.sigma === 'number' ? state.sigma : 0.5,
        comp: state.comp ?? 're',
      }
    }
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY_V2)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as PersistedV2).eq)) {
        const v2 = parsed as PersistedV2
        const raws = v2.eq.filter((item): item is string => typeof item === 'string')
        return {
          equations: equationsFromRaws(raws, v2.vis, v2.col),
          plane: v2.plane === 'st' || v2.plane === 'reim' ? v2.plane : 'xy',
          sigma: typeof v2.sigma === 'number' && Number.isFinite(v2.sigma) ? v2.sigma : 0.5,
          comp: v2.comp === 'im' || v2.comp === 'abs' || v2.comp === 'arg' ? v2.comp : 're',
        }
      }
    }
    const legacy = window.localStorage.getItem(STORAGE_KEY_V1)
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy)
      if (Array.isArray(parsed)) {
        const raws = parsed.filter((item): item is string => typeof item === 'string')
        if (raws.length) return { ...fallback, equations: equationsFromRaws(raws) }
      }
    }
  } catch {
    // Corrupt storage — fall through to empty state.
  }
  return fallback
}

function nextColorToken(equations: Equation[]): number {
  const used = new Set(equations.map((equation) => equation.colorToken))
  for (let token = 0; token < 5; token++) {
    if (!used.has(token)) return token
  }
  return equations.length % 5
}

export default function App() {
  const [initial] = useState(loadPersisted)
  const [equations, setEquations] = useState<Equation[]>(initial.equations)
  const [activePlane, setActivePlane] = useState<Plane>(initial.plane)
  const [sigma, setSigma] = useState(initial.sigma)
  const [component, setComponent] = useState<ComplexComponent>(initial.comp)
  const [theme, setTheme] = useState<'paper' | 'neon'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.graphTheme === 'paper'
      ? 'paper'
      : 'neon'
  )

  useEffect(() => {
    document.documentElement.dataset.graphTheme = theme
  }, [theme])
  const [snapX, setSnapX] = useState<number | null>(null)
  const graphRef = useRef<GraphApi | null>(null)
  const commandRef = useRef<CommandBarApi | null>(null)

  // --- Animated mode state (v1: in-memory only, no persistence) ---
  const [mode, setMode] = useState<GraphMode>('static')
  const [animatedEquations, setAnimatedEquations] = useState<Equation[]>([])
  const [playing, setPlaying] = useState(true)
  const [drawTime, setDrawTime] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  // TEMP debug speed (world units/sec). No other behavior change.
  const [debugSpeed, setDebugSpeed] = useState(DRAW_UNITS_PER_SEC)
  const drawTimeRef = useRef(0)
  const debugSpeedRef = useRef(debugSpeed)
  useEffect(() => {
    debugSpeedRef.current = debugSpeed
  }, [debugSpeed])
  const savedStaticVp = useRef<Viewport | null>(null)
  const savedAnimatedVp = useRef<Viewport | null>(null)

  const animated = mode === 'animated'
  const activeEquations = animated ? animatedEquations : equations
  const totalDuration = drawDuration(debugSpeed)
  const unlocked = animated && isDrawComplete(drawTime, debugSpeed)

  const switchPlane = (next: Plane) => {
    if (next === activePlane) return
    graphRef.current?.switchPlane(next)
    setActivePlane(next)
  }

  const switchMode = (next: GraphMode) => {
    if (next === mode) return
    // Silent discard from view: each mode keeps its own in-memory list and
    // only the active mode's equations are rendered.
    const vp = graphRef.current?.getViewport() ?? null
    if (mode === 'static') {
      // Entering animated mode: tight-zoom follow-cam home snapped to the
      // x=-5 start; clock reset so the pen begins at the lock position.
      if (vp) savedStaticVp.current = vp
      drawTimeRef.current = 0
      setDrawTime(0)
      setMode('animated')
      // Empty animated list stays frozen at 0 until the user adds a curve.
      setPlaying(animatedEquations.length > 0)
      requestAnimationFrame(() => graphRef.current?.applyAnimatedHome())
    } else {
      if (vp) savedAnimatedVp.current = vp
      setMode('static')
      const target = savedStaticVp.current
      if (target) requestAnimationFrame(() => graphRef.current?.setViewport(target))
    }
  }

  // Empty animated list: freeze at 0, pause the clock, snap home once.
  useEffect(() => {
    if (mode !== 'animated' || animatedEquations.length > 0) return
    drawTimeRef.current = 0
    setDrawTime(0)
    setPlaying(false)
    requestAnimationFrame(() => graphRef.current?.applyAnimatedHome())
  }, [mode, animatedEquations.length])

  // requestAnimationFrame clock: linear draw-on at debugSpeed world-units/sec,
  // play-once + hold. Freeze on complete graph, clamp dt to 0.1s on tab-return.
  // Guarded while the animated list is empty (stays at 0 paused).
  useEffect(() => {
    if (mode !== 'animated' || !playing) return
    if (animatedEquations.length === 0) {
      setPlaying(false)
      return
    }
    if (isDrawComplete(drawTimeRef.current, debugSpeedRef.current)) {
      setPlaying(false)
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const total = drawDuration(debugSpeedRef.current)
      const next = Math.min(drawTimeRef.current + dt, total)
      drawTimeRef.current = next
      setDrawTime(next)
      if (next >= total) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, playing, animatedEquations.length])

  const handleRestart = () => {
    // Empty list: restart stays at 0 paused (re-snaps home).
    if (animatedEquations.length === 0) {
      drawTimeRef.current = 0
      setDrawTime(0)
      setPlaying(false)
      requestAnimationFrame(() => graphRef.current?.applyAnimatedHome())
      return
    }
    drawTimeRef.current = 0
    setDrawTime(0)
    setPlaying(true)
    // Snap back to the x=-5 start in the tight-zoom home (re-locks).
    requestAnimationFrame(() => graphRef.current?.applyAnimatedHome())
  }

  const handlePlayPause = () => {
    // Empty list: play stays at 0 paused.
    if (animatedEquations.length === 0) return
    // At complete head, play resumes nowhere — stay held until Restart.
    if (!playing && isDrawComplete(drawTimeRef.current, debugSpeedRef.current)) return
    setPlaying((prev) => !prev)
  }

  const addRaw = (raws: string[]) => {
    setEquations((prev) => {
      const next = [...prev]
      for (const raw of raws) {
        const equation = makeEquation(raw, nextColorToken(next))
        if (equation) next.push(equation)
      }
      return next.length === prev.length ? prev : next
    })
  }

  const addAnimatedRaw = (raws: string[]) => {
    setAnimatedEquations((prev) => {
      const next = [...prev]
      for (const raw of raws) {
        const equation = makeEquation(raw, nextColorToken(next))
        if (equation) next.push(equation)
      }
      return next.length === prev.length ? prev : next
    })
  }

  const toggleEquation = (id: string) => {
    if (animated) {
      setAnimatedEquations((prev) =>
        prev.map((equation) =>
          equation.id === id ? { ...equation, visible: !equation.visible } : equation
        )
      )
    } else {
      setEquations((prev) =>
        prev.map((equation) =>
          equation.id === id ? { ...equation, visible: !equation.visible } : equation
        )
      )
    }
  }

  const deleteEquation = (id: string) => {
    if (animated) {
      setAnimatedEquations((prev) => prev.filter((equation) => equation.id !== id))
    } else {
      setEquations((prev) => prev.filter((equation) => equation.id !== id))
    }
  }

  const getStepSize = (): number => {
    const viewport = graphRef.current?.getViewport()
    return viewport ? niceStep(viewport.scale) / 5 : 1
  }

  const handleShare = (): string | null => {
    if (equations.length === 0) return null
    const viewport = graphRef.current?.getViewport()
    if (!viewport) return null
    const homes = graphRef.current?.getHomes()
    try {
      const payload = encodeShareState({
        eq: equations.map((equation) => equation.raw),
        vp: { s: viewport.scale, ox: viewport.originX, oy: viewport.originY },
        plane: activePlane,
        sigma,
        comp: component,
        vis: equations.map((equation) => (equation.visible ? 1 : 0)),
        col: equations.map((equation) => equation.colorToken),
        homes: homes
          ? {
              xy: homes.xy ? { s: homes.xy.scale, ox: homes.xy.originX, oy: homes.xy.originY } : null,
              st: homes.st ? { s: homes.st.scale, ox: homes.st.originX, oy: homes.st.originY } : null,
              reim: homes.reim
                ? { s: homes.reim.scale, ox: homes.reim.originX, oy: homes.reim.originY }
                : null,
            }
          : undefined,
      })
      const { origin, pathname, search } = window.location
      return `${origin}${pathname}${search}#${payload}`
    } catch {
      return null
    }
  }

  useEffect(() => {
    try {
      const payload: PersistedV2 = {
        eq: equations.map((equation) => equation.raw),
        plane: activePlane,
        sigma,
        comp: component,
        vis: equations.map((equation) => (equation.visible ? 1 : 0)),
        col: equations.map((equation) => equation.colorToken),
      }
      window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload))
    } catch {
      // Storage full / unavailable — equations stay in memory only.
    }
  }, [equations, activePlane, sigma, component])

  useEffect(() => {
    const state = decodeShareState(window.location.hash)
    if (!state) return
    if (state.plane && state.plane !== 'xy') {
      setActivePlane(state.plane)
    }
    if (typeof state.sigma === 'number') setSigma(state.sigma)
    if (state.comp) setComponent(state.comp)
    // Restore homes first so plane switch can use them, then active viewport.
    const applyViewports = () => {
      if (state.homes) {
        const converted: Partial<Record<Plane, Viewport>> = {}
        if (state.homes.xy) converted.xy = shareVpToViewport(state.homes.xy)
        if (state.homes.st) converted.st = shareVpToViewport(state.homes.st)
        if (state.homes.reim) converted.reim = shareVpToViewport(state.homes.reim)
        graphRef.current?.setHomes(converted)
      }
      if (state.plane && state.plane !== 'xy') {
        graphRef.current?.switchPlane(state.plane)
      }
      if (state.vp) {
        graphRef.current?.setViewport({
          scale: state.vp.s,
          originX: state.vp.ox,
          originY: state.vp.oy,
        })
      }
    }
    // Canvas sizes on first frame; defer one tick.
    const id = requestAnimationFrame(applyViewports)
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const stepSnap = (direction: number) => {
      const viewport = graphRef.current?.getViewport()
      if (!viewport) return
      const step = niceStep(viewport.scale) / 5
      const current = snapX ?? 0
      const next = Math.round(current / step + direction) * step
      setSnapX(Number(next.toPrecision(12)))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (event.key === '/') {
        if (isTyping) return
        event.preventDefault()
        commandRef.current?.focus()
        return
      }
      if (event.key === 'Escape') {
        if (isTyping) (target as HTMLElement).blur()
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (isTyping) return
        if (mode !== 'static') return
        event.preventDefault()
        stepSnap(event.key === 'ArrowRight' ? 1 : -1)
        return
      }
      if (isTyping) return
      if (event.key === '0') {
        event.preventDefault()
        graphRef.current?.reset()
        return
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        graphRef.current?.fit()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [snapX, mode])

  return (
    <ErrorBoundary>
      <TooltipProvider>
      <main className="relative h-svh w-full overflow-hidden bg-background text-foreground">
        <GraphCanvas
          ref={graphRef}
          equations={activeEquations}
          snapX={animated ? null : snapX}
          drawTime={animated ? drawTime : undefined}
          unitsPerSec={debugSpeed}
          unlocked={unlocked}
          coarse={animated && playing}
          disableHover={animated}
          plane={activePlane}
          sigma={sigma}
          component={component}
          theme={theme}
        />
        <div
          role="tablist"
          aria-label="graph theme"
          className="absolute left-1/2 top-[92px] z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background/80 p-0.5 backdrop-blur-md"
        >
          {(['paper', 'neon'] as const).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={theme === option}
              onClick={() => setTheme(option)}
              className={
                theme === option
                  ? 'rounded-md bg-primary px-3 py-1 font-mono text-xs text-primary-foreground'
                  : 'rounded-md px-3 py-1 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            >
              {option}
            </button>
          ))}
        </div>
        {activeEquations.length === 0 && <EmptyGraph />}
        {!animated && (
          <ReadoutPanel
            equations={equations}
            snapX={snapX}
            onSnapXChange={setSnapX}
            getStepSize={getStepSize}
            plane={activePlane}
            sigma={sigma}
            component={component}
          />
        )}
        <AnimatedModeToggle mode={mode} onChange={switchMode} />
        <PlaneToggle plane={activePlane} onChange={switchPlane} />
        <Legend equations={activeEquations} onToggle={toggleEquation} onDelete={deleteEquation} sigma={sigma} component={component} />
        {!animated && (
          <CommandBar
            ref={commandRef}
            onAdd={addRaw}
            onShare={handleShare}
            activePlane={activePlane}
            sigma={sigma}
            component={component}
            onSigmaChange={setSigma}
            onComponentChange={setComponent}
            onPlaneSwitch={switchPlane}
          />
        )}
        {animated && (
          <>
            <AnimDebugPanel
              speed={debugSpeed}
              onSpeedChange={setDebugSpeed}
              drawTime={drawTime}
              total={totalDuration}
            />
            <AnimatedControls
              playing={playing}
              onPlayPause={handlePlayPause}
              onRestart={handleRestart}
              onAddClick={() => setAddOpen(true)}
              speed={debugSpeed}
              elapsed={drawTime}
              total={totalDuration}
              unlocked={unlocked}
            />
          </>
        )}
        <AddAnimatedModal
          open={animated && addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={addAnimatedRaw}
        />
      </main>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
