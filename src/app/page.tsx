'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import BgDemo from '@/components/BgDemo'
import { tokens as T } from '@/lib/tokens'

function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="16" fill={T.teal}/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={T.ivory}/>
      <circle cx="90" cy="24" r="18" fill={T.ivory}/>
      <circle cx="90" cy="24" r="11" fill={T.teal}/>
    </svg>
  )
}

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

function StatCard({ num, suffix, label, sublabel, started }: { num: number; suffix: string; label: string; sublabel: string; started: boolean }) {
  const count = useCountUp(num, 1600, started)
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
      <div style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, color: T.green, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: '"Sora",sans-serif' }}>
        {num >= 1000 ? `₹${(count/100).toFixed(0)}L` : count}{suffix}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginTop: 8, fontFamily: '"Sora",sans-serif' }}>{label}</div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>{sublabel}</div>
    </div>
  )
}

const TICKER_ITEMS = [
  '🇮🇳 Made for every working Indian',
  '💸 Most users save ₹68,000 in taxes every year',
  '⚡ Know your exact taxes in under 8 minutes',
  '🔒 Your documents stay private — always',
  '📑 Works with any salary slip from any company',
  '✅ We tell you which tax option saves you more money',
  '🏦 Finds income you forgot you even had',
  '🎯 Trusted, government-registered financial advice',
]

