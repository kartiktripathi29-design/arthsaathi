'use client'
// PROTOTYPE (Phase 3) — the guided "tax breaks" wizard that collapses the separate Allowances and
// Deductions tabs into ONE linear, one-question-per-screen flow with the live verdict bar on top and
// a progress rail. It covers the levers that matter for most salaried filers (HRA, 80C, home-loan
// interest, 80D + senior status, NPS); the long tail (LTA, 80G, education loan, etc.) stays in the
// detailed tabs behind an "advanced items" link. Every step writes the SAME av_* keys the optimizer
// reads, so the answer moves live and carries straight into "Your Tax".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { computeQuickVerdict, type QuickVerdict } from '@/lib/quick-verdict'
import { applyRentToExemptions, markNoRentExemptions } from '@/lib/quick-inputs'
import VerdictBar from '@/components/VerdictBar'
import { tokens as T } from '@/lib/tokens'

const fmt = (v: number) => `₹${Math.abs(Math.round(v || 0)).toLocaleString('en-IN')}`
const num = (s: string) => Math.max(0, parseFloat((s || '').replace(/,/g, '')) || 0)
const readJSON = (k: string): any => { try { return JSON.parse(localStorage.getItem(k) || '{}') } catch { return {} } }
const writeJSON = (k: string, o: any) => { try { localStorage.setItem(k, JSON.stringify(o)) } catch {} }
const patchDed = (patch: any) => writeJSON('av_deductions', { ...readJSON('av_deductions'), ...patch })

const STEPS = ['Rent (HRA)', 'Investments (80C)', 'Home loan', 'Health insurance', 'Pension (NPS)'] as const

