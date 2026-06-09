'use client'
// Standalone, no-login offer-letter parser. For someone who *just* wants to decode an offer:
// upload it, get a clean CTC breakdown + an honest take-home estimate. Reuses the same
// /api/parse-offer-letter endpoint (and password-retry UX) the salary forecast flow uses.

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { passwordDialog } from '@/components/Dialog'
import { newRegimeAnnualTax } from '@/lib/tax-slabs'
import { tokens as T } from '@/lib/tokens'

interface OfferData {
  employeeName?: string; employerName?: string; designation?: string; joiningDate?: string
  basicSalary?: number; hra?: number; da?: number; ta?: number; lta?: number
  medicalAllowance?: number; specialAllowance?: number; otherAllowances?: number
  performanceBonus?: number; joiningBonus?: number; retentionBonus?: number; esopValue?: number
  gratuity?: number; employeePF?: number; employerPF?: number; professionalTax?: number
  fixedCTC?: number; variableCTC?: number; totalCTC?: number
  components?: { label: string; amount: number; type: string; frequency: string }[]
  notes?: string
}

const fmt = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="16" fill={T.teal} />
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={T.ivory} />
      <circle cx="90" cy="24" r="18" fill={T.ivory} />
      <circle cx="90" cy="24" r="11" fill={T.teal} />
    </svg>
  )
}

