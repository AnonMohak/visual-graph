// Domain-coloring field worker (Vite ?worker).
// Receives { jobId, raw, width, height, viewport, terms, step } and posts
// { jobId, buffer, width, height } with the RGBA pixels transferred.

import { parseEquation } from './parse'
import { computeFieldImage } from './field'
import type { Viewport } from './types'

interface FieldJob {
  jobId: number
  raw: string | null
  width: number
  height: number
  viewport: Viewport
  terms: number
  step: number
}

self.onmessage = (event: MessageEvent<FieldJob>) => {
  const { jobId, raw, width, height, viewport, terms, step } = event.data
  if (!width || !height || width > 4096 || height > 4096) return
  let evaluate: Parameters<typeof computeFieldImage>[3] = null
  if (raw) {
    try {
      const parsed = parseEquation(raw)
      if (parsed.ok && parsed.evaluateComplex) evaluate = parsed.evaluateComplex
    } catch {
      evaluate = null
    }
  }
  try {
    const img = computeFieldImage(width, height, viewport, evaluate, { terms, step })
    self.postMessage({ jobId, buffer: img.data.buffer, width, height })
  } catch {
    // Worker must never throw back to the main thread loop.
  }
}
