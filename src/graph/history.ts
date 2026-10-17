export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Tag of the last change; equal tags close in time merge into one step. */
  tag?: string
  time: number
}

const LIMIT = 100
const MERGE_MS = 800

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], time: 0 }
}

/** Record a new present. A change with the same tag as the last one, soon after, replaces it. */
export function record<T>(history: History<T>, next: T, tag?: string, now = Date.now()): History<T> {
  if (Object.is(next, history.present)) return history
  if (tag && tag === history.tag && now - history.time < MERGE_MS) {
    return { ...history, present: next, future: [], time: now }
  }
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: next,
    future: [],
    tag,
    time: now,
  }
}

export function undo<T>(history: History<T>): History<T> {
  if (!history.past.length) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    time: 0,
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (!history.future.length) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    time: 0,
  }
}