export default function TaxBreaksWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [v, setV] = useState<QuickVerdict | null>(null)

  const [rent, setRent] = useState('')
  const [noRent, setNoRent] = useState(false)
  const [c80, setC80] = useState('')
  const [hl, setHl] = useState('')
  const [d80, setD80] = useState('')
  const [nps, setNps] = useState('')
  const [selfSenior, setSelfSenior] = useState(false)
  const [parentsSenior, setParentsSenior] = useState(false)
  const pfAnnual = useRef(0)

  const recompute = useCallback(() => setV(computeQuickVerdict()), [])

  useEffect(() => {
    // Credit employee PF off the slip toward 80C, so the user only adds what's beyond it. Skip the
    // synthetic seed slip (/try) — it carries no real PF and must not fabricate an 80C credit.
    let slipPF = 0
    try { const sl = JSON.parse(localStorage.getItem('av_salary_timeline') || '[]'); const real = Array.isArray(sl) ? sl.filter((s: any) => !s?._synthetic) : []; const s = real[real.length - 1] || null; slipPF = Math.round((s?.employeePF || 0) * 12) } catch {}
    const ded = readJSON('av_deductions'); const exm = readJSON('av_exemptions')
    if (slipPF > 0 && !ded.employeePF) { patchDed({ employeePF: slipPF }) }
    pfAnnual.current = slipPF || Number(ded.employeePF) || 0
    if (exm.hra?.rentPaid) setRent(String(exm.hra.rentPaid)); if (exm.hra?.noRent) setNoRent(true)
    if (ded.ppf) setC80(String(ded.ppf)); if (ded.homeLoanInterest) setHl(String(ded.homeLoanInterest))
    if (ded.selfFamily) setD80(String(ded.selfFamily)); if (ded.nps) setNps(String(ded.nps))
    if (ded.selfSenior) setSelfSenior(true); if (ded.parentsSenior) setParentsSenior(true)
    recompute()
  }, [recompute])

  const onRent = (val: string) => {
    setRent(val); setNoRent(false)
    // Shared, canonical HRA writer — real per-month cap, saved isMetro, merged object (no fabrication).
    applyRentToExemptions(num(val))
    recompute()
  }
  const markNoRent = () => {
    setNoRent(true); setRent('')
    markNoRentExemptions()
    recompute()
  }
  const onDed = (field: string, val: string, set: (s: string) => void) => { set(val); patchDed({ [field]: num(val) }); recompute() }
  const onSenior = (who: 'self' | 'parents', val: boolean) => {
    if (who === 'self') { setSelfSenior(val); patchDed({ selfSenior: val, selfSeniorStatus: val ? 'senior' : 'normal' }) }
    else { setParentsSenior(val); patchDed({ parentsSenior: val }) }
    recompute()
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100)
  const fieldWrap: React.CSSProperties = { display: 'flex', border: `1.5px solid ${T.hairline}`, borderRadius: 10, overflow: 'hidden', background: T.card, maxWidth: 280 }
  const input: React.CSSProperties = { flex: 1, width: '100%', padding: '11px 12px', border: 'none', outline: 'none', fontSize: 16, fontFamily: '"Sora",sans-serif', background: 'transparent', color: T.ink }
  const rupee: React.CSSProperties = { padding: '11px 12px', fontSize: 15, color: T.teal, fontWeight: 700, borderRight: `1px solid ${T.hairline}` }
  const moneyInput = (val: string, on: (s: string) => void, ph: string) => (
    <div style={fieldWrap}><span style={rupee}>₹</span><input type="tel" inputMode="numeric" value={val} onChange={e => on(e.target.value)} placeholder={ph} style={input} autoFocus /></div>
  )
  const stepTitle: React.CSSProperties = { fontSize: 19, fontWeight: 800, color: T.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }
  const stepHelp: React.CSSProperties = { fontSize: 13, color: T.muted, margin: '0 0 16px', lineHeight: 1.55 }
  const chip = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${on ? T.teal : T.hairline}`, background: on ? T.tint : T.card, color: on ? T.teal : T.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' })

  if (v && !v.hasSalary) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', padding: 40, fontFamily: '"Sora",sans-serif' }}>
        <p style={{ fontSize: 14, color: T.muted }}>Confirm your salary slip first, then we’ll walk your tax breaks.</p>
        <Link href="/dashboard/tax/confirm" style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', background: T.teal, color: T.onTeal, borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Confirm slip →</Link>
      </div>
    )
  }

  const body = (() => {
    switch (step) {
      case 0: return (
        <>
          <h2 style={stepTitle}>Do you pay rent?</h2>
          <p style={stepHelp}>Rent unlocks the HRA exemption — usually the single biggest old-regime saver. Enter your <strong>monthly</strong> rent.</p>
          {!noRent && moneyInput(rent, onRent, 'e.g. 30,000')}
          <div style={{ marginTop: 12 }}>
            <button onClick={markNoRent} style={chip(noRent)}>I don’t pay rent</button>
          </div>
        </>
      )
      case 1: return (
        <>
          <h2 style={stepTitle}>Tax-saving investments (80C)</h2>
          <p style={stepHelp}>
            {pfAnnual.current > 0 ? <>We already counted <strong>{fmt(pfAnnual.current)}</strong> of EPF from your slip. </> : null}
            Add PPF, ELSS, LIC, tuition fees — anything else under 80C (₹1.5L cap, yearly).
          </p>
          {moneyInput(c80, s => onDed('ppf', s, setC80), 'up to 1,50,000')}
        </>
      )
      case 2: return (
        <>
          <h2 style={stepTitle}>Home loan interest</h2>
          <p style={stepHelp}>The interest part of your home-loan EMIs is deductible up to ₹2,00,000 a year under Section 24(b). Skip if it doesn’t apply.</p>
          {moneyInput(hl, s => onDed('homeLoanInterest', s, setHl), 'up to 2,00,000')}
        </>
      )
      case 3: return (
        <>
          <h2 style={stepTitle}>Health insurance (80D)</h2>
          <p style={stepHelp}>Yearly premium for you and your family. The cap lifts with age — tell us who’s 60+.</p>
          {moneyInput(d80, s => onDed('selfFamily', s, setD80), 'e.g. 25,000')}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={() => onSenior('self', !selfSenior)} style={chip(selfSenior)}>I’m 60+</button>
            <button onClick={() => onSenior('parents', !parentsSenior)} style={chip(parentsSenior)}>My parents are 60+</button>
          </div>
        </>
      )
      default: return (
        <>
          <h2 style={stepTitle}>Pension savings (NPS)</h2>
          <p style={stepHelp}>Your own NPS contribution gets an extra ₹50,000 deduction under 80CCD(1B), on top of 80C.</p>
          {moneyInput(nps, s => onDed('nps', s, setNps), 'up to 50,000')}
        </>
      )
    }
  })()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <VerdictBar verdict={v} />

      {/* Progress rail */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6 }}>
          <span>Tax breaks · {STEPS[step]}</span><span>Step {step + 1} of {STEPS.length}</span>
        </div>
        <div style={{ height: 6, background: T.sand, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: T.teal, transition: 'width 350ms cubic-bezier(0.16,1,0.3,1)' }} />
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 14, padding: '24px 22px', minHeight: 180, marginBottom: 16 }}>
        {body}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          style={{ padding: '12px 20px', background: 'transparent', color: step === 0 ? T.faint : T.teal, border: `1px solid ${T.hairline}`, borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>← Back</button>
        {step < STEPS.length - 1
          ? <button onClick={() => setStep(s => s + 1)} style={{ padding: '12px 24px', background: T.teal, color: T.onTeal, border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
          : <button onClick={() => router.push('/dashboard/tax/optimizer')} style={{ padding: '12px 24px', background: T.teal, color: T.onTeal, border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>See my full breakdown →</button>}
      </div>

      <p style={{ fontSize: 11.5, color: T.muted, textAlign: 'center', margin: '16px 0 0' }}>
        Have LTA, donations or an education loan?{' '}
        <Link href="/dashboard/profile/exemptions" style={{ color: T.teal, fontWeight: 600 }}>Add advanced items →</Link>
      </p>
    </div>
  )
}
