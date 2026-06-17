'use client'
// PROTOTYPE (Phase 1) — self-contained wrapper around VerdictBar. Drop it at the top of any
// onboarding step (Allowances, Deductions); it recomputes the quick-verdict from localStorage on a
// light poll + window focus, so the "best answer so far" stays live as the page's forms write data —
// without threading into each page's own save logic. Skips the state update when nothing changed.

import { useEffect, useRef, useState } from 'react'
import VerdictBar from './VerdictBar'
import { computeQuickVerdict, type QuickVerdict } from '@/lib/quick-verdict'

export default function VerdictBarLive() {
  const [v, setV] = useState<QuickVerdict | null>(null)
  const last = useRef('')

  useEffect(() => {
    const tick = () => {
      const next = computeQuickVerdict()
      const sig = `${next.hasSalary}|${next.recommendation}|${next.savings}|${next.exactness.pct}|${next.exactness.nextStep}`
      if (sig !== last.current) { last.current = sig; setV(next) }
    }
    tick()
    const id = setInterval(tick, 800)
    window.addEventListener('focus', tick)
    return () => { clearInterval(id); window.removeEventListener('focus', tick) }
  }, [])

  return <VerdictBar verdict={v} />
}
