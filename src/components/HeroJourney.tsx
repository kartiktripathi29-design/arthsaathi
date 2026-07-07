'use client'
// Landing hero-journey (brief Change 1) — v2: illustrated + cinematic, still pure CSS/SVG/JS.
//
// A 5-beat animated sequence: a person drowning in contradicting tax searches → "depends on your slip"
// → the slip arrives and the chaos clears → line items are read → the ACTUAL post-signup result
// component (<VerdictHero>), seeded from the visitor's own typed salary.
//
// Constraints honoured (see brief): no video / Lottie / external libs — inline SVG + CSS keyframes + a
// tiny rAF clock; non-blocking in-flow band above the untouched hero (decorative layers
// pointer-events:none); prefers-reduced-motion → static final frame; Skip; pauses when scrolled out of
// view; mobile-first; markup + a few KB of JS, no assets → far under the 150KB budget.
//
// Numbers policy (locked "no fabricated numbers"): regime + saving on the final frame are REAL, from
// the visitor's salary via the same estimateAnnualTax + debiased old-regime basis BgDemo uses; the
// refund is a clearly-labelled worked EXAMPLE (a no-data visitor has no TDS). The sample slip in beats
// 3–4 is an illustration tied to the same example salary.
//
// Engine (unchanged from v1): mounted-gate (no hydration mismatch), a "reel" that keeps the outgoing
// beat mounted ~0.45s so scenes cross-fade, an IntersectionObserver pause, Skip, progress dots.

import { useEffect, useRef, useState } from 'react'
import { tokens as T } from '@/lib/tokens'
import { estimateAnnualTax } from '@/lib/tax-slabs'
import VerdictHero from '@/components/VerdictHero'

const EXAMPLE_MONTHLY = 120000  // matches the hero input's "e.g. 1,20,000" placeholder

