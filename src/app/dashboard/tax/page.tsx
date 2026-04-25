'use client'
import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/AppStore'
import Link from 'next/link'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const clamp = (v:number, max:number) => Math.min(v, max)

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Info({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position:'relative', display:'inline-block', marginLeft:5 }}>
      <span
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        style={{ width:15, height:15, borderRadius:'50%', border:`1px solid ${C.wm}`, background:C.wl, color:C.fg, fontSize:9, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer', userSelect:'none' as const }}>
        i
      </span>
      {show && (
        <span style={{ position:'absolute', left:'50%', bottom:'calc(100% + 6px)', transform:'translateX(-50%)', background:'#1C2B22', color:'#fff', fontSize:11, padding:'8px 12px', borderRadius:6, zIndex:100, width:220, lineHeight:1.6, whiteSpace:'normal', boxShadow:'0 4px 16px rgba(0,0,0,0.18)' }}>
          {text}
          <span style={{ position:'absolute', bottom:-4, left:'50%', transform:'translateX(-50%)', width:8, height:8, background:'#1C2B22', rotate:'45deg' }} />
        </span>
      )}
    </span>
  )
}

// ─── Amount input ─────────────────────────────────────────────────────────────
function AmtInput({ value, onChange, max, width=120 }: { value:number; onChange:(n:number)=>void; max?:number; width?:number }) {
  const [local, setLocal] = useState(value > 0 ? String(value) : '')
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
      <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:4, overflow:'hidden' }}>
        <span style={{ padding:'6px 8px', background:C.wl, fontSize:11, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
        <input type="text" inputMode="numeric" value={local}
          onChange={e => setLocal(e.target.value.replace(/[^0-9]/g,''))}
          onBlur={() => { const v=parseFloat(local)||0; onChange(max?clamp(v,max):v); setLocal(String(max?clamp(v,max):v)||'') }}
          onKeyDown={e => e.key==='Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="0"
          style={{ padding:'6px 9px', border:'none', fontSize:12.5, fontFamily:'inherit', outline:'none', width, color:C.text }} />
      </div>
      {max && value >= max && <span style={{ fontSize:10, color:C.fg, fontWeight:600 }}>Limit reached ✓</span>}
      {max && value > 0 && value < max && <span style={{ fontSize:10, color:C.muted }}>{fmt(max-value)} more available</span>}
    </div>
  )
}

// ─── Progress bar for deduction limits ───────────────────────────────────────
function DeductionBar({ used, max, label }: { used:number; max:number; label:string }) {
  const pct = Math.min(100, (used/max)*100)
  const color = pct >= 100 ? C.fg : pct >= 80 ? C.wm : C.border
  return (
    <div style={{ padding:'10px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11.5, color:C.muted }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:700, color:pct>=100?C.fg:C.text }}>{fmt(used)} / {fmt(max)}</span>
      </div>
      <div style={{ height:4, background:C.border, borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2, transition:'width 0.3s' }} />
      </div>
      {pct < 100 && <span style={{ fontSize:10, color:C.muted, marginTop:2, display:'block' }}>{fmt(max-used)} more can be claimed</span>}
      {pct >= 100 && <span style={{ fontSize:10, color:C.fg, fontWeight:600, marginTop:2, display:'block' }}>Maximum limit reached ✓</span>}
    </div>
  )
}

// ─── Section row ──────────────────────────────────────────────────────────────
function Row({ label, tooltip, children }: { label:string; tooltip?:string; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:`1px solid #FAF7F2` }}>
      <div style={{ fontSize:13, color:C.text, display:'flex', alignItems:'center' }}>
        {label}{tooltip && <Info text={tooltip} />}
      </div>
      {children}
    </div>
  )
}

// ─── Nav buttons ──────────────────────────────────────────────────────────────
function NavButtons({ onBack, onReset, onProceed, proceedLabel='Proceed →' }: { onBack?:()=>void; onReset:()=>void; onProceed:()=>void; proceedLabel?:string }) {
  return (
    <div style={{ display:'flex', gap:8, marginTop:16 }}>
      {onBack && <button onClick={onBack} style={{ flex:1, padding:'10px', background:C.card, color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>}
      <button onClick={onReset} style={{ flex:1, padding:'10px', background:'#FBF0F0', color:C.danger, border:`1px solid #F0CECE`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>↺ Start over</button>
      <button onClick={onProceed} style={{ flex:2, padding:'10px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{proceedLabel}</button>
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ['Income','HRA','80C','80D','Other','Results']
function StepBar({ current }: { current:number }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:22, overflowX:'auto', paddingBottom:2 }}>
      {STEPS.map((s,i) => (
        <div key={s} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length-1 ? 1 : 'none' }}>
          <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', gap:4, flexShrink:0 }}>
            <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0, background:i<current?C.fg:i===current?C.wheat:'#F0EBE0', color:i<current?C.wheat:i===current?C.fg:C.muted, border:`1px solid ${i<=current?C.fg:C.border}` }}>
              {i < current ? '✓' : i+1}
            </div>
            <span style={{ fontSize:9, fontWeight:i===current?700:400, color:i<=current?C.fg:C.muted, whiteSpace:'nowrap' }}>{s}</span>
          </div>
          {i < STEPS.length-1 && <div style={{ flex:1, height:1, background:i<current?C.fg:C.border, margin:'0 4px', marginBottom:14 }} />}
        </div>
      ))}
    </div>
  )
}

// ─── Tax calculation engine ───────────────────────────────────────────────────
interface Deductions {
  // HRA
  rentPaid: number; hraReceived: number; isMetro: boolean
  // 80C
  ppf:number; elss:number; lic:number; homeLoanPrincipal:number; tuition:number; nsc:number; epf:number
  // 80D
  selfFamily:number; parents:number; parentsSenior:boolean; selfSenior:boolean
  // 80CCD(1B)
  nps:number
  // 80TTA/TTB
  savingsInterest:number
  // 80G
  donations100:number; donations50:number
  // 24B
  homeLoanInterest:number
  // 80E
  eduLoanInterest:number
}

function calcHRAExempt(d: Deductions, salary: number): number {
  if (d.rentPaid === 0 || d.hraReceived === 0) return 0
  const basicAnnual = salary * 0.4
  const hraAnnual   = d.hraReceived * 12   // monthly → annual
  const rentAnnual  = d.rentPaid * 12       // monthly → annual
  const rule1 = hraAnnual
  const rule2 = rentAnnual - 0.1 * basicAnnual
  const rule3 = d.isMetro ? 0.5 * basicAnnual : 0.4 * basicAnnual
  return Math.max(0, Math.min(rule1, Math.max(0, rule2), rule3))
}

function calcTax(income: number, deductions: Deductions, monthlyNet: number) {
  const annual = income

  // New regime
  const stdDed = 75000
  const newTaxable = Math.max(0, annual - stdDed)
  let newTax = 0, rem = newTaxable
  for (const [l,r] of [[300000,0],[300000,0.05],[300000,0.10],[300000,0.15],[300000,0.20],[Infinity,0.30]] as [number,number][]) {
    const c = Math.min(rem, l); newTax += c*r; rem-=c; if(rem<=0) break
  }
  if (newTaxable <= 700000) newTax = 0
  newTax = Math.round(newTax * 1.04)

  // Old regime deductions
  const c80 = clamp(deductions.ppf + deductions.elss + deductions.lic + deductions.homeLoanPrincipal + deductions.tuition + deductions.nsc + deductions.epf, 150000)
  const hraExempt = calcHRAExempt(deductions, annual)
  const c80D = clamp(deductions.selfFamily, deductions.selfSenior?50000:25000) + clamp(deductions.parents, deductions.parentsSenior?50000:25000)
  const c80CCD = clamp(deductions.nps, 50000)
  const c80TTA = clamp(deductions.savingsInterest, deductions.selfSenior?50000:10000)
  const c80G = deductions.donations100 + deductions.donations50 * 0.5
  const c24B = clamp(deductions.homeLoanInterest, 200000)
  const c80E = deductions.eduLoanInterest

  const totalOldDed = stdDed + c80 + hraExempt + c80D + c80CCD + c80TTA + c80G + c24B + c80E
  const oldTaxable = Math.max(0, annual - totalOldDed)
  let oldTax = 0, rem2 = oldTaxable
  for (const [l,r] of [[250000,0],[250000,0.05],[500000,0.20],[Infinity,0.30]] as [number,number][]) {
    const c = Math.min(rem2, l); oldTax += c*r; rem2-=c; if(rem2<=0) break
  }
  if (oldTaxable <= 500000) oldTax = 0
  oldTax = Math.round(oldTax * 1.04)

  return {
    newTax, oldTax, savings: Math.abs(oldTax-newTax), recommended: newTax<=oldTax?'new':'old',
    deductionBreakdown: { c80, hraExempt, c80D, c80CCD, c80TTA, c80G, c24B, c80E, stdDed, total: totalOldDed },
    newTaxable, oldTaxable
  }
}

// ─── Initial deductions state ─────────────────────────────────────────────────
const defaultDed: Deductions = { rentPaid:0, hraReceived:0, isMetro:true, ppf:0, elss:0, lic:0, homeLoanPrincipal:0, tuition:0, nsc:0, epf:0, selfFamily:0, parents:0, parentsSenior:false, selfSenior:false, nps:0, savingsInterest:0, donations100:0, donations50:0, homeLoanInterest:0, eduLoanInterest:0 }

const STEP_LABELS = ['Income','HRA','80C','80D','Other','Results']

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TaxPage() {
  const { salary } = useAppStore()
  const [step, setStep] = useState(-1) // -1 = welcome screen
  const [ded, setDed] = useState<Deductions>(defaultDed)
  const annual = (salary?.grossSalary || 0) * 12
  const set = (k: keyof Deductions) => (v: number | boolean) => setDed(prev => ({ ...prev, [k]: v }))

  // Load saved progress from localStorage + auto-fill from salary/profile
  const [savedStep, setSavedStep] = useState<number>(0)
  useState(() => {
    try {
      const saved = localStorage.getItem('av_tax_progress')
      if (saved) {
        const d = JSON.parse(saved)
        if (d.step !== undefined) setSavedStep(d.step)
        if (d.ded) setDed(d.ded)
        return
      }
      // Auto-fill on first visit from salary slip + profile savings
      const profile = localStorage.getItem('av_profile')
      const autoFill: Partial<Deductions> = {}
      if (profile) {
        const p = JSON.parse(profile)
        // 80C: auto-fill SIP from savings
        const sip = (p.savings||[]).find((s:any) => s.label?.toLowerCase().includes('sip') || s.label?.toLowerCase().includes('mutual'))
        if (sip?.amount) autoFill.elss = sip.amount * 12
      }
      if (Object.keys(autoFill).length > 0) setDed(prev => ({ ...prev, ...autoFill }))
    } catch {}
  })

  // Save progress on every change
  const saveProgress = (s: number, d: Deductions) => {
    try { localStorage.setItem('av_tax_progress', JSON.stringify({ step: s, ded: d })) } catch {}
  }

  const goStep = (s: number) => { setStep(s); saveProgress(s, ded) }
  const updateDed = (k: keyof Deductions) => (v: number | boolean) => {
    const newDed = { ...ded, [k]: v }
    setDed(newDed)
    saveProgress(step, newDed)
  }
  const reset = () => {
    setStep(-1)
    setDed(defaultDed)
    try { localStorage.removeItem('av_tax_progress') } catch {}
  }

  const tax = annual ? calcTax(annual, ded, salary?.netSalary||0) : null

  const sCard = { background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 } as React.CSSProperties
  const sCH   = { padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, display:'flex', justifyContent:'space-between', alignItems:'center' }

  if (!annual) return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:6, padding:'20px 24px', textAlign:'center' }}>
        <p style={{ fontSize:14, color:C.fg, fontWeight:600, margin:'0 0 8px' }}>Complete your income profile first</p>
        <Link href="/dashboard/profile" style={{ display:'inline-block', padding:'9px 20px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:13, fontWeight:600, textDecoration:'none' }}>Go to My Profile →</Link>
      </div>
    </div>
  )

  // Welcome screen — resume or start over
  if (step === -1) return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Tax Optimiser</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>We show you exactly how your tax is calculated — you deserve to know</p>
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:'14px 16px' }}>
        {/* Salary info */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:C.wl, border:`1.5px solid ${C.wm}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>📄</div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{salary?.employerName || 'Your employer'} · {fmt(salary?.netSalary||0)}/mo</p>
            <p style={{ fontSize:11, color:C.muted, margin:0 }}>Salary data loaded from My Profile</p>
          </div>
        </div>
        {/* Progress pills */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' as const, marginBottom:14 }}>
          {STEP_LABELS.map((l, i) => {
            const done = i < savedStep
            const current = i === savedStep
            return (
              <span key={l} style={{ fontSize:10.5, padding:'2px 9px', borderRadius:20, fontWeight:done||current?500:400, background:done?C.wl:current?C.fg:'#F0EBE0', border:`1px solid ${done?C.wm:current?C.fg:C.border}`, color:done?C.fg:current?C.wheat:C.muted }}>
                {done?'✓ ':current?'→ ':''}{l}
              </span>
            )
          })}
        </div>
        {/* Actions */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ fontSize:12, color:C.muted, margin:0 }}>
            {savedStep > 0 ? `Continue from where you left off?` : 'Ready to calculate your tax?'}
          </p>
          <div style={{ display:'flex', gap:8 }}>
            {savedStep > 0 && (
              <button onClick={reset} style={{ padding:'7px 14px', background:'#FBF0F0', color:C.danger, border:`1px solid #F0CECE`, borderRadius:5, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↺ Start over</button>
            )}
            <button onClick={() => goStep(savedStep > 0 ? savedStep : 0)}
              style={{ padding:'7px 16px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              {savedStep > 0 ? `Resume from ${STEP_LABELS[savedStep]} →` : 'Start calculating →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap')`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>Tax Optimiser</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>We'll show you exactly how your tax is calculated — and how to pay less</p>
      </div>

      <StepBar current={step} />

      {/* ── STEP 0: Income ── */}
      {step === 0 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>Your income — FY 2024-25</div>
            <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { l:'Gross salary / year', v:fmt(annual) },
                { l:'Monthly take-home', v:fmt(salary?.netSalary||0) },
                { l:'Employer', v:salary?.employerName||'—' },
                { l:'Standard deduction (auto)', v:fmt(75000) },
              ].map(s => (
                <div key={s.l} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{s.l}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'10px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}`, fontSize:12, color:C.muted, lineHeight:1.65 }}>
              ₹75,000 standard deduction applies to both regimes. The next steps find additional deductions for Old Regime — which may or may not save more than New Regime based on your actual investments.
            </div>
          </div>
          <NavButtons onReset={reset} onProceed={() => goStep(1)} proceedLabel="Proceed to HRA →" />
        </div>
      )}

      {/* ── STEP 1: HRA ── */}
      {step === 1 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>
              <span>HRA — House Rent Allowance Exemption
                <Info text="The HRA exemption is the MINIMUM of 3 values: (1) Actual HRA received, (2) Rent paid minus 10% of basic salary, (3) 50% of basic if metro / 40% if non-metro. Only applicable in Old Regime." />
              </span>
            </div>
            <div style={{ padding:'12px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.muted, lineHeight:1.65 }}>
              If you pay rent and receive HRA in your salary, part of it is tax-exempt. Skip this section if you own your home or don't receive HRA.
            </div>
            <Row label="Monthly rent you pay"><AmtInput value={ded.rentPaid} onChange={updateDed('rentPaid')} /></Row>
            <Row label="Monthly HRA received in salary"><AmtInput value={ded.hraReceived} onChange={updateDed('hraReceived')} /></Row>
            <Row label="City type">
              <div style={{ display:'flex', gap:6 }}>
                {[['Metro (Delhi, Mumbai, Chennai, Kolkata)', true], ['Non-Metro', false]].map(([l, v]) => (
                  <button key={String(v)} onClick={() => updateDed('isMetro')(v as boolean)}
                    style={{ padding:'6px 12px', borderRadius:4, border:`1px solid ${ded.isMetro===v?C.fg:C.border}`, background:ded.isMetro===v?C.wl:C.card, color:ded.isMetro===v?C.fg:C.muted, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', fontWeight:ded.isMetro===v?600:400 }}>
                    {String(l)}
                  </button>
                ))}
              </div>
            </Row>
            {ded.rentPaid > 0 && ded.hraReceived > 0 && (
              <div style={{ padding:'12px 14px', background:C.wl, borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:8, lineHeight:1.6 }}>
                  <strong style={{ color:C.fg }}>How your HRA exemption is calculated:</strong><br/>
                  Rule 1 — Actual HRA received: <strong>{fmt(ded.hraReceived*12)}/yr</strong><br/>
                  Rule 2 — Rent minus 10% of basic: <strong>{fmt(Math.max(0, ded.rentPaid*12 - 0.1*(annual*0.4)))}/yr</strong><br/>
                  Rule 3 — {ded.isMetro?'50%':'40%'} of basic salary: <strong>{fmt(annual*0.4*(ded.isMetro?0.5:0.4))}/yr</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C.fg }}>Your HRA exemption (minimum of 3)</span>
                  <span style={{ fontSize:17, fontWeight:700, color:C.fg }}>{fmt(calcHRAExempt(ded, annual))}</span>
                </div>
              </div>
            )}
          </div>
          <NavButtons onBack={() => goStep(0)} onReset={reset} onProceed={() => goStep(2)} proceedLabel="Proceed to 80C →" />
        </div>
      )}

      {/* ── STEP 2: 80C ── */}
      {step === 2 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>80C — Investments & Payments <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Max ₹1,50,000</span></div>
            <DeductionBar used={clamp(ded.ppf+ded.elss+ded.lic+ded.homeLoanPrincipal+ded.tuition+ded.nsc+ded.epf,150000)} max={150000} label="80C deduction used" />
            <Row label="PPF contribution"><AmtInput value={ded.ppf} onChange={updateDed('ppf')} /></Row>
            <Row label="ELSS mutual fund investment"><AmtInput value={ded.elss} onChange={updateDed('elss')} /></Row>
            <Row label="LIC / Life insurance premium"><AmtInput value={ded.lic} onChange={updateDed('lic')} /></Row>
            <Row label="Home loan — principal repayment"><AmtInput value={ded.homeLoanPrincipal} onChange={updateDed('homeLoanPrincipal')} /></Row>
            <Row label="Children's tuition fees"><AmtInput value={ded.tuition} onChange={updateDed('tuition')} /></Row>
            <Row label="NSC / Tax saver FD / SCSS"><AmtInput value={ded.nsc} onChange={updateDed('nsc')} /></Row>
            <Row label="EPF employee contribution (if not in payslip)"><AmtInput value={ded.epf} onChange={updateDed('epf')} /></Row>
            <div style={{ padding:'10px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}`, fontSize:11.5, color:C.muted, lineHeight:1.65 }}>
              All of the above pool into a single ₹1,50,000 limit. Any amount beyond ₹1.5L gives no additional benefit in Old Regime.
            </div>
          </div>
          <NavButtons onBack={() => goStep(1)} onReset={reset} onProceed={() => goStep(3)} proceedLabel="Proceed to 80D →" />
        </div>
      )}

      {/* ── STEP 3: 80D ── */}
      {step === 3 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>80D — Health Insurance Premiums <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Max ₹25K–75K</span></div>
            <div style={{ padding:'10px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:11.5, color:C.muted, lineHeight:1.65 }}>
              You can claim premiums paid for yourself + family (max ₹25K, or ₹50K if you're a senior citizen) AND parents separately (max ₹25K, or ₹50K if parents are senior citizens).
            </div>
            <Row label="Are you a senior citizen? (60+)">
              <div style={{ display:'flex', gap:6 }}>
                {[['Yes', true], ['No', false]].map(([l,v]) => (
                  <button key={String(v)} onClick={() => updateDed('selfSenior')(v as boolean)}
                    style={{ padding:'6px 14px', borderRadius:4, border:`1px solid ${ded.selfSenior===v?C.fg:C.border}`, background:ded.selfSenior===v?C.wl:C.card, color:ded.selfSenior===v?C.fg:C.muted, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', fontWeight:ded.selfSenior===v?600:400 }}>
                    {String(l)}
                  </button>
                ))}
              </div>
            </Row>
            <Row label={`Self + family insurance premium (max ${fmt(ded.selfSenior?50000:25000)})`}>
              <AmtInput value={ded.selfFamily} onChange={updateDed('selfFamily')} max={ded.selfSenior?50000:25000} />
            </Row>
            <Row label="Are your parents senior citizens? (60+)">
              <div style={{ display:'flex', gap:6 }}>
                {[['Yes', true], ['No', false]].map(([l,v]) => (
                  <button key={String(v)} onClick={() => updateDed('parentsSenior')(v as boolean)}
                    style={{ padding:'6px 14px', borderRadius:4, border:`1px solid ${ded.parentsSenior===v?C.fg:C.border}`, background:ded.parentsSenior===v?C.wl:C.card, color:ded.parentsSenior===v?C.fg:C.muted, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', fontWeight:ded.parentsSenior===v?600:400 }}>
                    {String(l)}
                  </button>
                ))}
              </div>
            </Row>
            <Row label={`Parents' insurance premium (max ${fmt(ded.parentsSenior?50000:25000)})`}>
              <AmtInput value={ded.parents} onChange={updateDed('parents')} max={ded.parentsSenior?50000:25000} />
            </Row>
            <div style={{ padding:'10px 14px', background:C.wl, borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:12.5, fontWeight:600, color:C.fg }}>Total 80D deduction</span>
              <span style={{ fontSize:15, fontWeight:700, color:C.fg }}>{fmt(clamp(ded.selfFamily, ded.selfSenior?50000:25000) + clamp(ded.parents, ded.parentsSenior?50000:25000))}</span>
            </div>
          </div>
          <NavButtons onBack={() => goStep(2)} onReset={reset} onProceed={() => goStep(4)} proceedLabel="Proceed to Other Deductions →" />
        </div>
      )}

      {/* ── STEP 4: Other deductions ── */}
      {step === 4 && (
        <div>
          {/* 80CCD(1B) */}
          <div style={sCard}>
            <div style={sCH}>
              <span>80CCD(1B) — NPS Additional Contribution
                <Info text="This is SEPARATE from 80C. You get an extra ₹50,000 deduction for investing in NPS (National Pension Scheme) over and above the ₹1.5L 80C limit. Total tax benefit can be 80C (₹1.5L) + 80CCD(1B) (₹50K) = ₹2L." />
              </span>
              <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Max ₹50,000</span>
            </div>
            <Row label="NPS contribution this FY (voluntary, over employer)"><AmtInput value={ded.nps} onChange={updateDed('nps')} max={50000} /></Row>
          </div>

          {/* 24B */}
          <div style={sCard}>
            <div style={sCH}>
              <span>24(B) — Home Loan Interest
                <Info text="Not to be confused with 80C (home loan principal). This is the INTEREST portion of your home loan EMI. You can claim up to ₹2,00,000/year on a self-occupied property. No limit for let-out property." />
              </span>
              <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Max ₹2,00,000</span>
            </div>
            <Row label="Home loan interest paid this FY"><AmtInput value={ded.homeLoanInterest} onChange={updateDed('homeLoanInterest')} max={200000} /></Row>
          </div>

          {/* 80TTA */}
          <div style={sCard}>
            <div style={sCH}>
              <span>80TTA — Savings Account Interest
                <Info text="Interest earned from your savings bank account (NOT FD) is exempt up to ₹10,000. If you're a senior citizen, use 80TTB instead — it covers both savings and FD interest up to ₹50,000." />
              </span>
              <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>{ded.selfSenior?'Max ₹50,000 (80TTB)':'Max ₹10,000'}</span>
            </div>
            <Row label={ded.selfSenior?'Savings + FD interest earned (80TTB)':'Savings account interest earned'}><AmtInput value={ded.savingsInterest} onChange={updateDed('savingsInterest')} max={ded.selfSenior?50000:10000} /></Row>
          </div>

          {/* 80E */}
          <div style={sCard}>
            <div style={sCH}>80E — Education Loan Interest <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>No upper limit</span></div>
            <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:11.5, color:C.muted }}>The entire interest paid on an education loan is deductible. Available for 8 years or until interest is fully repaid.</div>
            <Row label="Education loan interest paid this FY"><AmtInput value={ded.eduLoanInterest} onChange={updateDed('eduLoanInterest')} /></Row>
          </div>

          {/* 80G */}
          <div style={sCard}>
            <div style={sCH}>
              <span>80G — Donations
                <Info text="Donations to government-approved funds qualify. PM Relief Fund, CMs Relief Fund = 100% deduction. Most charitable trusts = 50% deduction. Cash donations above ₹2,000 are NOT eligible." />
              </span>
            </div>
            <Row label="100% qualifying donations (PM Relief Fund etc.)"><AmtInput value={ded.donations100} onChange={updateDed('donations100')} /></Row>
            <Row label="50% qualifying donations (charitable trusts etc.)"><AmtInput value={ded.donations50} onChange={updateDed('donations50')} /></Row>
          </div>

          <NavButtons onBack={() => goStep(3)} onReset={reset} onProceed={() => goStep(5)} proceedLabel="See my tax results →" />
        </div>
      )}

      {/* ── STEP 5: Results ── */}
      {step === 5 && tax && (
        <div>
          {/* Stat strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:20 }}>
            {[
              { l:'Gross annual income', v:fmt(annual) },
              { l:`Tax — New Regime`, v:fmt(tax.newTax), col:tax.recommended==='new'?C.fg:C.danger },
              { l:`Tax — Old Regime`, v:fmt(tax.oldTax), col:tax.recommended==='old'?C.fg:C.danger },
              { l:'You save by switching', v:fmt(tax.savings), col:C.fg },
            ].map((s,i) => (
              <div key={i} style={{ background:C.card, padding:'13px 16px' }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.l}</div>
                <div style={{ fontSize:17, fontWeight:700, color:s.col||C.text, letterSpacing:'-0.02em' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 14px', fontSize:12.5, color:C.fg, fontWeight:500, marginBottom:18 }}>
            ✓ {tax.recommended==='new'?'New Regime':'Old Regime'} saves you {fmt(tax.savings)}/year — we recommend switching
          </div>

          {/* Deduction breakdown */}
          <div style={sCard}>
            <div style={sCH}>Your deductions — Old Regime only</div>
            <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:11.5, color:C.muted }}>
              These deductions only reduce tax in Old Regime. New Regime ignores all of them (except standard deduction).
            </div>
            {[
              { l:'Standard deduction (both regimes)', v:tax.deductionBreakdown.stdDed, always:true },
              { l:'HRA exemption (rent)', v:tax.deductionBreakdown.hraExempt },
              { l:'80C — investments & payments', v:tax.deductionBreakdown.c80 },
              { l:'80D — health insurance', v:tax.deductionBreakdown.c80D },
              { l:'80CCD(1B) — NPS additional', v:tax.deductionBreakdown.c80CCD },
              { l:'80TTA/TTB — savings interest', v:tax.deductionBreakdown.c80TTA },
              { l:'24(B) — home loan interest', v:tax.deductionBreakdown.c24B },
              { l:'80E — education loan interest', v:tax.deductionBreakdown.c80E },
              { l:'80G — donations', v:tax.deductionBreakdown.c80G },
            ].filter(r => (r as any).always || r.v > 0).map((r,i,arr) => (
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 14px', borderBottom:i<arr.length-1?`1px solid #FAF7F2`:'none', fontSize:12.5, color:C.text }}>
                <span style={{ color:C.muted }}>{r.l}</span>
                <span style={{ fontWeight:600, color:C.fg }}>−{fmt(r.v)}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:C.wl, borderTop:`1px solid ${C.border}`, fontSize:13, fontWeight:700 }}>
              <span style={{ color:C.fg }}>Total deductions (Old Regime)</span>
              <span style={{ color:C.fg }}>−{fmt(tax.deductionBreakdown.total)}</span>
            </div>
          </div>

          {/* Taxable income + slab breakdown side by side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
            {[
              { label:'New Regime', tax:tax.newTax, taxable:tax.newTaxable, isRec:tax.recommended==='new',
                note:'Only standard deduction (₹75K) applied. No other deductions.',
                slabs:[[0,300000,0],[300000,600000,5],[600000,900000,10],[900000,1200000,15],[1200000,1500000,20],[1500000,Infinity,30]] as [number,number,number][] },
              { label:'Old Regime', tax:tax.oldTax, taxable:tax.oldTaxable, isRec:tax.recommended==='old',
                note:`All your deductions applied. Taxable income: ${fmt(tax.oldTaxable)}`,
                slabs:[[0,250000,0],[250000,500000,5],[500000,1000000,20],[1000000,Infinity,30]] as [number,number,number][] },
            ].map(regime => (
              <div key={regime.label} style={{ background:C.card, border:`1px solid ${regime.isRec?C.fg:C.border}`, borderRadius:6, overflow:'hidden' }}>
                <div style={{ padding:'10px 14px', background:regime.isRec?C.wl:'#FAFAF8', borderBottom:`1px solid ${regime.isRec?C.wm:C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.fg }}>{regime.label}</span>
                  {regime.isRec && <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600 }}>Recommended</span>}
                </div>
                <div style={{ padding:'8px 14px', borderBottom:`1px solid #FAF7F2`, fontSize:11.5, color:C.muted }}>{regime.note}</div>
                {regime.slabs.map(([from,to,rate],i) => {
                  const inSlab = Math.max(0, Math.min(regime.taxable, to===Infinity?regime.taxable:to) - from)
                  const slabTax = Math.round(inSlab * rate/100)
                  if (inSlab <= 0) return null
                  return (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 14px', borderBottom:`1px solid #FAF7F2`, fontSize:12 }}>
                      <span style={{ color:C.muted }}>{fmt(from)}–{to===Infinity?'above':fmt(to)} @ {rate}%</span>
                      <span style={{ fontWeight:600, color:slabTax===0?C.fg:C.text }}>{fmt(slabTax)}</span>
                    </div>
                  )
                })}
                <div style={{ padding:'9px 14px', borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700 }}>
                  <span style={{ color:C.fg }}>Total (incl. 4% cess)</span>
                  <span style={{ color:regime.isRec?C.fg:C.danger }}>{fmt(regime.tax)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly view */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:12 }}>Monthly view</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { l:'Monthly income', v:fmt(salary?.netSalary||0) },
                { l:`Tax/mo (${tax.recommended==='new'?'New':'Old'} — recommended)`, v:fmt(Math.min(tax.newTax,tax.oldTax)/12) },
                { l:'Effective tax rate', v:`${((Math.min(tax.newTax,tax.oldTax)/annual)*100).toFixed(1)}%` },
              ].map(s => (
                <div key={s.l} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{s.l}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => goStep(4)} style={{ flex:1, padding:'10px', background:C.card, color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
            <button onClick={reset} style={{ flex:1, padding:'10px', background:'#FBF0F0', color:C.danger, border:`1px solid #F0CECE`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>↺ Start over</button>
            <Link href="/dashboard/invest" style={{ flex:2, padding:'10px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>Proceed to Investments →</Link>
          </div>
        </div>
      )}
    </div>
  )
}
