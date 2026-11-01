'use client'
// PROTOTYPE (Phase 4) — defer auth. This is the public twin of /dashboard/tax/start: a visitor can
// reach the FULL provisional verdict and refine it with the quick questions WITHOUT an account. It
// lives outside /dashboard, so the dashboard AuthGate never runs. Sign-up is deferred to the moment
// they want to SAVE / get the exact, file-ready breakdown. Everything is written to the same
// localStorage keys, so after they sign up the dashboard already has their numbers (same origin).

import { useEffect, useRef, useState } from 'react'
import ProvisionalVerdict from '@/components/ProvisionalVerdict'
import EmailCapture from '@/components/EmailCapture'
import { shouldFetchContext } from '@/lib/email-capture'
import DataAssurance from '@/components/DataAssurance'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { ThemeToggle, useArthvoTheme, useThemedBase } from '@/components/ThemeToggle'
import { tokens as T } from '@/lib/tokens'
import { MIN_PLAUSIBLE_CTC, monthlyInHandFromGross, monthlyStructure, toMonthlyGross, type SalaryInputType } from '@/lib/salary-input'

const SALARY_TYPES: { type: SalaryInputType; label: string; placeholder: string; source: string }[] = [
  { type: 'gross', label: 'Gross monthly', placeholder: 'e.g. 1,20,000', source: '' },
  { type: 'ctc', label: 'Annual CTC', placeholder: 'e.g. 12,00,000', source: 'CTC' },
  { type: 'inhand', label: 'Monthly in‑hand', placeholder: 'e.g. 75,000', source: 'in‑hand pay' },
]

const num =(s: string) => Math.max(0, parseFloat((s || '').replace(/,/g, '')) || 0)
const writeJSON = (k: string, o: any) => { try { localStorage.setItem(k, JSON.stringify(o)) } catch {} }
// Fire-and-forget funnel ping for launch monitoring (server counts it into /api/health). Never throws,
// never blocks the page — a failed ping must be invisible to the visitor.
const pingAnalytics = (event: string) => {
  try {
    void fetch('/api/analytics/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }),
    }).catch(() => {})
  } catch { /* never surface */ }
}

