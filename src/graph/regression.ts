export type Point = [number, number]

/** Parse pasted CSV/TSV text: the first two numbers on each line are x and y. Headers are skipped. */
export function parseCsv(text: string): Point[] {
  const points: Point[] = []
  for (const line of text.split(/\r?\n/)) {
    const cells = line
      .split(/[,;\t ]+/)
      .map((cell) => cell.trim())
      .filter(Boolean)
    if (cells.length < 2) continue
    const x = Number(cells[0])
    const y = Number(cells[1])
    if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y])
  }
  return points
}

function num(value: number): string {
  return String(Number(value.toPrecision(6)))
}

/** Equation text for a point list: `(1, 2), (3, 4)`. */
export function pointsToRaw(points: Point[]): string {
  return points.map(([x, y]) => `(${num(x)}, ${num(y)})`).join(', ')
}

/** Solve A x = b by Gaussian elimination with partial pivoting; null if singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col]
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = m[row][n]
    for (let k = row + 1; k < n; k++) sum -= m[row][k] * x[k]
    x[row] = sum / m[row][row]
  }
  return x
}

export interface Fit {
  /** Coefficients c0..cn of c0 + c1 x + ... + cn x^n. */
  coefficients: number[]
  r2: number
}

/**
 * Least-squares polynomial fit of the given degree (1 = linear).
 * x is centered and scaled before solving the normal equations for stability.
 */
export function polyFit(points: Point[], degree: number): Fit | null {
  const d = Math.max(1, Math.min(6, Math.round(degree)))
  if (points.length < d + 1) return null
  const xs = points.map((p) => p[0])
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const spread = Math.max(...xs.map((x) => Math.abs(x - mean))) || 1
  const u = xs.map((x) => (x - mean) / spread)
  const ata = Array.from({ length: d + 1 }, () => new Array<number>(d + 1).fill(0))
  const atb = new Array<number>(d + 1).fill(0)
  points.forEach(([, y], i) => {
    for (let r = 0; r <= d; r++) {
      atb[r] += u[i] ** r * y
      for (let c = 0; c <= d; c++) ata[r][c] += u[i] ** (r + c)
    }
  })
  const scaled = solve(ata, atb)
  if (!scaled) return null
  // Expand sum a_k ((x - mean)/spread)^k into powers of x.
  const coefficients = new Array<number>(d + 1).fill(0)
  for (let k = 0; k <= d; k++) {
    const a = scaled[k] / spread ** k
    for (let j = 0; j <= k; j++) {
      coefficients[j] += a * binomial(k, j) * (-mean) ** (k - j)
    }
  }
  const yMean = points.reduce((sum, p) => sum + p[1], 0) / points.length
  let ssRes = 0
  let ssTot = 0
  for (const [x, y] of points) {
    const predicted = coefficients.reduce((sum, c, k) => sum + c * x ** k, 0)
    ssRes += (y - predicted) ** 2
    ssTot += (y - yMean) ** 2
  }
  return { coefficients, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot }
}

function binomial(n: number, k: number): number {
  let out = 1
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i
  return out
}

/** Equation text for a fit: `y = 2x + 1`, `y = 0.5x^2 - x + 3`. */
export function fitToRaw(fit: Fit): string {
  const terms: string[] = []
  for (let k = fit.coefficients.length - 1; k >= 0; k--) {
    const c = Number(fit.coefficients[k].toPrecision(6))
    if (c === 0 && fit.coefficients.length > 1) continue
    const sign = c < 0 ? '-' : '+'
    const abs = Math.abs(c)
    const power = k === 0 ? '' : k === 1 ? 'x' : `x^${k}`
    const body = k === 0 ? String(abs) : abs === 1 ? power : `${abs}${power}`
    terms.push(terms.length === 0 ? (sign === '-' ? `-${body}` : body) : `${sign} ${body}`)
  }
  return `y = ${terms.length ? terms.join(' ') : '0'}`
}
