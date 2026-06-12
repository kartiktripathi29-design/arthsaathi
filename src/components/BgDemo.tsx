'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { estimateAnnualTax } from '@/lib/tax-slabs'
import { tokens as T } from '@/lib/tokens'

export default function BgDemo({ monthly }: { monthly?: number | null }) {
  const m = monthly && monthly > 0 ? monthly : 120000
  const isExample = !(monthly && monthly > 0)
  const annual = m * 12
  const newTax = estimateAnnualTax(annual, 'new')
  const oldTax = estimateAnnualTax(annual, 'old')
  const gap = Math.abs(oldTax - newTax)

  // Count-up: animate both regime figures 0 → value over ~800ms ease-out whenever
  // `monthly` changes (and on first mount), rounding every frame. On the final frame
  // the figures flash marigold briefly before settling to their resting colors.
  const [displayNew, setDisplayNew] = useState(0)
  const [displayOld, setDisplayOld] = useState(0)
  const [flash, setFlash] = useState(false)
  const rafRef = useRef<number | null>(null)
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const DURATION = 800
    let startTs: number | null = null
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts
      const p = Math.min(1, (ts - startTs) / DURATION)
      const e = easeOut(p)
      setDisplayNew(Math.round(newTax * e))
      setDisplayOld(Math.round(oldTax * e))
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplayNew(newTax)
        setDisplayOld(oldTax)
        setFlash(true)
        flashRef.current = setTimeout(() => setFlash(false), 180)
      }
    }
    setFlash(false)
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (flashRef.current !== null) clearTimeout(flashRef.current)
    }
  }, [newTax, oldTax])

  const slots = [
    'House rent (HRA)',
    'Tax-saving investments',
    'Health insurance',
    'Pension savings (NPS)',
  ]

  const s: Record<string, React.CSSProperties> = {
    wrap: { width: '100%', background: T.card, borderRadius: 16, overflow: 'hidden', fontFamily: '"Sora",-apple-system,sans-serif', position: 'relative' },
    topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${T.hairline}` },
    content: { padding: 16 },
  }

  return (
    <div style={s.wrap}>
      <div className="demo-topbar" style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 120 120" fill="none">
            <rect width="120" height="120" rx="14" fill={T.teal}/>
            <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={T.ivory}/>
            <circle cx="90" cy="24" r="18" fill={T.ivory}/>
            <circle cx="90" cy="24" r="11" fill={T.teal}/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: 14, color: T.ink }}>Arth<span style={{ color: T.teal }}>Vo</span></span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: isExample ? T.muted : T.teal, whiteSpace: 'nowrap' as const }}>
          {isExample ? 'Example — ₹1,20,000/month' : `On your ₹${m.toLocaleString('en-IN')}/month`}
        </span>
      </div>

      <div style={s.content}>
        <div className="demo-regime" style={{ marginBottom: 6 }}>
          <div style={{ background: T.tint, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.teal, letterSpacing: '0.04em', marginBottom: 6 }}>New regime</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: flash ? T.marigold : T.teal, letterSpacing: '-0.02em' }}>₹{Math.round(displayNew).toLocaleString('en-IN')}</div>
          </div>
          <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', marginBottom: 6 }}>Old regime</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: flash ? T.marigold : T.ink, letterSpacing: '-0.02em' }}>₹{Math.round(displayOld).toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, textAlign: 'center', margin: '10px 0 16px' }}>
          <span style={{ color: T.ink, fontWeight: 700 }}>₹{gap.toLocaleString('en-IN')}</span>
          <span style={{ color: T.muted }}> — decided by a box you ticked once. Time to re-decide.</span>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>What your salary slip unlocks</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>Four blanks stand between you and your real answer.</div>

        <div className="demo-slots" style={{ marginBottom: 14 }}>
          {slots.map((label, i) => (
            <div key={i} style={{ border: `1px dashed ${T.taupeLine}`, borderRadius: 9, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
              <span style={{ fontSize: 12, color: T.marigold, fontWeight: 600, letterSpacing: '0.04em' }}>₹ —</span>
            </div>
          ))}
        </div>

        <div style={{ background: T.tint, borderRadius: 9, padding: '11px 14px', fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ color: T.teal, fontWeight: 600 }}>One slip and a few quick questions</span>
          <span style={{ color: T.muted }}> — that&apos;s all your answer needs.</span>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Link href="/signup" className="btn-green" style={{ display: 'inline-block', padding: '11px 22px', background: T.teal, color: T.ivory, borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            See which one&apos;s yours →
          </Link>
        </div>
      </div>
    </div>
  )
}
