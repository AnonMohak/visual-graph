import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ZETA_ZEROS } from '@/graph/zeta'
import { cn } from '@/lib/utils'

interface ZerosPanelProps {
  /** Center the view on the zero 1/2 + i t. */
  onPick: (t: number) => void
  onClose: () => void
  className?: string
}

/** List of the first nontrivial zeta zeros; click one to center on it. */
export function ZerosPanel({ onPick, onClose, className }: ZerosPanelProps) {
  return (
    <div
      className={cn(
        'absolute right-3 top-3 z-20 flex w-48 flex-col gap-1 rounded-lg border bg-background/95 p-2 text-xs text-muted-foreground backdrop-blur-md max-sm:inset-x-2 max-sm:top-auto max-sm:bottom-[132px] max-sm:w-auto',
        className
      )}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span>zeta zeros ½ + i t</span>
        <Button variant="ghost" size="icon-xs" aria-label="close zeros" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <ScrollArea className="max-h-[50vh]">
        <ol className="flex flex-col">
          {ZETA_ZEROS.map((t, k) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="flex w-full justify-between rounded px-1.5 py-0.5 font-mono tabular-nums hover:bg-muted hover:text-foreground"
              >
                <span>#{k + 1}</span>
                <span>t = {t}</span>
              </button>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </div>
  )
}
