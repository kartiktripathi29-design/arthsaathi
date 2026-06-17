'use client'
// PROTOTYPE (Phase 1) — a sticky "best answer so far" bar. Drop it at the top of any onboarding
// step (provisional verdict, Allowances, Deductions) and pass the current QuickVerdict; it shows the
// recommended regime, the live saving (count-up on change) and an exactness meter with the next
// best action. Presentational only — the parent owns the verdict + recompute.

import { useEffect, useRef, useState } from 'react'
import { tokens as T } from '@/lib/tokens'
import type { QuickVerdict } from '@/lib/quick-verdict'

const fmt = (v: number) => `₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`

// Count from the previous value to the new one over ~600ms whenever it changes.
function useCountUp(value: number, ms = 600) {
  const [d, setD] = useState(value)
  const from = useRef(value)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    const start = from.current
    let t0: number | null = null
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (ts: number) => {
      if (t0 === null) t0 = ts
      const p = Math.min(1, (ts - t0) / ms)
      setD(Math.round(start + (value - start) * ease(p)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else from.current = value
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value, ms])
  return d
}

export default function VerdictBar({ verdict }: { verdict: QuickVerdict | null }) {
  const savings = useCountUp(verdict?.savings ?? 0)
  if (!verdict?.hasSalary) return null
  const regime = verdict.recommendation === 'new' ? 'New regime' : 'Old regime'
  const pct = verdict.exactness.pct

  return (
    <div style={{
      position: 'sticky', top: 12, zIndex: 30,
      background: T.card, border: `1px solid ${T.hairline}`, borderLeft: `3px solid ${T.teal}`,
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      boxShadow: '0 4px 18px rgba(14,77,71,0.08)', fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Best answer so far</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>
          {regime}
          {savings > 0 && <span style={{ color: T.green, fontWeight: 700, fontSize: 13, marginLeft: 8 }}>saves {fmt(savings)}</span>}
        </div>
      </div>
      <div style={{ minWidth: 190, flex: '0 1 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
          <span>Exactness</span><span>{pct}%</span>
        </div>
        <div style={{ height: 6, background: T.sand, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? T.green : T.teal, transition: 'width 450ms cubic-bezier(0.16,1,0.3,1)' }} />
        </div>
        {verdict.exactness.nextStep
          ? <div style={{ fontSize: 10, color: T.teal, fontWeight: 600, marginTop: 4 }}>Next: {verdict.exactness.nextStep} →</div>
          : <div style={{ fontSize: 10, color: T.green, fontWeight: 600, marginTop: 4 }}>✓ Exact — every input is in</div>}
      </div>
    </div>
  )
}
