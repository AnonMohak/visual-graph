export interface GraphColors {
  background: string
  gridMinor: string
  gridMajor: string
  axis: string
  accent: string
  label: string
  charts: string[]
}

const FALLBACK: GraphColors = {
  background: '#0b100e',
  gridMinor: 'rgba(255, 255, 255, 0.05)',
  gridMajor: 'rgba(255, 255, 255, 0.11)',
  axis: 'rgba(190, 225, 210, 0.55)',
  accent: '#7ee0a9',
  label: 'rgba(190, 225, 210, 0.75)',
  charts: ['#a78bfa', '#22d3ee', '#fbbf24', '#fb7185', '#4ade80'],
}

function supportsColor(value: string): boolean {
  if (!value) return false
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return true
  ctx.fillStyle = '#010203'
  ctx.fillStyle = value
  return ctx.fillStyle !== '#010203'
}

function readVar(name: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function pick(value: string, fallback: string): string {
  if (!value) return fallback
  return supportsColor(value) ? value : fallback
}

/**
 * Resolve canvas colors from CSS vars so paper/neon themes apply live.
 * Chart order is fixed (1..5) — themes only retune the values.
 */
export function resolveGraphColors(): GraphColors {
  return {
    background: pick(readVar('--background'), FALLBACK.background),
    gridMinor: pick(readVar('--graph-grid-minor'), FALLBACK.gridMinor),
    gridMajor: pick(readVar('--graph-grid-major'), FALLBACK.gridMajor),
    axis: pick(readVar('--graph-axis'), FALLBACK.axis),
    accent: pick(readVar('--graph-accent'), FALLBACK.accent),
    label: pick(readVar('--muted-foreground'), FALLBACK.label),
    charts: FALLBACK.charts.map((fallback, i) => pick(readVar(`--chart-${i + 1}`), fallback)),
  }
}
