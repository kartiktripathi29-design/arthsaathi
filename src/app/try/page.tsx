'use client'
// PROTOTYPE (Phase 4) — defer auth. This is the public twin of /dashboard/tax/start: a visitor can
// reach the FULL provisional verdict and refine it with the quick questions WITHOUT an account. It
// lives outside /dashboard, so the dashboard AuthGate never runs. Sign-up is deferred to the moment
// they want to SAVE / get the exact, file-ready breakdown. Everything is written to the same
// localStorage keys, so after they sign up the dashboard already has their numbers (same origin).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProvisionalVerdict from '@/components/ProvisionalVerdict'
import Logo from '@/components/Logo'
import { tokens as T } from '@/lib/tokens'

const num = (s: string) => Math.max(0, parseFloat((s || '').replace(/,/g, '')) || 0)
const writeJSON = (k: string, o: any) => { try { localStorage.setItem(k, JSON.stringify(o)) } catch {} }

export default function TryPage() {
  const [salary, setSalary] = useState('')
  const [entered, setEntered] = useState(false)
  const [version, setVersion] = useState(0)

  // Resume if a salary is already on the device (e.g. from a previous visit / the landing estimate).
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('av_salary_summary') || 'null')
      if (s && (s.annualGross || 0) > 0) { setSalary(String(Math.round(s.annualGross / 12))); setEntered(true) }
    } catch {}
  }, [])

  const seed = (monthlyStr: string) => {
    const m = num(monthlyStr)
    if (!m) return
    const annual = m * 12
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    // A salary-only seed — enough for the provisional range + the quick questions. (No slip yet.)
    writeJSON('av_salary_summary', {
      annualGross: annual, annualNet: Math.round(annual * 0.9), annualTDS: 0, fyStartYear,
      hraBasis: Array.from({ length: 12 }, () => ({ basic: Math.round(m * 0.4), hra: Math.round(m * 0.2) })),
    })
    setEntered(true)
    setVersion(x => x + 1)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.paper, color: T.ink, fontFamily: '"Sora",-apple-system,sans-serif' }}>
      {/* Public header — no account required */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', borderBottom: `1px solid ${T.hairline}` }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}><Logo variant="onLight" size={30} /></Link>
        <Link href="/login" style={{ fontSize: 13, color: T.muted, fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
      </nav>

      <div style={{ padding: '28px 20px 60px' }}>
        {!entered ? (
          <div style={{ maxWidth: 440, margin: '40px auto 0', background: T.card, border: `1.5px solid ${T.hairline}`, borderRadius: 16, padding: '24px 28px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 6 }}>See your real tax — no signup.</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>Start with your monthly salary. We’ll show old vs new regime, then refine it with a few questions.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', flex: 1, border: `1.5px solid ${T.hairline}`, borderRadius: 10, overflow: 'hidden', background: T.card }}>
                <span style={{ padding: '11px 12px', fontSize: 15, color: T.teal, fontWeight: 700, borderRight: `1px solid ${T.hairline}` }}>₹</span>
                <input type="tel" inputMode="numeric" value={salary} onChange={e => setSalary(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') seed(salary) }} placeholder="e.g. 1,20,000" autoFocus
                  style={{ flex: 1, width: '100%', padding: '11px 12px', border: 'none', outline: 'none', fontSize: 14, fontFamily: '"Sora",sans-serif', background: 'transparent', color: T.ink }} />
              </div>
              <button onClick={() => seed(salary)} style={{ padding: '11px 18px', background: T.teal, color: T.onTeal, borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>See my answer →</button>
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 12 }}>🔒 No account needed. Your numbers stay on your device until you save.</div>
          </div>
        ) : (
          <>
            <div style={{ maxWidth: 760, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setEntered(false)} style={{ background: 'transparent', border: 'none', color: T.teal, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Change salary</button>
              <span style={{ fontSize: 11.5, color: T.muted }}>🔒 Saved on this device · no account yet</span>
            </div>
            <ProvisionalVerdict
              version={version}
              heading="Your answer — no signup needed"
              subheading="Old vs new regime on your salary. Refine it below; sign up only when you want to save it."
              ctaHref="/signup"
              ctaLabel="Save your answer → Sign up"
              noSalaryHref="/try"
              noSalaryLabel="Enter your salary →"
              footnote="Sign up (free) to add your real slip, capital gains and exact TDS — and get a CA-ready computation."
            />
          </>
        )}
      </div>
    </div>
  )
}
