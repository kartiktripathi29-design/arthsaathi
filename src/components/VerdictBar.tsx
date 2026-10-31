'use client'
// PROTOTYPE (Phase 1) — a sticky "best answer so far" bar. Drop it at the top of any onboarding
// step (provisional verdict, Allowances, Deductions) and pass the current QuickVerdict; it shows the
// recommended regime, the live saving (count-up on change) and an exactness meter with the next
// best action. Presentational only — the parent owns the verdict + recompute.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { tokens as T } from '@/lib/tokens'
import type { ExactnessItem, ExactnessKey, QuickVerdict } from '@/lib/quick-verdict'

const fmt = (v: number) => `₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`

// Where each missing item is filled in, for logged-in pages. A parent can override any of these.
const ITEM_HREFS: Partial<Record<ExactnessKey, string>> = {
  slip: '/dashboard/profile/documents',
  ais: '/dashboard/profile/documents',
  rent: '/dashboard/profile/exemptions',
  '80c': '/dashboard/profile/deductions',
  '80d': '/dashboard/profile/deductions',
  nps: '/dashboard/profile/deductions',
}

// Focus a field, centring it so the sticky bar can't cover it.
export const focusField = (id: string) => {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.focus({ preventScroll: true })
}

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

export interface VerdictBarProps {
  verdict: QuickVerdict | null
  // Missing items that act on this page (e.g. focus a field) instead of navigating.
  itemActions?: Partial<Record<ExactnessKey, () => void>>
  // Per-item link overrides; null renders that item as plain text.
  itemHrefs?: Partial<Record<ExactnessKey, string | null>>
}

export default function VerdictBar({ verdict, itemActions, itemHrefs }: VerdictBarProps) {
  const savings = useCountUp(verdict?.savings ?? 0)
  const [open, setOpen] = useState(false)
  if (!verdict?.hasSalary) return null
  const regime = verdict.recommendation === 'new' ? 'New regime' : 'Old regime'
  const pct = verdict.exactness.pct
  const todo: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: T.teal, whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }

  const hrefFor = (key: ExactnessKey) => itemHrefs?.[key] === undefined ? ITEM_HREFS[key] : itemHrefs[key]
  const renderItem = (item: ExactnessItem) => {
    if (item.done) return <span key={item.key} style={{ fontSize: 10, fontWeight: 600, color: T.green, whiteSpace: 'nowrap' }}>✓ {item.label}</span>
    const text = `○ ${item.label} (+${item.adds}%)`
    const action = itemActions?.[item.key]
    if (action) return <button key={item.key} type="button" onClick={() => { setOpen(false); action() }} style={todo}>{text}</button>
    const href = hrefFor(item.key)
    if (href) return <Link key={item.key} href={href} style={todo}>{text}</Link>
    return <span key={item.key} style={{ fontSize: 10, fontWeight: 600, color: T.muted, whiteSpace: 'nowrap' }}>{text}</span>
  }

  // The collapsed mobile view's one item: the biggest gain doable on this page, else via a link.
  const missing = verdict.exactness.items.filter(i => !i.done)
  const onPage = missing.filter(i => itemActions?.[i.key])
  const candidates = onPage.length ? onPage : missing.filter(i => hrefFor(i.key))
  const topItem = candidates.reduce<ExactnessItem | null>((best, i) => (!best || i.adds > best.adds ? i : best), null)

  return (
    <div className="vb-bar" style={{
      position: 'sticky', top: 12, zIndex: 30,
      background: T.card, border: `1px solid ${T.hairline}`, borderLeft: `3px solid ${T.teal}`,
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
      boxShadow: '0 4px 18px rgba(14,77,71,0.08)', fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      {/* Phones get a collapsed view (percentage, bar, one item) that taps open to the full checklist. */}
      <style>{`
        .vb-bar { gap: 16px; }
        .vb-compact { display: none; }
        .vb-full { display: flex; flex-wrap: wrap; gap: 3px 10px; margin-top: 6px; }
        @media (max-width: 480px) {
          .vb-bar { gap: 8px; }
          .vb-eyebrow { display: none; }
          .vb-compact { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 6px; }
          .vb-full:not(.vb-open) { display: none; }
        }
      `}</style>
      <div>
        <div className="vb-eyebrow" style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Best answer so far</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>
          {regime}
          {savings > 0 && <span style={{ color: T.green, fontWeight: 700, fontSize: 13, marginLeft: 8 }}>saves {fmt(savings)}</span>}
        </div>
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0, maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 600 }}>
          <span>Exactness</span><span>{pct}%</span>
        </div>
        <div style={{ height: 6, background: T.sand, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? T.green : T.teal, transition: 'width 450ms cubic-bezier(0.16,1,0.3,1)' }} />
        </div>
        <div className="vb-compact">
          {!open && topItem ? renderItem(topItem) : <span />}
          <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ fontSize: 10, fontWeight: 600, color: T.muted, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{open ? 'Hide' : 'See all'}</button>
        </div>
        <div className={open ? 'vb-full vb-open' : 'vb-full'}>
          {verdict.exactness.items.map(renderItem)}
        </div>
      </div>
    </div>
  )
}
