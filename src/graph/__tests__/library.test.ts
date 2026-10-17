import { beforeEach, describe, expect, it } from 'vitest'
import { deleteSaved, graphFromJson, graphToJson, listSaved, saveGraph } from '../library'
import { decodeShareHash, encodeShareCompressed, encodeShareState } from '../share'

// Minimal localStorage for the node test environment.
const store = new Map<string, string>()
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  },
})

const state = { eq: ['sin(x)', 'a = 2'], vp: { s: 60, ox: 10, oy: 20 }, grp: ['trig', ''] }

describe('library', () => {
  beforeEach(() => store.clear())

  it('saves, replaces and deletes by name', () => {
    saveGraph('one', state, 1)
    saveGraph('two', { ...state, eq: ['x'] }, 2)
    saveGraph('one', { ...state, eq: ['x^2'] }, 3)
    const list = listSaved()
    expect(list.map((item) => item.name)).toEqual(['one', 'two'])
    expect(list[0].state.eq).toEqual(['x^2'])
    deleteSaved('one')
    expect(listSaved().map((item) => item.name)).toEqual(['two'])
  })

  it('round-trips JSON files and rejects bad input', () => {
    const parsed = graphFromJson(graphToJson(state, 'demo'))
    expect(parsed?.eq).toEqual(state.eq)
    expect(parsed?.grp).toEqual(['trig', ''])
    expect(graphFromJson('{"eq": 5}')).toBeNull()
    expect(graphFromJson('not json')).toBeNull()
  })
})

describe('compressed links', () => {
  it('round-trips and is shorter for repetitive input', async () => {
    const big = { eq: Array.from({ length: 20 }, (_, k) => `sin(${k}*x) + cos(${k}*x)`), vp: null }
    const short = await encodeShareCompressed(big)
    expect(short.startsWith('z')).toBe(true)
    expect(short.length).toBeLessThan(encodeShareState(big).length)
    expect((await decodeShareHash(`#${short}`))?.eq).toEqual(big.eq)
  })

  it('still reads plain links', async () => {
    expect((await decodeShareHash(`#${encodeShareState(state)}`))?.eq).toEqual(state.eq)
  })
})
