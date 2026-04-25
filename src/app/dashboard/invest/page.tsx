'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/AppStore'
import Link from 'next/link'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`

interface InvestItem { id:string; label:string; icon:string; amount:number; category:string; note:string; editable:boolean }

const uid = () => Math.random().toString(36).slice(2,8)

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
        style={{ padding:'5px 8px', border:'none', fontSize:12, fontFamily:'inherit', outline:'none', width:90, color:C.text }} />
    </div>
  )
}

export default function InvestPage() {
  const { salary } = useAppStore()

  // Load profile free-to-spend
  const [freeToSpend, setFreeToSpend] = useState(0)
  useEffect(() => {
    try {
      const p = localStorage.getItem('av_profile')
      if (p) {
        const d = JSON.parse(p)
        const netSal = salary?.netSalary || 0
        const totalExp = (d.expenses || []).reduce((s:number,e:any) => s+e.amount, 0)
        const totalSav = (d.savings || []).reduce((s:number,sv:any) => s+sv.amount, 0)
        setFreeToSpend(Math.max(0, netSal - totalExp - totalSav))
      } else {
        setFreeToSpend(salary?.netSalary ? Math.round(salary.netSalary * 0.3) : 0)
      }
    } catch { setFreeToSpend(0) }
  }, [salary])

  const monthly = salary?.netSalary || 0
  const suggested = Math.min(freeToSpend, Math.round(monthly * 0.3))

  const [plan, setPlan] = useState<InvestItem[]>([])
  const [edited, setEdited] = useState(false)

  // Build default plan when we have data
  useEffect(() => {
    if (!monthly || plan.length > 0) return
    const s = suggested
    setPlan([
      { id:uid(), label:'Large cap index fund (SIP)', icon:'📈', amount:Math.round(s*0.35), category:'equity', note:'Low cost, tracks Nifty 50. Best for long-term wealth.', editable:true },
      { id:uid(), label:'Mid cap fund (SIP)', icon:'📊', amount:Math.round(s*0.2), category:'equity', note:'Higher growth potential, slightly more risk.', editable:true },
      { id:uid(), label:'ELSS — Tax saving fund', icon:'🏛️', amount:Math.min(12500, Math.round(s*0.25)), category:'tax', note:'Saves up to ₹46,800 in tax under 80C (Old Regime).', editable:true },
      { id:uid(), label:'Emergency fund top-up', icon:'🆘', amount:Math.round(s*0.15), category:'safety', note:'Target: 6 months of expenses. Keep in liquid fund.', editable:true },
      { id:uid(), label:'NPS (80CCD(1B))', icon:'🏦', amount:Math.round(s*0.1), category:'tax', note:'Extra ₹50,000 deduction over 80C limit.', editable:true },
    ])
  }, [monthly, suggested])

  const totalAllocated = plan.reduce((s,i) => s+i.amount, 0)
  const remaining = freeToSpend - totalAllocated
  const updateAmount = (id:string, amount:number) => { setPlan(p => p.map(i => i.id===id ? {...i,amount} : i)); setEdited(true) }
  const reset = () => { setPlan([]); setEdited(false) }

  const catColors: Record<string,string> = { equity:'#3A7A5A', tax:C.fg, safety:'#8A6A1A' }
  const catBg: Record<string,string> = { equity:'#E8F5EE', tax:C.wl, safety:'#FBF4E0' }

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Investments</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Personalised plan — based on your income, tax regime and free-to-spend</p>
      </div>

      {!monthly ? (
        <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:6, padding:'20px 24px', textAlign:'center' }}>
          <p style={{ fontSize:14, color:C.fg, fontWeight:600, margin:'0 0 8px' }}>Complete your profile first</p>
          <Link href="/dashboard/profile" style={{ display:'inline-block', padding:'9px 20px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:13, fontWeight:600, textDecoration:'none' }}>Go to My Profile →</Link>
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:22 }}>
            {[
              { l:'Monthly income', v:fmt(monthly) },
              { l:'Free to invest', v:fmt(freeToSpend), pos:true },
              { l:'Total allocated', v:fmt(totalAllocated), pos:totalAllocated<=freeToSpend },
              { l:'Unallocated', v:fmt(Math.max(0,remaining)), pos:remaining>=0 },
            ].map((s,i) => (
              <div key={i} style={{ background:C.card, padding:'13px 16px' }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.l}</div>
                <div style={{ fontSize:17, fontWeight:700, color:(s as any).pos ? C.fg : C.text, letterSpacing:'-0.02em' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {remaining < 0 && (
            <div style={{ background:'#FBF0F0', border:`1px solid #F0CECE`, borderRadius:5, padding:'9px 14px', fontSize:12.5, color:C.danger, marginBottom:14 }}>
              ⚠ You've allocated {fmt(-remaining)} more than your free-to-invest amount. Adjust the amounts below.
            </div>
          )}

          {edited && (
            <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'9px 14px', fontSize:12.5, color:C.fg, marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>You've customised this plan.</span>
              <button onClick={reset} style={{ fontSize:12, color:C.fg, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:600, textDecoration:'underline' }}>Reset to suggestion</button>
            </div>
          )}

          {/* Investment plan table */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'10px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr auto auto', gap:16, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>
              <span>Investment</span><span style={{ width:110, textAlign:'right' }}>Monthly amount</span><span style={{ width:60, textAlign:'right' }}>% of free</span>
            </div>
            {plan.map((item,i) => (
              <div key={item.id} style={{ padding:'12px 14px', borderBottom: i<plan.length-1 ? `1px solid #FAF7F2` : 'none' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:16, alignItems:'center', marginBottom:5 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                    <span style={{ fontSize:17 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize:13, fontWeight:500, color:C.text, margin:0 }}>{item.label}</p>
                      <span style={{ fontSize:10, padding:'1px 7px', borderRadius:3, background:catBg[item.category]||C.wl, color:catColors[item.category]||C.fg, fontWeight:600 }}>{item.category.toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ width:110, display:'flex', justifyContent:'flex-end' }}>
                    <AmtInput value={item.amount} onChange={v => updateAmount(item.id, v)} />
                  </div>
                  <div style={{ width:60, textAlign:'right', fontSize:12, color:C.muted }}>
                    {freeToSpend > 0 ? `${((item.amount/freeToSpend)*100).toFixed(0)}%` : '—'}
                  </div>
                </div>
                <p style={{ fontSize:11.5, color:C.muted, margin:0, paddingLeft:26 }}>{item.note}</p>
              </div>
            ))}
            <div style={{ padding:'11px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr auto auto', gap:16 }}>
              <span style={{ fontSize:12.5, fontWeight:600, color:C.text }}>Total allocated</span>
              <span style={{ width:110, textAlign:'right', fontSize:13, fontWeight:700, color:totalAllocated<=freeToSpend?C.fg:C.danger }}>{fmt(totalAllocated)}</span>
              <span style={{ width:60, textAlign:'right', fontSize:12, color:C.muted }}>{freeToSpend>0?`${((totalAllocated/freeToSpend)*100).toFixed(0)}%`:'—'}</span>
            </div>
          </div>

          {/* Tax saving callout */}
          {plan.find(i=>i.category==='tax') && (
            <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 14px', fontSize:12.5, color:C.fg, lineHeight:1.6, marginBottom:16 }}>
              💡 Your ELSS + NPS investments save you an additional <strong>{fmt(Math.min(plan.find(i=>i.label.includes('ELSS'))?.amount||0, 12500)*12*0.3)}</strong> in taxes this year under Old Regime.
            </div>
          )}

          <Link href="/dashboard/chat" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', background:C.fg, borderRadius:6, textDecoration:'none' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:C.wheat, margin:'0 0 2px' }}>Ask AI Advisor about this plan →</p>
              <p style={{ fontSize:11, color:'rgba(230,207,167,0.5)', margin:0 }}>Get deeper insights on each fund or tweak the plan</p>
            </div>
            <span style={{ color:C.wheat, fontSize:20 }}>→</span>
          </Link>
        </>
      )}
    </div>
  )
}
