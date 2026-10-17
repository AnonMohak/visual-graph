/**
 * Minimal CanvasRenderingContext2D stand-in that records drawing calls as SVG.
 * It covers exactly what render.ts uses, so drawGraph() can produce vector output.
 */

interface Style {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  globalAlpha: number
  dash: number[]
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

function n(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0'
}

const BASELINE: Partial<Record<CanvasTextBaseline, string>> = {
  top: 'hanging',
  middle: 'central',
  bottom: 'text-after-edge',
}

const ANCHOR: Partial<Record<CanvasTextAlign, string>> = {
  center: 'middle',
  right: 'end',
  end: 'end',
}

export class SvgContext {
  private readonly parts: string[] = []
  private path = ''
  private stack: Style[] = []
  private style: Style = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    dash: [],
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
    lineJoin: 'miter',
  }

  // Accepted for API compatibility; glow is not exported.
  shadowColor = ''
  shadowBlur = 0

  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  get fillStyle(): string {
    return this.style.fillStyle
  }
  set fillStyle(value: string) {
    this.style.fillStyle = value
  }
  get strokeStyle(): string {
    return this.style.strokeStyle
  }
  set strokeStyle(value: string) {
    this.style.strokeStyle = value
  }
  get lineWidth(): number {
    return this.style.lineWidth
  }
  set lineWidth(value: number) {
    this.style.lineWidth = value
  }
  get globalAlpha(): number {
    return this.style.globalAlpha
  }
  set globalAlpha(value: number) {
    this.style.globalAlpha = value
  }
  get font(): string {
    return this.style.font
  }
  set font(value: string) {
    this.style.font = value
  }
  get textAlign(): CanvasTextAlign {
    return this.style.textAlign
  }
  set textAlign(value: CanvasTextAlign) {
    this.style.textAlign = value
  }
  get textBaseline(): CanvasTextBaseline {
    return this.style.textBaseline
  }
  set textBaseline(value: CanvasTextBaseline) {
    this.style.textBaseline = value
  }
  get lineCap(): CanvasLineCap {
    return this.style.lineCap
  }
  set lineCap(value: CanvasLineCap) {
    this.style.lineCap = value
  }
  get lineJoin(): CanvasLineJoin {
    return this.style.lineJoin
  }
  set lineJoin(value: CanvasLineJoin) {
    this.style.lineJoin = value
  }

  save(): void {
    this.stack.push({ ...this.style, dash: [...this.style.dash] })
  }
  restore(): void {
    const prev = this.stack.pop()
    if (prev) this.style = prev
  }
  setLineDash(dash: number[]): void {
    this.style.dash = [...dash]
  }
  setTransform(): void {}
  clearRect(): void {}

  beginPath(): void {
    this.path = ''
  }
  closePath(): void {
    this.path += 'Z'
  }
  moveTo(x: number, y: number): void {
    this.path += `M${n(x)} ${n(y)}`
  }
  lineTo(x: number, y: number): void {
    this.path += `L${n(x)} ${n(y)}`
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.path += `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.rect(x, y, w, h)
  }
  /** Only full circles are drawn by the renderer. */
  arc(x: number, y: number, r: number): void {
    this.path += `M${n(x + r)} ${n(y)}A${n(r)} ${n(r)} 0 1 0 ${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 1 0 ${n(x + r)} ${n(y)}`
  }

  private alpha(): string {
    return this.style.globalAlpha < 1 ? ` opacity="${n(this.style.globalAlpha)}"` : ''
  }

  stroke(): void {
    if (!this.path) return
    const dash = this.style.dash.length ? ` stroke-dasharray="${this.style.dash.map(n).join(' ')}"` : ''
    this.parts.push(
      `<path d="${this.path}" fill="none" stroke="${escapeXml(this.style.strokeStyle)}" stroke-width="${n(this.style.lineWidth)}" stroke-linecap="${this.style.lineCap}" stroke-linejoin="${this.style.lineJoin}"${dash}${this.alpha()}/>`
    )
  }
  fill(): void {
    if (!this.path) return
    this.parts.push(`<path d="${this.path}" fill="${escapeXml(this.style.fillStyle)}"${this.alpha()}/>`)
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.parts.push(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${escapeXml(this.style.fillStyle)}"${this.alpha()}/>`
    )
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.parts.push(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${escapeXml(this.style.strokeStyle)}" stroke-width="${n(this.style.lineWidth)}"${this.alpha()}/>`
    )
  }

  private fontSize(): number {
    const match = /(\d+(?:\.\d+)?)px/.exec(this.style.font)
    return match ? Number(match[1]) : 10
  }

  measureText(text: string): { width: number } {
    // Monospace estimate: 0.6em per character.
    return { width: text.length * this.fontSize() * 0.6 }
  }

  fillText(text: string, x: number, y: number): void {
    const anchor = ANCHOR[this.style.textAlign] ?? 'start'
    const baseline = BASELINE[this.style.textBaseline] ?? 'alphabetic'
    this.parts.push(
      `<text x="${n(x)}" y="${n(y)}" font-family="ui-monospace, monospace" font-size="${this.fontSize()}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="${escapeXml(this.style.fillStyle)}"${this.alpha()}>${escapeXml(text)}</text>`
    )
  }

  /** Raster layers (the complex field) are embedded as a PNG image. */
  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void {
    if (typeof HTMLCanvasElement === 'undefined' || !(image instanceof HTMLCanvasElement)) return
    this.parts.push(
      `<image href="${image.toDataURL('image/png')}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none"/>`
    )
  }

  toString(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">${this.parts.join('')}</svg>`
  }
}
