'use client'
import Link from 'next/link'
import { useState } from 'react'
import BgDemo from '@/components/BgDemo'
import Logo from '@/components/Logo'
import { tokens as T } from '@/lib/tokens'
import { estimateAnnualTax } from '@/lib/tax-slabs'

export default function LandingPage() {
  const [salary, setSalary] = useState('')
  const [taxSaving, setTaxSaving] = useState<{ monthly: number; newTax: number; oldTax: number } | null>(null)

  const calcQuickSaving = (s: string) => {
    const monthly = parseFloat(s.replace(/,/g, '')) || 0
    if (!monthly) { setTaxSaving(null); return }
    const annual = monthly * 12
    const newTax = estimateAnnualTax(annual, 'new')
    const oldTax = estimateAnnualTax(annual, 'old')
    setTaxSaving({ monthly, newTax, oldTax })
  }

  const runCheck = () => {
    calcQuickSaving(salary)
    document.getElementById('live-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ minHeight: '100vh', background: T.paper, color: T.ink, fontFamily: '"Sora",-apple-system,sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .btn-green{transition:transform 0.15s,box-shadow 0.15s}
        .btn-green:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(14,77,71,0.25)}
        .btn-ghost{transition:background 0.15s}
        .btn-ghost:hover{background:var(--tint)!important}
        .pain-card{transition:transform 0.2s,box-shadow 0.2s}
        .pain-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(14,77,71,0.1)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both}
        .d2{animation-delay:0.2s}.d3{animation-delay:0.35s}.d4{animation-delay:0.5s}
        .salary-input:focus{outline:none;border-color:var(--teal)!important;box-shadow:0 0 0 3px rgba(14,77,71,0.12)}
        .highlight{position:relative;display:inline-block}
        .highlight::after{content:'';position:absolute;bottom:4px;left:0;width:100%;height:6px;background:var(--tint);z-index:-1;border-radius:2px}
        .nav-bar{padding:16px 52px}
        .hero-sec{padding:80px 32px 32px}
        .demo-wrap{padding:4px 32px 24px}
        .pain-sec{padding:40px 52px 24px}
        .pain-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .hiw-sec{padding:80px 52px}
        .hiw-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .cta-sec{padding:72px 48px}
        .footer-bar{padding:20px 48px}
        .demo-regime{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .demo-slots{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        @media (max-width:900px){ .pain-grid{grid-template-columns:1fr} .hiw-grid{grid-template-columns:repeat(2,1fr)} }
        @media (max-width:768px){ .nav-bar{padding:12px 20px} .hero-sec{padding:56px 20px 24px} .demo-wrap{padding:4px 16px 24px} .pain-sec{padding:32px 20px 24px} .hiw-sec{padding:56px 20px} .cta-sec{padding:56px 24px} .footer-bar{padding:16px 20px} }
        @media (max-width:560px){ .hiw-grid{grid-template-columns:1fr} .demo-slots{grid-template-columns:1fr} }
        @media (max-width:480px){ .demo-regime{grid-template-columns:1fr} .demo-topbar{flex-wrap:wrap;row-gap:4px} }
      `}</style>

      {/* Sticky nav */}
      <nav className="nav-bar" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${T.hairline}`, position:'sticky', top:0, background:'rgba(248,242,231,0.95)', backdropFilter:'blur(8px)', zIndex:50 }}>
        <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:11 }}>
          <Logo variant="onLight" size={32} />
        </Link>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/login" className="btn-ghost" style={{ padding:'8px 20px', background:'transparent', border:`1px solid ${T.hairline}`, borderRadius:8, color:T.muted, fontWeight:500, textDecoration:'none', fontSize:13 }}>Sign in</Link>
          <Link href="/signup" className="btn-green" style={{ padding:'9px 22px', background:T.teal, color:T.ivory, borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:13 }}>Sign up →</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero-sec" style={{ maxWidth:1000, margin:'0 auto', textAlign:'center' }}>
        <h1 className="fu d2" style={{ fontSize:'clamp(26px, 7vw, 54px)', fontWeight:900, lineHeight:1.04, letterSpacing:'-0.04em', color:T.ink, marginBottom:8 }}>
          <span style={{ display:'block' }}>Your employer taxed<br />what they knew.</span>
          <span style={{ color:T.teal }} className="highlight">Not what's true for you.</span>
        </h1>

        <p className="fu d3" style={{ fontSize:'clamp(15px,2vw,18px)', color:T.muted, margin:'20px auto 32px', maxWidth:520, lineHeight:1.75, fontWeight:400 }}>
          One slip. Your real tax — and which regime it belongs in.
        </p>

        {/* Quick calculator */}
        <div className="fu d4" style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:16, padding:'24px 28px', maxWidth:440, margin:'0 auto 12px', textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.teal, marginBottom:12 }}>Quick estimate — what's your monthly salary?</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:0 }}>
            <div style={{ display:'flex', flex:1, border:`1.5px solid ${T.hairline}`, borderRadius:10, overflow:'hidden', background:T.card }}>
              <span style={{ padding:'11px 12px', fontSize:15, color:T.teal, fontWeight:700, borderRight:`1px solid ${T.hairline}` }}>₹</span>
              <input type="tel" value={salary} onChange={e => setSalary(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runCheck() }}
                placeholder="e.g. 1,20,000" className="salary-input"
                style={{ flex:1, padding:'11px 12px', border:'none', fontSize:14, fontFamily:'"Sora",sans-serif' }} />
            </div>
            <button onClick={runCheck} className="btn-green"
              style={{ padding:'11px 18px', background:T.teal, color:T.ivory, borderRadius:10, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', fontFamily:'"Sora",sans-serif', whiteSpace:'nowrap' as const }}>
              Check now →
            </button>
          </div>
          <div style={{ fontSize:11, color:T.muted, marginTop:12 }}>No signup needed.</div>
        </div>
      </div>

      {/* Demo */}
      <div id="live-demo" className="demo-wrap" style={{ maxWidth:680, margin:'0 auto' }}>
        <div style={{ borderRadius:20, overflow:'hidden', border:`1.5px solid ${T.hairline}`, boxShadow:'0 8px 48px rgba(14,77,71,0.1)' }}>
          <BgDemo monthly={taxSaving?.monthly ?? null} />
        </div>
      </div>

      {/* Pain section */}
      <div className="pain-sec" style={{ background:T.paper }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase' as const, marginBottom:12 }}>Why ArthVo exists</div>
            <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:900, letterSpacing:'-0.03em', color:T.ink, lineHeight:1.1 }}>
              We've all been there.
            </h2>
          </div>

          <div className="pain-grid">
            {[
              {
                statement: 'You picked a regime once. Maybe.',
                body: 'Most people never ran the comparison — they ticked a box in an HR form years ago.',
                answer: 'ArthVo shows you both regimes on your actual salary.',
              },
              {
                statement: 'Your salary slip is written for payroll software, not for you.',
                body: 'Basic, special allowance, employer PF — what does any of it mean for your tax?',
                answer: 'ArthVo turns it into plain numbers.',
              },
              {
                statement: 'HR gives you a deadline and a dropdown. You guess.',
                body: 'Regime election, investment declarations — decided in a rush, once a year, with zero explanation.',
                answer: 'Run the real numbers here before you commit.',
              },
            ].map((p, i) => (
              <div key={i} className="pain-card" style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:16, padding:'28px 24px', cursor:'pointer' }}>
                <div style={{ fontSize:16, fontWeight:700, color:T.ink, lineHeight:1.35, marginBottom:10 }}>{p.statement}</div>
                <div style={{ fontSize:13.5, color:T.muted, lineHeight:1.7, marginBottom:16 }}>{p.body}</div>
                <div style={{ fontSize:13, color:T.green, fontWeight:600, lineHeight:1.6, display:'flex', gap:8 }}>
                  <span>✓</span><span>{p.answer}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="hiw-sec" style={{ background:T.sand }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase' as const, marginBottom:12 }}>How it works</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, letterSpacing:'-0.03em', color:T.ink }}>
              From slip to answer. In minutes.
            </h2>
          </div>
          <div className="hiw-grid">
            {[
              { num:'01', title:'Add your salary slip', body:'ArthVo reads it for you — no manual typing.' },
              { num:'02', title:'It pulls your income', body:'Your salary and the earnings it can read from your documents.' },
              { num:'03', title:'See what you owe', body:'Old vs new regime, side by side, on your numbers.' },
              { num:'04', title:'Know your next step', body:'Which regime fits and what to check — in plain English.' },
            ].map((s, i) => (
              <div key={i} style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:14, padding:'24px 20px' }}>
                <div style={{ fontSize:28, fontWeight:800, color:T.teal, letterSpacing:'0.02em', marginBottom:14 }}>{s.num}</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink, marginBottom:8 }}>{s.title}</div>
                <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA — dark section: eyebrow/accents → green, headline → ivory, CTA button → green (teal would vanish on dark) */}
      <div className="cta-sec" style={{ background:T.ink, textAlign:'center' }}>
        <div style={{ fontSize:11, color:T.green, fontWeight:700, letterSpacing:'0.2em', marginBottom:16, textTransform:'uppercase' as const }}>
          One slip is all it takes
        </div>
        <h2 style={{ fontSize:'clamp(32px,5vw,60px)', fontWeight:900, letterSpacing:'-0.04em', color:T.ivory, lineHeight:1.05, marginBottom:20 }}>
          Know what you owe.<br />
          <span style={{ color:T.green }}>And which regime is yours.</span>
        </h2>
        <p style={{ fontSize:16, color:'rgba(244,238,224,0.75)', marginBottom:44, maxWidth:400, margin:'0 auto 44px', lineHeight:1.75 }}>
          No credit card. No guesswork.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as const }}>
          <Link href="/signup" className="btn-green"
            style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'16px 40px', background:T.green, color:T.ivory, borderRadius:12, fontWeight:800, textDecoration:'none', fontSize:17, letterSpacing:'-0.01em' }}>
            See which one's yours →
          </Link>
        </div>
        <div style={{ marginTop:20, display:'flex', justifyContent:'center', gap:28, flexWrap:'wrap' as const }}>
          {['No signup for the estimate', 'Plain English, always'].map(t => (
            <div key={t} style={{ fontSize:13, color:'rgba(244,238,224,0.7)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:T.green }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="footer-bar" style={{ textAlign:'center', background:T.ink, fontSize:11, color:'rgba(244,238,224,0.55)' }}>
        ArthVo helps you read your salary slip and compare tax regimes. Consult a CA for ITR filing. © 2026 ArthVo
        {' · '}
        <a href="/privacy" style={{ color:'rgba(244,238,224,0.7)', textDecoration:'underline' }}>Privacy</a>
      </div>
    </div>
  )
}