// Beat durations (ms). Total ≈ 10s of motion, then the final frame holds — inside the 8–12s budget.
const BEATS = [
  { key: 'chaos', ms: 3800 },    // 1–2: a person swamped by searches that contradict each other
  { key: 'slip', ms: 2200 },     // 3: the chaos clears, the slip arrives, relief
  { key: 'extract', ms: 2600 },  // 4: the slip is scanned, line items detected
  { key: 'resolve', ms: 1400 },  // 5-in: brief "working it out" flourish before the real result
] as const
const TOTAL = BEATS.length            // phase index of the (persistent) final frame
const THRESHOLDS = BEATS.reduce<number[]>((acc, b) => { acc.push((acc[acc.length - 1] || 0) + b.ms); return acc }, [])
const STAGE_H = 344                   // px — fixed so the page never reflows as scenes swap

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function HeroJourney({ monthly, onTry }: { monthly?: number | null; onTry?: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [phase, setPhase] = useState(0)
  const [leaving, setLeaving] = useState<number | null>(null)
  const prevPhaseRef = useRef(0)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pausedRef = useRef(false)
  const elapsedRef = useRef(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const r = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    setReduced(r)
    setMounted(true)
    if (r) { doneRef.current = true; setPhase(TOTAL) }
  }, [])

  useEffect(() => {
    if (phase === prevPhaseRef.current) return
    const from = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (reduced || from >= TOTAL) { setLeaving(null); return }
    setLeaving(from)
    const t = setTimeout(() => setLeaving(null), 460)
    return () => clearTimeout(t)
  }, [phase, reduced])

  useEffect(() => {
    const el = stageRef.current
    if (!el || !mounted || reduced) return
    const io = new IntersectionObserver(([e]) => { pausedRef.current = e.intersectionRatio < 0.4 }, { threshold: [0, 0.4, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [mounted, reduced])

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
        if (e >= THRESHOLDS[THRESHOLDS.length - 1]) { doneRef.current = true; setPhase(TOTAL) }
        else { const p = THRESHOLDS.findIndex(t => e < t); setPhase(prev => (prev === p ? prev : p)) }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [mounted, reduced])

  const skip = () => { doneRef.current = true; setPhase(TOTAL) }

  // Final-frame figures — real regime/saving from the visitor's salary (or the example), refund labelled.
  const m = monthly && monthly > 0 ? monthly : EXAMPLE_MONTHLY
  const annual = m * 12
  const ASSUMED_OLD_DEDUCTIONS = 225000   // same debiased basis as BgDemo (₹1.5L 80C + ₹50k NPS + ₹25k 80D)
  const newTax = estimateAnnualTax(annual, 'new')
  const oldTax = estimateAnnualTax(Math.max(0, annual - ASSUMED_OLD_DEDUCTIONS), 'old')
  const recommendation: 'new' | 'old' = newTax <= oldTax ? 'new' : 'old'
  const recTax = Math.min(newTax, oldTax)
  const exampleTds = Math.round(recTax * 1.18)
  const sampleBasic = Math.round(m * 0.4)
  const sampleHra = Math.round(m * 0.2)
  const sampleDeductions = 150000

  const final = phase === TOTAL

  return (
    <div ref={stageRef} aria-hidden={!final} style={{ position: 'relative' as const, maxWidth: 680, margin: '0 auto' }}>
      <style>{`
        .hj-scene { position: absolute; inset: 0; }
        /* Centre via symmetric insets, NOT translateX — the hj-fade-in keyframe ends at transform:none
           and would wipe a translateX, shifting the caption off-centre (and clipping it). */
        .hj-cap { position: absolute; left: 12px; right: 12px; bottom: 6px; text-align: center; font-size: 13px; font-weight: 600; color: var(--muted); line-height: 1.5; }
        .hj-cap strong { color: var(--ink); font-weight: 800; }
        .hj-tab { display: inline-block; background: var(--card); border: 1px solid var(--hairline); border-radius: 9px; padding: 6px 10px; font-size: 11.5px; color: var(--muted); box-shadow: 0 6px 20px rgba(14,77,71,0.08); white-space: nowrap; }
        .hj-clash { display: inline-block; background: var(--card); border-radius: 999px; padding: 7px 13px; font-size: 12.5px; font-weight: 700; box-shadow: 0 12px 30px rgba(14,77,71,0.16); white-space: nowrap; }
        .hj-q { color: var(--taupe); font-weight: 800; }
        .hj-dot { border-radius: 999px; transition: background .3s, width .3s; }
        @keyframes hjAmbient { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: .8; transform: scale(1.05) } }
        @keyframes hjDrift { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes hjBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes hjIn { from { opacity: 0; transform: translateY(12px) scale(.96) } to { opacity: 1; transform: none } }
        @keyframes hjOut { from { opacity: 1 } to { opacity: 0; transform: translateY(-12px) scale(.99) } }
        @keyframes hjDrop { 0% { opacity: 0; transform: translateY(-46px) rotate(-7deg) scale(.9) } 70% { opacity: 1; transform: translateY(4px) rotate(1deg) scale(1) } 100% { transform: translateY(0) rotate(0) scale(1) } }
        @keyframes hjPop { 0% { opacity: 0; transform: scale(.7) } 60% { transform: scale(1.08) } 100% { opacity: 1; transform: scale(1) } }
        @keyframes hjChip { from { opacity: 0; transform: translateX(-16px) } to { opacity: 1; transform: none } }
        @keyframes hjPulse { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.06); opacity: 1 } }
        @keyframes hjSweep { from { transform: translateX(-100%) } to { transform: translateX(200%) } }
        @keyframes hjScan { 0% { top: 4%; opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { top: 94%; opacity: 0 } }
        @keyframes hjSpin { to { transform: rotate(360deg) } }
        @keyframes hjReveal { 0% { opacity: 0; transform: translateY(14px) scale(.97) } 100% { opacity: 1; transform: none } }
        .hj-ambient { position: absolute; inset: 0; z-index: 0; pointer-events: none; background: radial-gradient(58% 54% at 50% 40%, var(--tint), transparent 72%); animation: hjAmbient 5s ease-in-out infinite; }
        .hj-fade-in { animation: hjIn .5s cubic-bezier(.16,1,.3,1) both; }
        .hj-scene-exit { animation: hjOut .45s ease-in both; }
        .hj-float { animation: hjDrift 3.8s ease-in-out infinite; }
        .hj-bob { animation: hjBob 4.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hj-ambient, .hj-float, .hj-bob, .hj-fade-in, .hj-scene-exit { animation: none !important; }
        }
      `}</style>

      {!mounted && <div style={{ height: STAGE_H }} />}

      {mounted && !final && (
        <button onClick={skip} style={{ position: 'absolute' as const, top: 0, right: 0, zIndex: 6, background: 'transparent', border: 'none', color: T.faint, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', pointerEvents: 'auto' }}>
          Skip intro →
        </button>
      )}

      {mounted && !final && (
        <>
          <div style={{ position: 'relative' as const, height: STAGE_H, pointerEvents: 'none' as const, overflow: 'hidden' }}>
            <div className="hj-ambient" />
            {leaving !== null && leaving !== phase && (
              <Scene i={leaving} exiting basic={sampleBasic} hra={sampleHra} deductions={sampleDeductions} />
            )}
            <Scene i={phase} basic={sampleBasic} hra={sampleHra} deductions={sampleDeductions} />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6 }}>
            {BEATS.map((_, i) => (
              <span key={i} className="hj-dot" style={{ height: 6, background: i === phase ? T.teal : T.hairline, width: i === phase ? 18 : 6 }} />
            ))}
          </div>
        </>
      )}

      {final && (
        <div style={{ position: 'relative' as const, paddingTop: 4 }}>
          <div style={{ position: 'absolute' as const, inset: '-6% 8% 20%', zIndex: 0, background: 'radial-gradient(50% 60% at 50% 40%, var(--tint), transparent 72%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' as const, zIndex: 1, animation: reduced ? undefined : 'hjReveal .55s cubic-bezier(.16,1,.3,1) both' }}>
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
        </div>
      )}
    </div>
  )
}

function Scene({ i, exiting, basic, hra, deductions }: { i: number; exiting?: boolean; basic: number; hra: number; deductions: number }) {
  return (
    <div className={`hj-scene ${exiting ? 'hj-scene-exit' : 'hj-fade-in'}`} style={{ zIndex: 1 }}>
      {i === 0 && <ChaosBeat />}
      {i === 1 && <SlipBeat basic={basic} hra={hra} />}
      {i === 2 && <ExtractBeat basic={basic} hra={hra} deductions={deductions} />}
      {i === 3 && <ResolveBeat />}
    </div>
  )
}

// A centred 380-wide canvas so beat layouts are predictable regardless of stage width.
function Canvas({ children }: { children: React.ReactNode }) {
  return <div style={{ position: 'absolute' as const, left: '50%', top: 0, transform: 'translateX(-50%)', width: 'min(380px, 100%)', height: '100%' }}>{children}</div>
}

// Beats 1–2 — a person swamped by contradicting searches, thoughts swirling around their head.
function ChaosBeat() {
  return (
    <Canvas>
      {/* faint rotating swirl behind the cloud, for depth */}
      <div aria-hidden style={{ position: 'absolute', left: '50%', top: 30, transform: 'translateX(-50%)', width: 190, height: 190, borderRadius: '50%', border: `1.5px dashed ${T.hairline}`, opacity: 0.5, animation: 'hjSpin 22s linear infinite' }} />

      {/* the person, lower-centre. Positioning transform on the OUTER node; the bob animation on the
          inner node, so hjBob's transform can't wipe the translateX centering. */}
      <div style={{ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)' }}>
        <div className="hj-bob"><Person mood="confused" /></div>
      </div>

      {/* floating searches — parallax by depth (scale + opacity) and stagger */}
      <Floaty left={2} top={26} rot={-5} depth={1} float delay={0}><span className="hj-tab">“what is HRA exemption?”</span></Floaty>
      <Floaty right={2} top={30} rot={4} depth={1} float delay={.15}><span className="hj-tab">“tax on 12 LPA?”</span></Floaty>
      <Floaty left={0} top={86} rot={5} depth={.9} float delay={.3}><span className="hj-tab">“80C limit 2025?”</span></Floaty>
      <Floaty right={0} top={90} rot={-4} depth={.88} float delay={.45}><span className="hj-tab">“switch regimes?”</span></Floaty>

      {/* the clash — two confident, opposite answers near the head */}
      <div style={{ position: 'absolute', left: '8%', top: 118, zIndex: 4 }}>
        <div style={{ animation: 'hjPop .5s cubic-bezier(.16,1,.3,1) both', animationDelay: '1.1s' }}>
          <span className="hj-clash" style={{ color: T.teal, border: `1.5px solid ${T.teal}` }}>Old regime saves more</span>
        </div>
      </div>
      <div style={{ position: 'absolute', right: '6%', top: 158, zIndex: 4 }}>
        <div style={{ animation: 'hjPop .5s cubic-bezier(.16,1,.3,1) both', animationDelay: '1.55s' }}>
          <span className="hj-clash" style={{ color: T.marigold, border: `1.5px solid ${T.marigold}` }}>No — new regime wins</span>
        </div>
      </div>

      <Floaty left={'44%'} top={44} rot={0} depth={1} float delay={.2}><span className="hj-q" style={{ fontSize: 22 }}>?</span></Floaty>
      <Floaty right={'30%'} top={104} rot={0} depth={.9} float delay={.7}><span className="hj-q" style={{ fontSize: 15 }}>?</span></Floaty>

      <div className="hj-cap hj-fade-in" style={{ animationDelay: '2s' }}>
        Google can&apos;t settle it — <strong>the answer depends on your slip</strong>.
      </div>
    </Canvas>
  )
}

// Beat 3 — the chaos clears; the slip drops in and the person relaxes.
function SlipBeat({ basic, hra }: { basic: number; hra: number }) {
  return (
    <Canvas>
      <div style={{ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', opacity: 0.5 }}>
        <div className="hj-bob"><Person mood="happy" /></div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: 34, transform: 'translateX(-50%)' }}>
        <div style={{ animation: 'hjDrop .7s cubic-bezier(.16,1,.3,1) both' }}>
          <SlipCard basic={basic} hra={hra} highlight={false} scanning={false} />
        </div>
      </div>
      <div className="hj-cap hj-fade-in" style={{ animationDelay: '.5s' }}>
        One salary slip holds every figure the answer needs.
      </div>
    </Canvas>
  )
}

// Beat 4 — the slip is scanned; line items are detected and extracted into chips.
function ExtractBeat({ basic, hra, deductions }: { basic: number; hra: number; deductions: number }) {
  const chips = [
    { l: 'Basic · per year', v: inr(basic * 12), d: .1 },
    { l: 'HRA · per year', v: inr(hra * 12), d: .3 },
    { l: '80C + deductions', v: inr(deductions), d: .5 },
  ]
  return (
    <Canvas>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' as const, padding: '0 8px 40px' }}>
        <div className="hj-fade-in"><SlipCard basic={basic} hra={hra} highlight scanning /></div>
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
    </Canvas>
  )
}

// Beat 5-in — a short "working it out" flourish before the real result frame.
function ResolveBeat() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div className="hj-fade-in" style={{ animation: 'hjPulse 1s ease-in-out infinite' }}>
        <BrandMark size={46} />
      </div>
      <div className="hj-fade-in" style={{ fontSize: 15, fontWeight: 800, color: T.teal }}>Working out your real tax…</div>
      <div className="hj-fade-in" style={{ width: 168, height: 5, borderRadius: 4, background: T.tint, overflow: 'hidden' }}>
        <div style={{ width: '40%', height: '100%', background: T.teal, animation: 'hjSweep 1s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

// A tilted, floating element with a depth (scale/opacity). Rotation/offset live on the static outer
// node; the keyframe animation on the inner node, so drift composes with the tilt.
function Floaty({ left, right, top, rot, depth = 1, delay, float, children }: {
  left?: number | string; right?: number | string; top?: number | string; rot?: number; depth?: number; delay?: number; float?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'absolute' as const, left, right, top, zIndex: 3, transform: `rotate(${rot ?? 0}deg) scale(${depth})`, opacity: 0.35 + depth * 0.65 }}>
      <div className={`hj-fade-in${float ? ' hj-float' : ''}`} style={{ animationDelay: float ? `${delay ?? 0}s, ${delay ?? 0}s` : `${delay ?? 0}s` }}>
        {children}
      </div>
    </div>
  )
}

// Illustrated bust — a friendly monochrome figure. `confused` raises a hand to the head; `happy` smiles.
function Person({ mood }: { mood: 'confused' | 'happy' }) {
  const { teal, ivory } = T
  return (
    <svg width="138" height="138" viewBox="0 0 160 160" fill="none" aria-hidden style={{ display: 'block' }}>
      <ellipse cx="80" cy="151" rx="46" ry="7" fill="rgba(14,77,71,0.10)" />
      <path d="M40 160 C40 120 60 110 80 110 C100 110 120 120 120 160 Z" fill={teal} />
      <rect x="72" y="94" width="16" height="22" rx="7" fill={teal} />
      <circle cx="80" cy="72" r="26" fill={teal} />
      <circle cx="70" cy="71" r="3" fill={ivory} />
      <circle cx="90" cy="71" r="3" fill={ivory} />
      {mood === 'confused' ? (
        <>
          <path d="M63 60 L73 64" stroke={ivory} strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
          <path d="M97 60 L87 64" stroke={ivory} strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
          <path d="M73 87 Q80 83 87 87" stroke={ivory} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          {/* hand raised to the temple */}
          <path d="M117 122 Q127 90 105 68" stroke={teal} strokeWidth="14" strokeLinecap="round" fill="none" />
          <circle cx="104" cy="64" r="9" fill={teal} />
        </>
      ) : (
        <>
          <path d="M64 63 Q69 60 74 63" stroke={ivory} strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
          <path d="M86 63 Q91 60 96 63" stroke={ivory} strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
          <path d="M71 82 Q80 92 89 82" stroke={ivory} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  )
}

function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <rect width="120" height="120" rx="26" fill={T.teal} />
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={T.ivory} />
      <circle cx="90" cy="24" r="18" fill={T.ivory} />
      <circle cx="90" cy="24" r="11" fill={T.teal} />
    </svg>
  )
}

// A compact salary-slip document. `highlight` lights the read rows; `scanning` sweeps a teal line.
function SlipCard({ basic, hra, highlight, scanning }: { basic: number; hra: number; highlight: boolean; scanning: boolean }) {
  const line = (label: string, value: string, lit: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 8px', borderRadius: 5, background: lit ? T.tint : 'transparent', transition: 'background .3s' }}>
      <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
      <span style={{ fontSize: 11, color: lit ? T.teal : T.ink, fontWeight: lit ? 800 : 600 }}>{value}</span>
    </div>
  )
  return (
    <div style={{ position: 'relative', width: 214, background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 12, boxShadow: '0 14px 46px rgba(14,77,71,0.15)', overflow: 'hidden' }}>
      {scanning && (
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, height: 2, background: T.teal, boxShadow: `0 0 10px 1px ${T.teal}`, opacity: 0.9, zIndex: 2, animation: 'hjScan 1.6s ease-in-out infinite' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderBottom: `1px solid ${T.hairline}` }}>
        <BrandMark size={16} />
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