export default function OfferParserPage() {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle')
  const [data, setData] = useState<OfferData | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    setStatus('parsing'); setError('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string) || '').split(',')[1])
        reader.onerror = () => reject(new Error('Could not read that file.'))
        reader.readAsDataURL(file)
      })

      const call = async (password?: string) => {
        const r = await fetch('/api/parse-offer-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: base64, mediaType: file.type || 'application/pdf', fileName: file.name, password }),
        })
        return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({} as Record<string, unknown>)) }
      }

      let res = await call()
      // Password-protected PDFs: prompt and retry until it unlocks or the user cancels.
      if (res.status === 422 && (res.json?.error === 'requires_password' || res.json?.error === 'incorrect_password')) {
        let pwd = await passwordDialog({
          title: 'Password-protected file',
          message: `"${file.name}" is password-protected. Enter the password to read it, or cancel.`,
          confirmLabel: 'Unlock', placeholder: 'PDF password',
        })
        while (pwd) {
          setStatus('parsing')
          res = await call(pwd)
          if (!(res.status === 422 && res.json?.error === 'incorrect_password')) break
          pwd = await passwordDialog({
            title: 'Incorrect password',
            message: `That password didn't work for "${file.name}". Try again, or cancel.`,
            confirmLabel: 'Unlock', placeholder: 'PDF password',
          })
        }
        if (!pwd && res.status === 422) { setStatus('idle'); toast('Skipped — password needed.'); return }
      }

      if (!res.ok) throw new Error((res.json?.error as string) || 'Could not parse this offer letter.')
      setData((res.json.data as OfferData) || {})
      setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setStatus('error')
    }
  }

  const reset = () => { setData(null); setStatus('idle'); setError('') }

  return (
    <div style={{ minHeight: '100vh', background: T.paper, fontFamily: '"Sora",-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cta { transition: opacity .15s, transform .15s; }
        .cta:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
      `}</style>

      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 52px', borderBottom: `1px solid ${T.hairline}` }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Logo />
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, color: T.ink, letterSpacing: '-0.025em' }}>Arth<span style={{ color: T.teal }}>Vo</span></div>
            <div style={{ fontSize: 8, color: T.faint, letterSpacing: '0.18em', marginTop: -1 }}>WEALTH EVOLVED</div>
          </div>
        </Link>
        <div style={{ fontSize: 13, color: T.muted }}>
          <Link href="/login" style={{ color: T.teal, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px 64px' }}>
        <div style={{ width: '100%', maxWidth: 760 }}>

          {(status === 'idle' || status === 'parsing' || status === 'error') && (
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h1 style={{ fontSize: 30, fontWeight: 800, color: T.ink, letterSpacing: '-0.03em', marginBottom: 8 }}>Decode your offer letter</h1>
              <p style={{ fontSize: 15, color: T.muted, lineHeight: 1.6, maxWidth: 540, margin: '0 auto' }}>
                Upload your offer letter and get a clear CTC breakdown — fixed vs variable, every component,
                and an estimated monthly take-home. No sign-up, nothing saved.
              </p>
            </div>
          )}

          {(status === 'idle' || status === 'error') && (
            <>
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
                style={{
                  display: 'block', cursor: 'pointer', textAlign: 'center',
                  border: `2px dashed ${dragOver ? T.teal : T.hairline}`, borderRadius: 14,
                  background: dragOver ? T.tint : T.card, padding: '48px 24px', transition: 'all .15s',
                }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Drop your offer letter here, or click to browse</div>
                <div style={{ fontSize: 12.5, color: T.muted }}>PDF, Word (.docx) or image · password-protected PDFs supported</div>
                <input type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              </label>
              {status === 'error' && (
                <p style={{ marginTop: 14, fontSize: 13, color: '#DC2626', textAlign: 'center' }}>⚠ {error}</p>
              )}
              <p style={{ marginTop: 18, fontSize: 11.5, color: T.faint, textAlign: 'center', lineHeight: 1.6 }}>
                Your file is parsed on the fly and not stored. Figures are extracted as written — we never invent numbers.
              </p>
            </>
          )}

          {status === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '56px 0', color: T.muted, fontSize: 14 }}>
              ⏳ Reading your offer letter…
            </div>
          )}

          {status === 'done' && data && <Breakdown data={data} onReset={reset} />}
        </div>
      </div>
    </div>
  )
}

function Row({ label, amount, hint }: { label: string; amount: number; hint?: string }) {
  if (!amount) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: `1px solid ${T.hairline}` }}>
      <span style={{ fontSize: 13, color: T.ink }}>{label}{hint && <span style={{ color: T.faint, fontWeight: 400 }}> · {hint}</span>}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{fmt(amount)}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.faint, margin: '0 0 8px' }}>{title}</p>
      {children}
    </div>
  )
}

function Breakdown({ data: d, onReset }: { data: OfferData; onReset: () => void }) {
  const fixed = d.fixedCTC || d.totalCTC || 0
  const variable = d.variableCTC || Math.max(0, (d.totalCTC || 0) - fixed)
  const total = d.totalCTC || fixed + variable

  // Honest take-home estimate: based on guaranteed (fixed) pay, employer PF excluded (it isn't your
  // cash), new regime with standard deduction only. Before any 80C/HRA you might actually claim.
  const grossCash = Math.max(0, fixed - (d.employerPF || 0))
  const annualTax = grossCash > 0 ? newRegimeAnnualTax(grossCash) : 0
  const annualInHand = Math.max(0, grossCash - (d.employeePF || 0) - (d.professionalTax || 0) - annualTax)
  const monthlyInHand = Math.round(annualInHand / 12)

  const hasFixed = [d.basicSalary, d.hra, d.da, d.ta, d.lta, d.medicalAllowance, d.specialAllowance, d.otherAllowances, d.employerPF, d.gratuity].some(Boolean)
  const hasVariable = [d.performanceBonus, d.joiningBonus, d.retentionBonus, d.esopValue].some(Boolean)
  const hasDeductions = [d.employeePF, d.professionalTax].some(Boolean)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: '-0.025em', margin: 0 }}>
          {d.employerName || 'Your offer'}
        </h1>
        <p style={{ fontSize: 13.5, color: T.muted, marginTop: 4 }}>
          {[d.designation, d.employeeName, d.joiningDate && `joins ${d.joiningDate}`].filter(Boolean).join(' · ') || 'Compensation breakdown'}
        </p>
      </div>

      {/* Headline numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { k: 'Total CTC', v: total, c: T.ink },
          { k: 'Fixed (guaranteed)', v: fixed, c: T.green },
          { k: 'Variable (at-risk)', v: variable, c: T.caution.text },
        ].map(s => (
          <div key={s.k} style={{ background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{s.k}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.c, letterSpacing: '-0.02em' }}>{fmt(s.v)}</div>
          </div>
        ))}
      </div>

      {/* Take-home estimate */}
      {monthlyInHand > 0 && (
        <div style={{ background: T.slip.fill, border: `1px solid ${T.slip.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Estimated monthly take-home</div>
              <div style={{ fontSize: 11, color: T.green, marginTop: 2 }}>New regime · standard deduction only · before 80C/HRA</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.green, letterSpacing: '-0.02em' }}>{fmt(monthlyInHand)}</div>
          </div>
          <p style={{ fontSize: 11, color: T.green, margin: '10px 0 0', lineHeight: 1.5 }}>
            Rough estimate from your guaranteed pay (employer PF excluded). Your real in-hand changes once you
            declare HRA, 80C and other deductions — that’s what the full planner is for.
          </p>
        </div>
      )}

      {hasFixed && (
        <Section title="Fixed components (annual)">
          <Row label="Basic salary" amount={d.basicSalary || 0} />
          <Row label="HRA" amount={d.hra || 0} />
          <Row label="Dearness allowance" amount={d.da || 0} />
          <Row label="Travel allowance" amount={d.ta || 0} />
          <Row label="LTA" amount={d.lta || 0} />
          <Row label="Medical allowance" amount={d.medicalAllowance || 0} />
          <Row label="Special allowance" amount={d.specialAllowance || 0} />
          <Row label="Other allowances" amount={d.otherAllowances || 0} />
          <Row label="Employer PF" amount={d.employerPF || 0} hint="benefit" />
          <Row label="Gratuity" amount={d.gratuity || 0} hint="benefit" />
        </Section>
      )}

      {hasVariable && (
        <Section title="Variable & one-time">
          <Row label="Performance bonus" amount={d.performanceBonus || 0} />
          <Row label="Joining bonus" amount={d.joiningBonus || 0} hint="one-time" />
          <Row label="Retention bonus" amount={d.retentionBonus || 0} hint="one-time" />
          <Row label="ESOPs" amount={d.esopValue || 0} hint="vesting value" />
        </Section>
      )}

      {hasDeductions && (
        <Section title="Deductions (annual)">
          <Row label="Employee PF" amount={d.employeePF || 0} />
          <Row label="Professional tax" amount={d.professionalTax || 0} />
        </Section>
      )}

      {d.notes && (
        <Section title="Notes from the offer">
          <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, margin: 0 }}>{d.notes}</p>
        </Section>
      )}

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button onClick={onReset} className="cta"
          style={{ padding: '12px 18px', background: T.card, color: T.ink, border: `1px solid ${T.hairline}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↺ Parse another
        </button>
        <Link href="/login" className="cta" style={{ flex: 1, minWidth: 220, textAlign: 'center', padding: '12px 18px', background: T.teal, color: T.ivory, borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
          Plan taxes on this offer →
        </Link>
      </div>
      <p style={{ fontSize: 11, color: T.faint, textAlign: 'center', marginTop: 14 }}>
        Figures are extracted exactly as written in your document. Estimates are indicative, not tax advice.
      </p>
    </div>
  )
}
