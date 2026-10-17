import { describe, expect, it } from 'vitest'
import { drawGraph } from '../render'
import { SvgContext } from '../svg'

describe('svg export', () => {
  it('records the grid, a curve and labels as SVG', () => {
    const svg = new SvgContext(200, 100)
    drawGraph(svg as unknown as CanvasRenderingContext2D, {
      width: 200,
      height: 100,
      dpr: 1,
      viewport: { scale: 20, originX: 100, originY: 50 },
      colors: {
        background: '#000',
        gridMinor: '#111',
        gridMajor: '#222',
        axis: '#333',
        accent: '#0f0',
        label: '#ccc',
        charts: ['#f00', '#0f0', '#00f', '#ff0', '#0ff'],
      },
      curves: [
        {
          id: 'a',
          colorIndex: 0,
          visible: true,
          samples: { segments: [{ xs: Float64Array.of(-1, 1), ys: Float64Array.of(-1, 1) }], hasPoints: true },
          evaluate: (x) => x,
        },
      ],
      hover: null,
      snapX: null,
      labels: { x: 'x', y: 'y & <z>' },
    })
    const text = svg.toString()
    expect(text.startsWith('<svg')).toBe(true)
    expect(text).toContain('stroke="#f00"')
    expect(text).toContain('M80 70L120 30')
    expect(text).toContain('y &#38; &#60;z&#62;')
  })
})
