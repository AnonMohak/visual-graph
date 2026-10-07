import { EyeIcon, EyeOffIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurveStatus } from '@/graph/store'
import type { ComplexComponent, Equation } from '@/graph/types'
import { CHART_CLASSES } from '@/lib/chart'
import { cn } from '@/lib/utils'

interface LegendProps {
  equations: Equation[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  className?: string
  /** Live global sampler props — badges reflect these, not stale per-equation defaults. */
  sigma?: number
  component?: ComplexComponent
}

export function Legend({ equations, onToggle, onDelete, className, sigma = 0.5, component = 're' }: LegendProps) {
  const status = useCurveStatus()
  if (equations.length === 0) return null

  return (
    <div
      className={cn(
        'absolute right-3 top-3 z-10 flex w-64 flex-col rounded-lg border bg-background/80 backdrop-blur-md',
        className
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <span>curves</span>
        <span className="font-mono tabular-nums">{equations.length}</span>
      </div>
      <Separator />
      <ScrollArea className="max-h-[45vh]">
        <ul className="flex flex-col gap-0.5 p-1">
          {equations.map((equation) => {
            const hasPoints = status[equation.id]
            return (
              <li
                key={equation.id}
                className={cn(
                  'flex flex-col rounded-md px-1.5 py-1 transition-colors hover:bg-muted/50',
                  !equation.visible && 'opacity-50'
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      CHART_CLASSES[equation.colorToken % 5]
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={equation.raw}>
                    {equation.raw}
                  </span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={equation.visible ? 'hide curve' : 'show curve'}
                          onClick={() => onToggle(equation.id)}
                        />
                      }
                    >
                      {equation.visible ? (
                        <EyeIcon data-icon="inline-start" />
                      ) : (
                        <EyeOffIcon data-icon="inline-start" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>{equation.visible ? 'hide' : 'show'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="delete curve"
                          onClick={() => onDelete(equation.id)}
                        />
                      }
                    >
                      <XIcon data-icon="inline-start" />
                    </TooltipTrigger>
                    <TooltipContent>delete</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-1 pl-[1.1rem] pt-0.5">
                  {equation.kind !== 'real' && (
                    <>
                      <span className="rounded border border-primary/30 px-1 font-mono text-[10px] text-primary">
                        {equation.kind === 'complex-param' ? 'param' : component}
                      </span>
                      <span className="rounded border px-1 font-mono text-[10px] text-muted-foreground">
                        σ={sigma}
                      </span>
                    </>
                  )}
                </div>
                {hasPoints === false && equation.visible && (
                  <span className="pl-[1.1rem] text-[11px] text-muted-foreground">
                    no real points in view
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
