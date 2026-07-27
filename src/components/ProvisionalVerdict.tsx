'use client'
// Shared provisional-verdict UI: the salary-only range + the live "make it exact" quick questions +
// the sticky VerdictBar, all writing the SAME av_* keys the optimizer reads. Used by the in-app
// onboarding step (/dashboard/tax/start) AND the public, pre-auth /try flow — so both are one
// implementation. The only difference is the CTA (full breakdown vs sign-up-to-save).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { computeQuickVerdict, type QuickVerdict } from '@/lib/quick-verdict'
import { applyRentToExemptions } from '@/lib/quick-inputs'
import { CAP_80C, CAP_24B, CAP_NPS } from '@/lib/verdict-engine'
import VerdictBar from '@/components/VerdictBar'
import { tokens as T } from '@/lib/tokens'

const fmt = (v: number) => `₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`
const num = (s: string) => Math.max(0, parseFloat((s || '').replace(/,/g, '')) || 0)
const readJSON = (key: string): any => { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } }
const writeJSON = (key: string, obj: any) => { try { localStorage.setItem(key, JSON.stringify(obj)) } catch {} }

export interface ProvisionalVerdictProps {
  ctaHref: string
  ctaLabel: string
  heading?: string
  subheading?: string
  footnote?: React.ReactNode
  noSalaryHref?: string
  noSalaryLabel?: string
  // Optional secondary link beside the CTA (e.g. /start → the step-by-step wizard).
  secondaryHref?: string
  secondaryLabel?: string
  // Bump to force a re-read when salary is set/changed by a parent (e.g. the public /try salary gate).
  version?: number
}

