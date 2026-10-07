import type { ComplexComponent, Plane, Viewport } from './types'

export interface ShareViewport {
  s: number
  ox: number
  oy: number
}

export interface ShareState {
  eq: string[]
  vp: ShareViewport | null
  /** v2 fields */
  plane?: Plane
  sigma?: number
  comp?: ComplexComponent
  homes?: Partial<Record<Plane, ShareViewport | null>>
  /** Visibility (1 = visible, 0 = hidden) and color token per equation. */
  vis?: number[]
  col?: number[]
}

const MAX_EQUATIONS = 100
const MAX_LENGTH = 500

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function toShareVp(vp: ShareViewport | Viewport | null | undefined): ShareViewport | null {
  if (!vp) return null
  if ('s' in vp) {
    const s = Number(vp.s)
    const ox = Number(vp.ox)
    const oy = Number(vp.oy)
    if (Number.isFinite(s) && Number.isFinite(ox) && Number.isFinite(oy)) return { s, ox, oy }
    return null
  }
  const v = vp as Viewport
  if (Number.isFinite(v.scale) && Number.isFinite(v.originX) && Number.isFinite(v.originY)) {
    return { s: round(v.scale), ox: round(v.originX), oy: round(v.originY) }
  }
  return null
}

function parseVp(raw: unknown): ShareViewport | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  const s = Number(candidate.s)
  const ox = Number(candidate.ox)
  const oy = Number(candidate.oy)
  if (Number.isFinite(s) && Number.isFinite(ox) && Number.isFinite(oy)) {
    return { s, ox, oy }
  }
  return null
}

export function encodeShareState(state: ShareState): string {
  const payload: Record<string, unknown> = {
    eq: state.eq.slice(0, MAX_EQUATIONS).map((raw) => raw.slice(0, MAX_LENGTH)),
    vp: state.vp
      ? { s: round(state.vp.s), ox: round(state.vp.ox), oy: round(state.vp.oy) }
      : null,
  }
  // v2: {eq:[raw], plane, sigma, comp, vp, homes} — omit defaults to stay short.
  if (state.plane && state.plane !== 'xy') payload.plane = state.plane
  if (typeof state.sigma === 'number' && Number.isFinite(state.sigma)) payload.sigma = round(state.sigma)
  if (state.comp && state.comp !== 're') payload.comp = state.comp
  if (state.homes) {
    const homes: Record<string, ShareViewport> = {}
    for (const [k, v] of Object.entries(state.homes)) {
      const sv = toShareVp(v as ShareViewport)
      if (sv) homes[k] = sv
    }
    if (Object.keys(homes).length) payload.homes = homes
  }
  if (state.vis) {
    const vis = state.vis.slice(0, MAX_EQUATIONS).map((v) => (v ? 1 : 0))
    // Omit when all visible to stay short.
    if (vis.some((v) => v === 0)) payload.vis = vis
  }
  if (state.col) {
    const col = state.col.slice(0, MAX_EQUATIONS).map((c) => {
      const n = Math.round(Number(c))
      return Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0
    })
    payload.col = col
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return bytesToBase64Url(bytes)
}

export function decodeShareState(hash: string): ShareState | null {
  try {
    const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
    if (!trimmed) return null
    const bytes = base64UrlToBytes(trimmed)
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    const eqRaw = record.eq
    if (!Array.isArray(eqRaw)) return null
    const eq = eqRaw.filter((item): item is string => typeof item === 'string').slice(0, MAX_EQUATIONS)
    // v1 fallback: {eq, vp} only.
    const vp = parseVp(record.vp)
    let plane: Plane = 'xy'
    if (record.plane === 'st' || record.plane === 'reim' || record.plane === 'xy') plane = record.plane
    let sigma: number | undefined
    const sigmaNum = Number(record.sigma)
    if (Number.isFinite(sigmaNum)) sigma = sigmaNum
    let comp: ComplexComponent | undefined
    if (record.comp === 're' || record.comp === 'im' || record.comp === 'abs' || record.comp === 'arg') {
      comp = record.comp
    }
    let homes: ShareState['homes']
    if (record.homes && typeof record.homes === 'object') {
      const rawHomes = record.homes as Record<string, unknown>
      homes = {}
      for (const key of ['xy', 'st', 'reim'] as const) {
        const sv = parseVp(rawHomes[key])
        if (sv) homes[key] = sv
      }
      if (!Object.keys(homes).length) homes = undefined
    }
    // Backward-compat: v1 payloads omit vis/col entirely.
    let vis: number[] | undefined
    if (Array.isArray(record.vis)) {
      vis = (record.vis as unknown[])
        .slice(0, MAX_EQUATIONS)
        .map((v) => (Number(v) ? 1 : 0))
    }
    let col: number[] | undefined
    if (Array.isArray(record.col)) {
      col = (record.col as unknown[])
        .slice(0, MAX_EQUATIONS)
        .map((c) => {
          const n = Math.round(Number(c))
          return Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0
        })
    }
    return { eq, vp, plane, sigma, comp, homes, vis, col }
  } catch {
    return null
  }
}

export function shareVpToViewport(vp: ShareViewport): Viewport {
  return { scale: vp.s, originX: vp.ox, originY: vp.oy }
}
