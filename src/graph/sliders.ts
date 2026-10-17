import { parseEquation, type Env, type ParseResult } from './parse'

/**
 * Parse with free single-letter symbols auto-defined as sliders (`a = 1`).
 * `sliders` lists the definitions to add before the equation itself.
 */
export function parseWithSliders(line: string, env: Env): ParseResult & { sliders?: string[] } {
  const result = parseEquation(line, env)
  if (result.ok || !result.freeSymbols?.length) return result
  const withSliders: Env = { ...env }
  for (const name of result.freeSymbols) withSliders[name] = 1
  const retry = parseEquation(line, withSliders)
  if (!retry.ok) return result
  return { ...retry, sliders: result.freeSymbols.map((name) => `${name} = 1`) }
}

const SLIDER_RE = /^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*(-?\d*\.?\d+(?:e-?\d+)?)\s*$/

/** A constant definition whose right side is a plain number gets a slider. */
export function sliderOf(raw: string): { name: string; value: number } | null {
  const match = SLIDER_RE.exec(raw)
  if (!match) return null
  const value = Number(match[2])
  return Number.isFinite(value) ? { name: match[1], value } : null
}

/** Default slider range: [-10, 10], widened to contain the value. */
export function sliderRange(value: number): { min: number; max: number; step: number } {
  const bound = Math.max(10, Math.ceil(Math.abs(value)))
  return { min: -bound, max: bound, step: bound / 200 }
}

export function formatSliderValue(value: number): string {
  return String(Number(value.toPrecision(6)))
}
