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
  // Old regime, debiased. estimateAnnualTax(...,'old') applies ONLY the ₹50k standard deduction,
  // which makes the old regime look strictly worse than it really is — its entire point is the
  // deductions. So alongside that bare figure we also show the old bill with the deductions almost
  // any salaried investor can claim: ₹1.5L (80C) + ₹50k (NPS 80CCD(1B)) + ₹25k (80D health) = ₹2.25L.
  // HRA is deliberately excluded (it varies by rent/city/basic), so a real floor is usually lower
  // still. estimateAnnualTax subtracts the ₹50k standard deduction itself, so passing (annual − 2.25L)
  // yields taxable = annual − 2.75L — no need to reach past the shared slab math.
  const ASSUMED_OLD_DEDUCTIONS = 225000
  const oldTaxWithDeductions = estimateAnnualTax(annual - ASSUMED_OLD_DEDUCTIONS, 'old')
  const oldMoves = oldTaxWithDeductions < oldTax

  // Count-up: animate both regime figures 0 → value over ~800ms ease-out whenever
  // `monthly` changes (and on first mount), rounding every frame. On the final frame
  // the figures flash marigold briefly before settling to their resting colors.
  const [displayNew, setDisplayNew] = useState(0)
  const [displayOld, setDisplayOld] = useState(0)
  const [displayOldFloor, setDisplayOldFloor] = useState(0)
  const [flash, setFlash] = useState(false)
  const rafRef = useRef<number | null>(null)
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // No real salary yet → the card shows a prompt, not figures, so there's nothing to animate.
    if (isExample) { setDisplayNew(0); setDisplayOld(0); setDisplayOldFloor(0); return }
    const DURATION = 800
    let startTs: number | null = null
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts
      const p = Math.min(1, (ts - startTs) / DURATION)
      const e = easeOut(p)
      setDisplayNew(Math.round(newTax * e))
      setDisplayOld(Math.round(oldTax * e))
      setDisplayOldFloor(Math.round(oldTaxWithDeductions * e))
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplayNew(newTax)
        setDisplayOld(oldTax)
        setDisplayOldFloor(oldTaxWithDeductions)
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
  }, [newTax, oldTax, oldTaxWithDeductions, isExample])

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
          {isExample ? 'Your real tax, in seconds' : `On your ₹${m.toLocaleString('en-IN')}/month`}
        </span>
      </div>

      <div style={s.content}>
        <div id="demo-reveal" style={{ marginBottom: 16 }}>
          {isExample ? (
            // No salary entered yet — prompt for one instead of showing example figures, so the
            // numbers on screen are only ever the user's own. (The input lives in the hero above.)
            <div style={{ border: `1.5px dashed ${T.taupeLine}`, borderRadius: 10, padding: '22px 16px', textAlign: 'center', background: T.paper }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Enter your monthly salary above ↑</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>to see your real tax — old vs new regime, side by side.</div>
            </div>
          ) : (
            <>
              <div className="demo-regime" style={{ marginBottom: 6 }}>
                <div style={{ background: T.tint, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.teal, letterSpacing: '0.04em', marginBottom: 6 }}>New regime</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: flash ? T.marigold : T.teal, transition: flash ? 'none' : 'color 450ms ease-out', letterSpacing: '-0.02em' }}>₹{Math.round(displayNew).toLocaleString('en-IN')}</div>
                </div>
                <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', marginBottom: 6 }}>Old regime</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: flash ? T.marigold : T.ink, transition: flash ? 'none' : 'color 450ms ease-out', letterSpacing: '-0.02em' }}>₹{Math.round(displayOld).toLocaleString('en-IN')}</div>
                  {oldMoves && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.teal, letterSpacing: '-0.01em' }}>↓ with typical deductions</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: T.teal, letterSpacing: '-0.02em' }}>~₹{Math.round(displayOldFloor).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 9.5, color: T.faint, marginTop: 2 }}>assumes ₹1.5L 80C + NPS + insurance</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12.5, textAlign: 'center', margin: '10px 0 0' }}>
                <span style={{ color: T.ink, fontWeight: 700 }}>Your real answer sits in this range.</span>
                <span style={{ color: T.muted }}> The four blanks below decide where.</span>
              </div>
            </>
          )}
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
          <Link href={monthly && monthly > 0 ? `/try?m=${monthly}` : '/try'} className="btn-green" style={{ display: 'inline-block', padding: '11px 22px', background: T.teal, color: T.ivory, borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            See which one&apos;s yours →
          </Link>
        </div>
      </div>
    </div>
  )
}
