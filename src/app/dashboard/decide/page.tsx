'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/AppStore'
import Link from 'next/link'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const calcEMI = (p:number, months:number, annualRate:number) => {
  if (annualRate === 0) return p/months
  const r = annualRate/12/100
  return p * r * Math.pow(1+r,months) / (Math.pow(1+r,months)-1)
}

type Step = 'input' | 'verdict'

export default function DecidePage() {
  const { salary } = useAppStore()
  const [step, setStep] = useState<Step>('input')
  const [itemName, setItemName] = useState('')
  const [price, setPrice] = useState('')
  const [freeToSpend, setFreeToSpend] = useState(0)

  useEffect(() => {
    try {
      const p = localStorage.getItem('av_profile')
      if (p) {
        const d = JSON.parse(p)
        const netSal = salary?.netSalary || 0
        const totalExp = (d.expenses||[]).reduce((s:number,e:any)=>s+e.amount,0)
        const totalSav = (d.savings||[]).reduce((s:number,sv:any)=>s+sv.amount,0)
        setFreeToSpend(Math.max(0, netSal-totalExp-totalSav))
      } else { setFreeToSpend(salary?.netSalary ? Math.round(salary.netSalary*0.3) : 0) }
    } catch { setFreeToSpend(0) }
  }, [salary])

  const priceNum = parseFloat(price.replace(/,/g,'')) || 0
  const pctOfFree = freeToSpend > 0 ? (priceNum/freeToSpend)*100 : 0
  const leftAfter = freeToSpend - priceNum
  const verdict = !freeToSpend ? 'unknown' : leftAfter < 0 ? 'no' : pctOfFree <= 10 ? 'yes' : pctOfFree <= 25 ? 'maybe' : 'no'

  const verdictConfig = {
    yes:     { emoji:'✅', title:'Yes, go ahead', color:C.fg, bg:C.wl, border:C.wm, sub:`${fmt(priceNum)} is ${pctOfFree.toFixed(1)}% of your monthly budget. Comfortable.` },
    maybe:   { emoji:'🤔', title:'Possible, but think twice', color:'#7A5A1A', bg:'#FFFAEE', border:'#F0D898', sub:`This is ${pctOfFree.toFixed(1)}% of your free budget. Not dangerous, but not small.` },
    no:      { emoji:'❌', title:'Not the best time', color:C.danger, bg:'#FBF0F0', border:'#F0CECE', sub:`This would leave you with ${fmt(Math.max(0,leftAfter))} this month. Too tight.` },
    unknown: { emoji:'📊', title:'Add your profile first', color:C.fg, bg:C.wl, border:C.wm, sub:'Complete My Profile to get a personalised verdict.' },
  }[verdict]

  const emiOptions = [
    { label:'Pay in full', months:0, rate:0, tag:'Best', tagCol:C.fg, tagBg:C.wl },
    { label:'No-cost EMI (3 months)', months:3, rate:0, tag:'Watch out', tagCol:'#7A5A1A', tagBg:'#FFFAEE' },
    { label:'6-month EMI @ 18%', months:6, rate:18, tag:'If needed', tagCol:'#2A5A8A', tagBg:'#EEF4FD' },
    { label:'12-month EMI @ 24%', months:12, rate:24, tag:'Avoid', tagCol:C.danger, tagBg:'#FBF0F0' },
  ]

  const s = {
    card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:10 } as React.CSSProperties,
    ch: { padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const },
  }

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:680 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Can I Buy This?</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>
          {freeToSpend > 0 ? <>Based on your profile — <strong style={{ color:C.fg }}>{fmt(freeToSpend)}</strong> free this month</> : 'Enter an item and price for a verdict'}
        </p>
      </div>

      {/* Profile missing warning */}
      {!freeToSpend && (
        <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'9px 14px', fontSize:12.5, color:C.fg, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Add your expenses in My Profile for a personalised verdict</span>
          <Link href="/dashboard/profile?tab=expenses" style={{ fontSize:12, color:C.fg, fontWeight:600, textDecoration:'underline' }}>Set up →</Link>
        </div>
      )}

      {step === 'input' && (
        <div>
          <div style={{ ...s.card }}>
            <div style={s.ch}>What do you want to buy?</div>
            <div style={{ padding:'14px 16px' }}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, color:C.muted, display:'block', marginBottom:5 }}>Item name</label>
                <input value={itemName} onChange={e=>setItemName(e.target.value)}
                  placeholder="e.g. Titan watch, iPhone, Nike shoes…"
                  style={{ width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:5, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const, color:C.text }} />
              </div>
              <div>
                <label style={{ fontSize:12, color:C.muted, display:'block', marginBottom:5 }}>Price (₹)</label>
                <div style={{ display:'flex', border:`1px solid ${C.border}`, borderRadius:5, overflow:'hidden' }}>
                  <span style={{ padding:'9px 11px', background:C.wl, fontSize:13, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
                  <input type="tel" value={price} onChange={e=>setPrice(e.target.value.replace(/[^0-9,]/g,''))}
                    placeholder="e.g. 4,999"
                    style={{ flex:1, padding:'9px 12px', border:'none', fontSize:13, fontFamily:'inherit', outline:'none', color:C.text }} />
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => priceNum > 0 && setStep('verdict')} disabled={!priceNum}
            style={{ width:'100%', padding:'11px', background:priceNum>0?C.fg:'#C8D4C8', color:priceNum>0?C.wheat:'#8A9A8A', border:'none', borderRadius:5, fontSize:13, fontWeight:600, cursor:priceNum>0?'pointer':'not-allowed', fontFamily:'inherit' }}>
            Get verdict →
          </button>
        </div>
      )}

      {step === 'verdict' && (
        <div>
          {/* Verdict card */}
          <div style={{ background:verdictConfig.bg, border:`1.5px solid ${verdictConfig.border}`, borderRadius:6, padding:'18px 20px', textAlign:'center', marginBottom:16 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>{verdictConfig.emoji}</div>
            <div style={{ fontSize:20, fontWeight:700, color:verdictConfig.color, letterSpacing:'-0.02em', marginBottom:6 }}>{verdictConfig.title}</div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.65 }}>{verdictConfig.sub}</div>
            {freeToSpend > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:14 }}>
                {[
                  { l:'Free budget', v:fmt(freeToSpend) },
                  { l:'Item cost', v:fmt(priceNum) },
                  { l:'Left after', v:fmt(Math.max(0,leftAfter)) },
                ].map(s => (
                  <div key={s.l} style={{ background:'rgba(255,255,255,0.65)', borderRadius:5, padding:'8px 6px' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.v}</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EMI breakdown */}
          {verdict === 'unknown' ? (
            <Link href="/dashboard/profile" style={{ display:'block', padding:'11px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:13, fontWeight:600, textDecoration:'none', textAlign:'center' }}>Set up My Profile →</Link>
          ) : (
            <>
              <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>How should you pay?</div>
              {emiOptions.map((opt,i) => {
                const monthly = opt.months===0 ? 0 : calcEMI(priceNum, opt.months, opt.rate)
                const total = opt.months===0 ? priceNum : monthly*opt.months + (opt.rate===0?149:0)
                const extra = total - priceNum + (opt.rate===0&&opt.months>0?149:0)
                return (
                  <div key={i} style={{ background:i===0?C.wl:C.card, border:`1px solid ${i===0?C.wm:C.border}`, borderRadius:5, padding:'12px 14px', marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{opt.label}</span>
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:3, background:opt.tagBg, color:opt.tagCol, border:`1px solid ${opt.tagBg==='#FFFAEE'?'#F0D898':opt.tagBg===C.wl?C.wm:opt.tagBg==='#EEF4FD'?'#B5D4F4':'#F0CECE'}` }}>{opt.tag}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      {opt.months===0 ? (
                        <>
                          <div><div style={{ fontSize:10, color:C.muted }}>You pay</div><div style={{ fontSize:13, fontWeight:700, color:C.text }}>{fmt(priceNum)}</div></div>
                          <div><div style={{ fontSize:10, color:C.muted }}>Extra cost</div><div style={{ fontSize:13, fontWeight:700, color:C.fg }}>₹0</div></div>
                          <div><div style={{ fontSize:10, color:C.muted }}>One shot</div><div style={{ fontSize:13, fontWeight:700, color:C.text }}>Full amount</div></div>
                        </>
                      ) : (
                        <>
                          <div><div style={{ fontSize:10, color:C.muted }}>Per month</div><div style={{ fontSize:13, fontWeight:700, color:C.text }}>{fmt(monthly)}</div></div>
                          <div><div style={{ fontSize:10, color:C.muted }}>Total paid</div><div style={{ fontSize:13, fontWeight:700, color:extra>0?C.danger:C.fg }}>{fmt(total)}</div></div>
                          <div><div style={{ fontSize:10, color:C.muted }}>Extra cost</div><div style={{ fontSize:13, fontWeight:700, color:extra>0?C.danger:C.fg }}>{extra>0?`+${fmt(extra)}`:'₹0'}</div></div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              <div style={{ background:C.fg, borderRadius:5, padding:'12px 16px', marginBottom:14, fontSize:13, color:'rgba(230,207,167,0.85)', lineHeight:1.7 }}>
                💡 <span style={{ color:C.wheat, fontWeight:600 }}>Bottom line:</span>{' '}
                {verdict==='yes' ? `Buy it. Pay in full — you save ${fmt(calcEMI(priceNum,3,0)*3-priceNum+149)} vs No-cost EMI. Enjoy guilt-free.` :
                 verdict==='maybe' ? 'Consider waiting 2 weeks to see how your expenses pan out. If you must buy, pay in full.' :
                 'Not the right time. Wait until next month when expenses ease.'}
              </div>
            </>
          )}

          <button onClick={() => { setStep('input'); setItemName(''); setPrice('') }}
            style={{ width:'100%', padding:'10px', background:C.card, color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            ↺ Check another item
          </button>
        </div>
      )}
    </div>
  )
}
