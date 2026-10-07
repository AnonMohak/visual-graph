import { PauseIcon, PlayIcon, PlusIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DRAW_X_MAX, DRAW_X_MIN } from '@/graph/animated'
import { cn } from '@/lib/utils'

interface AnimatedControlsProps {
  playing: boolean
  onPlayPause: () => void
  onRestart: () => void
  onAddClick: () => void
  /** Live debug speed in world units/sec. */
  speed?: number
  /** Elapsed draw time in seconds. */
  elapsed?: number
  /** Total draw duration in seconds at current speed. */
  total?: number
  /** When true, draw is complete and free navigation is allowed. */
  unlocked?: boolean
  className?: string
}

export function AnimatedControls({
  playing,
  onPlayPause,
  onRestart,
  onAddClick,
  speed,
  elapsed,
  total,
  unlocked = false,
  className,
}: AnimatedControlsProps) {
  const showLive = speed !== undefined && elapsed !== undefined && total !== undefined
  return (
    <div className={cn('absolute inset-x-0 bottom-0 z-20 p-3', className)}>
      <div className="flex flex-col gap-2 rounded-xl border bg-background/85 p-2 shadow-lg shadow-black/30 backdrop-blur-md">
        <div className="flex items-center justify-start gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={playing ? 'pause animation' : 'play animation'}
            onClick={onPlayPause}
          >
            {playing ? <PauseIcon data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="restart animation" onClick={onRestart}>
            <RotateCcwIcon data-icon="inline-start" />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="add animated equation" onClick={onAddClick}>
            <PlusIcon data-icon="inline-start" />
          </Button>
        </div>
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground/70">
          <span>
            {unlocked
              ? 'complete — pan/zoom free · follow-cam off'
              : 'follow-cam locked — grid tracks pen · wheel/drag locked'}
          </span>
          <span className="font-mono tabular-nums">
            {showLive
              ? `${(speed as number).toFixed(2)} u/s · ${(elapsed as number).toFixed(1)}/${(total as number).toFixed(1)}s`
              : `draws ${DRAW_X_MIN}→${DRAW_X_MAX}, holds`}
          </span>
        </div>
      </div>
    </div>
  )
}
