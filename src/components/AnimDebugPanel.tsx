import { useEffect, useRef } from 'react'
import GUI from 'lil-gui'
import { DRAW_UNITS_PER_SEC, drawHeadX } from '@/graph/animated'

interface AnimDebugPanelProps {
  speed: number
  onSpeedChange: (next: number) => void
  drawTime: number
  total: number
}

const SPEED_MIN = 0.05
const SPEED_MAX = 20
const LOG_MIN = Math.log10(SPEED_MIN)
const LOG_MAX = Math.log10(SPEED_MAX)

function clampSpeed(v: number): number {
  if (!Number.isFinite(v)) return DRAW_UNITS_PER_SEC
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, v))
}

/**
 * TEMP debug panel for animated draw-on speed (lil-gui).
 * Mounted only in animated mode. Removed before shipping.
 * Log slider: lil-gui has no built-in log scale, so the slider drives
 * log10(speed) over [log10(0.05), log10(20)] and maps to actual u/s.
 */
export function AnimDebugPanel({ speed, onSpeedChange, drawTime, total }: AnimDebugPanelProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const guiRef = useRef<GUI | null>(null)
  const paramsRef = useRef({
    logSpeed: Math.log10(clampSpeed(speed)),
    speed,
    elapsed: 0,
    total,
    head: 0,
  })
  const onSpeedRef = useRef(onSpeedChange)
  onSpeedRef.current = onSpeedChange

  // Keep mutable params in sync for the readout controllers.
  paramsRef.current.elapsed = drawTime
  paramsRef.current.total = total
  paramsRef.current.head = drawHeadX(drawTime, speed)
  paramsRef.current.speed = speed
  const targetLog = Math.log10(clampSpeed(speed))
  if (Math.abs(paramsRef.current.logSpeed - targetLog) > 1e-9) {
    paramsRef.current.logSpeed = targetLog
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const gui = new GUI({ title: 'Anim debug (TEMP)' })
    guiRef.current = gui
    mount.appendChild(gui.domElement)
    gui.domElement.style.position = 'static'

    const params = paramsRef.current
    gui
      .add(params, 'logSpeed', LOG_MIN, LOG_MAX, 0.001)
      .name(`speed log (u/s ${SPEED_MIN}–${SPEED_MAX})`)
      .onChange((v: number) => {
        const s = clampSpeed(Math.pow(10, v))
        params.speed = s
        onSpeedRef.current(s)
      })
    gui.add(params, 'speed').name('speed (u/s)').disable().listen()
    gui
      .add(
        {
          reset: () => {
            params.logSpeed = Math.log10(DRAW_UNITS_PER_SEC)
            params.speed = DRAW_UNITS_PER_SEC
            onSpeedRef.current(DRAW_UNITS_PER_SEC)
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
          },
        },
        'reset'
      )
      .name(`reset to ${DRAW_UNITS_PER_SEC}`)
    gui.add(params, 'elapsed').name('elapsed (s)').disable().listen()
    gui.add(params, 'total').name('total (s)').disable().listen()
    gui.add(params, 'head').name('head x').disable().listen()

    return () => {
      gui.destroy()
      guiRef.current = null
    }
    // Mount once; live values flow through paramsRef + listen().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh readouts as the clock advances.
  useEffect(() => {
    guiRef.current?.controllersRecursive().forEach((c) => c.updateDisplay())
  }, [drawTime, total, speed])

  return (
    <div
      ref={mountRef}
      className="absolute right-3 top-16 z-30"
      aria-label="animation debug panel"
    />
  )
}
