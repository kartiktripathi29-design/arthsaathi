'use client'
// Landing hero-journey (brief Change 1). A pure-CSS/SVG/JS animated sequence that tells the story
// "googling your tax doesn't work → your slip has the answer → here's the real result", ending in the
// ACTUAL post-signup result component (<VerdictHero>), seeded from the visitor's own typed salary.
//
// Constraints honoured (see brief):
//  · No video / Lottie / external animation libs — inline SVG + CSS keyframes + a tiny rAF clock.
//  · Non-blocking: this is an in-flow band ABOVE the untouched hero; decorative layers are
//    pointer-events:none, so the salary widget + CTAs below are usable immediately, even mid-play.
//  · prefers-reduced-motion → skip straight to the static final frame, no beats.
//  · Subtle Skip affordance; pauses when scrolled out of view (IntersectionObserver).
//  · Mobile-first (~380px portrait) — the stage is fluid and the beats are laid out for portrait.
//  · Weight: markup + a few KB of JS, no assets → far under the 150KB budget.
//
// Numbers policy (locked "no fabricated numbers"): regime + saving on the final frame are REAL,
// computed from the visitor's salary via the same estimateAnnualTax + debiased old-regime basis the
// live demo (BgDemo) uses. The refund is a clearly-labelled worked EXAMPLE (a no-data visitor has no
// TDS on record). The sample slip in beats 3–4 is an illustration tied to the same example salary.
//
// Scene transitions: a small "reel" keeps the outgoing beat mounted for ~0.45s so scenes cross-fade
// (chaos "falls away" as the slip arrives) instead of hard-cutting. Absolutely-positioned animated
// elements put rotation/offset on a STATIC outer wrapper and the keyframe animation on the inner node,
// so float/pop transforms compose with the tilt instead of clobbering it.

import { useEffect, useRef, useState } from 'react'
import { tokens as T } from '@/lib/tokens'
import { estimateAnnualTax } from '@/lib/tax-slabs'
import VerdictHero from '@/components/VerdictHero'

const EXAMPLE_MONTHLY = 120000  // matches the hero input's "e.g. 1,20,000" placeholder

