import { useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { valueTable } from '@/graph/analysis'
import type { Equation } from '@/graph/types'
import { formatNumber } from '@/graph/viewport'
import { cn } from '@/lib/utils'

interface ValueTableProps {
  equations: Equation[]
  onClose: () => void
  className?: string
}

const fieldClass = 'h-6 w-full rounded border bg-background px-1 font-mono text-xs text-foreground'

/** Table of x and f(x) for one curve over a chosen range and step. */
export function ValueTable({ equations, onClose, className }: ValueTableProps) {
  const curves = equations.filter((equation) => equation.kind === 'real')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [start, setStart] = useState('-5')
  const [end, setEnd] = useState('5')
  const [step, setStep] = useState('1')
  const curve = curves.find((equation) => equation.id === pickedId) ?? curves[0]
  const rows = curve ? valueTable(curve.evaluate, Number(start), Number(end), Number(step)) : []

  return (
    <div
      className={cn(
        'absolute bottom-32 left-3 z-10 flex w-64 flex-col gap-1.5 rounded-lg border bg-background/90 p-2 text-xs backdrop-blur-md',
        className
      )}
    >
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>table of values</span>
        <Button variant="ghost" size="icon-xs" aria-label="close table" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      {curves.length === 0 ? (
        <span className="text-muted-foreground">add a y = f(x) curve first</span>
      ) : (
        <>
          <select
            aria-label="curve"
            value={curve?.id}
            onChange={(event) => setPickedId(event.target.value)}
            className={fieldClass}
          >
            {curves.map((equation) => (
              <option key={equation.id} value={equation.id}>
                {equation.raw}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
            <label>
              from
              <input aria-label="from" value={start} onChange={(e) => setStart(e.target.value)} className={fieldClass} />
            </label>
            <label>
              to
              <input aria-label="to" value={end} onChange={(e) => setEnd(e.target.value)} className={fieldClass} />
            </label>
            <label>
              step
              <input aria-label="step" value={step} onChange={(e) => setStep(e.target.value)} className={fieldClass} />
            </label>
          </div>
          <ScrollArea className="max-h-[30vh]">
            <table className="w-full font-mono tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal">x</th>
                  <th className="text-right font-normal">f(x)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([x, y]) => (
                  <tr key={x}>
                    <td>{formatNumber(x, 6)}</td>
                    <td className={cn('text-right', y === null && 'text-muted-foreground')}>
                      {y === null ? '—' : formatNumber(y, 6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </>
      )}
    </div>
  )
}