export default function LandingPage() {
  const [statsVisible, setStatsVisible] = useState(false)
  const [salary, setSalary] = useState('')
  const [taxSaving, setTaxSaving] = useState<number | null>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.3 })
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const calcQuickSaving = (s: string) => {
    const monthly = parseFloat(s.replace(/,/g, '')) || 0
    if (!monthly) { setTaxSaving(null); return }
    const annual = monthly * 12
    const saving = Math.max(0, Math.round(annual * 0.06))
    setTaxSaving(saving > 0 ? saving : null)
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
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes wiggle{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
        .fu{animation:fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both}
        .d1{animation-delay:0.05s}.d2{animation-delay:0.2s}.d3{animation-delay:0.35s}.d4{animation-delay:0.5s}
        .ticker-track{display:flex;animation:ticker 28s linear infinite;white-space:nowrap}
        .ticker-track:hover{animation-play-state:paused}
        .wobble:hover{animation:wiggle 0.3s ease}
        .salary-input:focus{outline:none;border-color:var(--teal)!important;box-shadow:0 0 0 3px rgba(14,77,71,0.12)}
        .highlight{position:relative;display:inline-block}
        .highlight::after{content:'';position:absolute;bottom:4px;left:0;width:100%;height:6px;background:var(--tint);z-index:-1;border-radius:2px}
      `}</style>

      {/* Sticky nav */}
      <nav style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 52px', borderBottom:`1px solid ${T.hairline}`, position:'sticky', top:0, background:'rgba(248,242,231,0.95)', backdropFilter:'blur(8px)', zIndex:50 }}>
        <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:11 }}>
          <Logo size={32} />
          <div>
            <div style={{ fontWeight:800, fontSize:19, color:T.ink, letterSpacing:'-0.025em' }}>Arth<span style={{ color:T.teal }}>Vo</span></div>
            <div style={{ fontSize:8, color:T.faint, letterSpacing:'0.18em', marginTop:-1 }}>WEALTH EVOLVED</div>
          </div>
          <span style={{ fontSize:9, background:T.tint, color:T.teal, padding:'3px 8px', borderRadius:20, marginLeft:4, border:`1px solid ${T.slip.border}`, fontWeight:700, letterSpacing:'0.04em' }}>GOV. REGISTERED</span>
        </Link>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/login" className="btn-ghost" style={{ padding:'8px 20px', background:'transparent', border:`1px solid ${T.hairline}`, borderRadius:8, color:T.muted, fontWeight:500, textDecoration:'none', fontSize:13 }}>Sign in</Link>
          <Link href="/signup" className="btn-green" style={{ padding:'9px 22px', background:T.teal, color:T.ivory, borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:13 }}>Sign up — it's free →</Link>
        </div>
      </nav>

      {/* Ticker strip */}
      <div style={{ background:T.tint, borderBottom:`1px solid ${T.hairline}`, padding:'10px 0', overflow:'hidden' }}>
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{ fontSize:12, color:T.teal, fontWeight:500, padding:'0 32px', flexShrink:0 }}>
              {item} <span style={{ color:T.faint, margin:'0 8px' }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* HERO */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'80px 48px 32px', textAlign:'center' }}>
        {/* dark badge on light page — text → ivory, pulse dot → green for visibility */}
        <div className="fu d1" style={{ display:'inline-flex', alignItems:'center', gap:8, background:T.ink, color:T.ivory, padding:'6px 18px', borderRadius:100, fontSize:12, marginBottom:28, fontWeight:600, letterSpacing:'0.02em' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:T.green, display:'inline-block', animation:'pulse 2s infinite' }} />
          ₹68,000 is sitting in your pocket. You just don't know it yet.
        </div>

        <h1 className="fu d2" style={{ fontSize:'clamp(38px, 6.5vw, 72px)', fontWeight:900, lineHeight:1.04, letterSpacing:'-0.04em', color:T.ink, marginBottom:8 }}>
          Stop overpaying tax.<br />
          <span style={{ color:T.teal }} className="highlight">Start this year.</span>
        </h1>

        <p className="fu d3" style={{ fontSize:'clamp(15px,2vw,18px)', color:T.muted, margin:'20px auto 32px', maxWidth:520, lineHeight:1.75, fontWeight:400 }}>
          Upload your government tax document. In 8 minutes, ArthVo shows you exactly how much tax you've been overpaying — and exactly how to get it back.
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
            <div style={{ background:T.slip.fill, borderRadius:8, padding:'10px 14px', fontSize:13, color:T.slip.text, fontWeight:500 }}>
              🎉 You could save approx. <strong style={{ color:T.green }}>₹{taxSaving.toLocaleString('en-IN')}/year</strong> by picking the right tax option.
            </div>
          )}
        </div>

        <div style={{ fontSize:11, color:T.faint, marginTop:8 }}>No signup needed for the estimate. Free, forever.</div>
      </div>

      {/* Demo */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'8px 48px 56px' }}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <span style={{ fontSize:10, color:T.faint, fontWeight:700, letterSpacing:'0.25em', textTransform:'uppercase' as const }}>See it in action</span>
        </div>
        <div style={{ borderRadius:20, overflow:'hidden', border:`1.5px solid ${T.hairline}`, boxShadow:'0 8px 48px rgba(14,77,71,0.1)' }}>
          <BgDemo />
        </div>
      </div>

      {/* Stats strip — dark section: number → green (positive + pops on dark) */}
      <div ref={statsRef} style={{ background:T.ink, padding:'0 48px' }}>
        <div style={{ maxWidth:960, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
          {[
            { num: 6800, suffix: '+', label: 'Average tax saved', sublabel: 'per person, per year' },
            { num: 8, suffix: ' min', label: 'Start to finish', sublabel: 'upload your doc, get your answer' },
            { num: 100, suffix: '%', label: 'Reads any slip', sublabel: 'any company, any format' },
            { num: 0, suffix: ' ₹ fee', label: 'Forever free', sublabel: 'no credit card, no catch' },
          ].map((s, i) => (
            <div key={i} style={{ borderRight: i < 3 ? '1px solid rgba(244,238,224,0.07)' : 'none' }}>
              <StatCard {...s} started={statsVisible} />
            </div>
          ))}
        </div>
      </div>

      {/* Pain section */}
      <div style={{ padding:'80px 52px', background:T.paper }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:11, color:T.teal, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' as const, marginBottom:12 }}>Why ArthVo exists</div>
            <h2 style={{ fontSize:'clamp(26px,4vw,42px)', fontWeight:900, letterSpacing:'-0.03em', color:T.ink, lineHeight:1.1 }}>
              We've all been there.
            </h2>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:18 }}>
            {[
              {
                emoji: '😰',
                pain: '"I got a notice from the Income Tax office for bank interest I didn\'t even know I had to report."',
                fix: 'ArthVo checks your government tax records and tells you about every rupee before the taxman does.',
                tag: 'Tax Notice',
                tagColor: '#DC2626',
              },
              {
                emoji: '🤑',
                pain: '"My CA charges ₹5,000 just to tell me which tax option to pick. Every. Single. Year."',
                fix: 'ArthVo compares both tax options in seconds with YOUR exact numbers. Free. No appointment.',
                tag: 'CA Fees',
                tagColor: '#D97706',
              },
              {
                emoji: '😅',
                pain: '"I sold some mutual funds last year and had no idea I had to report the profit anywhere."',
                fix: 'The government already knows about your profits. ArthVo reads that record and handles it for you.',
                tag: 'Missed Reporting',
                tagColor: '#7C3AED',
              },
            ].map((p, i) => (
              <div key={i} className="pain-card" style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:16, padding:'28px 24px', cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <div style={{ fontSize:32 }} className="wobble">{p.emoji}</div>
                  <span style={{ fontSize:10, fontWeight:700, color:p.tagColor, background:`${p.tagColor}12`, padding:'3px 10px', borderRadius:20, border:`1px solid ${p.tagColor}30` }}>{p.tag}</span>
                </div>
                <div style={{ fontSize:14, color:T.muted, fontStyle:'italic', marginBottom:16, lineHeight:1.75, paddingLeft:14, borderLeft:`2px solid ${T.hairline}` }}>{p.pain}</div>
                <div style={{ fontSize:13, color:T.green, fontWeight:600, lineHeight:1.68, display:'flex', gap:8 }}>
                  <span>✓</span><span>{p.fix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding:'80px 52px', background:T.paper }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <div style={{ fontSize:11, color:T.teal, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' as const, marginBottom:12 }}>How it works</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, letterSpacing:'-0.03em', color:T.ink }}>
              4 steps. 8 minutes. Done.
            </h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
            {[
              { num:'01', icon:'📑', title:'Upload your tax document', body:'Download it from the Income Tax website. ArthVo reads it instantly — no manual typing needed.' },
              { num:'02', icon:'🤖', title:'We find everything', body:'Your salary, bank interest, profits from selling shares or property — all found automatically.' },
              { num:'03', icon:'📊', title:'See exactly what you owe', body:'Two tax options compared side by side. We tell you which one puts more money back in your pocket.' },
              { num:'04', icon:'💡', title:'Get a clear plan', body:'Where to invest, what to claim, how to legally pay less tax. Proper advice — not guesswork.' },
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
      <div style={{ background:T.ink, padding:'100px 48px', textAlign:'center' }}>
        <div style={{ fontSize:11, color:T.green, fontWeight:700, letterSpacing:'0.2em', marginBottom:20, textTransform:'uppercase' as const }}>
          Your CA doesn't want you to read this
        </div>
        <h2 style={{ fontSize:'clamp(32px,5vw,60px)', fontWeight:900, letterSpacing:'-0.04em', color:T.ivory, lineHeight:1.05, marginBottom:20 }}>
          Know exactly what you owe.<br />
          <span style={{ color:T.green }}>Keep the rest.</span>
        </h2>
        <p style={{ fontSize:16, color:'rgba(244,238,224,0.5)', marginBottom:44, maxWidth:400, margin:'0 auto 44px', lineHeight:1.75 }}>
          Free forever. No credit card. Takes 8 minutes.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as const }}>
          <Link href="/signup" className="btn-green"
            style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'16px 40px', background:T.green, color:T.ivory, borderRadius:12, fontWeight:800, textDecoration:'none', fontSize:17, letterSpacing:'-0.01em' }}>
            Start saving tax — free →
          </Link>
        </div>
        <div style={{ marginTop:24, display:'flex', justifyContent:'center', gap:28, flexWrap:'wrap' as const }}>
          {['No credit card needed', 'Free to try, no signup', 'Government-registered advisors'].map(t => (
            <div key={t} style={{ fontSize:12, color:'rgba(244,238,224,0.3)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color:T.green }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', padding:'20px 48px', background:T.ink, fontSize:11, color:'rgba(244,238,224,0.2)' }}>
        ArthVo provides general financial guidance. Consult a CA for ITR filing. © 2025 ArthVo
        {' · '}
        <a href="/privacy" style={{ color:'rgba(244,238,224,0.3)', textDecoration:'underline' }}>Privacy</a>
      </div>
    </div>
  )
}
