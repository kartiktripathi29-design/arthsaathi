'use client'
import Link from 'next/link'
import { useAppStore } from '@/store/AppStore'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`

function calcTax(annual:number) {
  const std = 75000
  const newTaxable = Math.max(0, annual - std)
  let nt = 0
  for (const [l,r] of [[300000,0],[300000,0.05],[300000,0.10],[300000,0.15],[300000,0.20],[Infinity,0.30]] as [number,number][]) {
    const chunk = Math.min(Math.max(0, newTaxable - [0,300000,600000,900000,1200000,1500000].reduce((a,b)=>b<=newTaxable?b:a,0)), l)
    nt += chunk * r; if (newTaxable - [0,300000,600000,900000,1200000,1500000].reduce((a,b)=>b<=newTaxable?b:a,0) <= l) break
  }
  // simplified new regime calc
  let newTax = 0, rem = newTaxable
  for (const [l,r] of [[300000,0],[300000,0.05],[300000,0.10],[300000,0.15],[300000,0.20],[Infinity,0.30]] as [number,number][]) {
    const c = Math.min(rem, l); newTax += c * r; rem -= c; if (rem <= 0) break
  }
  if (newTaxable <= 700000) newTax = 0
  newTax = Math.round(newTax * 1.04)

  // old regime
  const oldTaxable = Math.max(0, annual - std - 150000 - 25000)
  let oldTax = 0, rem2 = oldTaxable
  for (const [l,r] of [[250000,0],[250000,0.05],[500000,0.20],[Infinity,0.30]] as [number,number][]) {
    const c = Math.min(rem2, l); oldTax += c * r; rem2 -= c; if (rem2 <= 0) break
  }
  if (oldTaxable <= 500000) oldTax = 0
  oldTax = Math.round(oldTax * 1.04)

  return { newTax, oldTax, savings: Math.abs(oldTax - newTax), recommended: newTax <= oldTax ? 'new' : 'old' }
}

const NEW_SLABS = [[0,300000,0],[300000,600000,5],[600000,900000,10],[900000,1200000,15],[1200000,1500000,20],[1500000,Infinity,30]] as [number,number,number][]
const OLD_SLABS = [[0,250000,0],[250000,500000,5],[500000,1000000,20],[1000000,Infinity,30]] as [number,number,number][]

function SlabRow({ from, to, rate, income }: { from:number; to:number; rate:number; income:number }) {
  const taxable = Math.max(0, Math.min(income, to === Infinity ? income : to) - from)
  const tax = Math.round(taxable * rate / 100)
  if (taxable <= 0) return null
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', borderBottom:`1px solid #FAF7F2`, fontSize:12.5, color:C.text }}>
      <span style={{ color:C.muted }}>{fmt(from)} – {to === Infinity ? 'above' : fmt(to)} @ {rate}%</span>
      <span style={{ fontWeight:600, color: tax === 0 ? C.fg : C.text }}>{fmt(tax)}</span>
    </div>
  )
}

export default function TaxPage() {
  const { salary } = useAppStore()
  const annual = (salary?.netSalary || 0) * 12
  const { newTax, oldTax, savings, recommended } = calcTax(annual)

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Tax Optimiser</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Old vs New regime — exactly which saves more for you</p>
      </div>

      {!annual ? (
        <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:6, padding:'20px 24px', textAlign:'center' }}>
          <p style={{ fontSize:14, color:C.fg, fontWeight:600, margin:'0 0 8px' }}>Complete your income profile first</p>
          <p style={{ fontSize:12.5, color:C.muted, margin:'0 0 14px' }}>Add your salary and other income in My Profile to see your tax breakdown</p>
          <Link href="/dashboard/profile" style={{ display:'inline-block', padding:'9px 20px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:13, fontWeight:600, textDecoration:'none' }}>Go to My Profile →</Link>
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:22 }}>
            {[
              { l:'Total annual income', v:fmt(annual), col:C.text },
              { l:'Tax — New Regime', v:fmt(newTax), col:recommended==='new'?C.fg:C.danger },
              { l:'Tax — Old Regime', v:fmt(oldTax), col:recommended==='old'?C.fg:C.danger },
              { l:'You save by switching', v:fmt(savings), col:C.fg },
            ].map((s,i) => (
              <div key={i} style={{ background:C.card, padding:'13px 16px' }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.l}</div>
                <div style={{ fontSize:17, fontWeight:700, color:s.col, letterSpacing:'-0.02em' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Recommendation banner */}
          <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 14px', fontSize:12.5, color:C.fg, fontWeight:500, marginBottom:18 }}>
            ✓ {recommended === 'new' ? 'New Regime' : 'Old Regime'} saves you {fmt(savings)}/year — we recommend switching
          </div>

          {/* Side by side slabs */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
            {[
              { label:'New Regime', tax:newTax, slabs:NEW_SLABS, isRec:recommended==='new', note:'Standard deduction ₹75,000 applied. No deductions needed.' },
              { label:'Old Regime', tax:oldTax, slabs:OLD_SLABS, isRec:recommended==='old', note:'80C (₹1.5L) + 80D (₹25K) + standard deduction assumed.' },
            ].map(regime => (
              <div key={regime.label} style={{ background:C.card, border:`1px solid ${regime.isRec ? C.fg : C.border}`, borderRadius:6, overflow:'hidden' }}>
                <div style={{ padding:'10px 14px', background:regime.isRec ? C.wl : '#FAFAF8', borderBottom:`1px solid ${regime.isRec ? C.wm : C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.fg, letterSpacing:'0.04em' }}>{regime.label}</span>
                  {regime.isRec && <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600 }}>Recommended</span>}
                </div>
                {regime.slabs.map(([from,to,rate],i) => <SlabRow key={i} from={from} to={to} rate={rate} income={annual - (regime.label==='Old Regime' ? 250000 : 75000)} />)}
                <div style={{ padding:'10px 14px', borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700 }}>
                  <span style={{ color:C.fg }}>Total tax (incl. 4% cess)</span>
                  <span style={{ color:regime.isRec ? C.fg : C.danger }}>{fmt(regime.tax)}</span>
                </div>
                <div style={{ padding:'6px 14px 10px', fontSize:11, color:C.muted }}>{regime.note}</div>
              </div>
            ))}
          </div>

          {/* Monthly breakdown */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:'14px 16px', marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:12 }}>Monthly Tax Breakdown</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { l:'Take-home / mo', v:fmt(salary?.netSalary||0) },
                { l:'Tax deducted / mo (New)', v:fmt(newTax/12) },
                { l:'Tax deducted / mo (Old)', v:fmt(oldTax/12) },
              ].map(s => (
                <div key={s.l} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{s.l}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Proceed to Investments */}
          <Link href="/dashboard/invest" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:C.fg, borderRadius:6, textDecoration:'none' }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:C.wheat, margin:'0 0 2px' }}>Proceed to Investments →</p>
              <p style={{ fontSize:11, color:'rgba(230,207,167,0.5)', margin:0 }}>Get a personalised plan based on your tax regime and free-to-spend</p>
            </div>
            <span style={{ color:C.wheat, fontSize:20 }}>→</span>
          </Link>
        </>
      )}
    </div>
  )
}
