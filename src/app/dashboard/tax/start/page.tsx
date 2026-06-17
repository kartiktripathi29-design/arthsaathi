'use client'
// PROTOTYPE (Phase 1) — the provisional-verdict / onboarding screen.
//   • Shows a real answer the moment a slip is parsed (salary-only range, same framing as the
//     landing card — but on the user's own numbers).
//   • Four quick questions (HRA, 80C, 80D, NPS) that write the SAME av_* keys the optimizer reads,
//     so each answer moves the sticky VerdictBar live and carries straight into "Your Tax".
//   • Hands off to the full optimizer for the exact, file-ready number.
// New route, additive — the existing flow is untouched. Demonstrates "verdict-first, refine-forward".

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { computeQuickVerdict, type QuickVerdict } from '@/lib/quick-verdict'
import { getSalaryFacts } from '@/lib/salary-facts'
import VerdictBar from '@/components/VerdictBar'
import { tokens as T } from '@/lib/tokens'

const fmt = (v: number) => `₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`
const num = (s: string) => Math.max(0, parseFloat((s || '').replace(/,/g, '')) || 0)

function readJSON(key: string): any { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } }
function writeJSON(key: string, obj: any) { try { localStorage.setItem(key, JSON.stringify(obj)) } catch {} }

export default function StartPage() {
  const [v, setV] = useState<QuickVerdict | null>(null)
  const [rent, setRent] = useState('')
  const [c80, setC80] = useState('')
  const [d80, setD80] = useState('')
  const [nps, setNps] = useState('')
  // Monthly basic / HRA-received off the latest slip — needed to value the HRA exemption.
  const basis = useRef<{ basic: number; hra: number }>({ basic: 0, hra: 0 })

  const recompute = useCallback(() => setV(computeQuickVerdict()), [])

  useEffect(() => {
    const facts = getSalaryFacts()
    const last: any = facts.hraBasis?.[facts.hraBasis.length - 1] || {}
    basis.current = { basic: Number(last.basic) || Math.round(facts.annualGross * 0.4 / 12), hra: Number(last.hra) || 0 }
    const ded = readJSON('av_deductions'); const exm = readJSON('av_exemptions')
    if (exm.hra?.rentPaid) setRent(String(exm.hra.rentPaid))
    if (ded.ppf) setC80(String(ded.ppf))
    if (ded.selfFamily) setD80(String(ded.selfFamily))
    if (ded.nps) setNps(String(ded.nps))
    recompute()
  }, [recompute])

  const onRent = (val: string) => {
    setRent(val)
    const rentM = num(val)
    const { basic, hra } = basis.current
    // Annual HRA exemption ≈ 12 × min(received, rent − 10% basic, 50% basic [metro]). Prototype assumes metro.
    const monthly = rentM > 0 ? Math.max(0, Math.min(hra || basic * 0.5, rentM - 0.1 * basic, 0.5 * basic)) : 0
    const exm = readJSON('av_exemptions')
    exm.hra = { ...(exm.hra || {}), rentPaid: rentM, hraReceived: hra || Math.round(basic * 0.5), isMetro: true, annualExemption: Math.round(monthly * 12) }
    writeJSON('av_exemptions', exm); recompute()
  }
  const onDed = (field: string, val: string, set: (s: string) => void) => {
    set(val)
    const ded = readJSON('av_deductions'); ded[field] = num(val)
    writeJSON('av_deductions', ded); recompute()
  }

  if (v && !v.hasSalary) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 14, color: T.muted }}>Upload a salary slip first to see your provisional answer.</p>
        <Link href="/dashboard/profile/documents" style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', background: T.teal, color: T.onTeal, borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Add your slip →</Link>
      </div>
    )
  }

  const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 12 }
  const fieldWrap: React.CSSProperties = { display: 'flex', border: `1.5px solid ${T.hairline}`, borderRadius: 9, overflow: 'hidden', background: T.card }
  const input: React.CSSProperties = { flex: 1, padding: '9px 10px', border: 'none', fontSize: 14, fontFamily: '"Sora",sans-serif', width: '100%', background: 'transparent', color: T.ink }
  const rupee: React.CSSProperties = { padding: '9px 10px', fontSize: 13, color: T.teal, fontWeight: 700, borderRight: `1px solid ${T.hairline}` }

  const questions: { label: string; sub: string; val: string; on: (s: string) => void; ph: string }[] = [
    { label: 'House rent (HRA)', sub: 'monthly rent you pay', val: rent, on: onRent, ph: 'e.g. 30,000' },
    { label: 'Tax-saving investments (80C)', sub: 'PPF · ELSS · LIC — yearly', val: c80, on: s => onDed('ppf', s, setC80), ph: 'up to 1,50,000' },
    { label: 'Health insurance (80D)', sub: 'yearly premium', val: d80, on: s => onDed('selfFamily', s, setD80), ph: 'e.g. 25,000' },
    { label: 'Pension savings (NPS)', sub: '80CCD(1B) — yearly', val: nps, on: s => onDed('nps', s, setNps), ph: 'up to 50,000' },
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <VerdictBar verdict={v} />

      <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Your provisional answer</h1>
      <p style={{ fontSize: 13, color: T.muted, margin: '0 0 16px' }}>Straight off your slip. Answer four quick questions to make it exact.</p>

      {/* First-look range — the payoff, from salary alone */}
      {v && (
        <div style={{ ...card, padding: 18, marginBottom: 20 }}>
          <div className="demo-regime" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
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
            <span style={{ color: T.ink, fontWeight: 700 }}>Your real answer sits in this range.</span> The four questions below decide where.
          </div>
        </div>
      )}

      {/* The four quick questions — each writes the same data the optimizer reads, live */}
      <div style={{ ...card, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Make it exact</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {questions.map(q => (
            <div key={q.label}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{q.label}</div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>{q.sub}</div>
              <div style={fieldWrap}>
                <span style={rupee}>₹</span>
                <input type="tel" inputMode="numeric" value={q.val} onChange={e => q.on(e.target.value)} placeholder={q.ph} style={input} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Handoff to the exact, file-ready number */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Link href="/dashboard/tax/optimizer" style={{ padding: '12px 22px', background: T.teal, color: T.onTeal, borderRadius: 9, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>See the full breakdown →</Link>
      </div>
      <p style={{ fontSize: 11, color: T.muted, fontStyle: 'italic', margin: '12px 0 0', textAlign: 'center' }}>Provisional — capital gains, other income and exact TDS are added in “Your Tax”.</p>
    </div>
  )
}
