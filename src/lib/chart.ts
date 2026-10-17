import type { CSSProperties } from 'react'

export const CHART_CLASSES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

interface Colored {
  colorToken: number
  color?: string
}

/** Swatch class for a curve: the theme color unless a custom color is set. */
export function swatchClass(curve: Colored): string {
  return curve.color ? '' : CHART_CLASSES[curve.colorToken % 5]
}

export function swatchStyle(curve: Colored): CSSProperties | undefined {
  return curve.color ? { background: curve.color } : undefined
}
