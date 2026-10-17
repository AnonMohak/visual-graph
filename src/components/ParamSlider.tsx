import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon, RepeatIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatSliderValue, sliderRange } from '@/graph/sliders'
import { cn } from '@/lib/utils'

interface ParamSliderProps {
  name: string
  value: number
  onChange: (value: number) => void
  /** Fixed range; default fits the value in [-10, 10]. */
  range?: { min: number; max: number; step: number }
  className?: string
}

/** Range input for a constant, with play (sweep) and loop (bounce) controls. */
export function ParamSlider({ name, value, onChange, range: fixedRange, className }: ParamSliderProps) {
  const [autoRange] = useState(() => sliderRange(value))
  const range = fixedRange ?? autoRange
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const valueRef = useRef(value)
  const dirRef = useRef(1)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    // One full sweep of the range takes 4 seconds.
    const speed = (range.max - range.min) / 4
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      let next = valueRef.current + dirRef.current * speed * dt
      if (next >= range.max || next <= range.min) {
        next = Math.min(range.max, Math.max(range.min, next))
        if (loop) dirRef.current *= -1
        else {
          onChangeRef.current(next)
          setPlaying(false)
          return
        }
      }
      onChangeRef.current(Number(next.toPrecision(6)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, loop, range])

  return (
    <div className={cn('flex items-center gap-1.5 pl-[1.1rem] pt-0.5', className)}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={playing ? `pause ${name}` : `play ${name}`}
        onClick={() => {
          if (!playing && !loop && valueRef.current >= range.max) onChange(range.min)
          dirRef.current = valueRef.current >= range.max ? -1 : dirRef.current
          setPlaying((prev) => !prev)
        }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        aria-label={`${name} value`}
        onChange={(event) => onChange(Number(formatSliderValue(Number(event.target.value))))}
        className="h-5 min-w-0 flex-1 accent-primary"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="loop"
        aria-pressed={loop}
        onClick={() => setLoop((prev) => !prev)}
        className={cn(!loop && 'opacity-40')}
      >
        <RepeatIcon />
      </Button>
    </div>
  )
}
