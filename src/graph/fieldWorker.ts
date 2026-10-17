// Domain-coloring field worker (Vite ?worker).
// Receives { jobId, raw, width, height, viewport, terms, step } and posts
// { jobId, buffer, width, height } with the RGBA pixels transferred.

import { envFromDefs } from './equations'
import { parseEquation } from './parse'
import { computeFieldImage, type Contours } from './field'
import type { Viewport } from './types'

interface FieldJob {
  jobId: number
  raw: string | null
  defs?: string[]
  contours?: Contours
  width: number
  height: number
  viewport: Viewport
  terms: number
  step: number
}

self.onmessage = (event: MessageEvent<FieldJob>) => {
  const { jobId, raw, defs, contours, width, height, viewport, terms, step } = event.data
  if (!width || !height || width > 4096 || height > 4096) return
  let evaluate: Parameters<typeof computeFieldImage>[3] = null
  if (raw) {
    try {
      const parsed = parseEquation(raw, envFromDefs(defs ?? []))
      if (parsed.ok && parsed.evaluateComplex) evaluate = parsed.evaluateComplex
    } catch {
      evaluate = null
    }
  }
  try {
    const img = computeFieldImage(width, height, viewport, evaluate, { terms, step, contours })
    self.postMessage({ jobId, buffer: img.data.buffer, width, height })
  } catch {
    // Worker must never throw back to the main thread loop.
  }
}
