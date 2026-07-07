'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import BgDemo from '@/components/BgDemo'
import DataAssurance from '@/components/DataAssurance'
import Logo from '@/components/Logo'
import { ThemeToggle, type ThemeMode } from '@/components/ThemeToggle'
import { tokens as T } from '@/lib/tokens'
import { estimateAnnualTax } from '@/lib/tax-slabs'

export default function LandingPage() {
  const [salary, setSalary] = useState('')
  const [taxSaving, setTaxSaving] = useState<{ monthly: number; newTax: number; oldTax: number } | null>(null)
  // Hero photo fallback — if /hero/hero.jpg is missing or fails to load, the .photo-hero gradient shows.
  const [heroError, setHeroError] = useState(false)

  // Theme: identical logic to dashboard/layout.tsx (same av_theme key, same default, same resolution),
  // so a choice made here matches the dashboard and vice versa. 'system' follows prefers-color-scheme;
  // 'light'/'dark' force. Synchronous, window-guarded initializers resolve the right value on first paint.
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem('av_theme') as ThemeMode | null)) || 'system'
  )
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const setTheme = (t: ThemeMode) => {
    setThemeState(t)
    try { localStorage.setItem('av_theme', t) } catch {}
  }
  const resolved: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Base background: the page's root div is themed, but html/body are not — so an overscroll/bounce
  // past the content shows the default light body through. Mirror the page theme onto <html> (so the
  // existing tokens resolve per mode) and keep the rubber-band bounce (it signals page end).
  //
  // Two-tone rebound: the overscroll stretch is painted by the canvas, which only ever takes the
  // root's single solid background-color (a gradient/fixed image can't fill it). So to make each end
  // match the section it borders, we swap that color as the user crosses the page midpoint — top half
  // → --paper (matches the header/hero), bottom half → the footer band's color (--ink in light,
  // --paper in dark; same conditional the footer uses). You can only rubber-band at an end you've
  // already scrolled to, and the swap sits behind opaque sections, so it's invisible mid-scroll and
  // only shows in the rebound. color-scheme is mirrored too so native chrome follows the theme.
  // Scoped to this route: everything is restored on unmount so other routes (e.g. the dashboard) are
  // untouched. (Existing tokens only — no new color.)
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      theme: html.getAttribute('data-theme'),
      htmlBg: html.style.background, htmlScheme: html.style.colorScheme,
      bodyBg: body.style.background,
    }
    html.setAttribute('data-theme', resolved)
    html.style.colorScheme = resolved
    body.style.background = 'var(--paper)'

    const topColor = 'var(--paper)'
    const bottomColor = resolved === 'dark' ? 'var(--paper)' : 'var(--ink)'
    const applyEdge = () => {
      const max = html.scrollHeight - window.innerHeight
      const pastMid = max > 0 && window.scrollY > max / 2
      html.style.background = pastMid ? bottomColor : topColor
    }
    applyEdge()
    window.addEventListener('scroll', applyEdge, { passive: true })
    window.addEventListener('resize', applyEdge)
    return () => {
      window.removeEventListener('scroll', applyEdge)
      window.removeEventListener('resize', applyEdge)
      if (prev.theme === null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', prev.theme)
      html.style.colorScheme = prev.htmlScheme
      html.style.background = prev.htmlBg
      body.style.background = prev.bodyBg
    }
  }, [resolved])

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
    const target = document.getElementById('demo-reveal')
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 84  // sticky nav + breathing room
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  // Hand-off from the hero-journey final frame → the live quick-estimate widget (brief Change 1).
  const goToEstimate = () => {
    const el = document.getElementById('quick-estimate')
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 84
    window.scrollTo({ top: y, behavior: 'smooth' })
    el.querySelector('input')?.focus()
  }

  return (
    <div data-theme={resolved} suppressHydrationWarning style={{ minHeight: '100vh', background: T.paper, color: T.ink, fontFamily: '"Sora",-apple-system,sans-serif', overflowX: 'hidden' }}>
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
        /* Photo hero — full-bleed pre-graded image (teal duotone + baked left scrim). Headline overlaid
           on the LEFT (desktop) / anchored to the BOTTOM over a scrim (mobile). NO CSS colour overlay on
           desktop — the grade is baked in; a second layer would double-darken. */
        .photo-hero{position:relative;width:100%;height:clamp(400px,60vh,600px);overflow:hidden;background:linear-gradient(120deg,var(--sand) 0%,var(--paper) 52%,var(--tint) 100%)}
        .photo-hero-img{object-fit:cover;object-position:50% center}
        .photo-hero-scrim{position:absolute;inset:0;pointer-events:none;display:none}
        .photo-hero-copy{position:absolute;inset:0;max-width:1120px;margin:0 auto;padding:0 52px;display:flex;flex-direction:column;justify-content:center}
        .photo-hero-copy-inner{max-width:600px}
        /* FIXED overlay colours (not theme tokens): the photo is identical in light & dark, so the text
           must not flip with the theme. The baked LEFT SCRIM darkens this zone (measured ~0.09 lum), so
           LIGHT text reads on it — no CSS image overlay needed (per spec). The text-shadow is a per-glyph
           halo (not an image overlay), added as legibility insurance where the grade lightens. */
        .ph-title{color:#F6F1E6;text-shadow:0 1px 18px rgba(0,0,0,0.42)}
        .ph-accent{color:#F1D69C;text-shadow:0 1px 18px rgba(0,0,0,0.42)}
        .ph-sub{color:rgba(246,241,230,0.92);text-shadow:0 1px 14px rgba(0,0,0,0.38)}
        .demo-regime{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .demo-slots{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        @media (max-width:900px){ .pain-grid{grid-template-columns:1fr} .hiw-grid{grid-template-columns:repeat(2,1fr)} }
        @media (max-width:768px){ .nav-bar{padding:12px 20px} .hero-sec{padding:56px 20px 24px} .demo-wrap{padding:4px 16px 24px} .pain-sec{padding:32px 20px 24px} .hiw-sec{padding:56px 20px} .cta-sec{padding:56px 24px} .footer-bar{padding:16px 20px}
          .photo-hero{height:clamp(440px,74vh,560px)} .photo-hero-img{object-position:70% center} .photo-hero-copy{justify-content:flex-end;padding:0 22px 34px}
          .photo-hero-scrim{display:block;background:linear-gradient(to top,rgba(9,14,12,0.82) 4%,rgba(9,14,12,0.38) 42%,rgba(9,14,12,0) 72%)} }
        @media (max-width:560px){ .hiw-grid{grid-template-columns:1fr} .demo-slots{grid-template-columns:1fr} }
        @media (max-width:480px){ .demo-regime{grid-template-columns:1fr} .demo-topbar{flex-wrap:wrap;row-gap:4px} }
        @media (max-width:430px){ .nav-actions{gap:6px} .nav-cta{padding-left:13px!important;padding-right:13px!important} }
      `}</style>

      {/* Sticky nav */}
      <nav className="nav-bar" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${T.hairline}`, position:'sticky', top:0, background: resolved === 'dark' ? 'rgba(20,30,27,0.85)' : 'rgba(248,242,231,0.95)', backdropFilter:'blur(8px)', zIndex:50 }}>
        <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:11 }}>
          <Logo variant="onLight" size={32} />
        </Link>
        <div className="nav-actions" style={{ display:'flex', gap:8, alignItems:'center' }}>
          <ThemeToggle theme={theme} setTheme={setTheme} resolved={resolved} />
          <Link href="/login" className="btn-ghost nav-cta" style={{ padding:'8px 20px', background:'transparent', border:`1px solid ${T.hairline}`, borderRadius:8, color:T.muted, fontWeight:500, textDecoration:'none', fontSize:13, whiteSpace:'nowrap' as const }}>Sign in</Link>
          <Link href="/signup" className="btn-green nav-cta" style={{ padding:'9px 22px', background:T.teal, color:T.ivory, borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:13, whiteSpace:'nowrap' as const }}>Sign up →</Link>
        </div>
      </nav>

      {/* PHOTO HERO — replaces the animated hero on this page (HeroJourney was imported only here).
          Pre-graded photo via next/image; live headline overlaid on the left. No CSS colour overlay on
          desktop (grade is baked in). Static gradient fallback shows if the image is missing/errors. */}
      <section className="photo-hero">
        {!heroError && (
          <Image src="/hero/hero.jpg" alt="A salaried professional reviewing a payslip at a laptop"
            fill priority sizes="100vw" className="photo-hero-img" onError={() => setHeroError(true)} />
        )}
        <div className="photo-hero-scrim" aria-hidden />
        <div className="photo-hero-copy">
          <div className="photo-hero-copy-inner fu d2">
            <h1 className="ph-title" style={{ fontSize:'clamp(27px,4.4vw,48px)', fontWeight:900, lineHeight:1.06, letterSpacing:'-0.03em', margin:0 }}>
              Your employer taxed<br />what they knew.
              <span className="ph-accent" style={{ display:'block' }}>Not what&apos;s true for you.</span>
            </h1>
            <p className="ph-sub" style={{ fontSize:'clamp(14px,2vw,18px)', lineHeight:1.6, margin:'16px 0 22px', maxWidth:430, fontWeight:400 }}>
              One slip. Your real tax — and which regime it belongs in.
            </p>
            <button onClick={goToEstimate} className="btn-green" style={{ padding:'13px 26px', background:T.teal, color:T.ivory, borderRadius:10, fontWeight:800, fontSize:15, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              See your real tax →
            </button>
          </div>
        </div>
      </section>

      {/* HERO widget */}
      <div className="hero-sec" style={{ maxWidth:1000, margin:'0 auto', textAlign:'center' }}>
        {/* Quick calculator */}
        <div id="quick-estimate" className="fu d4" style={{ background:T.card, border:`1.5px solid ${T.hairline}`, borderRadius:16, padding:'24px 28px', maxWidth:440, margin:'0 auto 12px', textAlign:'left' }}>
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
          {/* Pricing (Change 2) + data-handling assurance (Change 3), placed here so both sit ABOVE
              the fold, next to the first CTA (acceptance #4). Change 2 reinstates the word "free",
              deliberately reversing the session-4 "free retired" positioning call — logged for Kartik.
              Change 3 states ONLY the founder-cleared claim ("never seen by a human"); the "never sold"
              and retention (deleted / stored-encrypted) claims are NOT yet confirmed, so they are
              intentionally omitted here — do not add them without founder sign-off. */}
          <div style={{ marginTop:12, display:'flex', flexWrap:'wrap' as const, alignItems:'center', gap:'4px 12px', fontSize:11, color:T.muted }}>
            <span>No signup needed.</span>
            <span style={{ color:T.green, fontWeight:700 }}>Free during early access.</span>
          </div>
          <DataAssurance style={{ marginTop:8 }} />
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
                statement: 'You chose a regime and forgot.',
                body: 'Most people never ran the comparison — they ticked a box and never looked again.',
                answer: 'ArthVo shows you both regimes on your actual salary.',
              },
              {
                statement: 'Your salary slip is written for payroll software, not for you.',
                body: 'Basic, special allowance, employer PF — what does any of it mean for your tax?',
                answer: 'ArthVo turns it into plain numbers.',
              },
              {
                statement: 'You hand it to a tax consultant and hope.',
                body: 'It gets filed, the fee gets paid — and it\'s still your money you can\'t explain.',
                answer: 'See it yourself — no consultant needed.',
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

      {/* Credibility block (Change 4) — ICAI-compliant: institutional voice only, NO individual name,
          photo, membership number or firm, and NO invitation to engage CA services. The copy is the
          founder's own, verbatim from the brief. NOTE: the collective "built by chartered accountants"
          is a factual claim about authorship — founder-provided but not separately re-confirmed here;
          if it should not be asserted, this whole block is a clean removal. */}
      <div className="pain-sec" style={{ background:T.paper, paddingTop:0 }}>
        <div style={{ maxWidth:720, margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:'0.3em', textTransform:'uppercase' as const, marginBottom:16 }}>Who builds ArthVo</div>
          <p style={{ fontSize:'clamp(15px,2.2vw,19px)', color:T.ink, lineHeight:1.7, fontWeight:400 }}>
            ArthVo is built by chartered accountants who spent years watching the same story: clients discovering at filing time that they&apos;d overpaid all year — money they could have kept if anyone had explained their own salary slip to them. This is that explanation, automated.
          </p>
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
              { num:'02', title:'It pulls your income', body:'Reads your salary slip and pulls out every figure.' },
              { num:'03', title:'See what you owe', body:'Old vs new regime, side by side, on your numbers.' },
              { num:'04', title:'Know what to do next', body:'The regime to pick and what to check — in plain English.' },
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
      <div className="cta-sec" style={{ background: resolved === 'dark' ? T.paper : T.ink, textAlign:'center' }}>
        <div style={{ fontSize:11, color:T.green, fontWeight:700, letterSpacing:'0.2em', marginBottom:16, textTransform:'uppercase' as const }}>
          One slip is all it takes
        </div>
        <h2 style={{ fontSize:'clamp(32px,5vw,60px)', fontWeight:900, letterSpacing:'-0.04em', color:T.ivory, lineHeight:1.05, marginBottom:20 }}>
          Your tax. Your regime.<br />
          <span style={{ color:T.green }}><span style={{ whiteSpace:'nowrap' }}>Settled.</span></span>
        </h2>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as const }}>
          <Link href="/try" className="btn-green"
            style={{ display:'inline-flex', alignItems:'center', gap:12, padding:'16px 40px', background:T.green, color:T.ivory, borderRadius:12, fontWeight:800, textDecoration:'none', fontSize:17, letterSpacing:'-0.01em' }}>
            See which one's yours →
          </Link>
        </div>
        {/* Pricing repeated near the final CTA (Change 2), incl. the optional extended-access line. */}
        <div style={{ marginTop:16, fontSize:13, color:'rgba(244,238,224,0.85)', lineHeight:1.6 }}>
          <strong style={{ color:T.green, fontWeight:700 }}>Free during early access.</strong> Early users keep extended free access.
        </div>
        <div style={{ marginTop:16, display:'flex', justifyContent:'center', gap:28, flexWrap:'wrap' as const }}>
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
