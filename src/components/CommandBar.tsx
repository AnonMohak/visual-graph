import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { CheckIcon, ChevronDownIcon, Share2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { parseEquation, type ParseFailure } from '@/graph/parse'
import type { ComplexComponent, Plane } from '@/graph/types'
import { cn } from '@/lib/utils'

const SAMPLES: { label: string; plane: Plane }[] = [
  { label: 'sin(x)/x', plane: 'xy' },
  { label: 'x^3 - 3x', plane: 'xy' },
  { label: 'tan(x)', plane: 'xy' },
  { label: 'zeta(0.5+i*t)', plane: 'xy' },
  { label: 'eta(0.5+i*t)', plane: 'xy' },
  { label: 'gamma(0.5+i*t)', plane: 'xy' },
  { label: 'zeta(s)', plane: 'st' },
  { label: 'eta(s)', plane: 'st' },
  { label: 'gamma(s)', plane: 'st' },
  { label: '1/(s-1)', plane: 'st' },
  { label: 's^2+1', plane: 'reim' },
  { label: 'conj(zeta(s))', plane: 'reim' },
]

interface Notice {
  value: string
  tone: 'error' | 'info'
  text: string
}

interface CommandBarProps {
  onAdd: (raws: string[]) => void
  onShare?: () => string | null
  className?: string
  ref?: React.Ref<CommandBarApi>
  activePlane?: Plane
  sigma?: number
  component?: ComplexComponent
  onSigmaChange?: (sigma: number) => void
  onComponentChange?: (component: ComplexComponent) => void
  onPlaneSwitch?: (plane: Plane) => void
}

export interface CommandBarApi {
  focus: () => void
  clear: () => void
}

const COMPONENTS: ComplexComponent[] = ['re', 'im', 'abs', 'arg']

export function CommandBar({
  onAdd,
  onShare,
  className,
  ref,
  activePlane = 'xy',
  sigma = 0.5,
  component = 're',
  onSigmaChange,
  onComponentChange,
  onPlaneSwitch,
}: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const [value, setValue] = useState('')
  const [storedNotice, setStoredNotice] = useState<Notice | null>(null)
  const [copied, setCopied] = useState(false)
  const notice = storedNotice && storedNotice.value === value ? storedNotice : null

  const setNotice = (tone: Notice['tone'], text: string) => {
    setStoredNotice({ value, tone, text })
  }

  const preview = useMemo(() => (value.trim() ? parseEquation(value) : null), [value])
  const previewComplex = preview && preview.ok && preview.kind !== 'real'

  const placeholder =
    activePlane === 'st' ? 'zeta(s)' : activePlane === 'reim' ? 'zeta(0.5+i*t)' : 'y = sin(x)/x'

  const latexHtml = useMemo(() => {
    if (!preview || !preview.ok) return null
    try {
      return katex.renderToString(preview.latex, {
        throwOnError: false,
        displayMode: false,
        strict: false,
      })
    } catch {
      return null
    }
  }, [preview])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus()
        inputRef.current?.select()
      },
      clear: () => {
        setValue('')
        setStoredNotice(null)
        inputRef.current?.blur()
      },
    }),
    []
  )

  const addLines = (lines: string[]) => {
    const valid: string[] = []
    let firstError: ParseFailure | null = null
    for (const line of lines) {
      const result = parseEquation(line)
      if (result.ok) valid.push(result.raw)
      else if (!firstError) firstError = result
    }
    if (valid.length) onAdd(valid)
    if (firstError) {
      setNotice('error', firstError.message)
      if (firstError.position !== undefined) {
        const input = inputRef.current
        if (input) {
          input.focus()
          const position = Math.min(firstError.position, value.length)
          input.setSelectionRange(position, position)
        }
      }
    }
    return valid.length > 0
  }

  const submit = () => {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) {
      setNotice('error', 'empty expression')
      return
    }
    const added = addLines(lines)
    if (added && lines.length === 1) {
      setValue('')
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!/[\r\n]/.test(text)) return
    event.preventDefault()
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) return
    const valid: string[] = []
    let error: ParseFailure | null = null
    for (const line of lines) {
      const result = parseEquation(line)
      if (result.ok) valid.push(result.raw)
      else if (!error) error = result
    }
    if (valid.length) onAdd(valid)
    if (error) {
      setNotice('error', `${lines.length - valid.length} skipped — ${error.message}`)
    } else {
      setNotice('info', `added ${valid.length} equation${valid.length === 1 ? '' : 's'}`)
    }
  }

  const markCopied = () => {
    setCopied(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 1600)
  }

  const copyFallback = (text: string): boolean => {
    try {
      const helper = document.createElement('textarea')
      helper.value = text
      helper.setAttribute('readonly', '')
      helper.style.position = 'fixed'
      helper.style.top = '0'
      helper.style.opacity = '0'
      document.body.appendChild(helper)
      helper.focus()
      helper.select()
      helper.setSelectionRange(0, helper.value.length)
      const ok = document.execCommand('copy')
      document.body.removeChild(helper)
      return ok
    } catch {
      return false
    }
  }

  const handleShare = async () => {
    let url: string | null = null
    try {
      url = onShare?.() ?? null
    } catch {
      url = null
    }
    if (!url) {
      setNotice('error', 'nothing to share yet — add an equation first')
      return
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url)
        markCopied()
        return
      } catch {
        // Fall through to legacy copy path (insecure / headless contexts).
      }
    }
    if (copyFallback(url)) {
      markCopied()
    } else {
      setNotice('error', 'could not copy the share link')
    }
  }

  const handleSample = (sample: string) => {
    setValue(sample)
    inputRef.current?.focus()
  }

  const showComplexControls = Boolean(previewComplex)
  const suggestSwitch =
    preview && preview.ok && preview.suggestedPlane !== activePlane ? preview.suggestedPlane : null

  let statusRow: React.ReactNode
  if (notice) {
    statusRow = (
      <span className={cn('truncate', notice.tone === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
        {notice.text}
      </span>
    )
  } else if (suggestSwitch) {
    const label = suggestSwitch === 'st' ? 'σ-t' : suggestSwitch === 'reim' ? 'Re-Im' : 'xy'
    statusRow = (
      <span className="flex min-w-0 items-center gap-2 truncate text-muted-foreground">
        <span className="truncate">looks complex — switch to {label}?</span>
        <button
          type="button"
          onClick={() => onPlaneSwitch?.(suggestSwitch)}
          className="shrink-0 rounded border border-primary/40 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10"
        >
          Switch
        </button>
      </span>
    )
  } else if (preview && !preview.ok) {
    statusRow = <span className="truncate text-destructive">{preview.message}</span>
  } else if (latexHtml) {
    statusRow = (
      <span
        className="katex-preview truncate [&_.katex]:text-foreground"
        dangerouslySetInnerHTML={{ __html: latexHtml }}
      />
    )
  } else {
    statusRow = <span className="truncate text-muted-foreground/70">type an equation, e.g. sin(x)/x</span>
  }

  return (
    <div className={cn('absolute inset-x-0 bottom-0 z-20 p-3', className)}>
      <div className="flex flex-col gap-2 rounded-xl border bg-background/85 p-2 shadow-lg shadow-black/30 backdrop-blur-md">
        {showComplexControls && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5">
              σ=
              <input
                type="range"
                min={-1}
                max={2}
                step={0.01}
                value={Math.min(2, Math.max(-1, sigma))}
                onChange={(event) => {
                  const v = Number(event.target.value)
                  if (Number.isFinite(v)) onSigmaChange?.(Math.min(2, Math.max(-1, v)))
                }}
                aria-label="sigma range"
                className="h-6 w-32 accent-primary"
              />
              <input
                type="number"
                min={-1}
                max={2}
                step={0.01}
                value={sigma}
                onChange={(event) => {
                  const v = Number(event.target.value)
                  if (Number.isFinite(v)) onSigmaChange?.(Math.min(2, Math.max(-1, v)))
                }}
                aria-label="sigma"
                className="h-6 w-20 rounded border bg-background px-1 font-mono text-xs text-foreground"
              />
            </label>
            <div className="flex items-center gap-0.5" role="tablist" aria-label="component">
              {COMPONENTS.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={component === c}
                  onClick={() => onComponentChange?.(c)}
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-[11px]',
                    component === c ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  {c === 'abs' ? '|.|' : c}
                </button>
              ))}
              <button
                role="tab"
                aria-selected={false}
                title="parametric uses full complex output"
                className="rounded px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted"
                onClick={() => onPlaneSwitch?.('reim')}
              >
                param
              </button>
            </div>
          </div>
        )}
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <span className="font-medium text-graph-accent">{'>'}</span>
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                setValue('')
                setStoredNotice(null)
                inputRef.current?.blur()
              }
            }}
            onPaste={handlePaste}
            placeholder={placeholder}
            aria-label="equation"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="caret-graph-accent"
          />
        </InputGroup>
        <div className="flex items-center gap-2">
          <div className="flex min-h-6 min-w-0 flex-1 items-center overflow-hidden text-xs">{statusRow}</div>
          <div className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground md:flex">
            <Kbd className="font-mono">/</Kbd>
            focus
            <Kbd className="font-mono">⏎</Kbd>
            add
            <Kbd className="font-mono">0</Kbd>
            reset
            <Kbd className="font-mono">f</Kbd>
            fit
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              samples
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>samples</DropdownMenuLabel>
                {SAMPLES.map((sample) => (
                  <DropdownMenuItem
                    key={`${sample.plane}:${sample.label}`}
                    onClick={() => handleSample(sample.label)}
                  >
                    <span className="font-mono">{sample.label}</span>
                    <span className="ml-auto pl-2 text-[10px] text-muted-foreground">{sample.plane}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2Icon data-icon="inline-start" />
            share
          </Button>
          {copied && (
            <Badge variant="secondary" className="text-graph-accent">
              <CheckIcon data-icon="inline-start" />
              copied
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
