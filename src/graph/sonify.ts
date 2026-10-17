import type { EvaluateFn } from './types'

export const LOW_HZ = 220
export const HIGH_HZ = 880

/**
 * Pitch for each x step: y mapped linearly from [yMin, yMax] to
 * [LOW_HZ, HIGH_HZ] (clamped); null where the curve is undefined.
 */
export function pitchTrack(f: EvaluateFn, xMin: number, xMax: number, yMin: number, yMax: number, steps: number): (number | null)[] {
  const out: (number | null)[] = []
  const span = yMax - yMin || 1
  for (let k = 0; k < steps; k++) {
    const x = xMin + ((xMax - xMin) * k) / Math.max(1, steps - 1)
    const y = f(x)
    if (y === null || !Number.isFinite(y)) {
      out.push(null)
      continue
    }
    const t = Math.min(1, Math.max(0, (y - yMin) / span))
    out.push(LOW_HZ + (HIGH_HZ - LOW_HZ) * t)
  }
  return out
}

let active: AudioContext | null = null

/** Play a pitch track over `seconds`; silence where the pitch is null. Stops any earlier sound. */
export function playTrack(track: (number | null)[], seconds = 3): void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx || !track.length) return
  void active?.close()
  const ctx = new Ctx()
  active = ctx
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.connect(gain)
  gain.connect(ctx.destination)
  const start = ctx.currentTime + 0.05
  const step = seconds / track.length
  gain.gain.setValueAtTime(0, ctx.currentTime)
  track.forEach((hz, k) => {
    const at = start + k * step
    if (hz === null) {
      gain.gain.setTargetAtTime(0, at, 0.01)
    } else {
      osc.frequency.setValueAtTime(hz, at)
      gain.gain.setTargetAtTime(0.2, at, 0.01)
    }
  })
  gain.gain.setTargetAtTime(0, start + seconds, 0.02)
  osc.start(start)
  osc.stop(start + seconds + 0.2)
  osc.onended = () => {
    void ctx.close()
    if (active === ctx) active = null
  }
}
