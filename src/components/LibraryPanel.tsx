import { useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { deleteSaved, listSaved, saveGraph, type SavedGraph } from '@/graph/library'
import type { ShareState } from '@/graph/share'
import { cn } from '@/lib/utils'

interface LibraryPanelProps {
  /** Current graph, or null when there is nothing to save. */
  getState: () => ShareState | null
  onLoad: (state: ShareState) => void
  onClose: () => void
  className?: string
}

/** Named graphs saved in this browser: save the current one, load or delete others. */
export function LibraryPanel({ getState, onLoad, onClose, className }: LibraryPanelProps) {
  const [items, setItems] = useState<SavedGraph[]>(listSaved)
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const save = () => {
    const state = getState()
    if (!state) {
      setMessage('nothing to save yet — add an equation first')
      return
    }
    if (!saveGraph(name, state)) {
      setMessage(name.trim() ? 'could not save — storage is full or blocked' : 'type a name first')
      return
    }
    setMessage(`saved "${name.trim()}"`)
    setName('')
    setItems(listSaved())
  }

  return (
    <div
      className={cn(
        'absolute bottom-32 right-3 z-20 flex w-72 flex-col gap-2 rounded-lg border bg-background/95 p-2.5 text-xs backdrop-blur-md max-sm:inset-x-2 max-sm:w-auto',
        className
      )}
    >
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>saved graphs</span>
        <Button variant="ghost" size="icon-xs" aria-label="close saved graphs" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <form
        className="flex gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <input
          aria-label="graph name"
          placeholder="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-7 min-w-0 flex-1 rounded border bg-background px-1.5 font-mono text-xs"
        />
        <Button type="submit" variant="outline" size="sm">
          save
        </Button>
      </form>
      {message && <span className="text-muted-foreground">{message}</span>}
      {items.length === 0 ? (
        <span className="text-muted-foreground">no saved graphs yet</span>
      ) : (
        <ScrollArea className="max-h-[35vh]">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.name} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/50">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col text-left"
                  onClick={() => onLoad(item.state)}
                  title="load this graph"
                >
                  <span className="truncate font-mono">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.state.eq.length} curve{item.state.eq.length === 1 ? '' : 's'} ·{' '}
                    {new Date(item.savedAt).toLocaleString()}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`delete ${item.name}`}
                  onClick={() => {
                    deleteSaved(item.name)
                    setItems(listSaved())
                  }}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
