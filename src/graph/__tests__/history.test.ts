import { describe, expect, it } from 'vitest'
import { initHistory, record, redo, undo } from '../history'

describe('history', () => {
  it('undoes and redoes', () => {
    let h = initHistory(1)
    h = record(h, 2)
    h = record(h, 3)
    h = undo(h)
    expect(h.present).toBe(2)
    h = redo(h)
    expect(h.present).toBe(3)
    h = undo(undo(h))
    expect(h.present).toBe(1)
    expect(undo(h)).toBe(h)
  })

  it('merges rapid changes with the same tag', () => {
    let h = initHistory(0)
    h = record(h, 1, 'slider', 1000)
    h = record(h, 2, 'slider', 1200)
    h = record(h, 3, 'slider', 1400)
    expect(undo(h).present).toBe(0)
  })

  it('clears redo on a new change', () => {
    let h = record(initHistory(0), 1)
    h = record(undo(h), 5)
    expect(redo(h)).toBe(h)
  })
})
