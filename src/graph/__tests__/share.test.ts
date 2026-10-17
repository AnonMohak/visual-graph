import { describe, expect, it } from 'vitest'
import { decodeShareState, encodeShareState } from '../share'

describe('share state', () => {
  it('round-trips equations and viewport', () => {
    const hash = encodeShareState({ eq: ['sin(x)', 'x^2'], vp: { s: 60, ox: 100, oy: 200 }, vis: [1, 0], col: [0, 3] })
    const state = decodeShareState(`#${hash}`)
    expect(state?.eq).toEqual(['sin(x)', 'x^2'])
    expect(state?.vp).toEqual({ s: 60, ox: 100, oy: 200 })
    expect(state?.vis).toEqual([1, 0])
    expect(state?.col).toEqual([0, 3])
  })

  it('rejects garbage', () => {
    expect(decodeShareState('#!!notbase64')).toBeNull()
    expect(decodeShareState('')).toBeNull()
  })
})

describe('share styles', () => {
  it('round-trips styles and drops invalid values', () => {
    const hash = encodeShareState({ eq: ['x', 'x^2'], vp: null, sty: [{ c: '#ff0000', d: 'dashed', w: 3 }, 0] })
    expect(decodeShareState(hash)?.sty).toEqual([{ c: '#ff0000', d: 'dashed', w: 3 }, 0])
  })
  it('rejects unsafe colors', async () => {
    const { parseStyle } = await import('../share')
    expect(parseStyle({ c: 'red;background:url(x)', w: 99 })).toBe(0)
  })
})
