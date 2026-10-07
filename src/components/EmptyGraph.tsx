import { SigmaIcon } from 'lucide-react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Kbd } from '@/components/ui/kbd'

export function EmptyGraph() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <Empty className="w-auto max-w-sm border border-border bg-card/90 px-8 py-6 shadow-xl backdrop-blur-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SigmaIcon />
          </EmptyMedia>
          <EmptyTitle>no equations yet</EmptyTitle>
          <EmptyDescription>
            xy: sin(x)/x, zeta(0.5+i*t) · σ-t: zeta(s), eta(s), gamma(s) · Re-Im: conj(zeta(s))
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap items-center justify-center gap-2">
          press
          <Kbd className="font-mono">/</Kbd>
          to focus the command bar
        </EmptyContent>
      </Empty>
    </div>
  )
}