export default function ProvisionalVerdict({
  ctaHref, ctaLabel,
  heading = 'Your provisional answer',
  subheading = 'Straight off your slip. Answer a few quick questions to make it exact.',
  footnote = 'Provisional — capital gains, other income and exact TDS are added in “Your Tax”.',
  noSalaryHref = '/dashboard/profile/documents',
  noSalaryLabel = 'Add your slip →',
  secondaryHref,
  secondaryLabel,
  version = 0,
}: ProvisionalVerdictProps) {
  const [v, setV] = useState<QuickVerdict | null>(null)
  const [rent, setRent] = useState('')
  const [c80, setC80] = useState('')
  const [d80, setD80] = useState('')
  const [nps, setNps] = useState('')
  const [hl, setHl] = useState('')

  const recompute = useCallback(() => setV(computeQuickVerdict()), [])

  useEffect(() => {
    const ded = readJSON('av_deductions'); const exm = readJSON('av_exemptions')
    setRent(exm.hra?.rentPaid ? String(exm.hra.rentPaid) : '')
    setC80(ded.ppf ? String(ded.ppf) : '')
    setD80(ded.selfFamily ? String(ded.selfFamily) : '')
    setNps(ded.nps ? String(ded.nps) : '')
    setHl(ded.homeLoanInterest ? String(ded.homeLoanInterest) : '')
    recompute()
  }, [recompute, version])

  const onRent = (val: string) => {
    setRent(val)
    // Canonical Rule 2A via the shared helper — caps at real per-month HRA (no fabrication), honours
    // the saved isMetro, and merges into the saved exemptions object. See src/lib/quick-inputs.ts.
    applyRentToExemptions(num(val))
    recompute()
  }
  const onDed = (field: string, val: string, set: (s: string) => void) => {
    set(val)
    const ded = readJSON('av_deductions'); ded[field] = num(val)
    writeJSON('av_deductions', ded); recompute()
  }

  if (v && !v.hasSalary) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 14, color: T.muted }}>Add your salary first to see your provisional answer.</p>
        <Link href={noSalaryHref} style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', background: T.teal, color: T.onTeal, borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>{noSalaryLabel}</Link>
      </div>
    )
  }

  const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 12 }
  const fieldWrap: React.CSSProperties = { display: 'flex', border: `1.5px solid ${T.hairline}`, borderRadius: 9, overflow: 'hidden', background: T.card }
  const input: React.CSSProperties = { flex: 1, padding: '9px 10px', border: 'none', fontSize: 14, fontFamily: '"Sora",sans-serif', width: '100%', background: 'transparent', color: T.ink }
  const rupee: React.CSSProperties = { padding: '9px 10px', fontSize: 13, color: T.teal, fontWeight: 700, borderRight: `1px solid ${T.hairline}` }

  // `cap` marks the fields with a fixed statutory ceiling (80C ₹1.5L, 24(b) ₹2L, NPS ₹50k). HRA is
  // monthly rent (no input ceiling — the exemption is computed via Rule 2A) and 80D's cap is senior-
  // dependent, so both are left unclamped. The engine already caps the MATH; this only aligns what the
  // field SHOWS with what actually counts, so a fat-fingered ₹2,00,000,199,999 doesn't sit there looking
  // as if it all applies.
  const questions: { label: string; sub: string; val: string; on: (s: string) => void; ph: string; cap?: number }[] = [
    { label: 'House rent (HRA)', sub: 'monthly rent you pay', val: rent, on: onRent, ph: 'e.g. 30,000' },
    { label: 'Tax-saving investments (80C)', sub: 'PPF · ELSS · LIC — yearly', val: c80, on: s => onDed('ppf', s, setC80), ph: 'up to 1,50,000', cap: CAP_80C },
    { label: 'Home loan interest (24b)', sub: 'yearly interest — up to 2L', val: hl, on: s => onDed('homeLoanInterest', s, setHl), ph: 'up to 2,00,000', cap: CAP_24B },
    { label: 'Health insurance (80D)', sub: 'yearly premium', val: d80, on: s => onDed('selfFamily', s, setD80), ph: 'e.g. 25,000' },
    { label: 'Pension savings (NPS)', sub: '80CCD(1B) — yearly', val: nps, on: s => onDed('nps', s, setNps), ph: 'up to 50,000', cap: CAP_NPS },
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: '"Sora",-apple-system,sans-serif' }}>
      {/* Both grids are 2-up by default; collapse to a single column on narrow phones so the regime
          figures and the "make it exact" inputs don't crowd or clip at ~320px. (Local rule — the
          landing's own .demo-regime media query is component-scoped and doesn't reach here.) */}
      <style>{`
        .pv-regime { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pv-questions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        @media (max-width: 480px) {
          .pv-regime { grid-template-columns: 1fr; }
          .pv-questions { grid-template-columns: 1fr; }
        }
      `}</style>
      <VerdictBar verdict={v} />

      <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{heading}</h1>
      <p style={{ fontSize: 13, color: T.muted, margin: '0 0 16px' }}>{subheading}</p>

      {v && (
        <div style={{ ...card, padding: 18, marginBottom: 20 }}>
          <div className="pv-regime" style={{ marginBottom: 8 }}>
            <div style={{ background: T.tint, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.teal, letterSpacing: '0.04em', marginBottom: 6 }}>New regime</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.teal, letterSpacing: '-0.02em' }}>{fmt(v.range.newTax)}</div>
            </div>
            <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', marginBottom: 6 }}>Old regime</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' }}>{fmt(v.range.oldBare)}</div>
              {v.range.oldTypical < v.range.oldBare && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.teal }}>↓ with typical deductions</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: T.teal }}>~{fmt(v.range.oldTypical)}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12.5, textAlign: 'center', color: T.muted }}>
            <span style={{ color: T.ink, fontWeight: 700 }}>Your real answer sits in this range.</span> The questions below decide where.
          </div>
        </div>
      )}

      <div style={{ ...card, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Make it exact</div>
        <div className="pv-questions">
          {questions.map(q => {
            const over = q.cap != null && num(q.val) > q.cap
            return (
              <div key={q.label}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{q.label}</div>
                <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>{q.sub}</div>
                <div style={fieldWrap}>
                  <span style={rupee}>₹</span>
                  <input
                    type="tel" inputMode="numeric" value={q.val}
                    onChange={e => q.on(e.target.value)}
                    onBlur={q.cap != null ? () => { if (num(q.val) > q.cap!) q.on(String(q.cap)) } : undefined}
                    placeholder={q.ph} style={input}
                  />
                </div>
                {over && (
                  <div style={{ fontSize: 10, color: T.teal, marginTop: 4 }}>Only {fmt(q.cap!)} counts — the annual cap.</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: secondaryHref ? 'space-between' : 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        {secondaryHref ? <Link href={secondaryHref} style={{ fontSize: 12.5, color: T.teal, fontWeight: 600, textDecoration: 'none' }}>{secondaryLabel}</Link> : <span />}
        <Link href={ctaHref} style={{ padding: '12px 22px', background: T.teal, color: T.onTeal, borderRadius: 9, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>{ctaLabel}</Link>
      </div>
      {footnote && <p style={{ fontSize: 11, color: T.muted, fontStyle: 'italic', margin: '12px 0 0', textAlign: 'center' }}>{footnote}</p>}
    </div>
  )
}
