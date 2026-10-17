import { useEffect, useMemo, useRef, useState } from 'react'
import { AddAnimatedModal } from '@/components/AddAnimatedModal'
import { AnimDebugPanel } from '@/components/AnimDebugPanel'
import { AnimatedControls } from '@/components/AnimatedControls'
import { AnimatedModeToggle, type GraphMode } from '@/components/AnimatedModeToggle'
import { CommandBar, type CommandBarApi } from '@/components/CommandBar'
import { EmptyGraph } from '@/components/EmptyGraph'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GraphCanvas, type GraphApi } from '@/components/GraphCanvas'
import { HelpOverlay } from '@/components/HelpOverlay'
import { LibraryPanel } from '@/components/LibraryPanel'
import { Legend, type SpecPatch } from '@/components/Legend'
import { PlaneToggle } from '@/components/PlaneToggle'
import { ReadoutPanel } from '@/components/ReadoutPanel'
import { ToggleBar } from '@/components/ToggleBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ValueTable } from '@/components/ValueTable'
import { ViewPanel } from '@/components/ViewPanel'
import { loadView, saveView, type ViewSettings } from '@/graph/view'
import { DRAW_UNITS_PER_SEC, drawDuration, isDrawComplete } from '@/graph/animated'
import { buildEquations, newSpecId, nextColorToken, type EquationSpec } from '@/graph/equations'
import { initHistory, record, redo, undo } from '@/graph/history'
import { formatSliderValue, sliderOf } from '@/graph/sliders'
import { downloadBlob, graphFromJson, graphToJson } from '@/graph/library'
import {
  decodeShareHash,
  decodeShareState,
  encodeShareCompressed,
  parseStyle,
  shareVpToViewport,
  styleOf,
  type ShareState,
  type ShareStyle,
} from '@/graph/share'
import type { ComplexComponent, Plane, Viewport } from '@/graph/types'
import { niceStep } from '@/graph/viewport'

const STORAGE_KEY_V2 = 'graph.equations.v2'
const STORAGE_KEY_V1 = 'graph.equations.v1'

function specsFromRaws(raws: string[], vis?: number[], col?: number[], sty?: ShareStyle[], grp?: string[]): EquationSpec[] {
  return raws.map((raw, i) => {
    const colVal = col?.[i]
    const colorToken = colVal !== undefined && Number.isFinite(colVal)
      ? Math.min(4, Math.max(0, Math.round(colVal)))
      : i % 5
    const style = sty?.[i] || {}
    const group = grp?.[i] || undefined
    return { id: newSpecId(), raw, colorToken, visible: vis?.[i] !== 0, color: style.c, dash: style.d, lineWidth: style.w, group }
  })
}

interface PersistedV2 {
  eq: string[]
  plane?: Plane
  sigma?: number
  comp?: ComplexComponent
  vis?: number[]
  col?: number[]
  sty?: unknown[]
  grp?: unknown[]
}

function loadPersisted(): { specs: EquationSpec[]; plane: Plane; sigma: number; comp: ComplexComponent } {
  const fallback = { specs: [] as EquationSpec[], plane: 'xy' as Plane, sigma: 0.5, comp: 're' as ComplexComponent }
  // URL hash takes precedence on load (share deep-links).
  const hash = window.location.hash
  if (hash && hash.length > 1) {
    const state = decodeShareState(hash)
    if (state) {
      return {
        specs: specsFromRaws(state.eq, state.vis, state.col, state.sty, state.grp),
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
          specs: specsFromRaws(
            raws,
            v2.vis,
            v2.col,
            Array.isArray(v2.sty) ? v2.sty.map(parseStyle) : undefined,
            Array.isArray(v2.grp) ? v2.grp.map((name) => (typeof name === 'string' ? name : '')) : undefined
          ),
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
        if (raws.length) return { ...fallback, specs: specsFromRaws(raws) }
      }
    }
  } catch {
    // Corrupt storage — fall through to empty state.
  }
  return fallback
}

/** Append raws as new specs; returns prev unchanged when nothing parses. */
function appendSpecs(prev: EquationSpec[], raws: string[]): EquationSpec[] {
  const next = [...prev]
  for (const raw of raws) {
    next.push({ id: newSpecId(), raw, colorToken: nextColorToken(next), visible: true })
  }
  return next.length === prev.length ? prev : next
}

