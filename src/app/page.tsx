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
      `}</style>

      {/* Sticky nav */}
      <nav style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 52px', borderBottom:`1px solid ${T.hairline}`, position:'sticky', top:0, background:'rgba(248,242,231,0.95)', backdropFilter:'blur(8px)', zIndex:50 }}>
        <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:11 }}>
          <Logo variant="onLight" size={32} />
        </Link>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/login" className="btn-ghost" style={{ padding:'8px 20px', background:'transparent', border:`1px solid ${T.hairline}`, borderRadius:8, color:T.muted, fontWeight:500, textDecoration:'none', fontSize:13 }}>Sign in</Link>
          <Link href="/signup" className="btn-green" style={{ padding:'9px 22px', background:T.teal, color:T.ivory, borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:13 }}>Sign up — it's free →</Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'80px 32px 32px', textAlign:'center' }}>
        <h1 className="fu d2" style={{ fontSize:'clamp(32px, 5vw, 54px)', fontWeight:900, lineHeight:1.04, letterSpacing:'-0.04em', color:T.ink, marginBottom:8 }}>
          Your employer taxed what they knew.<br />
          <span style={{ color:T.teal }} className="highlight">Not what's true for you.</span>
        </h1>

        <p className="fu d3" style={{ fontSize:'clamp(15px,2vw,18px)', color:T.muted, margin:'20px auto 32px', maxWidth:520, lineHeight:1.75, fontWeight:400 }}>
          One slip. Your real tax — and which regime it belongs in.
        </p>

        {/* Quick calculator */}
        <div className="fu d4" style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:16, padding:'24px 28px', maxWidth:440, margin:'0 auto 12px', textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.teal, marginBottom:12 }}>Quick estimate — what's your monthly salary?</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:taxSaving !== null ? 14 : 0 }}>
            <div style={{ display:'flex', flex:1, border:`1.5px solid ${T.hairline}`, borderRadius:10, overflow:'hidden', background:T.card }}>
              <span style={{ padding:'11px 12px', fontSize:15, color:T.teal, fontWeight:700, borderRight:`1px solid ${T.hairline}` }}>₹</span>
              <input type="tel" value={salary} onChange={e => { setSalary(e.target.value); calcQuickSaving(e.target.value) }}
                placeholder="e.g. 1,20,000" className="salary-input"
                style={{ flex:1, padding:'11px 12px', border:'none', fontSize:14, fontFamily:'"Sora",sans-serif' }} />
            </div>
            <Link href="/signup" className="btn-green"
              style={{ padding:'11px 18px', background:T.teal, color:T.ivory, borderRadius:10, fontWeight:700, fontSize:13, textDecoration:'none', whiteSpace:'nowrap' as const }}>
              Check now →
            </Link>
          </div>
          {taxSaving !== null && (
            <div style={{ marginTop:14, borderTop:`1px solid ${T.hairline}`, paddingTop:14 }}>
              <div style={{ fontSize:12, color:T.muted, marginBottom:14 }}>You're on one of these two. Probably without choosing.</div>
              <div style={{ display:'flex', gap:10, marginBottom:6 }}>
                <div style={{ flex:1, background:T.paper, border:`1px solid ${T.hairline}`, borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:4 }}>New regime</div>
                  <div style={{ fontSize:20, fontWeight:800, color:T.ink, letterSpacing:'-0.02em' }}>₹{taxSaving.newTax.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ flex:1, background:T.paper, border:`1px solid ${T.hairline}`, borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:4 }}>Old regime</div>
                  <div style={{ fontSize:20, fontWeight:800, color:T.ink, letterSpacing:'-0.02em' }}>₹{taxSaving.oldTax.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:T.faint, marginBottom:14 }}>on ₹{taxSaving.monthly.toLocaleString('en-IN')}/month · before your deductions</div>
              <div style={{ fontSize:12.5, color:T.muted, lineHeight:1.6, marginBottom:14 }}>Which one's actually yours depends on what you can claim — and running the comparison is the only way to know.</div>
              <div style={{ fontSize:10.5, color:T.faint, lineHeight:1.5, marginBottom:14 }}>Estimate on salary alone — your deductions change it.</div>
              <Link href="/signup" className="btn-green" style={{ display:'inline-block', padding:'11px 20px', background:T.teal, color:T.ivory, borderRadius:10, fontWeight:700, fontSize:13, textDecoration:'none' }}>See which one's yours →</Link>
            </div>
          )}
        </div>

        <div style={{ fontSize:11, color:T.faint, marginTop:8 }}>No signup needed for the estimate. Free, forever.</div>
      </div>

      {/* Demo */}
      <div style={{ maxWidth:1080, margin:'0 auto', padding:'8px 32px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <span style={{ fontSize:10, color:T.faint, fontWeight:700, letterSpacing:'0.25em', textTransform:'uppercase' as const }}>See it in action</span>
        </div>
        <div style={{ borderRadius:20, overflow:'hidden', border:`1.5px solid ${T.hairline}`, boxShadow:'0 8px 48px rgba(14,77,71,0.1)' }}>
          <BgDemo monthly={taxSaving?.monthly ?? null} />
        </div>
      </div>

      {/* Pain section */}
      <div style={{ padding:'40px 52px 80px', background:T.paper }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:11, color:T.teal, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' as const, marginBottom:12 }}>Why ArthVo exists</div>
            <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:900, letterSpacing:'-0.03em', color:T.ink, lineHeight:1.1 }}>
              We've all been there.
            </h2>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:18 }}>
            {[
              {
                statement: 'You picked a regime once. Maybe.',
                body: 'Most people never ran the comparison — they ticked a box in an HR form years ago.',
                answer: 'ArthVo shows you both regimes on your actual salary.',
              },
              {
                statement: 'Your payslip is written for payroll software, not for you.',
                body: 'Basic, special allowance, employer PF — what does any of it mean for your tax?',
                answer: 'ArthVo turns it into plain numbers.',
              },
              {
                statement: 'A CA charges thousands to answer one question.',
                body: 'And the question — old or new regime? — changes every year.',
                answer: 'The comparison here is free, in minutes.',
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
      <div style={{ padding:'80px 52px', background:T.paper }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:11, color:T.teal, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' as const, marginBottom:12 }}>How it works</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, letterSpacing:'-0.03em', color:T.ink }}>
              From slip to answer. In minutes.
            </h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
            {[
              { num:'01', icon:'📑', title:'Add your payslip', body:'ArthVo reads it for you — no manual typing.' },
              { num:'02', icon:'🤖', title:'It pulls your income', body:'Your salary and the earnings it can read from your documents.' },
              { num:'03', icon:'📊', title:'See what you owe', body:'Old vs new regime, side by side, on your numbers.' },
              { num:'04', icon:'💡', title:'Know your next step', body:'Which regime fits and what to check — in plain English.' },
            ].map((s, i) => (
              <div key={i} style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:14, padding:'24px 20px', position:'relative' as const }}>
                <div style={{ position:'absolute' as const, top:16, right:16, fontSize:11, fontWeight:900, color:T.hairline, letterSpacing:'0.05em' }}>{s.num}</div>
                <div style={{ fontSize:32, marginBottom:14 }}>{s.icon}</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink, marginBottom:8 }}>{s.title}</div>
                <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA — dark section: eyebrow/accents → green, headline → ivory, CTA button → green (teal would vanish on dark) */}
      <div style={{ background:T.ink, padding:'72px 48px', textAlign:'center' }}>
        <div style={{ fontSize:11, color:T.green, fontWeight:700, letterSpacing:'0.2em', marginBottom:16, textTransform:'uppercase' as const }}>
          One slip is all it takes
        </div>
        <h2 style={{ fontSize:'clamp(32px,5vw,60px)', fontWeight:900, letterSpacing:'-0.04em', color:T.ivory, lineHeight:1.05, marginBottom:20 }}>
          Know what you owe.<br />
          <span style={{ color:T.green }}>And which regime is yours.</span>
        </h2>
        <p style={{ fontSize:16, color:'rgba(244,238,224,0.5)', marginBottom:44, maxWidth:400, margin:'0 auto 44px', lineHeight:1.75 }}>
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
            <div key={t} style={{ fontSize:12, color:'rgba(244,238,224,0.3)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:T.green }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', padding:'20px 48px', background:T.ink, fontSize:11, color:'rgba(244,238,224,0.2)' }}>
        ArthVo helps you read your salary slip and compare tax regimes. Consult a CA for ITR filing. © 2025 ArthVo
        {' · '}
        <a href="/privacy" style={{ color:'rgba(244,238,224,0.3)', textDecoration:'underline' }}>Privacy</a>
      </div>
    </div>
  )
}
