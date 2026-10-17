import { describe, expect, it } from 'vitest'
import { HIGH_HZ, LOW_HZ, pitchTrack } from '../sonify'

describe('sonification', () => {
  it('maps y to pitch and leaves gaps silent', () => {
    const track = pitchTrack((x) => (x < 0 ? null : x), -1, 1, 0, 1, 5)
    expect(track).toEqual([null, null, LOW_HZ, (LOW_HZ + HIGH_HZ) / 2, HIGH_HZ])
  })
})
