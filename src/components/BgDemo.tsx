'use client'
import { useEffect, useState, useRef } from 'react'

const SLIDES = [
  {
    nav: 'AIS / 26AS',
    navIdx: 0,
    content: 'ais',
  },
  {
    nav: 'Salary Slip',
    navIdx: 1,
    content: 'salary',
  },
  {
    nav: 'Other Income',
    navIdx: 2,
    content: 'other',
  },
  {
    nav: 'Tax Optimiser',
    navIdx: 4,
    content: 'tax',
  },
  {
    nav: 'AI Advisor',
    navIdx: 5,
    content: 'chat',
  },
]

const NAV_ITEMS = ['📑 AIS / 26AS', '📄 Salary', '🏦 Other Income', '📋 Total Income', '📊 Tax Optimiser', '💬 AI Advisor']

export default function BgDemo() {
  const [cur, setCur] = useState(0)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = (n: number) => {
    setVisible(false)
    setTimeout(() => {
      setCur((n + SLIDES.length) % SLIDES.length)
      setVisible(true)
    }, 400)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setCur(prev => (prev + 1) % SLIDES.length)
        setVisible(true)
      }, 400)
    }, 4500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const slide = SLIDES[cur]

  const s: Record<string, React.CSSProperties> = {
    wrap: { width: '100%', background: '#0A1628', borderRadius: 16, overflow: 'hidden', fontFamily: '"Outfit",-apple-system,sans-serif', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' },
    topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    nav: { display: 'flex', gap: 2, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'hidden' as const },
    navItem: { padding: '4px 9px', borderRadius: 6, fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' as const },
    navActive: { background: '#C9A84C', color: '#0F2640', fontWeight: 700 },
    content: { padding: 14, transition: 'opacity 0.4s ease', opacity: visible ? 1 : 0 },
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: 10, marginBottom: 7 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 10 },
    parseOk: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 6, marginBottom: 4, fontSize: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'rgba(255,255,255,0.8)' },
    parseWarn: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 6, marginBottom: 4, fontSize: 10, background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)', color: 'rgba(255,255,255,0.6)' },
    goldCard: { background: 'rgba(201,168,76,0.07)', border: '2px solid #C9A84C', borderRadius: 9, padding: 10, marginBottom: 6 },
    chatU: { borderRadius: '10px 10px 2px 10px', padding: '7px 10px', fontSize: 10, lineHeight: 1.6, marginBottom: 5, maxWidth: '85%', background: '#C9A84C', color: '#0F2640', fontWeight: 500, marginLeft: 'auto' as const },
    chatA: { borderRadius: '10px 10px 10px 2px', padding: '7px 10px', fontSize: 10, lineHeight: 1.6, marginBottom: 5, maxWidth: '88%', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.08)' },
  }

  return (
    <div style={s.wrap}>
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 120 120" fill="none"><rect width="120" height="120" rx="14" fill="#C9A84C"/><polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#0F2640"/><circle cx="90" cy="24" r="18" fill="#C9A84C"/><circle cx="90" cy="24" r="11" fill="#0F2640"/></svg>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>Arth<span style={{ color: '#C9A84C' }}>Vo</span></span>
        </div>
        <span style={{ fontSize: 9, color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', padding: '2px 6px', borderRadius: 20, fontWeight: 600 }}>SEBI RIA</span>
      </div>

      {/* Nav */}
      <div style={s.nav}>
        {NAV_ITEMS.map((item, i) => (
          <div key={i} style={{ ...s.navItem, ...(i === slide.navIdx ? s.navActive : {}) }}>{item}</div>
        ))}
      </div>

      {/* Content */}
      <div style={s.content}>
        {slide.content === 'ais' && (
          <>
            <div style={{ fontSize: 8, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Upload your AIS — start here</div>
            <div style={{ border: '1.5px dashed rgba(201,168,76,0.35)', borderRadius: 9, padding: '18px 14px', textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📑</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', marginBottom: 3 }}>Annual_Information_Statement.pdf</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>Password protected · incometax.gov.in</div>
              <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6, padding: '5px 10px', fontSize: 9, color: '#C9A84C', fontWeight: 600, display: 'inline-block' }}>🔓 Decrypting with PAN + DOB…</div>
            </div>
            <div style={s.parseOk}><span style={{ color: '#4ADE80' }}>✓</span><span>Salary TDS from Employer — <strong>₹2,13,840</strong></span></div>
            <div style={s.parseOk}><span style={{ color: '#4ADE80' }}>✓</span><span>FD Interest — Bank — <strong>₹48,500</strong></span></div>
            <div style={s.parseOk}><span style={{ color: '#4ADE80' }}>✓</span><span>Capital Gains (Equity MF) — <strong>₹1,24,300</strong></span></div>
            <div style={s.parseWarn}><span style={{ color: '#FCD34D' }}>⚠</span><span>Savings interest ₹2,741 — unreported last year</span></div>
            <div style={{ marginTop: 8, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: '#4ADE80', fontWeight: 600 }}>✅ AIS parsed — auto-filling all income tabs</div>
          </>
        )}

        {slide.content === 'salary' && (
          <>
            <div style={{ background: 'linear-gradient(135deg,#0F2640,#1A3C5E)', borderRadius: 11, padding: 13, marginBottom: 9 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>SALARY ANALYSIS — PARSED BY AI</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>MONTHLY TAKE-HOME</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#4ADE80' }}>₹1,63,089</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>GROSS</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>₹2,00,410</div>
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                <div style={{ height: 5, background: '#4ADE80', borderRadius: 3, width: '81%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                <span>Take-Home 81%</span><span>Deductions 19%</span>
              </div>
            </div>
            <div style={s.card}>
              <div style={{ ...s.row, color: 'rgba(255,255,255,0.5)' }}><span>Basic Salary</span><span style={{ color: '#fff', fontWeight: 600 }}>₹91,260</span></div>
              <div style={{ ...s.row, color: 'rgba(255,255,255,0.5)' }}><span>Special Allowance</span><span style={{ color: '#fff', fontWeight: 600 }}>₹61,257</span></div>
              <div style={{ ...s.row, color: 'rgba(255,255,255,0.5)' }}><span>Other Allowances</span><span style={{ color: '#fff', fontWeight: 600 }}>₹47,892</span></div>
              <div style={{ ...s.row, borderBottom: 'none', color: '#FC8181' }}><span>EPF + TDS Deducted</span><span style={{ fontWeight: 600 }}>−₹37,321</span></div>
            </div>
            <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: '#4ADE80', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Annual CTC</span><span>₹25.36L</span>
            </div>
          </>
        )}

        {slide.content === 'other' && (
          <>
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: '#4ADE80', marginBottom: 10 }}>✅ 3 sources auto-filled from your AIS — nothing to type</div>
            {[
              { icon: '📊', label: 'LTCG — Equity / MF', sub: 'Held >12 months · 12.5% above ₹1.25L', val: '₹1,24,300' },
              { icon: '🏦', label: 'FD Interest', sub: 'Taxable at slab rate', val: '₹48,500' },
              { icon: '💰', label: 'Savings Interest', sub: '₹10K exempt under 80TTA', val: '₹2,741' },
            ].map((item, i) => (
              <div key={i} style={s.goldCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#C9A84C' }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{item.sub}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{item.val}</div>
                </div>
              </div>
            ))}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Total Other Income</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#C9A84C' }}>₹1,75,541</span>
            </div>
          </>
        )}

        {slide.content === 'tax' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ background: 'rgba(252,129,129,0.06)', border: '1.5px solid rgba(252,129,129,0.2)', borderRadius: 9, padding: 11 }}>
                <div style={{ fontSize: 8, color: '#FC8181', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>OLD REGIME</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#FC8181' }}>₹2,80,000</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>Tax payable</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8 }}>✓ 80C: ₹1,50,000<br/>✓ 80D: ₹25,000</div>
              </div>
              <div style={{ background: 'rgba(74,222,128,0.06)', border: '2px solid rgba(74,222,128,0.45)', borderRadius: 9, padding: 11, position: 'relative' as const }}>
                <div style={{ position: 'absolute' as const, top: -8, right: 10, background: '#4ADE80', color: '#0A1628', fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>RECOMMENDED</div>
                <div style={{ fontSize: 8, color: '#4ADE80', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>NEW REGIME</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#4ADE80' }}>₹2,12,000</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>Tax payable</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8 }}>✓ Std: ₹75,000<br/>✓ Better slabs</div>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg,rgba(201,168,76,0.1),rgba(201,168,76,0.05))', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#C9A84C' }}>Switch to New Regime</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Based on your income & deductions</div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#C9A84C' }}>₹68K</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>saved this year</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[{ v: '₹0', l: 'LTCG tax' }, { v: '24.2%', l: 'Effective rate' }, { v: '₹5,667', l: 'Saved/month' }].map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: 8, textAlign: 'center' as const }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: i === 1 ? '#C9A84C' : '#4ADE80' }}>{s.v}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {slide.content === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
            <div style={s.chatU}>How do I save more tax this year?</div>
            <div style={s.chatA}>Switching to New Regime saves ₹68,000 immediately — biggest win based on your data.<br/><br/>Your LTCG of ₹1,24,300 is just under ₹1.25L exemption — zero tax on that. 🎉</div>
            <div style={s.chatU}>Should I invest in ELSS or NPS?</div>
            <div style={s.chatA}>On New Regime — ELSS gives no tax benefit. But as wealth-building: 12–15% historical returns, 3-year lock-in.<br/><br/>NPS better for retirement + tax benefit if you switch to Old Regime.</div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', gap: 6, marginTop: 8 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>Ask anything about your money…</div>
              <div style={{ background: '#C9A84C', borderRadius: 6, padding: '7px 10px', fontSize: 11, color: '#0F2640' }}>→</div>
            </div>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 12 }}>
        {SLIDES.map((_, i) => (
          <div key={i} onClick={() => goTo(i)} style={{ width: i === cur ? 18 : 5, height: 4, borderRadius: 2, background: i === cur ? '#C9A84C' : 'rgba(255,255,255,0.2)', transition: 'all 0.3s', cursor: 'pointer' }} />
        ))}
      </div>

      {/* Bottom fade */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top,#0A1628,transparent)', pointerEvents: 'none' }} />
    </div>
  )
}
