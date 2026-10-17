import { parseSharePayload, sharePayload, type ShareState } from './share'

/** A named graph saved in this browser. */
export interface SavedGraph {
  name: string
  savedAt: number
  state: ShareState
}

const STORAGE_KEY = 'graph.library.v1'
const MAX_SAVED = 100

export const FILE_FORMAT = 'graph'
export const FILE_VERSION = 1

export function listSaved(): SavedGraph[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    const out: SavedGraph[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const state = parseSharePayload(record.state)
      if (typeof record.name !== 'string' || !state) continue
      out.push({ name: record.name, savedAt: Number(record.savedAt) || 0, state })
    }
    return out
  } catch {
    return []
  }
}

function writeSaved(list: SavedGraph[]): boolean {
  try {
    const stored = list.slice(0, MAX_SAVED).map((item) => ({
      name: item.name,
      savedAt: item.savedAt,
      state: sharePayload(item.state),
    }))
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

/** Save under a name; an existing graph with the same name is replaced. */
export function saveGraph(name: string, state: ShareState, now = Date.now()): boolean {
  const clean = name.trim().slice(0, 60)
  if (!clean) return false
  const rest = listSaved().filter((item) => item.name !== clean)
  return writeSaved([{ name: clean, savedAt: now, state }, ...rest])
}

export function deleteSaved(name: string): void {
  writeSaved(listSaved().filter((item) => item.name !== name))
}

/** JSON file contents for one graph. */
export function graphToJson(state: ShareState, name?: string): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, name, ...sharePayload(state) }, null, 2)
}

/** Parse an imported file; accepts our format or a bare share payload. */
export function graphFromJson(text: string): ShareState | null {
  try {
    return parseSharePayload(JSON.parse(text))
  } catch {
    return null
  }
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
