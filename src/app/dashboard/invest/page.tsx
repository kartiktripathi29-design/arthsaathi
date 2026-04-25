'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/AppStore'
import Link from 'next/link'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const uid = () => Math.random().toString(36).slice(2,8)

type Risk = 'conservative' | 'moderate' | 'aggressive'
type GoalKey = 'emergency' | 'house' | 'marriage' | 'child' | 'retirement' | 'fire' | 'travel' | 'wealth' | 'tax'

interface InvestRow {
  id: string
  icon: string
  label: string
  category: string
  catColor: string
  catBg: string
  goal: string
  note: string
  recommended: number
  userAmount: number
}

const GOALS: { key: GoalKey; icon: string; label: string; sub: string }[] = [
  { key:'emergency', icon:'🆘', label:'Emergency Fund', sub:'6 months expenses' },
  { key:'house',     icon:'🏠', label:'Buy a House', sub:'Down payment goal' },
  { key:'marriage',  icon:'💍', label:'Marriage', sub:'Wedding expenses' },
  { key:'child',     icon:'👶', label:'Child Education', sub:'Future education fund' },
  { key:'retirement',icon:'🌅', label:'Retirement', sub:'Long-term corpus' },
  { key:'fire',      icon:'⚡', label:'Early Retirement', sub:'FIRE — before 50' },
  { key:'travel',    icon:'✈️', label:'Travel Fund', sub:'Experiences' },
  { key:'wealth',    icon:'📈', label:'Wealth Building', sub:'General growth' },
  { key:'tax',       icon:'🏛️', label:'Tax Saving', sub:'80C deductions' },
]

const RISK_CONFIG = {
  conservative: { equity: 0.3, debt: 0.5, liquid: 0.2 },
  moderate:     { equity: 0.55, debt: 0.3, liquid: 0.15 },
  aggressive:   { equity: 0.75, debt: 0.15, liquid: 0.1 },
}

function buildPlan(goals: Set<GoalKey>, risk: Risk, free: number, monthlyExp: number): InvestRow[] {
  const rows: InvestRow[] = []
  const r = RISK_CONFIG[risk]
  const equityAmt = Math.round(free * r.equity)
  const debtAmt   = Math.round(free * r.debt)
  const liquidAmt = Math.round(free * r.liquid)

  const GREEN = { catColor:'#2A7A4A', catBg:'#E8F5EE' }
  const WHEAT = { catColor:C.fg, catBg:C.wl }
  const AMBER = { catColor:'#8A6A1A', catBg:'#FBF4E0' }
  const BLUE  = { catColor:'#2A5A8A', catBg:'#EEF4FD' }

  if (goals.has('emergency')) {
    const target = monthlyExp * 6
    rows.push({ id:uid(), icon:'🆘', label:'Liquid Fund (Emergency)', category:'SAFETY', ...AMBER, goal:'Emergency Fund', note:`Target: 6 months (${fmt(target)}). Keep accessible.`, recommended:Math.round(free*0.15), userAmount:Math.round(free*0.15) })
  }
  if (goals.has('retirement') || goals.has('fire')) {
    rows.push({ id:uid(), icon:'📈', label:'Nifty 50 Index Fund (SIP)', category:'EQUITY', ...GREEN, goal:goals.has('fire')?'Early Retirement':'Retirement', note:'Lowest cost equity. Core long-term holding.', recommended:Math.round(equityAmt*0.5), userAmount:Math.round(equityAmt*0.5) })
    if (risk !== 'conservative') rows.push({ id:uid(), icon:'📊', label:'Mid Cap Fund (SIP)', category:'EQUITY', ...GREEN, goal:goals.has('fire')?'Early Retirement':'Retirement', note:'Higher growth, moderate risk. 7–10 yr horizon.', recommended:Math.round(equityAmt*0.3), userAmount:Math.round(equityAmt*0.3) })
    rows.push({ id:uid(), icon:'🏦', label:'NPS (80CCD(1B))', category:'PENSION', ...BLUE, goal:'Retirement', note:'Extra ₹50,000 deduction over 80C. Tax-efficient.', recommended:Math.round(free*0.08), userAmount:Math.round(free*0.08) })
  }
  if (goals.has('house')) {
    rows.push({ id:uid(), icon:'🏠', label:'Debt Fund / RD', category:'DEBT', ...WHEAT, goal:'House Down Payment', note:'Stable returns for 3–5 yr goal. Low risk.', recommended:Math.round(debtAmt*0.6), userAmount:Math.round(debtAmt*0.6) })
  }
  if (goals.has('marriage')) {
    rows.push({ id:uid(), icon:'💍', label:'Short-term Debt Fund', category:'DEBT', ...WHEAT, goal:'Marriage', note:'Capital protection with better returns than FD.', recommended:Math.round(debtAmt*0.4), userAmount:Math.round(debtAmt*0.4) })
  }
  if (goals.has('child')) {
    rows.push({ id:uid(), icon:'👶', label:'Sukanya Samriddhi / PPF', category:'DEBT', ...BLUE, goal:'Child Education', note:'Government backed. Tax free returns.', recommended:Math.round(free*0.1), userAmount:Math.round(free*0.1) })
  }
  if (goals.has('tax') || goals.has('wealth')) {
    rows.push({ id:uid(), icon:'🛡️', label:'ELSS Fund (80C)', category:'TAX SAVING', ...GREEN, goal:'Tax Saving', note:'Saves up to ₹46,800/yr. 3-year lock-in.', recommended:Math.min(12500, Math.round(free*0.15)), userAmount:Math.min(12500, Math.round(free*0.15)) })
  }
  if (goals.has('travel')) {
    rows.push({ id:uid(), icon:'✈️', label:'Flexi-cap Mutual Fund', category:'EQUITY', ...GREEN, goal:'Travel Fund', note:'Moderate horizon (2–3 years). Liquid when needed.', recommended:Math.round(free*0.08), userAmount:Math.round(free*0.08) })
  }

  // If no goals or result empty, show default moderate plan
  if (rows.length === 0) {
    rows.push(
      { id:uid(), icon:'📈', label:'Nifty 50 Index Fund (SIP)', category:'EQUITY', ...GREEN, goal:'Wealth Building', note:'Core long-term holding.', recommended:Math.round(free*0.35), userAmount:Math.round(free*0.35) },
      { id:uid(), icon:'🆘', label:'Liquid Fund (Emergency)', category:'SAFETY', ...AMBER, goal:'Emergency Fund', note:'Target: 6 months expenses.', recommended:Math.round(free*0.2), userAmount:Math.round(free*0.2) },
      { id:uid(), icon:'🛡️', label:'ELSS Fund (80C)', category:'TAX SAVING', ...GREEN, goal:'Tax Saving', note:'Saves up to ₹46,800 in tax.', recommended:Math.round(free*0.15), userAmount:Math.round(free*0.15) },
    )
  }
  return rows
}

