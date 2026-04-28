'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store/AppStore'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

interface SalaryBreakdown {
  netSalary: number
  employeePF: number
  employerPF: number
  bonus: number
  otherBenefits: number
  employerName: string
}

function Bar({ value, max, color, label }: { value:number; max:number; color:string; label:string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:C.text, marginBottom:3 }}>
        <span>{label}</span>
        <span style={{ fontWeight:600 }}>{fmt(value)}</span>
      </div>
      <div style={{ height:8, background:'#F0EBE0', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4, transition:'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function Donut({ segments, size=120 }: { segments:{value:number;color:string;label:string}[]; size?:number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (!total) return <div style={{ width:size, height:size, borderRadius:'50%', background:'#F0EBE0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:C.muted }}>No data</div>
  const r = 40, circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#F0EBE0" strokeWidth="14" />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const len = (seg.value / total) * circ
        const dash = `${Math.max(len - 1, 0.5)} ${circ - Math.max(len - 1, 0.5)}`
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="round" />
        offset += len
        return el
      })}
    </svg>
  )
}

function Card({ title, icon, children, action }: { title:string; icon:string; children:React.ReactNode; action?:React.ReactNode }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden', marginBottom:16 }}>
      <div style={{ padding:'12px 16px', background:C.wl, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:700, color:C.fg, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:16 }}>{icon}</span>{title}
        </span>
        {action}
      </div>
      <div style={{ padding:'16px' }}>{children}</div>
    </div>
  )
}