export default function App() {
  const [initial] = useState(loadPersisted)
  const [history, setHistory] = useState(() => initHistory(initial.specs))
  const specs = history.present
  const setSpecs = (update: (prev: EquationSpec[]) => EquationSpec[], tag?: string) =>
    setHistory((prev) => record(prev, update(prev.present), tag))
  const [view, setView] = useState<ViewSettings>(loadView)
  const [viewOpen, setViewOpen] = useState(false)
  const built = useMemo(() => buildEquations(specs, { angle: view.angle }), [specs, view.angle])
  const equations = built.equations
  const plotted = useMemo(() => equations.filter((equation) => equation.plot), [equations])
  const [activePlane, setActivePlane] = useState<Plane>(initial.plane)
  const [sigma, setSigma] = useState(initial.sigma)
  const [component, setComponent] = useState<ComplexComponent>(initial.comp)
  const [theme, setTheme] = useState<'paper' | 'neon'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.graphTheme === 'paper'
      ? 'paper'
      : 'neon'
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.graphTheme = theme
    root.classList.toggle('dark', theme === 'neon')
    root.dataset.palette = view.palette
  }, [theme, view.palette])

  useEffect(() => saveView(view), [view])

  const changeView = (patch: Partial<ViewSettings>) => {
    setView((prev) => ({ ...prev, ...patch }))
    // Log axes change what the canvas coordinates mean: return home.
    if (patch.logX !== undefined || patch.logY !== undefined) requestAnimationFrame(() => graphRef.current?.reset())
  }
  const [snapX, setSnapX] = useState<number | null>(null)
  const [analysis, setAnalysis] = useState({ points: false, tangent: false })
  const [tableOpen, setTableOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [embed] = useState(() => new URLSearchParams(window.location.search).has('embed'))
  const graphRef = useRef<GraphApi | null>(null)
  const commandRef = useRef<CommandBarApi | null>(null)

  // --- Animated mode state (v1: in-memory only, no persistence) ---
  const [mode, setMode] = useState<GraphMode>('static')
  const [animatedSpecs, setAnimatedSpecs] = useState<EquationSpec[]>([])
  const animatedBuilt = useMemo(() => buildEquations(animatedSpecs, { angle: view.angle }), [animatedSpecs, view.angle])
  const animatedEquations = animatedBuilt.equations
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

  const setActiveSpecs = (update: (prev: EquationSpec[]) => EquationSpec[], tag?: string) => {
    if (animated) setAnimatedSpecs(update)
    else setSpecs(update, tag)
  }

  const updateEquation = (id: string, patch: SpecPatch) => {
    setActiveSpecs((prev) => prev.map((spec) => (spec.id === id ? { ...spec, ...patch } : spec)), `style:${id}`)
  }

  /** Show or hide every equation, or every equation in one folder. */
  const setVisibility = (visible: boolean, group?: string | null) => {
    setActiveSpecs((prev) =>
      prev.map((spec) =>
        group === undefined || (spec.group ?? null) === group ? { ...spec, visible } : spec
      )
    )
  }

  const moveEquation = (id: string, targetId: string) => {
    setActiveSpecs((prev) => {
      const from = prev.findIndex((spec) => spec.id === id)
      const to = prev.findIndex((spec) => spec.id === targetId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      // Dropping onto a row also moves the curve into that row's folder.
      next.splice(to, 0, { ...moved, group: prev[to].group })
      return next
    })
  }

  const addRaw = (raws: string[]) => setSpecs((prev) => appendSpecs(prev, raws))

  const addAnimatedRaw = (raws: string[]) => setAnimatedSpecs((prev) => appendSpecs(prev, raws))

  const toggleEquation = (id: string) => {
    setActiveSpecs((prev) => prev.map((spec) => (spec.id === id ? { ...spec, visible: !spec.visible } : spec)))
  }

  const deleteEquation = (id: string) => {
    setActiveSpecs((prev) => prev.filter((spec) => spec.id !== id))
  }

  const setConst = (id: string, value: number) => {
    setActiveSpecs((prev) =>
      prev.map((spec) => {
        if (spec.id !== id) return spec
        const slider = sliderOf(spec.raw)
        return slider ? { ...spec, raw: `${slider.name} = ${formatSliderValue(value)}` } : spec
      }),
      `const:${id}`
    )
  }

  const getStepSize = (): number => {
    const viewport = graphRef.current?.getViewport()
    return viewport ? niceStep(viewport.scale) / 5 : 1
  }

  const toShareVp = (vp: Viewport | null | undefined) =>
    vp ? { s: vp.scale, ox: vp.originX, oy: vp.originY } : null

  /** The current graph as a share state (equations, view, complex settings). */
  const currentState = (): ShareState | null => {
    if (specs.length === 0) return null
    const viewport = graphRef.current?.getViewport()
    if (!viewport) return null
    const homes = graphRef.current?.getHomes()
    return {
      eq: specs.map((spec) => spec.raw),
      vp: toShareVp(viewport),
      plane: activePlane,
      sigma,
      comp: component,
      vis: specs.map((spec) => (spec.visible ? 1 : 0)),
      col: specs.map((spec) => spec.colorToken),
      sty: specs.map(styleOf),
      grp: specs.map((spec) => spec.group ?? ''),
      homes: homes ? { xy: toShareVp(homes.xy), st: toShareVp(homes.st), reim: toShareVp(homes.reim) } : undefined,
    }
  }

  const linkFor = async (extraSearch = ''): Promise<string | null> => {
    const state = currentState()
    if (!state) return null
    try {
      const payload = await encodeShareCompressed(state)
      const { origin, pathname } = window.location
      return `${origin}${pathname}${extraSearch}#${payload}`
    } catch {
      return null
    }
  }

  const handleShare = () => linkFor()

  const handleEmbed = async () => {
    const url = await linkFor('?embed=1')
    return url ? `<iframe src="${url}" width="640" height="420" style="border:0" title="graph"></iframe>` : null
  }

  /** Load a whole graph (library, import, compressed link) as one undoable step. */
  const applyState = (state: ShareState, opts: { undoable: boolean } = { undoable: true }) => {
    const nextSpecs = specsFromRaws(state.eq, state.vis, state.col, state.sty, state.grp)
    if (opts.undoable) setSpecs(() => nextSpecs)
    else setHistory(initHistory(nextSpecs))
    if (mode !== 'static') switchMode('static')
    setActivePlane(state.plane ?? 'xy')
    setSigma(typeof state.sigma === 'number' ? state.sigma : 0.5)
    setComponent(state.comp ?? 're')
    requestAnimationFrame(() => applyViewports(state))
  }

  // Restore homes first so plane switch can use them, then the active viewport.
  const applyViewports = (state: ShareState) => {
    if (state.homes) {
      const converted: Partial<Record<Plane, Viewport>> = {}
      if (state.homes.xy) converted.xy = shareVpToViewport(state.homes.xy)
      if (state.homes.st) converted.st = shareVpToViewport(state.homes.st)
      if (state.homes.reim) converted.reim = shareVpToViewport(state.homes.reim)
      graphRef.current?.setHomes(converted)
    }
    if (state.plane && state.plane !== 'xy') graphRef.current?.switchPlane(state.plane)
    if (state.vp) graphRef.current?.setViewport(shareVpToViewport(state.vp))
  }

  const exportImage = async (kind: 'png' | 'svg') => {
    const blob = await graphRef.current?.exportImage(kind)
    if (blob) downloadBlob(blob, `graph.${kind}`)
  }

  const exportJson = () => {
    const state = currentState()
    if (!state) return false
    downloadBlob(new Blob([graphToJson(state)], { type: 'application/json' }), 'graph.json')
    return true
  }

  const importJson = async (file: File) => {
    const state = graphFromJson(await file.text())
    if (!state) return false
    applyState(state)
    return true
  }

  useEffect(() => {
    // Embedded graphs must not overwrite the visitor's own saved work.
    if (embed) return
    try {
      const payload: PersistedV2 = {
        eq: specs.map((spec) => spec.raw),
        plane: activePlane,
        sigma,
        comp: component,
        vis: specs.map((spec) => (spec.visible ? 1 : 0)),
        col: specs.map((spec) => spec.colorToken),
        sty: specs.map(styleOf),
        grp: specs.map((spec) => spec.group ?? ''),
      }
      window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload))
    } catch {
      // Storage full / unavailable — equations stay in memory only.
    }
  }, [specs, activePlane, sigma, component, embed])

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return
    let cancelled = false
    decodeShareHash(hash).then((state) => {
      if (!state || cancelled) return
      // Plain links were loaded synchronously; compressed ones load here.
      if (hash.startsWith('#z')) {
        applyState(state, { undoable: false })
        return
      }
      if (state.plane && state.plane !== 'xy') setActivePlane(state.plane)
      if (typeof state.sigma === 'number') setSigma(state.sigma)
      if (state.comp) setComponent(state.comp)
      // Canvas sizes on first frame; defer one tick.
      requestAnimationFrame(() => applyViewports(state))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z' || event.key === 'y')) {
        if (mode !== 'static') return
        event.preventDefault()
        const redoing = event.key === 'y' || event.shiftKey
        setHistory((prev) => (redoing ? redo(prev) : undo(prev)))
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        setHelpOpen((prev) => !prev)
        return
      }
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
          theme={`${theme}|${view.palette}`}
          view={view}
          defRaws={animated ? animatedBuilt.defRaws : built.defRaws}
          analysis={animated ? undefined : analysis}
          onSnap={setSnapX}
        />
        {!embed && (
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
        )}
        {!embed && !animated && activePlane === 'xy' && (
          <ToggleBar
            label="analysis"
            className="absolute left-1/2 top-[132px] z-10 -translate-x-1/2"
            options={[
              { key: 'points', label: 'points', title: 'mark roots, extrema, inflections, intersections', active: analysis.points },
              { key: 'tangent', label: 'tangent', title: 'tangent line at the cursor', active: analysis.tangent },
              { key: 'table', label: 'table', title: 'table of values', active: tableOpen },
              { key: 'view', label: 'view', title: 'grid, axes, scales, angles, palette', active: viewOpen },
            ]}
            onToggle={(key) => {
              if (key === 'table') setTableOpen((prev) => !prev)
              else if (key === 'view') setViewOpen((prev) => !prev)
              else setAnalysis((prev) => ({ ...prev, [key]: !prev[key as 'points' | 'tangent'] }))
            }}
          />
        )}
        {!animated && activePlane === 'xy' && viewOpen && (
          <ViewPanel view={view} onChange={changeView} onClose={() => setViewOpen(false)} />
        )}
        {!animated && tableOpen && <ValueTable equations={plotted} onClose={() => setTableOpen(false)} />}
        {activeEquations.length === 0 && <EmptyGraph />}
        {!animated && (
          <ReadoutPanel
            equations={plotted}
            snapX={snapX}
            onSnapXChange={setSnapX}
            getStepSize={getStepSize}
            plane={activePlane}
            sigma={sigma}
            component={component}
          />
        )}
        {!embed && <AnimatedModeToggle mode={mode} onChange={switchMode} />}
        {!embed && <PlaneToggle plane={activePlane} onChange={switchPlane} />}
        <Legend
          equations={activeEquations}
          onToggle={toggleEquation}
          onDelete={embed ? undefined : deleteEquation}
          onSetConst={setConst}
          onUpdate={embed ? undefined : updateEquation}
          onMove={embed ? undefined : moveEquation}
          onSetVisibility={setVisibility}
          sigma={sigma}
          component={component}
        />
        {!embed && !animated && (
          <CommandBar
            ref={commandRef}
            onAdd={addRaw}
            onHelp={() => setHelpOpen(true)}
            onExportImage={exportImage}
            onExportJson={exportJson}
            onImportJson={importJson}
            onEmbed={handleEmbed}
            onLibrary={() => setLibraryOpen((prev) => !prev)}
            env={built.env}
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
          env={animatedBuilt.env}
        />
        {libraryOpen && !animated && (
          <LibraryPanel getState={currentState} onLoad={(state) => applyState(state)} onClose={() => setLibraryOpen(false)} />
        )}
        {embed && (
          <a
            href={`${window.location.pathname}${window.location.hash}`}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-3 right-3 z-20 rounded-md border bg-background/85 px-2 py-1 text-xs text-muted-foreground backdrop-blur-md hover:text-foreground"
          >
            open in Graph ↗
          </a>
        )}
        {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
      </main>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
