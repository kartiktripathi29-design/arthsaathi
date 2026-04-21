'use client'
import { useEffect, useState, useRef } from 'react'

const SLIDES = [
  { nav: 'AIS / 26AS', navIdx: 0, content: 'ais' },
  { nav: 'Salary Slip', navIdx: 1, content: 'salary' },
  { nav: 'Other Income', navIdx: 2, content: 'other' },
  { nav: 'Tax Optimiser', navIdx: 4, content: 'tax' },
  { nav: 'AI Advisor', navIdx: 5, content: 'chat' },
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
    wrap: { width: '100%', background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', fontFamily: '"Sora",-apple-system,sans-serif', position: 'relative' },
    topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '1px solid #F0FDF4' },
    nav: { display: 'flex', gap: 2, padding: '6px 10px', borderBottom: '1px solid #F0FDF4', overflowX: 'hidden' as const, background: '#FAFDFB' },
    navItem: { padding: '4px 9px', borderRadius: 6, fontSize: 9, fontWeight: 500, color: '#64748B', whiteSpace: 'nowrap' as const },
    navActive: { background: '#059669', color: '#FFFFFF', fontWeight: 700 },
    content: { padding: 14, transition: 'opacity 0.4s ease', opacity: visible ? 1 : 0 },
    card: { background: '#F8FFFE', border: '1px solid #D1FAE5', borderRadius: 9, padding: 10, marginBottom: 7 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0FDF4', fontSize: 10 },
    parseOk: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 6, marginBottom: 4, fontSize: 10, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' },
    parseWarn: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 6, marginBottom: 4, fontSize: 10, background: '#FEF3C7', border: '1px solid #FCD34D', color: '#78350F' },
    greenCard: { background: '#F0FDF4', border: '2px solid #059669', borderRadius: 9, padding: 10, marginBottom: 6 },
    chatU: { borderRadius: '10px 10px 2px 10px', padding: '7px 10px', fontSize: 10, lineHeight: 1.6, marginBottom: 5, maxWidth: '85%', background: '#059669', color: '#FFFFFF', fontWeight: 500, marginLeft: 'auto' as const },
    chatA: { borderRadius: '10px 10px 10px 2px', padding: '7px 10px', fontSize: 10, lineHeight: 1.6, marginBottom: 5, maxWidth: '88%', background: '#F1F5F9', color: '#1E293B', border: '1px solid #E2E8F0' },
  }

  return (
    <div style={s.wrap}>
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 120 120" fill="none">
            <rect width="120" height="120" rx="14" fill="#059669"/>
            <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#FFFFFF"/>
            <circle cx="90" cy="24" r="18" fill="#FFFFFF"/>
            <circle cx="90" cy="24" r="11" fill="#059669"/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#1E293B' }}>Arth<span style={{ color: '#059669' }}>Vo</span></span>
        </div>
        <span style={{ fontSize: 9, color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 6px', borderRadius: 20, fontWeight: 600 }}>SEBI RIA</span>
      </div>

      <div style={s.nav}>
        {NAV_ITEMS.map((item, i) => (
          <div key={i} style={{ ...s.navItem, ...(i === slide.navIdx ? s.navActive : {}) }}>{item}</div>
        ))}
      </div>

      <div style={s.content}>
        {slide.content === 'ais' && (
          <>
            <div style={{ fontSize: 8, color: '#059669', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Upload your AIS — start here</div>
            <div style={{ border: '1.5px dashed #A7F3D0', borderRadius: 9, padding: '18px 14px', textAlign: 'center', marginBottom: 10, background: '#F8FFFE' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📑</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', marginBottom: 3 }}>Annual_Information_Statement.pdf</div>
              <div style={{ fontSize: 9, color: '#64748B', marginBottom: 10 }}>Password protected · incometax.gov.in</div>
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, padding: '5px 10px', fontSize: 9, color: '#065F46', fontWeight: 600, display: 'inline-block' }}>🔓 Decrypting with PAN + DOB…</div>
            </div>
            <div style={s.parseOk}><span>✓</span><span>Salary TDS from Employer — <strong>₹2,13,840</strong></span></div>
            <div style={s.parseOk}><span>✓</span><span>FD Interest — Bank — <strong>₹48,500</strong></span></div>
            <div style={s.parseOk}><span>✓</span><span>Capital Gains (Equity MF) — <strong>₹1,24,300</strong></span></div>
            <div style={s.parseWarn}><span>⚠</span><span>Savings interest ₹2,741 — unreported last year</span></div>
            <div style={{ marginTop: 8, background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: '#065F46', fontWeight: 600 }}>✅ AIS parsed — auto-filling all income tabs</div>
          </>
        )}

        {slide.content === 'salary' && (
          <>
            <div style={{ background: '#1E293B', borderRadius: 11, padding: 13, marginBottom: 9 }}>
              <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>SALARY ANALYSIS — PARSED BY AI</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 8, color: '#94A3B8' }}>MONTHLY TAKE-HOME</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#34D399' }}>₹1,63,089</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 8, color: '#94A3B8' }}>GROSS</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>₹2,00,410</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                <div style={{ height: 5, background: '#34D399', borderRadius: 3, width: '81%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 8, color: '#94A3B8' }}>
                <span>Take-Home 81%</span><span>Deductions 19%</span>
              </div>
            </div>
            <div style={s.card}>
              <div style={{ ...s.row, color: '#475569' }}><span>Basic Salary</span><span style={{ color: '#1E293B', fontWeight: 600 }}>₹91,260</span></div>
              <div style={{ ...s.row, color: '#475569' }}><span>Special Allowance</span><span style={{ color: '#1E293B', fontWeight: 600 }}>₹61,257</span></div>
              <div style={{ ...s.row, color: '#475569' }}><span>Other Allowances</span><span style={{ color: '#1E293B', fontWeight: 600 }}>₹47,892</span></div>
              <div style={{ ...s.row, borderBottom: 'none', color: '#DC2626' }}><span>EPF + TDS Deducted</span><span style={{ fontWeight: 600 }}>−₹37,321</span></div>
            </div>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: '#065F46', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Annual CTC</span><span>₹25.36L</span>
            </div>
          </>
        )}

        {slide.content === 'other' && (
          <>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: '#065F46', marginBottom: 10 }}>✅ 3 sources auto-filled from your AIS — nothing to type</div>
            {[
              { icon: '📊', label: 'LTCG — Equity / MF', sub: 'Held >12 months · 12.5% above ₹1.25L', val: '₹1,24,300' },
              { icon: '🏦', label: 'FD Interest', sub: 'Taxable at slab rate', val: '₹48,500' },
              { icon: '💰', label: 'Savings Interest', sub: '₹10K exempt under 80TTA', val: '₹2,741' },
            ].map((item, i) => (
              <div key={i} style={s.greenCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#059669' }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: 9, color: '#64748B', marginTop: 1 }}>{item.sub}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>{item.val}</div>
                </div>
              </div>
            ))}
            <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#475569' }}>Total Other Income</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>₹1,75,541</span>
            </div>
          </>
        )}

        {slide.content === 'tax' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 9, padding: 11 }}>
                <div style={{ fontSize: 8, color: '#DC2626', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>OLD REGIME</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>₹2,80,000</div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 7 }}>Tax payable</div>
                <div style={{ fontSize: 9, color: '#64748B', lineHeight: 1.8 }}>✓ 80C: ₹1,50,000<br/>✓ 80D: ₹25,000</div>
              </div>
              <div style={{ background: '#F0FDF4', border: '2px solid #059669', borderRadius: 9, padding: 11, position: 'relative' as const }}>
                <div style={{ position: 'absolute' as const, top: -8, right: 10, background: '#059669', color: '#FFFFFF', fontSize: 8, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>RECOMMENDED</div>
                <div style={{ fontSize: 8, color: '#059669', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>NEW REGIME</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>₹2,12,000</div>
                <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 7 }}>Tax payable</div>
                <div style={{ fontSize: 9, color: '#64748B', lineHeight: 1.8 }}>✓ Std: ₹75,000<br/>✓ Better slabs</div>
              </div>
            </div>
            <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>Switch to New Regime</div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>Based on your income & deductions</div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#059669' }}>₹68K</div>
                <div style={{ fontSize: 8, color: '#94A3B8' }}>saved this year</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[{ v: '₹0', l: 'LTCG tax' }, { v: '24.2%', l: 'Effective rate' }, { v: '₹5,667', l: 'Saved/month' }].map((item, i) => (
                <div key={i} style={{ background: '#F8FFFE', border: '1px solid #D1FAE5', borderRadius: 7, padding: 8, textAlign: 'center' as const }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{item.v}</div>
                  <div style={{ fontSize: 8, color: '#64748B', marginTop: 2 }}>{item.l}</div>
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
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 8, display: 'flex', gap: 6, marginTop: 8 }}>
              <div style={{ flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '7px 10px', fontSize: 9, color: '#94A3B8' }}>Ask anything about your money…</div>
              <div style={{ background: '#059669', borderRadius: 6, padding: '7px 10px', fontSize: 11, color: '#FFFFFF' }}>→</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 12, background: '#FFFFFF' }}>
        {SLIDES.map((_, i) => (
          <div key={i} onClick={() => goTo(i)} style={{ width: i === cur ? 18 : 5, height: 4, borderRadius: 2, background: i === cur ? '#059669' : '#D1FAE5', transition: 'all 0.3s', cursor: 'pointer' }} />
        ))}
      </div>
    </div>
  )
}
