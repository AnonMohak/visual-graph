import { useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ANIMATED_EXAMPLES, usesTimeVariable } from '@/graph/animated'
import { parseEquation } from '@/graph/parse'
import { cn } from '@/lib/utils'

interface AddAnimatedModalProps {
  open: boolean
  onClose: () => void
  onAdd: (raws: string[]) => void
}

export function AddAnimatedModal({ open, onClose, onAdd }: AddAnimatedModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const preview = useMemo(() => (value.trim() ? parseEquation(value) : null), [value])

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
    if (open) {
      setValue('')
      setNotice(null)
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open ])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const showTimeHint = usesTimeVariable(value)

  const submitLines = (lines: string[]) => {
    const valid: string[] = []
    let firstError: string | null = null
    for (const line of lines) {
      const result = parseEquation(line)
      if (result.ok) valid.push(result.raw)
      else if (!firstError) firstError = result.message
    }
    if (valid.length) {
      onAdd(valid)
      setValue('')
      setNotice(null)
      onClose()
    } else if (firstError) {
      setNotice(firstError)
    }
  }

  const submit = () => {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) {
      setNotice('empty expression')
      return
    }
    submitLines(lines)
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
    submitLines(lines)
  }

  let statusRow: React.ReactNode
  if (notice) {
    statusRow = <span className="truncate text-destructive">{notice}</span>
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
    statusRow = <span className="truncate text-muted-foreground/70">type an equation, e.g. sin(x)</span>
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="add animated equation"
        className="flex w-full max-w-md flex-col gap-2 rounded-xl border bg-background p-3 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">add animated equation</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">draw-on</span>
        </div>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <span className="font-medium text-graph-accent">{'>'}</span>
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setNotice(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
            onPaste={handlePaste}
            placeholder="y = sin(x)"
            aria-label="animated equation"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="caret-graph-accent"
          />
        </InputGroup>
        <div className="flex min-h-6 min-w-0 items-center overflow-hidden text-xs">{statusRow}</div>
        {showTimeHint && (
          <div className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            just type f(x) — line draws left → right, no time variable
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {ANIMATED_EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => {
                setValue(example)
                setNotice(null)
                inputRef.current?.focus()
              }}
              className={cn(
                'rounded-md border px-2 py-1 font-mono text-xs text-muted-foreground',
                'transition-colors hover:bg-muted hover:text-foreground'
              )}
            >
              {example}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            cancel
          </Button>
          <Button variant="default" size="sm" onClick={submit}>
            add
          </Button>
        </div>
      </div>
    </div>
  )
}