// ─── Amount input — outside component ────────────────────────────────────────
function AmtInput({ value, onChange }: { value:number; onChange:(n:number)=>void }) {
  const [local, setLocal] = useState(value > 0 ? String(value) : '')
  useEffect(() => { setLocal(value > 0 ? String(value) : '') }, [value])
  return (
    <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:4, overflow:'hidden' }}>
      <span style={{ padding:'5px 7px', background:C.wl, fontSize:11, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
      <input type="text" inputMode="numeric" value={local}
        onChange={e => setLocal(e.target.value.replace(/[^0-9]/g,''))}
        onBlur={() => onChange(parseFloat(local)||0)}
        onKeyDown={e => e.key==='Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="0"
        style={{ padding:'5px 8px', border:'none', fontSize:12, fontFamily:'inherit', outline:'none', width:80, color:C.text }} />
    </div>
  )
}

export default function InvestPage() {
  const { salary } = useAppStore()
  const [risk, setRisk] = useState<Risk>('moderate')
  const [goals, setGoals] = useState<Set<GoalKey>>(new Set(['emergency','retirement','wealth']))
  const [plan, setPlan] = useState<InvestRow[]>([])
  const [freeToSpend, setFreeToSpend] = useState(0)
  const [monthlyExp, setMonthlyExp] = useState(0)
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    try {
      const p = localStorage.getItem('av_profile')
      if (p) {
        const d = JSON.parse(p)
        const netSal = salary?.netSalary || 0
        const exp = (d.expenses||[]).reduce((s:number,e:any)=>s+e.amount,0)
        const sav = (d.savings||[]).reduce((s:number,sv:any)=>s+sv.amount,0)
        setMonthlyExp(exp)
        setFreeToSpend(Math.max(0, netSal-exp-sav))
      } else { setFreeToSpend(salary?.netSalary ? Math.round(salary.netSalary*0.3) : 0) }
    } catch { setFreeToSpend(0) }
  }, [salary])

  const generate = useCallback(() => {
    if (!freeToSpend) return
    const newPlan = buildPlan(goals, risk, freeToSpend, monthlyExp)
    setPlan(newPlan)
    setGenerated(true)
  }, [goals, risk, freeToSpend, monthlyExp])

  const updateAmount = (id:string, amount:number) => setPlan(p => p.map(i => i.id===id ? {...i, userAmount:amount} : i))
  const resetToRec = () => setPlan(p => p.map(i => ({...i, userAmount:i.recommended})))
  const toggleGoal = (key:GoalKey) => setGoals(prev => { const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n })

  const totalRec = plan.reduce((s,i)=>s+i.recommended,0)
  const totalUser = plan.reduce((s,i)=>s+i.userAmount,0)
  const deviations = plan.filter(i=>i.userAmount!==i.recommended)

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:900 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Investments</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Tell us your goals and risk appetite — we'll show what to invest and where</p>
      </div>

      {!salary?.netSalary ? (
        <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:6, padding:'20px 24px', textAlign:'center' }}>
          <p style={{ fontSize:14, color:C.fg, fontWeight:600, margin:'0 0 8px' }}>Complete your profile first</p>
          <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 14px' }}>Add your salary in My Profile to get a personalised investment plan</p>
          <Link href="/dashboard/profile" style={{ display:'inline-block', padding:'9px 20px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:13, fontWeight:600, textDecoration:'none' }}>Go to My Profile →</Link>
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:22 }}>
            {[
              { l:'Monthly income', v:fmt(salary.netSalary||0) },
              { l:'Free to invest', v:fmt(freeToSpend), pos:true },
              { l:'Currently allocating', v:generated?fmt(totalUser):'—', pos:true },
            ].map((s,i) => (
              <div key={i} style={{ background:C.card, padding:'13px 16px' }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.l}</div>
                <div style={{ fontSize:17, fontWeight:700, color:(s as any).pos?C.fg:C.text, letterSpacing:'-0.02em' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Step 1: Risk */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 }}>
            <div style={{ padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>
              Step 1 — What's your risk appetite?
            </div>
            <div style={{ padding:'14px 16px' }}>
              <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 12px' }}>This determines which funds we recommend</p>
              <div style={{ display:'flex', gap:10 }}>
                {([
                  ['conservative', '🛡️', 'Conservative', 'FDs, debt funds, capital safety'],
                  ['moderate',     '⚖️', 'Moderate',     'Mix of equity + debt'],
                  ['aggressive',   '🚀', 'Aggressive',   'Mostly equity, high growth'],
                ] as const).map(([key, icon, label, sub]) => (
                  <button key={key} onClick={() => { setRisk(key); setGenerated(false) }}
                    style={{ flex:1, padding:'12px 10px', borderRadius:5, border:`1.5px solid ${risk===key?C.fg:C.border}`, background:risk===key?C.wl:C.card, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const }}>
                    <div style={{ fontSize:18, marginBottom:5 }}>{icon}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:risk===key?C.fg:C.text, marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: Goals */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 }}>
            <div style={{ padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>
              Step 2 — What are you investing for?
            </div>
            <div style={{ padding:'14px 16px' }}>
              <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 12px' }}>Select all that apply — your plan will be built around these</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
                {GOALS.map(g => {
                  const sel = goals.has(g.key)
                  return (
                    <button key={g.key} onClick={() => { toggleGoal(g.key); setGenerated(false) }}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', border:`1px solid ${sel?C.fg:C.border}`, borderRadius:5, background:sel?C.wl:C.card, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const }}>
                      <div style={{ width:14, height:14, borderRadius:3, border:`1.5px solid ${sel?C.fg:C.border}`, background:sel?C.fg:C.card, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {sel && <span style={{ fontSize:9, color:C.wheat, fontWeight:700 }}>✓</span>}
                      </div>
                      <div>
                        <p style={{ fontSize:12, fontWeight:sel?600:400, color:sel?C.fg:C.text, margin:0 }}>{g.icon} {g.label}</p>
                        <p style={{ fontSize:10, color:C.muted, margin:0 }}>{g.sub}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button onClick={generate} disabled={goals.size===0||!freeToSpend}
            style={{ width:'100%', padding:'12px', background:goals.size>0&&freeToSpend?C.fg:'#C8D4C8', color:goals.size>0&&freeToSpend?C.wheat:'#8A9A8A', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:goals.size>0&&freeToSpend?'pointer':'not-allowed', fontFamily:'inherit', marginBottom:16 }}>
            {generated ? '↺ Regenerate plan with new settings' : '✨ Generate my investment plan →'}
          </button>

          {/* Step 3: Plan table */}
          {generated && plan.length > 0 && (
            <>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 }}>
                <div style={{ padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Step 3 — Your investment plan</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {deviations.length > 0 && (
                      <button onClick={resetToRec} style={{ fontSize:11, color:C.fg, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:600, textDecoration:'underline' }}>Reset to recommended</button>
                    )}
                    <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600 }}>AI Recommended</span>
                  </div>
                </div>

                {/* Table header */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 110px 130px 100px', gap:8, padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>
                  <span>Investment & Goal</span>
                  <span style={{ textAlign:'right' }}>Recommended</span>
                  <span style={{ textAlign:'right' }}>Your Amount</span>
                  <span style={{ textAlign:'right' }}>Difference</span>
                </div>

                {plan.map((item, i) => {
                  const diff = item.userAmount - item.recommended
                  return (
                    <div key={item.id} style={{ display:'grid', gridTemplateColumns:'1fr 110px 130px 100px', gap:8, padding:'12px 14px', borderBottom: i<plan.length-1 ? `1px solid #FAF7F2` : 'none', alignItems:'center' }}>
                      <div>
                        <p style={{ fontSize:13, fontWeight:500, color:C.text, margin:'0 0 3px' }}>{item.icon} {item.label}</p>
                        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
                          <span style={{ fontSize:10, padding:'1px 7px', borderRadius:3, background:item.catBg, color:item.catColor, fontWeight:600, border:`1px solid ${item.catBg}` }}>{item.category}</span>
                          <span style={{ fontSize:10, color:C.muted }}>→ {item.goal}</span>
                        </div>
                        <p style={{ fontSize:11.5, color:C.muted, margin:0 }}>{item.note}</p>
                      </div>
                      <div style={{ textAlign:'right', fontSize:13, fontWeight:600, color:C.fg }}>{fmt(item.recommended)}</div>
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <AmtInput value={item.userAmount} onChange={v => updateAmount(item.id, v)} />
                      </div>
                      <div style={{ textAlign:'right', fontSize:12, fontWeight:500, color: diff===0?C.muted : diff>0?'#2A7A4A' : C.danger }}>
                        {diff===0 ? '—' : diff>0 ? `+${fmt(diff)}` : `−${fmt(Math.abs(diff))}`}
                      </div>
                    </div>
                  )
                })}

                {/* Total row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 110px 130px 100px', gap:8, padding:'11px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>Total</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.fg, textAlign:'right' }}>{fmt(totalRec)}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:totalUser<=freeToSpend?C.fg:C.danger, textAlign:'right', paddingRight:4 }}>{fmt(totalUser)}</span>
                  <span style={{ fontSize:11, color:C.muted, textAlign:'right' }}>
                    {freeToSpend > 0 ? `${Math.round((totalUser/freeToSpend)*100)}% of free` : '—'}
                  </span>
                </div>
              </div>

              {/* Over-budget warning */}
              {totalUser > freeToSpend && (
                <div style={{ background:'#FBF0F0', border:`1px solid #F0CECE`, borderRadius:5, padding:'9px 14px', fontSize:12.5, color:C.danger, marginBottom:12 }}>
                  ⚠ You've allocated {fmt(totalUser - freeToSpend)} more than your free-to-invest amount. Reduce some amounts.
                </div>
              )}

              {/* Deviation insight */}
              {deviations.length > 0 && (
                <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 14px', fontSize:12.5, color:C.fg, lineHeight:1.65, marginBottom:12 }}>
                  💡 You've changed {deviations.length} item{deviations.length>1?'s':''} from the recommendation.{' '}
                  {deviations.filter(d=>d.userAmount<d.recommended).map(d=>`${d.label} is underfunded by ${fmt(d.recommended-d.userAmount)}.`).join(' ')}
                </div>
              )}

              <Link href="/dashboard/chat" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', background:C.fg, borderRadius:6, textDecoration:'none' }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:C.wheat, margin:'0 0 2px' }}>Ask AI Advisor about this plan →</p>
                  <p style={{ fontSize:11, color:'rgba(230,207,167,0.5)', margin:0 }}>Deep dive into any fund or get alternatives</p>
                </div>
                <span style={{ color:C.wheat, fontSize:20 }}>→</span>
              </Link>
            </>
          )}
        </>
      )}
    </div>
  )
}