export default function TryPage() {
  // /try lives outside /dashboard, so it gets none of the dashboard layout's theming — wire the shared
  // appearance state here (same av_theme key) and paint the themed base so dark mode actually applies
  // and a visitor can switch it, on this public pre-auth screen.
  const { theme, setTheme, resolved } = useArthvoTheme()
  useThemedBase(resolved)
  const [salary, setSalary] = useState('')
  const [salaryType, setSalaryType] = useState<SalaryInputType>('gross')
  const [entered, setEntered] = useState(false)
  const [version, setVersion] = useState(0)
  const [returning, setReturning] = useState<{ verdictFY: number; verdictAmount: number | null } | null>(null)

  // Funnel analytics for launch monitoring (fire-and-forget). try_visit once on mount; verdict_rendered
  // once when the answer screen first shows. Both feed /api/health's last-hour view.
  useEffect(() => { pingAnalytics('try_visit') }, [])
  const verdictFired = useRef(false)
  useEffect(() => {
    if (entered && !verdictFired.current) { verdictFired.current = true; pingAnalytics('verdict_rendered') }
  }, [entered])

  const seed = (amountStr: string, type: SalaryInputType = salaryType) => {
    const amount = num(amountStr)
    if (!amount || (type === 'ctc' && amount < MIN_PLAUSIBLE_CTC)) return
    const m = toMonthlyGross(type, amount)
    if (!m) return
    const annual = m * 12
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const { basic, hra } = monthlyStructure(m)
    const net = type === 'inhand' ? amount : monthlyInHandFromGross(m)
    // Careful summary (drives the verdict) PLUS a light synthetic slip, so the "has data" gates pass
    // after sign-up — the dashboard opens on their numbers instead of bouncing to a blank upload.
    // Flag the seeded summary synthetic so real uploaded/confirmed data is distinguishable from this
    // estimate — both so we never clobber real data (below) and so downstream can treat it as provisional.
    writeJSON('av_salary_summary', {
      annualGross: annual, annualNet: net * 12, annualTDS: 0, fyStartYear,
      hraBasis: Array.from({ length: 12 }, () => ({ basic, hra })), _synthetic: true,
      _salaryInput: { type, amount },
    })
    writeJSON('av_salary_timeline', [{ grossSalary: m, basicSalary: basic, hra, netSalary: net, month: '', year: String(fyStartYear), _synthetic: true }])
    setSalary(String(amount)); setSalaryType(type); setEntered(true); setVersion(x => x + 1)
  }

  const amount = num(salary)
  const ctcTooLow = salaryType === 'ctc' && amount > 0 && amount < MIN_PLAUSIBLE_CTC
  const activeType = SALARY_TYPES.find(t => t.type === salaryType)!
  const conversion = salaryType !== 'gross' && amount > 0 && !ctcTooLow
    ? `≈ ₹${toMonthlyGross(salaryType, amount).toLocaleString('en-IN')} gross per month (estimated from ${activeType.source})`
    : null

  // Resume from a salary carried in (?m= from the landing estimate) or one already on the device.
  // REAL uploaded/confirmed salary (a non-synthetic summary or slip) is never overwritten by the
  // landing estimate — a returning user who types a figure resumes their real data instead of losing
  // it. Only when there's no real data do we seed the synthetic estimate from ?m=.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('av_salary_summary') || 'null')
      const hasRealSummary = !!s && (s.annualGross || 0) > 0 && !s._synthetic
      let hasRealSlip = false
      try {
        const tl = JSON.parse(localStorage.getItem('av_salary_timeline') || 'null')
        hasRealSlip = Array.isArray(tl) && tl.some((x: any) => x && !x._synthetic && (Number(x.grossSalary) || 0) > 0)
      } catch {}
      if (hasRealSummary || hasRealSlip) {
        if (hasRealSummary) setSalary(String(Math.round(s.annualGross / 12)))
        setEntered(true)
        return
      }
      const mParam = new URLSearchParams(window.location.search).get('m')
      if (mParam && num(mParam) > 0) { seed(mParam, 'gross'); return }
      // No real data and no ?m=, but a prior synthetic estimate is on the device — resume it as typed.
      if (s && (s.annualGross || 0) > 0) {
        const typed = s._salaryInput
        if (typed?.type && typed.amount > 0) { setSalaryType(typed.type); setSalary(String(typed.amount)) }
        else setSalary(String(Math.round(s.annualGross / 12)))
        setEntered(true)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cross-device rehydrate: if the January email link carries ?r=<token> and this device has NO local
  // verdict, fetch back ONLY the prior verdict figures and show a returning-user banner. Local state
  // wins if present; unknown/unsubscribed token → 404 → no banner, page works normally.
  useEffect(() => {
    try {
      const token = new URLSearchParams(window.location.search).get('r')
      const s = JSON.parse(localStorage.getItem('av_salary_summary') || 'null')
      const hasLocalVerdict = !!s && (s.annualGross || 0) > 0
      if (!shouldFetchContext(hasLocalVerdict, token)) return
      fetch(`/api/email-capture/context?r=${encodeURIComponent(token as string)}`)
        .then(res => (res.ok ? res.json() : null))
        .then(ctx => { if (ctx && Number.isInteger(ctx.verdictFY)) setReturning(ctx) })
        .catch(() => {})
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div data-theme={resolved} suppressHydrationWarning style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: T.paper, color: T.ink, fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <style>{`.btn-ghost{transition:background .15s} .btn-ghost:hover{background:var(--tint) !important}`}</style>
      <SiteHeader actions={<ThemeToggle theme={theme} setTheme={setTheme} resolved={resolved} />} />

      <div style={{ flex: 1, padding: '28px 20px 60px' }}>
        {returning && typeof returning.verdictAmount === 'number' && returning.verdictAmount > 0 && (
          <div style={{ maxWidth: 440, margin: '0 auto 16px', background: T.tint, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: '14px 16px', color: T.ink, fontSize: 13, lineHeight: 1.55 }}>
            In July you found <strong>₹{returning.verdictAmount.toLocaleString('en-IN')}</strong> you could have saved. Let’s see what’s still fixable this year.
          </div>
        )}
        {!entered ? (
          <div style={{ maxWidth: 440, margin: '40px auto 0', background: T.card, border: `1.5px solid ${T.hairline}`, borderRadius: 16, padding: '24px 28px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 6 }}>See your real tax — no signup.</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>Start with your salary. We’ll show old vs new regime, then refine it with a few questions.</div>
            <div role="group" aria-label="Salary type" style={{ display: 'flex', gap: 4, padding: 3, marginBottom: 10, background: T.tint, borderRadius: 10 }}>
              {SALARY_TYPES.map(t => {
                const active = t.type === salaryType
                return (
                  <button key={t.type} type="button" aria-pressed={active} onClick={() => setSalaryType(t.type)}
                    style={{ flex: 1, minWidth: 0, padding: '7px 4px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, background: active ? T.teal : 'transparent', color: active ? T.onTeal : T.ink }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', flex: 1, border: `1.5px solid ${T.hairline}`, borderRadius: 10, overflow: 'hidden', background: T.card }}>
                <span style={{ padding: '11px 12px', fontSize: 15, color: T.teal, fontWeight: 700, borderRight: `1px solid ${T.hairline}` }}>₹</span>
                <input type="tel" inputMode="numeric" value={salary} onChange={e => setSalary(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') seed(salary) }} placeholder={activeType.placeholder} aria-label={activeType.label} autoFocus
                  style={{ flex: 1, width: '100%', padding: '11px 12px', border: 'none', outline: 'none', fontSize: 14, fontFamily: '"Sora",sans-serif', background: 'transparent', color: T.ink }} />
              </div>
              <button onClick={() => seed(salary)} style={{ padding: '11px 18px', background: T.teal, color: T.onTeal, borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>See my answer →</button>
            </div>
            {conversion && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.teal, marginTop: 10 }}>{conversion}</div>}
            {ctcTooLow && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 10 }}>Enter the full yearly amount, e.g. 12,00,000 for 12 LPA.</div>}
            <div style={{ fontSize: 11, color: T.muted, marginTop: 12 }}>No account needed. Your numbers stay on your device until you save.</div>
            <DataAssurance style={{ marginTop: 8 }} />
          </div>
        ) : (
          <>
            <div style={{ maxWidth: 760, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setEntered(false)} style={{ background: 'transparent', border: 'none', color: T.teal, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Change salary</button>
              <span style={{ fontSize: 11.5, color: T.muted }}>Saved on this device · no account yet</span>
            </div>
            {conversion && <div style={{ maxWidth: 760, margin: '0 auto 12px', fontSize: 12.5, fontWeight: 600, color: T.teal }}>{conversion}</div>}
            <ProvisionalVerdict
              version={version}
              uploadHref={null}
              heading="Your answer — no signup needed"
              subheading="Old vs new regime on your salary. Refine it below; sign up only when you want to save it."
              ctaHref="/signup"
              ctaLabel="Save your answer → Sign up"
              noSalaryHref="/try"
              noSalaryLabel="Enter your salary →"
              footnote="Sign up (free) to add your real slip, capital gains and exact TDS — and get a CA-ready computation."
            />
            {/* Post-verdict email capture — renders AFTER the verdict and never gates it. */}
            <EmailCapture />
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}
