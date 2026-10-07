import { useSyncExternalStore } from 'react'

interface Store<T> {
  get: () => T
  set: (next: T) => void
  subscribe: (listener: () => void) => () => void
}

function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set: (next) => {
      if (Object.is(next, state)) return
      state = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export interface HoverZ {
  re: number
  im: number
}

export interface ReadoutState {
  hoverX: number | null
  hoverY: number | null
  hoverZ: HoverZ | null
}

export const readoutStore = createStore<ReadoutState>({ hoverX: null, hoverY: null, hoverZ: null })
export const statusStore = createStore<Record<string, boolean>>({})

export function useReadout(): ReadoutState {
  return useSyncExternalStore(readoutStore.subscribe, readoutStore.get, readoutStore.get)
}

export function useCurveStatus(): Record<string, boolean> {
  return useSyncExternalStore(statusStore.subscribe, statusStore.get, statusStore.get)
}
