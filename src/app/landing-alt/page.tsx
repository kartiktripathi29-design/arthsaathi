'use client'
// Standalone ALTERNATE landing — reachable at /landing-alt, does NOT touch the live `/` (src/app/page.tsx).
// Matches the current ArthVo look: same tokens, same shared theme hooks, same reusable hero/demo/assurance
// components. Kept token-only (no raw hex) so it flips correctly in light and dark, exactly like the live page.
import Link from 'next/link'
import { useState } from 'react'
import BgDemo from '@/components/BgDemo'
import DataAssurance from '@/components/DataAssurance'
import HeroJourney from '@/components/HeroJourney'
import Logo from '@/components/Logo'
import { ThemeToggle, useArthvoTheme, useThemedBase } from '@/components/ThemeToggle'
import { tokens as T } from '@/lib/tokens'
import { estimateAnnualTax } from '@/lib/tax-slabs'

export default function LandingAltPage() {
  // Shared theme state + themed <html>/<body> base — same `av_theme` key the live landing/dashboard use,
  // so a choice here carries across surfaces. Reuses the hooks instead of re-inlining the boilerplate.
  const { theme, setTheme, resolved } = useArthvoTheme()
  useThemedBase(resolved)

  const [salary, setSalary] = useState('')
  const [monthly, setMonthly] = useState<number | null>(null)

  const runCheck = () => {
    const m = parseFloat(salary.replace(/,/g, '')) || 0
    setMonthly(m || null)
    const el = document.getElementById('live-demo')
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: 'smooth' })
  }

  const goToEstimate = () => {
    const el = document.getElementById('quick-estimate')
    if (!el) return
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: 'smooth' })
    el.querySelector('input')?.focus()
  }

  // Live preview of the saving, computed the same way the live page does (both regimes on annualised pay).
  const saving = (() => {
    if (!monthly) return null
    const annual = monthly * 12
    const newTax = estimateAnnualTax(annual, 'new')
    const oldTax = estimateAnnualTax(annual, 'old')
    return { newTax, oldTax, best: Math.min(newTax, oldTax), gap: Math.abs(newTax - oldTax) }
  })()
  const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

  return (
    <div data-theme={resolved} suppressHydrationWarning style={{ minHeight: '100vh', background: T.paper, color: T.ink, fontFamily: '"Sora",-apple-system,sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .btn-green{transition:transform 0.15s,box-shadow 0.15s}
        .btn-green:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(14,77,71,0.25)}
        .btn-ghost{transition:background 0.15s}
        .btn-ghost:hover{background:var(--tint)!important}
        .step-card{transition:transform 0.2s,box-shadow 0.2s}
        .step-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(14,77,71,0.1)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both}
        .d2{animation-delay:0.15s}.d3{animation-delay:0.3s}.d4{animation-delay:0.45s}
        .salary-input:focus{outline:none;border-color:var(--teal)!important;box-shadow:0 0 0 3px rgba(14,77,71,0.12)}
        .highlight{position:relative;display:inline-block}
        .highlight::after{content:'';position:absolute;bottom:4px;left:0;width:100%;height:6px;background:var(--tint);z-index:-1;border-radius:2px}
        .nav-bar{padding:16px 52px}
        .hero-sec{padding:80px 32px 32px}
        .demo-wrap{padding:4px 32px 24px}
        .hiw-sec{padding:80px 52px}
        .hiw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .cta-sec{padding:72px 48px}
        .footer-bar{padding:20px 48px}
        @media (max-width:900px){ .hiw-grid{grid-template-columns:repeat(2,1fr)} }
        @media (max-width:768px){ .nav-bar{padding:12px 20px} .hero-sec{padding:56px 20px 24px} .demo-wrap{padding:4px 16px 24px} .hiw-sec{padding:56px 20px} .cta-sec{padding:56px 24px} .footer-bar{padding:16px 20px} }
        @media (max-width:560px){ .hiw-grid{grid-template-columns:1fr} }
      `}</style>

      {/* Sticky nav — mirrors the live landing */}
      <nav className="nav-bar" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${T.hairline}`, position:'sticky', top:0, background: resolved === 'dark' ? 'rgba(20,30,27,0.85)' : 'rgba(248,242,231,0.95)', backdropFilter:'blur(8px)', zIndex:50 }}>
        <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:11 }}>
          <Logo variant="onLight" size={32} />
        </Link>
        <div className="nav-actions" style={{ display:'flex', gap:8, alignItems:'center' }}>
          <ThemeToggle theme={theme} setTheme={setTheme} resolved={resolved} />
          <Link href="/login" className="btn-ghost" style={{ padding:'8px 20px', background:'transparent', border:`1px solid ${T.hairline}`, borderRadius:8, color:T.muted, fontWeight:500, textDecoration:'none', fontSize:13, whiteSpace:'nowrap' }}>Sign in</Link>
          <Link href="/signup" className="btn-green" style={{ padding:'9px 22px', background:T.teal, color:T.ivory, borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:13, whiteSpace:'nowrap' }}>Sign up →</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero-sec" style={{ maxWidth:1000, margin:'0 auto', textAlign:'center' }}>
        <h1 className="fu d2" style={{ fontSize:'clamp(26px, 7vw, 54px)', fontWeight:900, lineHeight:1.04, letterSpacing:'-0.04em', color:T.ink, marginBottom:8 }}>
          <span style={{ display:'block' }}>One salary slip.<br />Your real tax,</span>
          <span style={{ color:T.teal }} className="highlight">and the regime that fits.</span>
        </h1>

        <p className="fu d3" style={{ fontSize:'clamp(15px,2vw,18px)', color:T.muted, margin:'20px auto 32px', maxWidth:520, lineHeight:1.75, fontWeight:400 }}>
          Upload once. See both regimes on your actual numbers — in plain English.
        </p>

        <div className="fu d3" style={{ margin:'0 auto 28px' }}>
          <HeroJourney monthly={monthly} onTry={goToEstimate} />
        </div>

        {/* Quick estimate */}
        <div id="quick-estimate" className="fu d4" style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:16, padding:'24px 28px', maxWidth:440, margin:'0 auto 12px', textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.teal, marginBottom:12 }}>Quick estimate — what's your monthly salary?</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ display:'flex', flex:1, border:`1.5px solid ${T.hairline}`, borderRadius:10, overflow:'hidden', background:T.card }}>
              <span style={{ padding:'11px 12px', fontSize:15, color:T.teal, fontWeight:700, borderRight:`1px solid ${T.hairline}` }}>₹</span>
              <input type="tel" value={salary} onChange={e => setSalary(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runCheck() }}
                placeholder="e.g. 1,20,000" className="salary-input"
                style={{ flex:1, padding:'11px 12px', border:'none', fontSize:14, fontFamily:'"Sora",sans-serif' }} />
            </div>
            <button onClick={runCheck} className="btn-green"
              style={{ padding:'11px 18px', background:T.teal, color:T.ivory, borderRadius:10, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', fontFamily:'"Sora",sans-serif', whiteSpace:'nowrap' }}>
              Check now →
            </button>
          </div>

          {saving && (
            <div style={{ marginTop:14, padding:'12px 14px', background:T.tint, borderRadius:10, fontSize:13, color:T.ink, lineHeight:1.6 }}>
              On <strong>{inr(monthly! * 12)}</strong>/yr, the better regime is roughly{' '}
              <strong style={{ color:T.green }}>{inr(saving.best)}</strong> tax
              {saving.gap > 0 && <> — about <strong style={{ color:T.green }}>{inr(saving.gap)}</strong> apart. Upload a slip to see it exactly.</>}
            </div>
          )}

          <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', alignItems:'center', gap:'4px 12px', fontSize:11, color:T.muted }}>
            <span>No signup needed.</span>
            <span style={{ color:T.green, fontWeight:700 }}>Free during early access.</span>
          </div>
          <DataAssurance style={{ marginTop:8 }} />
        </div>
      </div>

      {/* Live demo */}
      <div id="live-demo" className="demo-wrap" style={{ maxWidth:680, margin:'0 auto' }}>
        <div style={{ borderRadius:20, overflow:'hidden', border:`1.5px solid ${T.hairline}`, boxShadow:'0 8px 48px rgba(14,77,71,0.1)' }}>
          <BgDemo monthly={monthly} />
        </div>
      </div>

      {/* How it works */}
      <div className="hiw-sec" style={{ background:T.sand }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:12 }}>How it works</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, letterSpacing:'-0.03em', color:T.ink }}>
              From slip to answer. In minutes.
            </h2>
          </div>
          <div className="hiw-grid">
            {[
              { num:'01', title:'Add your salary slip', body:'ArthVo reads it for you — no manual typing.' },
              { num:'02', title:'It pulls your income', body:'Every figure on the slip, extracted automatically.' },
              { num:'03', title:'See what you owe', body:'Old vs new regime, side by side, on your numbers.' },
              { num:'04', title:'Know what to do next', body:'The regime to pick and what to check — in plain English.' },
            ].map((s, i) => (
              <div key={i} className="step-card" style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:14, padding:'24px 20px' }}>
                <div style={{ fontSize:28, fontWeight:800, color:T.teal, letterSpacing:'0.02em', marginBottom:14 }}>{s.num}</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink, marginBottom:8 }}>{s.title}</div>
                <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA — dark band; accents go green (teal would vanish on dark), same as the live page */}
      <div className="cta-sec" style={{ background: resolved === 'dark' ? T.paper : T.ink, textAlign:'center' }}>
        <div style={{ fontSize:11, color:T.green, fontWeight:700, letterSpacing:'0.2em', marginBottom:16, textTransform:'uppercase' }}>
          One slip is all it takes
        </div>
        <h2 style={{ fontSize:'clamp(32px,5vw,60px)', fontWeight:900, letterSpacing:'-0.04em', color:T.ivory, lineHeight:1.05, marginBottom:20 }}>
          Your tax. Your regime.<br />
          <span style={{ color:T.green }}><span style={{ whiteSpace:'nowrap' }}>Settled.</span></span>
        </h2>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/try" className="btn-green"
            style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'16px 40px', background:T.green, color:T.ivory, borderRadius:12, fontWeight:800, textDecoration:'none', fontSize:17, letterSpacing:'-0.01em' }}>
            See which one's yours →
          </Link>
        </div>
        <div style={{ marginTop:16, fontSize:13, color:'rgba(244,238,224,0.85)', lineHeight:1.6 }}>
          <strong style={{ color:T.green, fontWeight:700 }}>Free during early access.</strong> Early users keep extended free access.
        </div>
        <div style={{ marginTop:16, display:'flex', justifyContent:'center', gap:28, flexWrap:'wrap' }}>
          {['No signup for the estimate', 'Never seen by a human', 'Plain English, always'].map(t => (
            <div key={t} style={{ fontSize:13, color:'rgba(244,238,224,0.7)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:T.green }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="footer-bar" style={{ textAlign:'center', background: resolved === 'dark' ? T.paper : T.ink, fontSize:11, color:'rgba(244,238,224,0.55)' }}>
        ArthVo helps you read your salary slip and compare tax regimes. Consult a CA for ITR filing. © 2026 ArthVo
        {' · '}
        <a href="/privacy" style={{ color:'rgba(244,238,224,0.7)', textDecoration:'underline' }}>Privacy</a>
      </div>
    </div>
  )
}
