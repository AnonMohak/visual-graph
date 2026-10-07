import type { EvaluateComplexFn, Viewport } from './types'
import { screenToWorldX, screenToWorldY } from './viewport'
import { cAbs, cArg, zetaComplex } from './zeta'

export interface FieldOptions {
  terms?: number
  step?: number
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const hh = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hh < 1) [r, g, b] = [c, x, 0]
  else if (hh < 2) [r, g, b] = [x, c, 0]
  else if (hh < 3) [r, g, b] = [0, c, x]
  else if (hh < 4) [r, g, b] = [0, x, c]
  else if (hh < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = v - c
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** Domain coloring: hue=arg(z), brightness=log|z|. Pole s=1 clipped to dark. */
export function fieldColorFor(
  z: { re: number; im: number } | null,
  sDistToPole: number
): [number, number, number, number] {
  if (sDistToPole < 0.02) return [10, 12, 14, 255] // clipped pole s=1
  if (!z || !Number.isFinite(z.re) || !Number.isFinite(z.im)) return [0, 0, 0, 0]
  const mag = cAbs(z)
  if (!Number.isFinite(mag)) return [0, 0, 0, 0]
  const hue = ((cArg(z) + Math.PI) / (2 * Math.PI)) * 360
  // Brightness from log magnitude: rings via fractional part, base brightness via tanh.
  const logMag = Math.log(mag + 1e-12) / Math.LN2
  const ring = Math.abs(((logMag % 1) + 1) % 1 - 0.5) * 2 // 0..1
  const base = 0.55 + 0.3 * Math.tanh(logMag / 4)
  const v = Math.min(1, Math.max(0.15, base - ring * 0.12))
  const s = mag < 1e-3 || mag > 1e3 ? 0.55 : 0.9
  const [r, g, b] = hsvToRgb(hue, s, v)
  return [r, g, b, 255]
}

export function computeFieldImage(
  width: number,
  height: number,
  viewport: Viewport,
  evaluate: EvaluateComplexFn | null,
  opts?: FieldOptions
): ImageData {
  const step = Math.max(1, Math.round(opts?.step ?? 2))
  const terms = opts?.terms ?? 200
  const data = new ImageData(width, height)
  const px = data.data
  for (let py = 0; py < height; py += 1) {
    const wy = screenToWorldY(viewport, py)
    for (let sx = 0; sx < width; sx += 1) {
      const wx = screenToWorldX(viewport, sx)
      const poleDist = Math.hypot(wx - 1, wy)
      let z: { re: number; im: number } | null
      if (evaluate) {
        try {
          const v = evaluate({ re: wx, im: wy } as never)
          z = v ? { re: (v as { re: number }).re, im: (v as { im: number }).im } : null
        } catch {
          z = null
        }
      } else {
        z = zetaComplex({ re: wx, im: wy }, { terms })
      }
      const [r, g, b, a] = fieldColorFor(z, poleDist)
      // Fill step x step block for coarse mode.
      for (let oy = 0; oy < step && py + oy < height; oy++) {
        for (let ox = 0; ox < step && sx + ox < width; ox++) {
          const idx = ((py + oy) * width + (sx + ox)) * 4
          px[idx] = r
          px[idx + 1] = g
          px[idx + 2] = b
          px[idx + 3] = a
        }
      }
      if (step > 1) sx += step - 1
    }
    if (step > 1) {
      // duplicate rows already filled by block fill above; skip
    }
  }
  return data
}

export function drawFieldImage(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  offscreen?: HTMLCanvasElement | null
): void {
  if (offscreen) {
    offscreen.width = img.width
    offscreen.height = img.height
    const octx = offscreen.getContext('2d')
    if (octx) {
      octx.putImageData(img, 0, 0)
      ctx.drawImage(offscreen, 0, 0, img.width, img.height)
      return
    }
  }
  // Fallback: put directly (assumes canvas matches CSS pixel size pre-transform).
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.putImageData(img, 0, 0)
  ctx.restore()
}
