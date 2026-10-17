import { useEffect } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useT } from '@/i18n'

interface HelpOverlayProps {
  onClose: () => void
}

const SHORTCUTS: [string, string][] = [
  ['/', 'focus the equation input'],
  ['Enter', 'add the equation'],
  ['Esc', 'clear the input / unfocus / close this help'],
  ['← →', 'step the snap x by one grid step'],
  ['0', 'reset the view (or double-click the canvas)'],
  ['f', 'fit curves vertically'],
  ['Ctrl+Z', 'undo'],
  ['Ctrl+Shift+Z / Ctrl+Y', 'redo'],
  ['?', 'show or hide this help'],
]

const MOUSE: [string, string][] = [
  ['drag', 'pan'],
  ['wheel / pinch', 'zoom at the cursor'],
  ['Shift / Alt + wheel', 'zoom y / x only (equal aspect off)'],
  ['double-click a legend row', 'edit the equation'],
  ['drag a legend row', 'reorder, or move into a folder'],
  ['click a marked point', 'snap the readout to it'],
]

const SYNTAX: [string, string][] = [
  ['x^2 + 2x', 'curve y = f(x); implicit multiplication is fine'],
  ['a = 2, f(x) = a x^2', 'constants (with sliders) and functions'],
  ['(cos(t), sin(t))', 'parametric curve'],
  ['r = 1 + cos(θ)', 'polar curve'],
  ['x^2 + y^2 = 1, y < sin(x)', 'implicit curve, shaded inequality'],
  ["d/dx(x^3), f'(x)", 'derivatives'],
  ['integral(x^2, 0, 3)', 'integral; constant bounds shade the area'],
  ['x < 0 ? -x : x^2', 'piecewise'],
]

function Table({ title, rows, keys }: { title: string; rows: [string, string][]; keys?: boolean }) {
  const t = useT()
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(title)}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {rows.map(([key, text]) => (
          <div key={key} className="contents">
            <dt className="font-mono">{keys ? <Kbd className="font-mono">{key}</Kbd> : key}</dt>
            <dd className="text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Modal list of keyboard shortcuts, mouse gestures and input syntax. */
export function HelpOverlay({ onClose }: HelpOverlayProps) {
  const t = useT()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="help"
        className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-xl border bg-background p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t('help')}</h2>
          <Button variant="ghost" size="icon-sm" aria-label="close help" onClick={onClose} autoFocus>
            <XIcon />
          </Button>
        </div>
        <Table title="keyboard" rows={SHORTCUTS} keys />
        <Table title="mouse and touch" rows={MOUSE} />
        <Table title="syntax" rows={SYNTAX} />
      </div>
    </div>
  )
}
