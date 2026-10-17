import { useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fitToRaw, parseCsv, pointsToRaw, polyFit } from '@/graph/regression'
import type { Equation } from '@/graph/types'
import { formatNumber } from '@/graph/viewport'
import { cn } from '@/lib/utils'

interface DataPanelProps {
  equations: Equation[]
  onAdd: (raws: string[]) => void
  onClose: () => void
  className?: string
}

const DEGREES = [
  { value: 1, label: 'linear' },
  { value: 2, label: 'quadratic' },
  { value: 3, label: 'cubic' },
  { value: 4, label: 'degree 4' },
  { value: 5, label: 'degree 5' },
  { value: 6, label: 'degree 6' },
]

const fieldClass = 'h-7 w-full rounded border bg-background px-1 font-mono text-xs text-foreground'

/** Paste CSV to add a scatter plot, then fit a regression curve to it. */
export function DataPanel({ equations, onAdd, onClose, className }: DataPanelProps) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const pointSets = equations.filter((equation) => equation.points?.length)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [degree, setDegree] = useState(1)
  const picked = pointSets.find((equation) => equation.id === pickedId) ?? pointSets[pointSets.length - 1]

  const addPoints = () => {
    const points = parseCsv(text)
    if (!points.length) {
      setMessage('no x,y pairs found — one pair per line, e.g. 1, 2.5')
      return
    }
    onAdd([pointsToRaw(points)])
    setMessage(`added ${points.length} point${points.length === 1 ? '' : 's'}`)
    setText('')
  }

  const addFit = () => {
    if (!picked?.points) return
    const fit = polyFit(picked.points, degree)
    if (!fit) {
      setMessage(`need at least ${degree + 1} distinct points for this fit`)
      return
    }
    onAdd([fitToRaw(fit)])
    setMessage(`added fit, R² = ${formatNumber(fit.r2, 5)}`)
  }

  return (
    <div
      className={cn(
        'absolute bottom-32 left-1/2 z-20 flex w-72 -translate-x-1/2 flex-col gap-2 rounded-lg border bg-background/95 p-2.5 text-xs text-muted-foreground backdrop-blur-md max-sm:inset-x-2 max-sm:w-auto max-sm:translate-x-0',
        className
      )}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span>data</span>
        <Button variant="ghost" size="icon-xs" aria-label="close data" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <textarea
        aria-label="CSV data"
        placeholder={'paste x,y pairs (CSV or TSV)\n1, 2.1\n2, 3.9\n3, 6.2'}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        className="resize-y rounded border bg-background p-1.5 font-mono text-xs text-foreground"
      />
      <Button variant="outline" size="sm" onClick={addPoints}>
        add points
      </Button>
      {pointSets.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-2">
          <span className="text-[11px]">regression</span>
          <select
            aria-label="point set"
            value={picked?.id}
            onChange={(event) => setPickedId(event.target.value)}
            className={fieldClass}
          >
            {pointSets.map((equation) => (
              <option key={equation.id} value={equation.id}>
                {equation.points?.length} points: {equation.raw.slice(0, 30)}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <select
              aria-label="fit type"
              value={degree}
              onChange={(event) => setDegree(Number(event.target.value))}
              className={fieldClass}
            >
              {DEGREES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={addFit}>
              add fit
            </Button>
          </div>
        </div>
      )}
      {message && <span>{message}</span>}
    </div>
  )
}