// Beat durations (ms). Total ≈ 9.4s of motion, then the final frame holds — inside the 8–12s budget.
const BEATS = [
  { key: 'chaos', ms: 3600 },    // 1–2: search tabs pile up and contradict each other
  { key: 'slip', ms: 2000 },     // 3: chaos falls away, the slip slides in
  { key: 'extract', ms: 2400 },  // 4: line items → detected numbers
  { key: 'resolve', ms: 1400 },  // 5-in: brief "working it out" flourish before the real result
] as const
const TOTAL = BEATS.length            // phase index of the (persistent) final frame
const THRESHOLDS = BEATS.reduce<number[]>((acc, b) => { acc.push((acc[acc.length - 1] || 0) + b.ms); return acc }, [])
const STAGE_H = 320                   // px — fixed so the page never reflows as scenes swap

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function HeroJourney({ monthly, onTry }: { monthly?: number | null; onTry?: () => void }) {
  // Mounted gate so SSR and the first client render agree (no hydration mismatch): both render an
  // empty stage; reduced-motion vs. beats is decided only AFTER mount, in the effect below.
  const [mounted, setMounted] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [phase, setPhase] = useState(0)
  const [leaving, setLeaving] = useState<number | null>(null)   // the outgoing beat, kept briefly to cross-fade
  const prevPhaseRef = useRef(0)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pausedRef = useRef(false)
  const elapsedRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const r = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    setReduced(r)
    setMounted(true)
    if (r) { doneRef.current = true; setPhase(TOTAL) }   // reduced-motion → straight to the static final frame
  }, [])

  // Cross-fade: when the phase advances, keep the previous scene mounted for the exit animation.
  useEffect(() => {
    if (phase === prevPhaseRef.current) return
    const from = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (reduced || from >= TOTAL) { setLeaving(null); return }
    setLeaving(from)
    const t = setTimeout(() => setLeaving(null), 460)
    return () => clearTimeout(t)
  }, [phase, reduced])

  // Pause the clock while the stage is scrolled out of view (brief: "pause on user scroll").
  useEffect(() => {
    const el = stageRef.current
    if (!el || !mounted || reduced) return
    const io = new IntersectionObserver(([e]) => { pausedRef.current = e.intersectionRatio < 0.4 }, { threshold: [0, 0.4, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [mounted, reduced])

  // Single rAF clock advances the phase at each threshold; cheap (only setState on a phase change).
  useEffect(() => {
    if (!mounted || reduced) return
    let raf = 0
    let last: number | null = null
    const loop = (ts: number) => {
      if (last === null) last = ts
      const dt = ts - last
      last = ts
      if (!pausedRef.current && !doneRef.current) {
        elapsedRef.current += dt
        const e = elapsedRef.current
        if (e >= THRESHOLDS[THRESHOLDS.length - 1]) {
          doneRef.current = true
          setPhase(TOTAL)
        } else {
          const p = THRESHOLDS.findIndex(t => e < t)
          setPhase(prev => (prev === p ? prev : p))
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [mounted, reduced])

  const skip = () => { doneRef.current = true; setPhase(TOTAL) }

  // ── Final-frame figures — REAL regime/saving from the visitor's salary (or the example), refund
  //    as a labelled illustration. ────────────────────────────────────────────────────────────────
  const m = monthly && monthly > 0 ? monthly : EXAMPLE_MONTHLY
  const annual = m * 12
  // Debias the old regime with the deductions almost any salaried investor claims — the SAME basis
  // BgDemo uses (₹1.5L 80C + ₹50k NPS + ₹25k 80D), so the two example results on this page agree and
  // the "Saves" figure isn't inflated by pricing the old regime with the standard deduction alone.
  const ASSUMED_OLD_DEDUCTIONS = 225000
  const newTax = estimateAnnualTax(annual, 'new')
  const oldTax = estimateAnnualTax(Math.max(0, annual - ASSUMED_OLD_DEDUCTIONS), 'old')
  const recommendation: 'new' | 'old' = newTax <= oldTax ? 'new' : 'old'
  const recTax = Math.min(newTax, oldTax)
  const exampleTds = Math.round(recTax * 1.18)   // illustrative employer over-withholding → a refund
  const sampleBasic = Math.round(m * 0.4)
  const sampleHra = Math.round(m * 0.2)
  const sampleDeductions = 150000

  const final = phase === TOTAL

  return (
    <div ref={stageRef} aria-hidden={!final} style={{ position: 'relative' as const, maxWidth: 680, margin: '0 auto' }}>
      <style>{`
        .hj-scene { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; }
        .hj-cap { font-size: 13px; font-weight: 600; color: var(--muted); text-align: center; margin-top: 16px; line-height: 1.5; max-width: 340px; }
        .hj-cap strong { color: var(--ink); font-weight: 800; }
        .hj-tab { background: var(--card); border: 1px solid var(--hairline); border-radius: 9px; padding: 7px 11px; font-size: 12px; color: var(--muted); box-shadow: 0 4px 16px rgba(14,77,71,0.06); white-space: nowrap; }
        .hj-clash { background: var(--card); border-radius: 10px; padding: 9px 13px; font-size: 12.5px; font-weight: 700; box-shadow: 0 10px 30px rgba(14,77,71,0.14); white-space: nowrap; }
        .hj-q { color: var(--taupe); font-weight: 800; }
        .hj-dot { width: 6px; height: 6px; border-radius: 50%; transition: background .3s, width .3s; }
        @keyframes hjDrift { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes hjIn { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes hjOut { from { opacity: 1 } to { opacity: 0; transform: translateY(-10px) scale(.99) } }
        @keyframes hjSlip { from { opacity: 0; transform: translateY(34px) scale(.9) } to { opacity: 1; transform: none } }
        @keyframes hjChip { from { opacity: 0; transform: translateX(-16px) } to { opacity: 1; transform: none } }
        @keyframes hjPop { 0% { opacity: 0; transform: scale(.7) } 60% { transform: scale(1.08) } 100% { opacity: 1; transform: scale(1) } }
        @keyframes hjPulse { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.06); opacity: 1 } }
        @keyframes hjSweep { from { transform: translateX(-100%) } to { transform: translateX(200%) } }
        .hj-fade-in { animation: hjIn .5s cubic-bezier(.16,1,.3,1) both; }
        .hj-scene-exit { animation: hjOut .45s ease-in both; }
        .hj-float { animation: hjDrift 3.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .hj-float, .hj-fade-in, .hj-scene-exit { animation: none !important; } }
      `}</style>

      {/* Pre-mount: an empty fixed-height stage. Identical on server + first client render, so there
          is no hydration mismatch and no layout shift when the beats mount in. */}
      {!mounted && <div style={{ height: STAGE_H }} />}

      {/* Skip — subtle, top-right; hidden once the final frame is up. */}
      {mounted && !final && (
        <button onClick={skip} style={{ position: 'absolute' as const, top: 0, right: 0, zIndex: 5, background: 'transparent', border: 'none', color: T.faint, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', pointerEvents: 'auto' }}>
          Skip intro →
        </button>
      )}

      {/* The beats live in a fixed-height, non-interactive stage so the page never reflows as scenes
          swap and nothing here can intercept taps meant for the widget below. */}
      {mounted && !final && (
        <>
          <div style={{ position: 'relative' as const, height: STAGE_H, pointerEvents: 'none' as const }}>
            {leaving !== null && leaving !== phase && (
              <Scene i={leaving} exiting basic={sampleBasic} hra={sampleHra} deductions={sampleDeductions} />
            )}
            <Scene i={phase} basic={sampleBasic} hra={sampleHra} deductions={sampleDeductions} />
          </div>
          {/* Progress dots — a quiet promise that this is a short intro that ends. */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 4 }}>
            {BEATS.map((_, i) => (
              <span key={i} className="hj-dot" style={{ background: i === phase ? T.teal : T.hairline, width: i === phase ? 16 : 6 }} />
            ))}
          </div>
        </>
      )}

      {/* Final frame — the REAL result component, seeded from the visitor's own salary. Hands off to
          the live quick-estimate widget below. */}
      {final && (
        <div className="hj-fade-in" style={{ paddingTop: 4 }}>
          <VerdictHero
            example
            recommendation={recommendation}
            savings={Math.abs(newTax - oldTax)}
            balance={recTax - exampleTds}
            total={recTax}
            tdsPaid={exampleTds}
            tdsSource="estimated"
            itrForm="ITR-1"
            itrReason="Salary within ₹50L — a standard salaried filer."
          />
          <div style={{ textAlign: 'center' as const, marginTop: 2 }}>
            <button onClick={onTry} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: T.teal, color: T.ivory, borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Try it with your salary →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// One beat's content. `exiting` plays the exit animation on the whole scene.
function Scene({ i, exiting, basic, hra, deductions }: { i: number; exiting?: boolean; basic: number; hra: number; deductions: number }) {
  return (
    <div className={`hj-scene ${exiting ? 'hj-scene-exit' : 'hj-fade-in'}`}>
      {i === 0 && <ChaosBeat />}
      {i === 1 && <SlipBeat basic={basic} hra={hra} highlight={false} caption="One salary slip holds every figure the answer needs." />}
      {i === 2 && <ExtractBeat basic={basic} hra={hra} deductions={deductions} />}
      {i === 3 && <ResolveBeat />}
    </div>
  )
}

// A tilted, floating element: rotation/offset on the static outer node; the keyframe animation on the
// inner node, so drift/pop compose with the tilt instead of overwriting it.
function Floaty({ left, right, top, rot, delay, float, children }: {
  left?: number | string; right?: number | string; top?: number | string; rot?: number; delay?: number; float?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'absolute' as const, left, right, top, transform: rot ? `rotate(${rot}deg)` : undefined }}>
      <div className={`hj-fade-in${float ? ' hj-float' : ''}`} style={{ animationDelay: float ? `${delay ?? 0}s, ${delay ?? 0}s` : `${delay ?? 0}s` }}>
        {children}
      </div>
    </div>
  )
}

// Beats 1–2 — a spread of contradicting searches that settle into two answers which disagree.
function ChaosBeat() {
  return (
    <>
      <div style={{ position: 'relative' as const, width: 'min(360px, 100%)', height: 210 }}>
        <Floaty left={0} top={0} rot={-5} float delay={0}><span className="hj-tab">“what is HRA exemption?”</span></Floaty>
        <Floaty right={0} top={8} rot={4} float delay={.15}><span className="hj-tab">“how much tax on 12 LPA?”</span></Floaty>
        <Floaty left={0} top={162} rot={4} float delay={.3}><span className="hj-tab">“80C limit 2025?”</span></Floaty>
        <Floaty right={0} top={158} rot={-4} float delay={.45}><span className="hj-tab">“can I switch regimes?”</span></Floaty>
        {/* The clash — two confident, opposite answers, front and centre. */}
        <div style={{ position: 'absolute' as const, left: '14%', top: 66, zIndex: 3 }}>
          <div style={{ animation: 'hjPop .5s cubic-bezier(.16,1,.3,1) both', animationDelay: '1.1s' }}>
            <span className="hj-clash" style={{ color: T.teal, border: `1.5px solid ${T.teal}` }}>Old regime saves more</span>
          </div>
        </div>
        <div style={{ position: 'absolute' as const, left: '30%', top: 108, zIndex: 3 }}>
          <div style={{ animation: 'hjPop .5s cubic-bezier(.16,1,.3,1) both', animationDelay: '1.6s' }}>
            <span className="hj-clash" style={{ color: T.marigold, border: `1.5px solid ${T.marigold}` }}>No — new regime wins</span>
          </div>
        </div>
        <Floaty left={'46%'} top={40} rot={0} float delay={.2}><span className="hj-q" style={{ fontSize: 22 }}>?</span></Floaty>
        <Floaty right={'34%'} top={132} rot={0} float delay={.7}><span className="hj-q" style={{ fontSize: 15 }}>?</span></Floaty>
      </div>
      <div className="hj-cap hj-fade-in" style={{ animationDelay: '2s' }}>
        Google can&apos;t settle it — <strong>the answer depends on your slip</strong>.
      </div>
    </>
  )
}

// Beat 3 — the slip arrives.
function SlipBeat({ basic, hra, highlight, caption }: { basic: number; hra: number; highlight: boolean; caption: string }) {
  return (
    <>
      <div style={{ animation: 'hjSlip .6s cubic-bezier(.16,1,.3,1) both' }}>
        <SlipCard basic={basic} hra={hra} highlight={highlight} />
      </div>
      <div className="hj-cap hj-fade-in" style={{ animationDelay: '.5s' }}>{caption}</div>
    </>
  )
}

// Beat 4 — the slip's line items are read and extracted into number chips (arrows show the flow).
function ExtractBeat({ basic, hra, deductions }: { basic: number; hra: number; deductions: number }) {
  const chips = [
    { l: 'Basic · per year', v: inr(basic * 12), d: 0 },
    { l: 'HRA · per year', v: inr(hra * 12), d: .18 },
    { l: '80C + deductions', v: inr(deductions), d: .36 },
  ]
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, justifyContent: 'center' }}>
        <div className="hj-fade-in"><SlipCard basic={basic} hra={hra} highlight /></div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {chips.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'hjChip .45s cubic-bezier(.16,1,.3,1) both', animationDelay: `${c.d}s` }}>
              <span style={{ color: T.slip.text, fontWeight: 800, fontSize: 13 }}>→</span>
              <div style={{ background: T.slip.fill, border: `1px solid ${T.slip.border}`, borderRadius: 8, padding: '6px 11px', minWidth: 148 }}>
                <div style={{ fontSize: 10, color: T.slip.text, fontWeight: 700 }}>{c.l}</div>
                <div style={{ fontSize: 15, color: T.ink, fontWeight: 800 }}>{c.v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hj-cap hj-fade-in" style={{ animationDelay: '.5s' }}>
        Basic, HRA, deductions — <strong>read automatically</strong>.
      </div>
    </>
  )
}

// Beat 5-in — a short "working it out" flourish that hands into the real result frame.
function ResolveBeat() {
  return (
    <div className="hj-fade-in" style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 14 }}>
      <div style={{ animation: 'hjPulse 1s ease-in-out infinite' }}>
        <svg width="42" height="42" viewBox="0 0 120 120" fill="none" aria-hidden>
          <rect width="120" height="120" rx="26" fill={T.teal} />
          <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={T.ivory} />
          <circle cx="90" cy="24" r="18" fill={T.ivory} />
          <circle cx="90" cy="24" r="11" fill={T.teal} />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: T.teal }}>Working out your real tax…</div>
      {/* A slim shimmer bar to signal computation. */}
      <div style={{ width: 160, height: 5, borderRadius: 4, background: T.tint, overflow: 'hidden' }}>
        <div style={{ width: '40%', height: '100%', background: T.teal, animation: 'hjSweep 1s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

// A compact salary-slip document. `highlight` lights up the line items being read (beat 4).
function SlipCard({ basic, hra, highlight }: { basic: number; hra: number; highlight: boolean }) {
  const line = (label: string, value: string, lit: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 8px', borderRadius: 5, background: lit ? T.tint : 'transparent', transition: 'background .3s' }}>
      <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
      <span style={{ fontSize: 11, color: lit ? T.teal : T.ink, fontWeight: lit ? 800 : 600 }}>{value}</span>
    </div>
  )
  return (
    <div style={{ width: 214, background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 12, boxShadow: '0 12px 44px rgba(14,77,71,0.13)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderBottom: `1px solid ${T.hairline}` }}>
        <svg width="16" height="16" viewBox="0 0 120 120" fill="none" aria-hidden>
          <rect width="120" height="120" rx="14" fill={T.teal} />
          <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={T.ivory} />
          <circle cx="90" cy="24" r="18" fill={T.ivory} />
          <circle cx="90" cy="24" r="11" fill={T.teal} />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.ink }}>Salary slip</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: T.faint, fontWeight: 600 }}>sample</span>
      </div>
      <div style={{ padding: '8px 6px' }}>
        {line('Basic', `₹${basic.toLocaleString('en-IN')}`, highlight)}
        {line('HRA', `₹${hra.toLocaleString('en-IN')}`, highlight)}
        {line('Special allow.', `₹${Math.round(basic * 0.6).toLocaleString('en-IN')}`, false)}
        {line('PF · PT · TDS', `−₹${Math.round(basic * 0.3).toLocaleString('en-IN')}`, highlight)}
      </div>
    </div>
  )
}
