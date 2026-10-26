'use client'
// Investing basics — an EDUCATION page, not an investment adviser. ArthVo is not SEBI-registered, so
// this page explains how common Indian savings/investment options work (lock-in, risk, tax treatment)
// and never recommends products, allocations, amounts or expected returns for the user. The one
// personal touch is factual: which regime "Your Tax" computed as lower, so the user knows whether the
// old-regime-only tax breaks apply to them. Gated by INVEST_GUIDE_ENABLED (src/lib/phase.ts).
// The personalised AI plan route (/api/invest) stays behind PHASE_2_ENABLED and is not used here.
import { useState, useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { INVEST_GUIDE_ENABLED } from '@/lib/phase'
import { tokens as T } from '@/lib/tokens'

const C = { fg:T.teal, wl:T.sand, wm:T.taupeLine, card:T.card, border:T.hairline, text:T.ink, muted:T.muted, faint:T.faint }

type Horizon = 'short' | 'medium' | 'long'

const HORIZONS: { key: Horizon; label: string; sub: string; body: string; options: string[] }[] = [
  {
    key: 'short', label: 'Under 3 years', sub: 'Emergency fund, a trip, a gadget',
    body: 'Money you need soon usually sits where its value doesn\'t swing much, because there\'s no time to recover from a fall. The trade-off is lower growth.',
    options: ['Savings account', 'Fixed or recurring deposit', 'Liquid fund'],
  },
  {
    key: 'medium', label: '3 to 7 years', sub: 'Home down payment, wedding',
    body: 'People often mix stable options with some market-linked ones here — enough growth to beat inflation, without the whole amount riding on the market close to the date.',
    options: ['Fixed deposit', 'Debt fund', 'Hybrid fund', 'Some equity fund'],
  },
  {
    key: 'long', label: 'Over 7 years', sub: 'Retirement, child\'s education',
    body: 'Over long periods, market-linked options have historically had time to ride out bad years, so long goals are where equity is most often used. Past returns don\'t guarantee future ones.',
    options: ['Equity or index fund', 'PPF', 'NPS (retirement)'],
  },
]

// Which regime "Your Tax" computed as lower (persisted by the optimizer). Null until they've been there,
// and on the server — so the regime note renders only after hydration.
const readRegime = (): 'old' | 'new' | null => {
  try {
    const r = JSON.parse(localStorage.getItem('av_tax_overview') || 'null')?.recommendation
    return r === 'old' || r === 'new' ? r : null
  } catch { return null }
}
const noSubscribe = () => () => {}

interface Product {
  name: string
  what: string
  lockIn: string
  risk: string
  tax: string
  oldRegimeBreak?: string   // the deduction it qualifies for — old regime only
  footnote?: string         // statute code, demoted per the voice rules
}

// Rules as of FY 2025-26. Facts only — no rates of return quoted (they change and would read as a promise).
const PRODUCTS: Product[] = [
  {
    name: 'Fixed deposit',
    what: 'You lend a bank a lump sum for a fixed period at an interest rate agreed up front.',
    lockIn: 'Chosen by you; breaking early usually costs a small penalty. The tax-saver FD is locked for 5 years.',
    risk: 'Low. Deposits are insured up to ₹5 lakh per depositor per bank.',
    tax: 'Interest is added to your income and taxed at your slab rate.',
    oldRegimeBreak: 'A 5-year tax-saver FD counts towards the ₹1.5 lakh yearly limit.',
    footnote: 'Section 80C',
  },
  {
    name: 'Liquid and debt funds',
    what: 'Mutual funds that lend to governments, banks and companies. Liquid funds hold very short-term loans.',
    lockIn: 'None. Liquid funds charge a tiny exit fee if you withdraw within 7 days.',
    risk: 'Low to moderate — value can dip if interest rates rise or a borrower defaults.',
    tax: 'Gains on units bought from April 2023 are taxed at your slab rate, however long you hold them.',
  },
  {
    name: 'Equity and index funds',
    what: 'Mutual funds that buy company shares. An index fund simply copies a market index like the Nifty 50, which keeps costs low.',
    lockIn: 'None.',
    risk: 'High in the short term — values can fall sharply in a bad year.',
    tax: 'Held over 12 months: gains above ₹1.25 lakh a year taxed at 12.5%. Held 12 months or less: 20%.',
  },
  {
    name: 'ELSS (tax-saving equity fund)',
    what: 'An equity mutual fund that also gives a tax deduction, in exchange for a lock-in.',
    lockIn: '3 years for each instalment.',
    risk: 'High in the short term, like any equity fund.',
    tax: 'Gains are taxed like equity funds.',
    oldRegimeBreak: 'Counts towards the ₹1.5 lakh yearly limit.',
    footnote: 'Section 80C',
  },
  {
    name: 'PPF (Public Provident Fund)',
    what: 'A government-backed savings account. The government sets the interest rate every quarter.',
    lockIn: '15 years. Partial withdrawals are allowed from the 7th year.',
    risk: 'Very low — backed by the Government of India.',
    tax: 'Interest and the maturity amount are tax-free. Deposits of ₹500 to ₹1.5 lakh a year.',
    oldRegimeBreak: 'Deposits count towards the ₹1.5 lakh yearly limit.',
    footnote: 'Section 80C',
  },
  {
    name: 'NPS (National Pension System)',
    what: 'A retirement account invested in a mix of equity and debt that you choose. At 60, part can be taken as a lump sum and part buys a pension, as PFRDA rules set.',
    lockIn: 'Mostly until age 60.',
    risk: 'Depends on the equity share you pick.',
    tax: 'Your employer\'s contribution can be deducted in both regimes.',
    oldRegimeBreak: 'Your own contributions get an extra ₹50,000 deduction on top of the ₹1.5 lakh limit.',
    footnote: 'Sections 80CCD(1B) and 80CCD(2)',
  },
  {
    name: 'Sukanya Samriddhi',
    what: 'A government-backed savings account for a daughter under 10.',
    lockIn: 'Matures 21 years after opening; partial withdrawal allowed for education after she turns 18.',
    risk: 'Very low — government-backed.',
    tax: 'Interest and the maturity amount are tax-free.',
    oldRegimeBreak: 'Deposits count towards the ₹1.5 lakh yearly limit.',
    footnote: 'Section 80C',
  },
]

const FOUNDATIONS = [
  { title: 'An emergency fund', body: 'Many guides suggest keeping a few months of expenses somewhere you can reach in a day, before investing for growth.' },
  { title: 'Insurance', body: 'Health cover and, if anyone depends on your income, term life cover protect your savings from one bad event. They\'re protection, not investments.' },
  { title: 'Costly debt', body: 'Credit-card and personal-loan interest is usually higher than what investments earn, which is why paying it down often comes first.' },
]

export default function InvestPage() {
  const router = useRouter()
  useEffect(() => { if (!INVEST_GUIDE_ENABLED) router.replace('/dashboard/profile/documents') }, [router])
  const [horizon, setHorizon] = useState<Horizon>('long')
  const [open, setOpen] = useState<string | null>(null)
  const regime = useSyncExternalStore(noSubscribe, readRegime, () => null)

  const h = HORIZONS.find(x => x.key === horizon)!
  const section = (title: string) => (
    <div style={{ padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>{title}</div>
  )

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:900 }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Investing basics</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>How common savings and investment options work, so you can make your own choices with clear eyes.</p>
      </div>

      {/* Foundations */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 }}>
        {section('Before investing')}
        <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14 }}>
          {FOUNDATIONS.map(f => (
            <div key={f.title} style={{ minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 4px' }}>{f.title}</p>
              <p style={{ fontSize:12.5, color:C.muted, margin:0, lineHeight:1.6 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Horizon */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 }}>
        {section('Match the money to the time')}
        <div style={{ padding:'14px 16px' }}>
          <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 12px' }}>When will you need the money?</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8, marginBottom:14 }}>
            {HORIZONS.map(x => {
              const sel = x.key === horizon
              return (
                <button key={x.key} onClick={() => setHorizon(x.key)} aria-pressed={sel}
                  style={{ padding:'12px 10px', borderRadius:5, border:`1.5px solid ${sel?C.fg:C.border}`, background:sel?C.wl:C.card, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:sel?C.fg:C.text, marginBottom:2 }}>{x.label}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{x.sub}</div>
                </button>
              )
            })}
          </div>
          <p style={{ fontSize:13, color:C.text, margin:'0 0 10px', lineHeight:1.65 }}>{h.body}</p>
          <p style={{ fontSize:11, color:C.muted, margin:'0 0 6px' }}>Options commonly used for this timeframe</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {h.options.map(o => (
              <span key={o} style={{ fontSize:12, padding:'4px 10px', borderRadius:20, background:T.tint, color:C.fg, fontWeight:500 }}>{o}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Regime note — factual, from the user's own computed result */}
      {regime && (
        <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 14px', fontSize:12.5, color:C.text, lineHeight:1.65, marginBottom:12 }}>
          {regime === 'new'
            ? <>Your Tax shows the <strong>new regime</strong> works out lower for you. Under the new regime most investment tax breaks don&apos;t apply — only your employer&apos;s NPS contribution does. The &ldquo;old regime&rdquo; lines below matter only if you file under the old regime.</>
            : <>Your Tax shows the <strong>old regime</strong> works out lower for you, so the &ldquo;old regime&rdquo; tax breaks below can reduce your tax. Your Deductions page shows how much of each limit you&apos;ve already used.</>}
        </div>
      )}

      {/* Product explainers */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 }}>
        {section('How each option works')}
        {PRODUCTS.map((p, i) => {
          const isOpen = open === p.name
          return (
            <div key={p.name} style={{ borderBottom: i < PRODUCTS.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <button onClick={() => setOpen(isOpen ? null : p.name)} aria-expanded={isOpen}
                style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'12px 16px', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{p.name}</span>
                <span aria-hidden="true" style={{ fontSize:14, color:C.muted, flexShrink:0 }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div style={{ padding:'0 16px 14px' }}>
                  <p style={{ fontSize:12.5, color:C.text, margin:'0 0 10px', lineHeight:1.6 }}>{p.what}</p>
                  {([['Lock-in', p.lockIn], ['Risk', p.risk], ['Tax', p.tax], ...(p.oldRegimeBreak ? [['Old regime tax break', p.oldRegimeBreak]] : [])] as [string, string][]).map(([k, v]) => (
                    <div key={k} style={{ display:'grid', gridTemplateColumns:'minmax(90px, 140px) minmax(0, 1fr)', gap:10, padding:'6px 0', borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:11.5, color:C.muted }}>{k}</span>
                      <span style={{ fontSize:12.5, color:C.text, lineHeight:1.55 }}>{v}</span>
                    </div>
                  ))}
                  {p.footnote && <p style={{ fontSize:13, color:C.faint, margin:'6px 0 0' }}>{p.footnote}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:5, padding:'12px 14px', marginBottom:12, display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <span style={{ fontSize:12.5, color:C.text }}>Want a term explained?</span>
        <Link href="/dashboard/chat" style={{ padding:'8px 16px', background:C.fg, color:T.onTeal, borderRadius:5, fontSize:12.5, fontWeight:600, textDecoration:'none' }}>Ask ArthVo</Link>
      </div>

      <p style={{ fontSize:13, color:C.faint, margin:'0 0 8px', lineHeight:1.6 }}>
        ArthVo is not a SEBI-registered investment adviser. This page is general information, not a recommendation to buy or sell any product. Mutual fund investments are subject to market risks; read all scheme-related documents carefully. Tax rules shown are for FY 2025-26 and can change. For advice on your own situation, speak to a SEBI-registered investment adviser.
      </p>
    </div>
  )
}
