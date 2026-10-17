import { CircleIcon, PauseIcon, PlayIcon, PlusIcon, RepeatIcon, RotateCcwIcon, SquareIcon, Undo2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SPEEDS } from '@/graph/animated'
import { cn } from '@/lib/utils'

interface AnimatedControlsProps {
  playing: boolean
  onPlayPause: () => void
  onRestart: () => void
  onAddClick: () => void
  /** Elapsed draw time in seconds. */
  elapsed: number
  /** Total draw duration in seconds at the current speed. */
  total: number
  onScrub: (time: number) => void
  speed: number
  onSpeedChange: (speed: number) => void
  loop: boolean
  onLoopChange: (loop: boolean) => void
  reverse: boolean
  onReverseChange: (reverse: boolean) => void
  /** Sweep slider constants together with the pen. */
  syncSliders: boolean
  onSyncChange: (sync: boolean) => void
  recording: boolean
  /** Start or stop recording a video; null when the browser cannot record. */
  onRecord: (() => void) | null
  /** When true, draw is complete and free navigation is allowed. */
  unlocked?: boolean
  className?: string
}

function Toggle({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant={pressed ? 'default' : 'outline'}
      size="icon-sm"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function AnimatedControls({
  playing,
  onPlayPause,
  onRestart,
  onAddClick,
  elapsed,
  total,
  onScrub,
  speed,
  onSpeedChange,
  loop,
  onLoopChange,
  reverse,
  onReverseChange,
  syncSliders,
  onSyncChange,
  recording,
  onRecord,
  unlocked = false,
  className,
}: AnimatedControlsProps) {
  return (
    <div className={cn('absolute inset-x-0 bottom-0 z-20 p-3', className)}>
      <div className="flex flex-col gap-2 rounded-xl border bg-background/85 p-2 shadow-lg shadow-black/30 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
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
          <input
            type="range"
            min={0}
            max={total}
            step={total / 1000}
            value={Math.min(elapsed, total)}
            aria-label="animation position"
            onChange={(event) => onScrub(Number(event.target.value))}
            className="h-6 min-w-24 flex-1 accent-primary"
          />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {elapsed.toFixed(1)}/{total.toFixed(1)}s
          </span>
          <select
            aria-label="speed"
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            className="h-7 rounded border bg-background px-1 font-mono text-xs"
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value} u/s
              </option>
            ))}
          </select>
          <Toggle label="loop" pressed={loop} onClick={() => onLoopChange(!loop)}>
            <RepeatIcon data-icon="inline-start" />
          </Toggle>
          <Toggle label="reverse" pressed={reverse} onClick={() => onReverseChange(!reverse)}>
            <Undo2Icon data-icon="inline-start" />
          </Toggle>
          <Button
            variant={syncSliders ? 'default' : 'outline'}
            size="sm"
            aria-pressed={syncSliders}
            title="sweep slider constants with the pen"
            onClick={() => onSyncChange(!syncSliders)}
          >
            sync sliders
          </Button>
          {onRecord && (
            <Button
              variant={recording ? 'destructive' : 'outline'}
              size="sm"
              aria-label={recording ? 'stop recording' : 'record video'}
              onClick={onRecord}
            >
              {recording ? <SquareIcon data-icon="inline-start" /> : <CircleIcon data-icon="inline-start" />}
              {recording ? 'stop' : 'record'}
            </Button>
          )}
          <Button variant="outline" size="icon-sm" aria-label="add animated equation" onClick={onAddClick}>
            <PlusIcon data-icon="inline-start" />
          </Button>
        </div>
        <div className="px-1 text-[11px] text-muted-foreground/70">
          {recording
            ? 'recording — stops when the drawing completes'
            : unlocked
              ? 'complete — pan/zoom free · follow-cam off'
              : 'follow-cam locked — grid tracks pen · wheel/drag locked'}
        </div>
      </div>
    </div>
  )
}