function SetupNudge({ text }: { text:string }) {
  return (
    <div style={{ textAlign:'center', padding:'20px 10px' }}>
      <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 12px' }}>{text}</p>
      <Link href="/dashboard/profile" style={{ padding:'8px 20px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:12, fontWeight:600, textDecoration:'none', display:'inline-block' }}>
        Set up My Profile →
      </Link>
    </div>
  )
}

export default function DashboardPage() {
  const { salary } = useAppStore() as any
  const [salBreakdown, setSalBreakdown] = useState<SalaryBreakdown>({ netSalary:0, employeePF:0, employerPF:0, bonus:0, otherBenefits:0, employerName:'' })
  const [expenses, setExpenses] = useState<{label:string;amount:number;icon:string}[]>([])
  const [variable, setVariable] = useState<{label:string;amount:number;icon:string}[]>([])
  const [savings, setSavings] = useState<{label:string;amount:number;icon:string}[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [taggedTxns, setTaggedTxns] = useState<any[]>([])
  const [bankMonths, setBankMonths] = useState(1)
  const [netWorth, setNetWorth] = useState<{label:string;value:number}[]>([
    { label:'Mutual Funds', value:0 },
    { label:'Stocks', value:0 },
    { label:'Fixed Deposits', value:0 },
    { label:'EPF/PPF', value:0 },
    { label:'Gold', value:0 },
    { label:'Real Estate', value:0 },
    { label:'NPS', value:0 },
    { label:'Cash/Savings', value:0 },
  ])
  const [corpusMonthly, setCorpusMonthly] = useState(5000)
  const [corpusYears, setCorpusYears] = useState(10)
  const [corpusReturn, setCorpusReturn] = useState(12)

  useEffect(() => {
    try {
      const sb = localStorage.getItem('av_salary_breakdown')
      if (sb) setSalBreakdown(JSON.parse(sb))
      const p = localStorage.getItem('av_profile')
      if (p) {
        const d = JSON.parse(p)
        if (d.expenses) setExpenses(d.expenses)
        if (d.savings) setSavings(d.savings)
        if (d.variable) setVariable(d.variable)
      }
      const ba = localStorage.getItem('av_banks')
      if (ba) {
        const accounts = JSON.parse(ba)
        setBankAccounts(accounts)
        const allTxns: any[] = []
        accounts.forEach((acc: any) => { (acc.data?.transactions || []).forEach((t: any) => allTxns.push(t)) })
        setTaggedTxns(allTxns)
        const keys = new Set<string>()
        allTxns.forEach((t: any) => { const parts = (t.date || '').split(/[-/]/); if (parts.length >= 3) keys.add(`${parts[2]}-${parts[1]}`) })
        setBankMonths(Math.max(1, keys.size))
      }
      const nw = localStorage.getItem('av_net_worth')
      if (nw) setNetWorth(JSON.parse(nw))
    } catch {}
  }, [])

  const updateNetWorth = (idx: number, value: number) => {
    const updated = netWorth.map((item, i) => i === idx ? { ...item, value } : item)
    setNetWorth(updated)
    try { localStorage.setItem('av_net_worth', JSON.stringify(updated)) } catch {}
  }

  const monthlyIncome = salBreakdown.netSalary
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
  const totalVar = variable.reduce((s, v) => s + v.amount, 0)
  const totalSav = savings.reduce((s, sv) => s + sv.amount, 0)
  const totalSpend = totalExp + totalVar
  const trulyFree = Math.max(0, monthlyIncome - totalSpend - totalSav)
  const savingsRate = monthlyIncome > 0 ? Math.round((totalSav / monthlyIncome) * 100) : 0
  const totalNetWorth = netWorth.reduce((s, item) => s + item.value, 0)

  const categoryBreakdown = useMemo(() => {
    if (taggedTxns.length === 0) return []
    const map: Record<string, { label:string; icon:string; color:string; total:number }> = {}
    const catMeta: Record<string, {icon:string; color:string; label:string}> = {
      food: { icon:'🍽️', color:'#E07A5F', label:'Food & Dining' },
      shopping: { icon:'🛍️', color:'#D4A03C', label:'Shopping' },
      transport: { icon:'🚗', color:'#E07A5F', label:'Transport & Fuel' },
      entertainment: { icon:'🎬', color:'#D4A03C', label:'Entertainment' },
      utilities: { icon:'⚡', color:'#6B8F71', label:'Utilities' },
      healthcare: { icon:'💊', color:'#E07A5F', label:'Healthcare' },
      housing: { icon:'🏠', color:'#8B6F47', label:'Housing' },
      insurance: { icon:'🛡️', color:'#6B8F71', label:'Insurance' },
      investments_regular: { icon:'📈', color:'#2A5A8A', label:'Investments' },
      investments_elss: { icon:'🛡️', color:'#2A7A4A', label:'ELSS (80C)' },
      cc_payment: { icon:'💳', color:'#7A8A7E', label:'Credit Card' },
      transfer: { icon:'👤', color:'#7A8A7E', label:'Transfers' },
      misc: { icon:'📦', color:'#A09080', label:'Miscellaneous' },
    }
    taggedTxns.forEach((t: any) => {
      if (t.type !== 'debit') return
      const cat = t.mega || t.category || 'misc'
      if (cat === 'salary' || cat === 'interest' || cat === 'cashback') return
      const meta = catMeta[cat] || { icon:'📦', color:'#A09080', label:cat }
      if (!map[cat]) map[cat] = { label:meta.label, icon:meta.icon, color:meta.color, total:0 }
      map[cat].total += t.amount
    })
    return Object.values(map).map(c => ({ ...c, monthly: Math.round(c.total / bankMonths) })).sort((a, b) => b.monthly - a.monthly).slice(0, 8)
  }, [taggedTxns, bankMonths])

  const corpusProjection = useMemo(() => {
    const r = corpusReturn / 100 / 12
    const n = corpusYears * 12
    if (r === 0) return corpusMonthly * n
    return Math.round(corpusMonthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r))
  }, [corpusMonthly, corpusYears, corpusReturn])

  const totalInvested = corpusMonthly * corpusYears * 12
  const wealthGain = corpusProjection - totalInvested
  const hasProfile = monthlyIncome > 0 || bankAccounts.length > 0

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Dashboard</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Your financial overview at a glance</p>
      </div>

      {!hasProfile && (
        <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:8, padding:'24px 20px', textAlign:'center', marginBottom:20 }}>
          <p style={{ fontSize:28, margin:'0 0 8px' }}>👋</p>
          <p style={{ fontSize:15, fontWeight:600, color:C.fg, margin:'0 0 6px' }}>Welcome to ArthVo</p>
          <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 16px', lineHeight:1.6 }}>Upload your bank statement and salary slip in My Profile to see your full financial picture here.</p>
          <Link href="/dashboard/profile" style={{ padding:'10px 24px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:13, fontWeight:600, textDecoration:'none', display:'inline-block' }}>
            Get started →
          </Link>
        </div>
      )}

      {hasProfile && (
        <>
          <Card title="Monthly Income vs Expenses" icon="💰" action={<Link href="/dashboard/profile" style={{ fontSize:11, color:C.fg, textDecoration:'underline' }}>Edit</Link>}>
            {monthlyIncome > 0 ? (
              <div>
                <div style={{ display:'flex', gap:20, marginBottom:16, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:120 }}>
                    <p style={{ fontSize:10, color:C.muted, margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.08em' }}>Income</p>
                    <p style={{ fontSize:22, fontWeight:700, color:'#2A7A4A', margin:0 }}>{fmt(monthlyIncome)}</p>
                    <p style={{ fontSize:10.5, color:C.muted, margin:'2px 0 0' }}>per month · {salBreakdown.employerName || 'Your employer'}</p>
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <p style={{ fontSize:10, color:C.muted, margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.08em' }}>Expenses</p>
                    <p style={{ fontSize:22, fontWeight:700, color:C.danger, margin:0 }}>{fmt(totalSpend)}</p>
                    <p style={{ fontSize:10.5, color:C.muted, margin:'2px 0 0' }}>{fmt(totalExp)} fixed + {fmt(totalVar)} variable</p>
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <p style={{ fontSize:10, color:C.muted, margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.08em' }}>Truly Free</p>
                    <p style={{ fontSize:22, fontWeight:700, color:C.fg, margin:0 }}>{fmt(trulyFree)}</p>
                    <p style={{ fontSize:10.5, color:C.muted, margin:'2px 0 0' }}>after expenses + savings</p>
                  </div>
                </div>
                <Bar value={totalSpend} max={monthlyIncome} color={C.danger} label={`Spending (${monthlyIncome > 0 ? Math.round((totalSpend/monthlyIncome)*100) : 0}%)`} />
                <Bar value={totalSav} max={monthlyIncome} color={C.wm} label={`Savings (${savingsRate}%)`} />
                <Bar value={trulyFree} max={monthlyIncome} color={C.fg} label={`Free (${monthlyIncome > 0 ? Math.round((trulyFree/monthlyIncome)*100) : 0}%)`} />
              </div>
            ) : (
              <SetupNudge text="Add your salary in My Profile to see income vs expenses" />
            )}
          </Card>

          <Card title="Where Your Money Goes" icon="📊" action={bankAccounts.length > 0 ? <Link href="/dashboard/profile" style={{ fontSize:11, color:C.fg, textDecoration:'underline' }}>Details</Link> : undefined}>
            {categoryBreakdown.length > 0 ? (
              <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
                <Donut segments={categoryBreakdown.map(c => ({ value:c.monthly, color:c.color, label:c.label }))} />
                <div style={{ flex:1, minWidth:200 }}>
                  {categoryBreakdown.map((cat, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:i < categoryBreakdown.length - 1 ? '1px solid #FAF7F2' : 'none' }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
                      <span style={{ fontSize:11.5, color:C.text, flex:1 }}>{cat.icon} {cat.label}</span>
                      <span style={{ fontSize:11.5, fontWeight:600, color:C.fg }}>{fmt(cat.monthly)}/mo</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <SetupNudge text="Upload a bank statement to see where your money goes" />
            )}
          </Card>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <Card title="Savings Rate" icon="🎯">
              {monthlyIncome > 0 ? (
                <div style={{ textAlign:'center' }}>
                  <div style={{ position:'relative', width:100, height:100, margin:'0 auto 12px' }}>
                    <svg viewBox="0 0 100 100" width={100} height={100} style={{ transform:'rotate(-90deg)' }}>
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#F0EBE0" strokeWidth="10" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke={savingsRate >= 20 ? '#2A7A4A' : savingsRate >= 10 ? C.wm : C.danger} strokeWidth="10"
                        strokeDasharray={`${(savingsRate / 100) * 251.3} 251.3`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:22, fontWeight:700, color:C.fg }}>{savingsRate}%</span>
                    </div>
                  </div>
                  <p style={{ fontSize:12, color:C.muted, margin:'0 0 4px' }}>{fmt(totalSav)} of {fmt(monthlyIncome)} saved</p>
                  <p style={{ fontSize:11, color:savingsRate >= 20 ? '#2A7A4A' : savingsRate >= 10 ? '#8A6A1A' : C.danger, fontWeight:600, margin:0 }}>
                    {savingsRate >= 20 ? 'Excellent — above 20% benchmark' : savingsRate >= 10 ? 'Good — aim for 20%+' : 'Low — try to save at least 10%'}
                  </p>
                </div>
              ) : (
                <SetupNudge text="Add income & savings to see your rate" />
              )}
            </Card>

            <Card title="Net Worth" icon="🏦">
              <div>
                <div style={{ textAlign:'center', marginBottom:12 }}>
                  <p style={{ fontSize:24, fontWeight:700, color:totalNetWorth > 0 ? C.fg : C.muted, margin:'0 0 4px' }}>
                    {totalNetWorth > 0 ? fmt(totalNetWorth) : '—'}
                  </p>
                  <p style={{ fontSize:10.5, color:C.muted, margin:0 }}>Total assets (manual entry)</p>
                </div>
                {netWorth.map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0', borderBottom:i < netWorth.length - 1 ? '1px solid #FAF7F2' : 'none' }}>
                    <span style={{ fontSize:11, color:C.text }}>{item.label}</span>
                    <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:3, overflow:'hidden' }}>
                      <span style={{ padding:'2px 5px', background:C.wl, fontSize:9, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
                      <input type="text" inputMode="numeric" value={item.value > 0 ? String(item.value) : ''}
                        onChange={e => updateNetWorth(i, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                        placeholder="0"
                        style={{ padding:'2px 5px', border:'none', fontSize:11, fontFamily:'inherit', outline:'none', width:70, color:C.text, textAlign:'right' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Wealth Projection" icon="📈">
            <div>
              <div style={{ display:'flex', gap:16, marginBottom:16, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:120 }}>
                  <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Monthly SIP (₹)</label>
                  <input type="text" inputMode="numeric" value={corpusMonthly > 0 ? String(corpusMonthly) : ''}
                    onChange={e => setCorpusMonthly(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                    style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ flex:1, minWidth:120 }}>
                  <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Years</label>
                  <input type="text" inputMode="numeric" value={String(corpusYears)}
                    onChange={e => setCorpusYears(Math.min(40, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0))}
                    style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ flex:1, minWidth:120 }}>
                  <label style={{ fontSize:10, color:C.muted, display:'block', marginBottom:4 }}>Expected return (%)</label>
                  <input type="text" inputMode="numeric" value={String(corpusReturn)}
                    onChange={e => setCorpusReturn(Math.min(30, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0))}
                    style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:8, padding:'16px 20px', textAlign:'center' }}>
                <p style={{ fontSize:10, color:C.muted, margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  After {corpusYears} years at {corpusReturn}% return
                </p>
                <p style={{ fontSize:28, fontWeight:700, color:C.fg, margin:'0 0 6px' }}>{fmt(corpusProjection)}</p>
                <div style={{ display:'flex', justifyContent:'center', gap:20, fontSize:11.5, color:C.muted }}>
                  <span>Invested: <strong style={{ color:C.text }}>{fmt(totalInvested)}</strong></span>
                  <span>Wealth gain: <strong style={{ color:'#2A7A4A' }}>+{fmt(wealthGain)}</strong></span>
                </div>
              </div>
              <div style={{ marginTop:12, height:40, display:'flex', alignItems:'flex-end', gap:2 }}>
                {Array.from({ length: Math.min(corpusYears, 30) }, (_, i) => {
                  const yr = i + 1
                  const r = corpusReturn / 100 / 12
                  const n = yr * 12
                  const val = r === 0 ? corpusMonthly * n : corpusMonthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
                  const maxVal = corpusProjection || 1
                  const h = Math.max(2, (val / maxVal) * 36)
                  return <div key={yr} style={{ flex:1, height:h, background:yr === corpusYears ? C.fg : C.wm, borderRadius:'2px 2px 0 0' }} title={`Year ${yr}: ${fmt(val)}`} />
                })}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:C.muted, marginTop:2 }}>
                <span>Year 1</span>
                <span>Year {corpusYears}</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
