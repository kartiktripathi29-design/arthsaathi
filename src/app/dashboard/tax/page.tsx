'use client'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/store/AppStore'
import Link from 'next/link'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const clamp = (v:number, max:number) => Math.min(v, max)

function projectCorpus(monthlyAmount: number, years: number, returnPct: number): number {
  const r = returnPct / 100 / 12
  const n = years * 12
  if (r === 0 || monthlyAmount === 0) return monthlyAmount * n
  return Math.round(monthlyAmount * ((Math.pow(1 + r, n) - 1) / r) * (1 + r))
}

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
  // Sync local state when the parent's value prop changes externally (auto-fill, reset, navigation back/forward).
  // Without this, the input "freezes" with whatever was in local state on mount.
  useEffect(() => {
    setLocal(value > 0 ? String(value) : '')
  }, [value])
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
function Row({ label, sectionTag, tooltip, children }: { label:string; sectionTag?:string; tooltip?:string; children?:React.ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:`1px solid #FAF7F2`, gap:12 }}>
      <div style={{ fontSize:13, color:C.text, display:'flex', flexDirection:'column' as const, gap:2 }}>
        <div style={{ display:'flex', alignItems:'center' }}>
          {label}{tooltip && <Info text={tooltip} />}
        </div>
        {sectionTag && <span style={{ fontSize:10, color:'#A09080', fontWeight:500, letterSpacing:'0.03em' }}>{sectionTag}</span>}
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
const STEPS = ['Smart','Income','HRA','Investments','Health','Other','Results']
function StepBar({ current, onJump }: { current:number; onJump?:(step:number)=>void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:22, overflowX:'auto', paddingBottom:2 }}>
      {STEPS.map((s,i) => {
        const isCompleted = i < current
        const isCurrent = i === current
        const isClickable = !isCurrent && onJump   // any step except current — both directions
        const handleClick = isClickable ? () => onJump!(i) : undefined
        return (
          <div key={s} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length-1 ? 1 : 'none' }}>
            <div
              onClick={handleClick}
              role={isClickable ? 'button' : undefined}
              title={isClickable ? `Jump to ${s}` : undefined}
              style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', gap:4, flexShrink:0, cursor:isClickable?'pointer':'default' }}>
              <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0, background:isCompleted?C.fg:isCurrent?C.wheat:'#F0EBE0', color:isCompleted?C.wheat:isCurrent?C.fg:C.muted, border:`1px solid ${i<=current?C.fg:C.border}`, transition:'transform 0.1s' }}>
                {isCompleted ? '✓' : i+1}
              </div>
              <span style={{ fontSize:9, fontWeight:isCurrent?700:400, color:i<=current?C.fg:C.muted, whiteSpace:'nowrap', textDecoration:isClickable?'underline dotted #C0B090':'none', textUnderlineOffset:'2px' }}>{s}</span>
            </div>
            {i < STEPS.length-1 && <div style={{ flex:1, height:1, background:i<current?C.fg:C.border, margin:'0 4px', marginBottom:14 }} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tax calculation engine ───────────────────────────────────────────────────
interface Deductions {
  // HRA
  rentPaid: number; hraReceived: number; isMetro: boolean
  basic: number              // monthly basic from latest salary slip (0 = fallback to 40% proxy)
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
  // Use actual basic from salary slip if available; otherwise fall back to 40% of gross as a proxy
  const basicAnnual = d.basic > 0 ? d.basic * 12 : salary * 0.4
  const hraAnnual   = d.hraReceived * 12   // monthly → annual
  const rentAnnual  = d.rentPaid * 12       // monthly → annual
  const rule1 = hraAnnual
  const rule2 = rentAnnual - 0.1 * basicAnnual
  const rule3 = d.isMetro ? 0.5 * basicAnnual : 0.4 * basicAnnual
  return Math.max(0, Math.min(rule1, Math.max(0, rule2), rule3))
}

// Tax computation handling slab + special-rate income
// `slabOther` = freelance net + F&O + intraday + FD + savings + dividends + bond interest (all slab rate)
// `equityLtcg` = LTCG from equity/MF (12.5% on amount above ₹1.25L)
// `equityStcg` = STCG from equity/MF (20% flat)
// `crypto` = crypto/VDA gains (30% flat, no deductions, no losses set-off)
// Standard deduction applies only to salary (capped). HRA exemption uses salary. Cess 4% on total tax.
interface OtherIncomeBreakdown {
  slabOther: number
  equityLtcg: number
  equityStcg: number
  crypto: number
}
function calcTax(income: number, deductions: Deductions, monthlyNet: number, otherBreakdown: OtherIncomeBreakdown = { slabOther: 0, equityLtcg: 0, equityStcg: 0, crypto: 0 }) {
  const salaryAnnual = income
  // Bug fix: savings interest entered in 80TTA field is INCOME. Add to slab total so it's taxed, then 80TTA deduction reduces it (capped).
  const savingsInterestIncome = deductions.savingsInterest || 0
  const slabOtherTotal = otherBreakdown.slabOther + savingsInterestIncome
  const slabGross = salaryAnnual + slabOtherTotal   // amount that goes into slab calculation

  // ─── Special-rate tax (same under both regimes; no deductions) ──────────────
  // Equity LTCG: 12.5% on amount above ₹1.25L
  const equityLtcgTaxable = Math.max(0, otherBreakdown.equityLtcg - 125000)
  const equityLtcgTax = Math.round(equityLtcgTaxable * 0.125)
  // Equity STCG: 20% flat
  const equityStcgTax = Math.round(otherBreakdown.equityStcg * 0.20)
  // Crypto: 30% flat
  const cryptoTax = Math.round(otherBreakdown.crypto * 0.30)
  const specialRateTax = equityLtcgTax + equityStcgTax + cryptoTax

  // ─── New regime — slab on slabGross only (special-rate income taxed separately) ──
  // FY 2025-26 + FY 2026-27 slabs (identical, per Budget 2026)
  // ₹0-4L: 0% · ₹4-8L: 5% · ₹8-12L: 10% · ₹12-16L: 15% · ₹16-20L: 20% · ₹20-24L: 25% · ₹24L+: 30%
  const newStdDed = Math.min(75000, salaryAnnual)
  const newTaxable = Math.max(0, slabGross - newStdDed)
  let newSlabTax = 0, rem = newTaxable
  for (const [l,r] of [[400000,0],[400000,0.05],[400000,0.10],[400000,0.15],[400000,0.20],[400000,0.25],[Infinity,0.30]] as [number,number][]) {
    const c = Math.min(rem, l); newSlabTax += c*r; rem-=c; if(rem<=0) break
  }
  // Section 87A rebate (New, FY 25-26 onwards): taxable ≤ ₹12L → full rebate (zero slab tax).
  // Special-rate income (LTCG/STCG/crypto) is NOT rebated.
  if (newTaxable <= 1200000) {
    newSlabTax = 0
  } else {
    // Marginal relief: tax on income just above ₹12L should not exceed (income - ₹12L).
    // Applies until tax_before_relief catches up with excess_over_12L (~₹12.75L taxable).
    const excessOver12L = newTaxable - 1200000
    if (newSlabTax > excessOver12L) {
      newSlabTax = excessOver12L
    }
  }
  const newTax = Math.round((newSlabTax + specialRateTax) * 1.04)

  // ─── Old regime — slab on (slabGross - deductions) ───────────────────────────
  // Std ded Old Regime is ₹50K (was wrongly ₹75K in earlier code)
  const oldStdDed = Math.min(50000, salaryAnnual)
  const c80 = clamp(deductions.ppf + deductions.elss + deductions.lic + deductions.homeLoanPrincipal + deductions.tuition + deductions.nsc + deductions.epf, 150000)
  const hraExempt = calcHRAExempt(deductions, salaryAnnual)
  const c80D = clamp(deductions.selfFamily, deductions.selfSenior?50000:25000) + clamp(deductions.parents, deductions.parentsSenior?50000:25000)
  const c80CCD = clamp(deductions.nps, 50000)
  const c80TTA = clamp(deductions.savingsInterest, deductions.selfSenior?50000:10000)
  const c80G = deductions.donations100 + deductions.donations50 * 0.5
  const c24B = clamp(deductions.homeLoanInterest, 200000)
  const c80E = deductions.eduLoanInterest

  const totalOldDed = oldStdDed + c80 + hraExempt + c80D + c80CCD + c80TTA + c80G + c24B + c80E
  const oldTaxable = Math.max(0, slabGross - totalOldDed)
  let oldSlabTax = 0, rem2 = oldTaxable
  for (const [l,r] of [[250000,0],[250000,0.05],[500000,0.20],[Infinity,0.30]] as [number,number][]) {
    const c = Math.min(rem2, l); oldSlabTax += c*r; rem2-=c; if(rem2<=0) break
  }
  if (oldTaxable <= 500000) oldSlabTax = 0
  const oldTax = Math.round((oldSlabTax + specialRateTax) * 1.04)

  // Total gross including special-rate income (for display only)
  const totalGross = salaryAnnual + slabOtherTotal + otherBreakdown.equityLtcg + otherBreakdown.equityStcg + otherBreakdown.crypto

  return {
    newTax, oldTax, savings: Math.abs(oldTax-newTax), recommended: (newTax<=oldTax?'new':'old') as 'new'|'old',
    deductionBreakdown: { c80, hraExempt, c80D, c80CCD, c80TTA, c80G, c24B, c80E, stdDed: oldStdDed, total: totalOldDed },
    newTaxable, oldTaxable,
    salaryAnnual, slabOther: slabOtherTotal, totalGross,
    // Special-rate breakdown (for UI display)
    equityLtcg: otherBreakdown.equityLtcg, equityStcg: otherBreakdown.equityStcg, crypto: otherBreakdown.crypto,
    equityLtcgTax, equityStcgTax, cryptoTax, specialRateTax,
    // Slab-only tax (before cess and before special-rate add)
    newSlabTax: Math.round(newSlabTax * 1.04), oldSlabTax: Math.round(oldSlabTax * 1.04),
  }
}

// ─── ITR form recommendation logic ─────────────────────────────────────────
// Recommendation based on income heads captured. Footnote acknowledges what we don't capture.
function recommendITRForm(input: {
  salaryAnnual: number
  hasFreelancePresumptive: boolean
  hasFreelanceActual: boolean
  hasFNOIntraday: boolean
  hasEquityGains: boolean
  hasCrypto: boolean
  hasInterestDividends: boolean
  totalIncome: number
}): { form: string; reasonShort: string; reasonDetail: string } {
  const { hasFreelancePresumptive, hasFreelanceActual, hasFNOIntraday, hasEquityGains, hasCrypto, totalIncome } = input
  const hasBusinessIncome = hasFNOIntraday || hasFreelanceActual
  const hasPresumptiveOnly = hasFreelancePresumptive && !hasBusinessIncome
  const hasCapitalGains = hasEquityGains || hasCrypto

  if (hasBusinessIncome) {
    const trigger = hasFNOIntraday ? 'F&O / Intraday trading' : 'Freelance income declared on actual basis'
    return { form: 'ITR-3', reasonShort: trigger, reasonDetail: `You need ITR-3 because of: ${trigger}. ITR-3 covers business or professional income alongside salary, capital gains, and other heads.` }
  }
  if (hasPresumptiveOnly && totalIncome < 5000000 && !hasCapitalGains) {
    return { form: 'ITR-4', reasonShort: 'Presumptive freelance income (44ADA)', reasonDetail: `ITR-4 (Sugam) is the simplified form for salaried users with presumptive freelance income (Section 44ADA), no capital gains, and total income under ₹50L.` }
  }
  if (hasCapitalGains) {
    const heads: string[] = []
    if (hasEquityGains) heads.push('equity gains')
    if (hasCrypto) heads.push('crypto gains')
    if (hasPresumptiveOnly) heads.push('presumptive freelance income')
    return { form: 'ITR-2', reasonShort: heads.join(' + '), reasonDetail: `ITR-2 covers salary + capital gains (including ${heads.join(', ')}). No business income from F&O/intraday or actual freelance.` }
  }
  return { form: 'ITR-1', reasonShort: 'Salary only', reasonDetail: 'ITR-1 (Sahaj) is the simplest form — for salaried users with one house property and interest income under ₹50L total. No capital gains, no business income.' }
}

// ─── Marginal slab rate for Old Regime (used for headroom math) ───────────────
// Returns the effective tax-saved rate (slab rate × 1.04 cess) for one additional rupee of deduction at current taxable income.
function oldRegimeMarginalRate(oldTaxable: number): number {
  // Old slabs cumulative: 2.5L (0%), +2.5L (5%), +5L (20%), rest (30%)
  let rate: number
  if (oldTaxable <= 250000) rate = 0
  else if (oldTaxable <= 500000) rate = 0.05
  else if (oldTaxable <= 1000000) rate = 0.20
  else rate = 0.30
  return rate * 1.04   // cess
}

// ─── Headroom analysis — what user could still save ───────────────────────────
interface HeadroomItem {
  key: string
  question: string
  sectionTag: string
  currentUsed: number
  cap: number
  unused: number
  taxSaved: number
}
function computeHeadroom(d: Deductions, oldTaxable: number): HeadroomItem[] {
  const mRate = oldRegimeMarginalRate(oldTaxable)
  if (mRate === 0) return []   // user already pays no tax — no headroom value
  const used80C = clamp(d.ppf + d.elss + d.lic + d.homeLoanPrincipal + d.tuition + d.nsc + d.epf, 150000)
  const usedNPS = clamp(d.nps, 50000)
  const cap80D_self = d.selfSenior ? 50000 : 25000
  const cap80D_parents = d.parentsSenior ? 50000 : 25000
  const used80D_self = clamp(d.selfFamily, cap80D_self)
  const used80D_parents = clamp(d.parents, cap80D_parents)
  const used24B = clamp(d.homeLoanInterest, 200000)
  const cap80TTA = d.selfSenior ? 50000 : 10000
  const used80TTA = clamp(d.savingsInterest, cap80TTA)

  const raw: HeadroomItem[] = [
    { key: '80C', question: 'Tax-saving investments (PPF / ELSS / LIC / home loan principal / etc.)', sectionTag: 'Section 80C', currentUsed: used80C, cap: 150000, unused: 150000 - used80C, taxSaved: 0 },
    { key: '80CCD', question: 'NPS additional contribution', sectionTag: 'Section 80CCD(1B)', currentUsed: usedNPS, cap: 50000, unused: 50000 - usedNPS, taxSaved: 0 },
    { key: '80D_self', question: 'Health insurance for yourself and family', sectionTag: 'Section 80D — Self & Family', currentUsed: used80D_self, cap: cap80D_self, unused: cap80D_self - used80D_self, taxSaved: 0 },
    { key: '80D_par', question: 'Health insurance for parents', sectionTag: 'Section 80D — Parents', currentUsed: used80D_parents, cap: cap80D_parents, unused: cap80D_parents - used80D_parents, taxSaved: 0 },
    { key: '24B', question: 'Home loan interest', sectionTag: 'Section 24(b)', currentUsed: used24B, cap: 200000, unused: 200000 - used24B, taxSaved: 0 },
    { key: '80TTA', question: d.selfSenior ? 'Savings + FD interest' : 'Savings account interest', sectionTag: d.selfSenior ? 'Section 80TTB' : 'Section 80TTA', currentUsed: used80TTA, cap: cap80TTA, unused: cap80TTA - used80TTA, taxSaved: 0 },
  ]
  return raw
    .map(item => ({ ...item, taxSaved: Math.round(item.unused * mRate) }))
    .filter(item => item.unused >= 5000)   // skip noise
    .sort((a, b) => b.taxSaved - a.taxSaved)
}

// ─── Initial deductions state ─────────────────────────────────────────────────
const defaultDed: Deductions = { rentPaid:0, hraReceived:0, isMetro:true, basic:0, ppf:0, elss:0, lic:0, homeLoanPrincipal:0, tuition:0, nsc:0, epf:0, selfFamily:0, parents:0, parentsSenior:false, selfSenior:false, nps:0, savingsInterest:0, donations100:0, donations50:0, homeLoanInterest:0, eduLoanInterest:0 }

const STEP_LABELS = ['Smart','Income','HRA','Investments','Health','Other','Results']

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TaxPage() {
  const { salary } = useAppStore()
  const [step, setStep] = useState(-1) // -1 = welcome screen
  const [ded, setDed] = useState<Deductions>(defaultDed)
  // ─── Other Income state (Build 4 Phase 2) — read av_other_income, compute by tax-rate ───
  const [otherBreakdown, setOtherBreakdown] = useState<OtherIncomeBreakdown>({ slabOther: 0, equityLtcg: 0, equityStcg: 0, crypto: 0 })
  const [otherTDS, setOtherTDS] = useState(0)
  const [otherSources, setOtherSources] = useState<Array<{
    sourceName: string; type: string; slab: number; ltcg: number; stcg: number; crypto: number; tds: number; method: string
  }>>([])
  const [hasFreelancePresumptive, setHasFreelancePresumptive] = useState(false)
  const [hasFreelanceActual, setHasFreelanceActual] = useState(false)
  const [hasFNOIntraday, setHasFNOIntraday] = useState(false)
  const [hasEquityGains, setHasEquityGains] = useState(false)
  const [hasCrypto, setHasCrypto] = useState(false)
  const [hasInterestDividends, setHasInterestDividends] = useState(false)
  useEffect(() => {
    try {
      const ois = localStorage.getItem('av_other_income')
      if (!ois) return
      const store = JSON.parse(ois)
      const breakdown: OtherIncomeBreakdown = { slabOther: 0, equityLtcg: 0, equityStcg: 0, crypto: 0 }
      let totTDS = 0
      const sources: Array<{ sourceName: string; type: string; slab: number; ltcg: number; stcg: number; crypto: number; tds: number; method: string }> = []
      let hPresump = false, hActual = false, hFNO = false, hEquity = false, hCrypto = false, hIntDiv = false
      for (const e of (store.entries || [])) {
        let slab = 0, ltcg = 0, stcg = 0, crypto = 0, tds = 0, method = ''
        if (e.type === 'freelance') {
          slab = e.declarationMethod === 'presumptive_44ada'
            ? Math.round(e.grossReceipts * 0.5)
            : Math.max(0, e.grossReceipts - (e.expenses || 0))
          tds = e.tdsDeducted || 0
          method = e.declarationMethod
          if (e.declarationMethod === 'presumptive_44ada') hPresump = true; else hActual = true
        } else if (e.type === 'equity') {
          ltcg = e.ltcgGains || 0
          stcg = e.stcgGains || 0
          if (ltcg > 0 || stcg > 0) hEquity = true
        } else if (e.type === 'crypto') {
          crypto = e.cryptoGains || 0
          tds = e.cryptoTds194S || 0
          if (crypto > 0) hCrypto = true
        } else if (e.type === 'fno_intraday') {
          slab = e.fnoNetProfit || 0
          tds = e.fnoTdsDeducted || 0
          if (slab > 0) hFNO = true
        } else if (e.type === 'interest_div') {
          slab = (e.fdInterest || 0) + (e.savingsInterest || 0) + (e.dividends || 0) + (e.otherInterest || 0)
          tds = e.interestTds || 0
          if (slab > 0) hIntDiv = true
        }
        breakdown.slabOther += slab
        breakdown.equityLtcg += ltcg
        breakdown.equityStcg += stcg
        breakdown.crypto += crypto
        totTDS += tds
        sources.push({ sourceName: e.sourceName, type: e.type, slab, ltcg, stcg, crypto, tds, method })
      }
      setOtherBreakdown(breakdown)
      setOtherTDS(totTDS)
      setOtherSources(sources)
      setHasFreelancePresumptive(hPresump); setHasFreelanceActual(hActual)
      setHasFNOIntraday(hFNO); setHasEquityGains(hEquity); setHasCrypto(hCrypto); setHasInterestDividends(hIntDiv)
    } catch {}
  }, [])
  // For backward-compat with display code that reads a single number
  const otherTaxable = otherBreakdown.slabOther + otherBreakdown.equityLtcg + otherBreakdown.equityStcg + otherBreakdown.crypto
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
        if (d.ded) setDed({ ...defaultDed, ...d.ded })
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

  // Save progress on every change of step or ded — useEffect-based to avoid closure staleness.
  // skipFirstSaveRef prevents the save from firing on initial mount (when ded === defaultDed),
  // which would otherwise wipe out the localStorage we just loaded from.
  const skipFirstSaveRef = useRef(true)
  useEffect(() => {
    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false
      return
    }
    try { localStorage.setItem('av_tax_progress', JSON.stringify({ step, ded })) } catch {}
  }, [step, ded])

  const goStep = (s: number) => { setStep(s) }
  const updateDed = (k: keyof Deductions) => (v: number | boolean) => {
    setDed(prev => ({ ...prev, [k]: v }))
  }
  const reset = () => {
    setStep(-1)
    setDed(defaultDed)
    try { localStorage.removeItem('av_tax_progress') } catch {}
  }

  const tax = (annual || otherTaxable) ? calcTax(annual, ded, salary?.netSalary||0, otherBreakdown) : null

  // ─── Smart Deductions: auto-detect from profile data ──────────────────────
  const [autoDetected, setAutoDetected] = useState<{key:string; label:string; section:string; amount:number; source:string; icon:string}[]>([])

  useEffect(() => {
    try {
      const detected: {key:string; label:string; section:string; amount:number; source:string; icon:string}[] = []
      const sb = localStorage.getItem('av_salary_breakdown')
      if (sb) {
        const breakdown = JSON.parse(sb)
        if (breakdown.employeePF > 0) {
          const a = breakdown.employeePF * 12
          detected.push({ key:'epf', label:'Employee PF', section:'80C', amount:a, source:'salary slip', icon:'🏛️' })
          setDed(prev => ({ ...prev, epf: prev.epf || a }))
        }
      }
      const profile = localStorage.getItem('av_profile')
      if (profile) {
        const p = JSON.parse(profile)
        const sip = (p.savings||[]).find((s:any) => s.label?.toLowerCase().includes('sip') || s.label?.toLowerCase().includes('elss') || s.label?.toLowerCase().includes('mutual'))
        if (sip?.amount) {
          const a = sip.amount * 12
          detected.push({ key:'elss', label:'ELSS / SIP', section:'80C', amount:a, source:'expenses profile', icon:'📈' })
          setDed(prev => ({ ...prev, elss: prev.elss || a }))
        }
        const health = (p.expenses||[]).find((e:any) => e.label?.toLowerCase().includes('health') || e.label?.toLowerCase().includes('insurance') || e.label?.toLowerCase().includes('mediclaim'))
        if (health?.amount) {
          const a = Math.min(health.amount * 12, 25000)
          detected.push({ key:'selfFamily', label:'Health Insurance', section:'80D', amount:a, source:'expenses profile', icon:'💊' })
          setDed(prev => ({ ...prev, selfFamily: prev.selfFamily || a }))
        }
        const lic = (p.expenses||[]).find((e:any) => e.label?.toLowerCase().includes('lic') || e.label?.toLowerCase().includes('life insurance'))
        if (lic?.amount) {
          const a = lic.amount * 12
          detected.push({ key:'lic', label:'LIC Premium', section:'80C', amount:a, source:'expenses profile', icon:'🛡️' })
          setDed(prev => ({ ...prev, lic: prev.lic || a }))
        }
      }
      const banks = localStorage.getItem('av_banks')
      if (banks) {
        const accs = JSON.parse(banks)
        let totalInterest = 0
        accs.forEach((acc:any) => {
          (acc.data?.transactions||[]).forEach((t:any) => {
            const desc = (t.description||t.narration||'').toUpperCase()
            if ((desc.includes('INT.PD') || desc.includes('INTEREST') || desc.includes('INT PD')) && t.type === 'credit') totalInterest += t.amount || 0
          })
        })
        if (totalInterest > 0) {
          detected.push({ key:'savingsInterest', label:'Savings Interest', section:'80TTA', amount:Math.min(totalInterest, 10000), source:'bank statement', icon:'🏦' })
          setDed(prev => ({ ...prev, savingsInterest: prev.savingsInterest || Math.min(totalInterest, 10000) }))
        }
      }
      setAutoDetected(detected)
    } catch {}
  }, [])

  const corpusItems = useMemo(() => {
    const items: {label:string; annualAmount:number; corpus10yr:number}[] = []
    if (ded.epf > 0) items.push({ label:'Employee PF', annualAmount:ded.epf, corpus10yr:projectCorpus(Math.round(ded.epf/12), 10, 8.15) })
    if (ded.elss > 0) items.push({ label:'ELSS SIP', annualAmount:ded.elss, corpus10yr:projectCorpus(Math.round(ded.elss/12), 10, 12) })
    if (ded.ppf > 0) items.push({ label:'PPF', annualAmount:ded.ppf, corpus10yr:projectCorpus(Math.round(ded.ppf/12), 10, 7.1) })
    if (ded.nps > 0) items.push({ label:'NPS', annualAmount:ded.nps, corpus10yr:projectCorpus(Math.round(ded.nps/12), 10, 10) })
    if (ded.nsc > 0) items.push({ label:'NSC/FD', annualAmount:ded.nsc, corpus10yr:projectCorpus(Math.round(ded.nsc/12), 10, 7.7) })
    return items
  }, [ded.epf, ded.elss, ded.ppf, ded.nps, ded.nsc])
  const totalCorpusAnnual = corpusItems.reduce((s,i) => s + i.annualAmount, 0)
  const totalCorpus10yr = corpusItems.reduce((s,i) => s + i.corpus10yr, 0)

  const sCard = { background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 } as React.CSSProperties
  const sCH   = { padding:'9px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, display:'flex', justifyContent:'space-between', alignItems:'center' }

  if (!annual && otherTaxable === 0) return (
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
              {savedStep > 0 ? `Resume from ${STEP_LABELS[savedStep]} →` : 'Start →'}
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

      <StepBar current={step} onJump={goStep} />

      {/* ── STEP 0: Smart Deductions ── */}
      {step === 0 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>💡 Smart Deductions — auto-detected from your profile</div>
            <div style={{ padding:'12px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.muted, lineHeight:1.65 }}>
              We scanned your salary slip, bank statement, and expenses to find deductions you're already making. Every rupee here is building your corpus — whether or not it saves tax.
            </div>
            {autoDetected.length > 0 ? autoDetected.map((item, i) => (
              <div key={item.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:i < autoDetected.length - 1 ? '1px solid #FAF7F2' : `1px solid ${C.border}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:16 }}>{item.icon}</span>
                  <div>
                    <span style={{ fontSize:12.5, color:C.text, fontWeight:500 }}>{item.label}</span>
                    <span style={{ fontSize:10, color:C.muted, marginLeft:6 }}>({item.section})</span>
                    <p style={{ fontSize:10, color:C.muted, margin:'2px 0 0' }}>from {item.source}</p>
                  </div>
                </div>
                <div style={{ textAlign:'right' as const }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#2A7A4A' }}>{fmt(item.amount)}/yr</span>
                  <span style={{ fontSize:10, color:'#2A7A4A', background:'#EEF2EE', padding:'1px 5px', borderRadius:3, marginLeft:6 }}>✓ detected</span>
                </div>
              </div>
            )) : (
              <div style={{ padding:'16px 14px', textAlign:'center', color:C.muted, fontSize:12 }}>
                No deductions auto-detected. Upload a salary slip and bank statement in My Profile for auto-detection, or add manually in the next steps.
              </div>
            )}
            {(() => {
              const notDetected: {label:string; icon:string}[] = []
              if (!autoDetected.find(d => d.key === 'epf')) notDetected.push({ label:'Provident Fund (auto from payslip)', icon:'🏛️' })
              if (!autoDetected.find(d => d.key === 'elss')) notDetected.push({ label:'Mutual fund SIPs / ELSS', icon:'📈' })
              if (!autoDetected.find(d => d.key === 'selfFamily')) notDetected.push({ label:'Health insurance premiums', icon:'💊' })
              if (ded.nps === 0) notDetected.push({ label:'NPS (80CCD1B)', icon:'🏢' })
              if (ded.homeLoanInterest === 0) notDetected.push({ label:'Home Loan Interest (24B)', icon:'🏠' })
              if (ded.rentPaid === 0) notDetected.push({ label:'HRA (Rent)', icon:'🏘️' })
              if (notDetected.length === 0) return null
              return (
                <div style={{ padding:'10px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}` }}>
                  <p style={{ fontSize:10, fontWeight:700, color:C.muted, margin:'0 0 6px', letterSpacing:'0.05em', textTransform:'uppercase' as const }}>Not detected — add manually in next steps</p>
                  <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6 }}>
                    {notDetected.map(item => (
                      <span key={item.label} style={{ fontSize:10.5, padding:'3px 8px', background:C.wl, border:`1px solid ${C.wm}`, borderRadius:3, color:C.muted }}>{item.icon} {item.label}</span>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
          {totalCorpusAnnual > 0 && (
            <div style={sCard}>
              <div style={sCH}>📊 Wealth being built from your deductions</div>
              <div style={{ padding:'12px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.muted, lineHeight:1.65 }}>
                Tax benefit is one thing. But these are also investments that compound. Here's what they become in 10 years.
              </div>
              {corpusItems.map((item, i) => (
                <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', borderBottom:i < corpusItems.length - 1 ? '1px solid #FAF7F2' : `1px solid ${C.border}` }}>
                  <div>
                    <span style={{ fontSize:12.5, color:C.text }}>{item.label}</span>
                    <p style={{ fontSize:10, color:C.muted, margin:'2px 0 0' }}>{fmt(item.annualAmount)}/yr invested</p>
                  </div>
                  <div style={{ textAlign:'right' as const }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C.fg }}>{fmt(item.corpus10yr)}</span>
                    <p style={{ fontSize:10, color:'#2A7A4A', margin:'1px 0 0' }}>in 10 years</p>
                  </div>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'11px 14px', background:C.wl, fontWeight:700, fontSize:13.5, color:C.fg }}>
                <span>Total corpus in 10 years</span>
                <span>{fmt(totalCorpus10yr)}</span>
              </div>
              <div style={{ padding:'10px 14px', fontSize:11.5, color:C.muted, lineHeight:1.6 }}>
                {fmt(totalCorpusAnnual)}/yr going into long-term wealth. Even if your tax is ₹0 under New Regime, this money is compounding. Keep going.
              </div>
            </div>
          )}
          <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:6, padding:'14px 16px', marginBottom:14 }}>
            <p style={{ fontSize:12, fontWeight:700, color:C.fg, margin:'0 0 6px' }}>📋 Quick Regime Check</p>
            {(annual + otherTaxable) <= 1200000 ? (
              <p style={{ fontSize:12, color:C.text, margin:0, lineHeight:1.65 }}>
                Your gross income is {fmt(annual + otherTaxable)}/yr{otherTaxable > 0 ? ' (salary + other income)' : ''} — under ₹12L. <strong>New Regime gives you zero tax.</strong> But your deductions ({fmt(totalCorpusAnnual)}/yr in PF, ELSS, etc.) are still building wealth regardless of regime.
              </p>
            ) : (
              <p style={{ fontSize:12, color:C.text, margin:0, lineHeight:1.65 }}>
                Your gross income is {fmt(annual + otherTaxable)}/yr{otherTaxable > 0 ? ' (salary + other income)' : ''} — above ₹12L. The right regime depends on your total deductions.{tax && tax.recommended === 'old' ? ` Based on detected deductions, Old Regime could save you ${fmt(tax.savings)}.` : " New Regime is likely better, but let's verify."}
              </p>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => goStep(6)} style={{ flex:1, padding:'10px', background:C.card, color:C.fg, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>Skip → See results</button>
            <button onClick={() => goStep(1)} style={{ flex:2, padding:'10px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Customize deductions →</button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Income ── */}
      {step === 1 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>Your income — FY 2026-27</div>
            <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                { l:'Gross salary / year', v:fmt(annual) },
                { l:'Monthly take-home', v:fmt(salary?.netSalary||0) },
                { l:'Employer', v:salary?.employerName||'—' },
                { l:'Standard deduction (auto)', v:'₹75K (New) / ₹50K (Old)' },
              ].map(s => (
                <div key={s.l} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{s.l}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.v}</div>
                </div>
              ))}
            </div>
            {otherSources.length > 0 && (
              <>
                <div style={{ padding:'10px 16px', background:'#FAF7F2', borderTop:`1px solid ${C.border}`, fontSize:11, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.04em', fontWeight:600 }}>Other Income</div>
                {otherSources.map((s, i) => {
                  const totalForSource = s.slab + s.ltcg + s.stcg + s.crypto
                  let label = ''
                  if (s.type === 'freelance') label = `Freelance · ${s.method === 'presumptive_44ada' ? 'Section 44ADA (50% taxable)' : 'actual income basis'}`
                  else if (s.type === 'equity') label = `Equity · ${s.ltcg > 0 ? `LTCG ${fmt(s.ltcg)}` : ''}${s.ltcg > 0 && s.stcg > 0 ? ' · ' : ''}${s.stcg > 0 ? `STCG ${fmt(s.stcg)}` : ''} (taxed separately at LTCG/STCG rates)`
                  else if (s.type === 'crypto') label = `Crypto · 30% flat tax`
                  else if (s.type === 'fno_intraday') label = `F&O / Intraday · taxed at slab rate`
                  else if (s.type === 'interest_div') label = `Interest & dividends · slab rate`
                  return (
                    <div key={i} style={{ padding:'10px 16px', borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                      <div>
                        <div style={{ color:C.text, fontWeight:500 }}>{s.sourceName}</div>
                        <div style={{ color:C.muted, fontSize:10.5, marginTop:2 }}>{label}{s.tds > 0 ? ` · TDS ${fmt(s.tds)}` : ''}</div>
                      </div>
                      <div style={{ fontWeight:700, color:C.text, fontVariantNumeric:'tabular-nums' as const }}>{fmt(totalForSource)}</div>
                    </div>
                  )
                })}
                <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.fg}`, background:C.wl, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:C.fg }}>
                  <span>Total income from other sources</span>
                  <span style={{ fontVariantNumeric:'tabular-nums' as const }}>{fmt(otherTaxable)}</span>
                </div>
              </>
            )}
            <div style={{ padding:'10px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}`, fontSize:12, color:C.muted, lineHeight:1.65 }}>
              Standard deduction applies to salary income only — ₹75,000 under New Regime, ₹50,000 under Old Regime. The next steps find additional deductions for Old Regime — which may or may not save more than New Regime based on your actual investments.{otherTaxable > 0 ? ' HRA exemption applies to salary income only.' : ''}
            </div>
          </div>
          <NavButtons onReset={reset} onProceed={() => goStep(2)} proceedLabel="Proceed to HRA →" />
        </div>
      )}

      {/* ── STEP 1: HRA ── */}
      {step === 2 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>
              <span>Rent & House Rent Allowance
                <Info text="The HRA exemption is the MINIMUM of 3 values: (1) Actual HRA received, (2) Rent paid minus 10% of basic salary, (3) 50% of basic if metro / 40% if non-metro. Only applicable in Old Regime." />
              </span>
            </div>
            <div style={{ padding:'12px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:12, color:C.muted, lineHeight:1.65 }}>
              If you pay rent and receive HRA in your salary, part of it is tax-exempt. Skip this section if you own your home or don't receive HRA.
            </div>
            <Row label="How much rent do you pay each month?" sectionTag="Section 10(13A) — HRA exemption"><AmtInput value={ded.rentPaid} onChange={updateDed('rentPaid')} /></Row>
            <Row label="Monthly HRA shown in your salary slip" sectionTag="House Rent Allowance"><AmtInput value={ded.hraReceived} onChange={updateDed('hraReceived')} /></Row>
            <Row label="Which city do you live in?" sectionTag="Metro cities (8): Delhi, Mumbai, Chennai, Kolkata, Bengaluru, Hyderabad, Pune, Ahmedabad — get 50% of basic. All others get 40%.">
              <div style={{ display:'flex', gap:6 }}>
                {[['Metro (Delhi/Mumbai/Chennai/Kolkata/Bengaluru/Hyderabad/Pune/Ahmedabad)', true], ['Non-Metro', false]].map(([l, v]) => (
                  <button key={String(v)} onClick={() => updateDed('isMetro')(v as boolean)}
                    style={{ padding:'6px 12px', borderRadius:4, border:`1px solid ${ded.isMetro===v?C.fg:C.border}`, background:ded.isMetro===v?C.wl:C.card, color:ded.isMetro===v?C.fg:C.muted, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', fontWeight:ded.isMetro===v?600:400 }}>
                    {String(l)}
                  </button>
                ))}
              </div>
            </Row>
            {ded.rentPaid > 0 && ded.hraReceived > 0 && (() => {
              const basicAnnualDisplay = ded.basic > 0 ? ded.basic * 12 : annual * 0.4
              const basicLabel = ded.basic > 0 ? 'basic salary (from your slip)' : 'basic salary (estimated as 40% of gross)'
              return (
              <div style={{ padding:'12px 14px', background:C.wl, borderTop:`1px solid ${C.border}` }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:8, lineHeight:1.6 }}>
                  <strong style={{ color:C.fg }}>How your HRA exemption is calculated:</strong><br/>
                  Rule 1 — Actual HRA received: <strong>{fmt(ded.hraReceived*12)}/yr</strong><br/>
                  Rule 2 — Rent minus 10% of {basicLabel}: <strong>{fmt(Math.max(0, ded.rentPaid*12 - 0.1*basicAnnualDisplay))}/yr</strong><br/>
                  Rule 3 — {ded.isMetro?'50%':'40%'} of {basicLabel}: <strong>{fmt(basicAnnualDisplay*(ded.isMetro?0.5:0.4))}/yr</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C.fg }}>Your HRA exemption (minimum of 3)</span>
                  <span style={{ fontSize:17, fontWeight:700, color:C.fg }}>{fmt(calcHRAExempt(ded, annual))}</span>
                </div>
              </div>
              )
            })()}
          </div>
          <NavButtons onBack={() => goStep(1)} onReset={reset} onProceed={() => goStep(3)} proceedLabel="Proceed to Investments →" />
        </div>
      )}

      {/* ── STEP 2: 80C ── */}
      {step === 3 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>Tax-Saving Investments & Payments <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Section 80C · cap ₹1,50,000</span></div>
            <DeductionBar used={clamp(ded.ppf+ded.elss+ded.lic+ded.homeLoanPrincipal+ded.tuition+ded.nsc+ded.epf,150000)} max={150000} label="Tax-saving investments used (₹1.5L cap)" />
            <Row label="Did you invest in PPF this year?" sectionTag="Section 80C — Public Provident Fund"><AmtInput value={ded.ppf} onChange={updateDed('ppf')} /></Row>
            <Row label="Did you invest in ELSS (tax-saver mutual fund)?" sectionTag="Section 80C — Equity-Linked Savings Scheme"><AmtInput value={ded.elss} onChange={updateDed('elss')} /></Row>
            <Row label="Do you pay premiums for life insurance (LIC etc.)?" sectionTag="Section 80C — Life insurance"><AmtInput value={ded.lic} onChange={updateDed('lic')} /></Row>
            <Row label="Are you repaying a home loan? Enter principal paid this year." sectionTag="Section 80C — Home loan principal"><AmtInput value={ded.homeLoanPrincipal} onChange={updateDed('homeLoanPrincipal')} /></Row>
            <Row label="Do you pay school/college fees for your children?" sectionTag="Section 80C — Children's tuition"><AmtInput value={ded.tuition} onChange={updateDed('tuition')} /></Row>
            <Row label="Did you invest in NSC, tax-saver FD, or SCSS?" sectionTag="Section 80C — Other instruments"><AmtInput value={ded.nsc} onChange={updateDed('nsc')} /></Row>
            <Row label="Your EPF contribution (we already filled this from your slip)" sectionTag="Section 80C — Provident Fund"><AmtInput value={ded.epf} onChange={updateDed('epf')} /></Row>
            <div style={{ padding:'10px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}`, fontSize:11.5, color:C.muted, lineHeight:1.65 }}>
              All of the above pool into a single ₹1,50,000 limit. Any amount beyond ₹1.5L gives no additional benefit in Old Regime.
            </div>
          </div>
          <NavButtons onBack={() => goStep(2)} onReset={reset} onProceed={() => goStep(4)} proceedLabel="Proceed to Health Insurance →" />
        </div>
      )}

      {/* ── STEP 3: 80D ── */}
      {step === 4 && (
        <div>
          <div style={sCard}>
            <div style={sCH}>Health Insurance Premiums <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Section 80D · save up to ₹75K</span></div>
            <div style={{ padding:'10px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:11.5, color:C.muted, lineHeight:1.65 }}>
              Premiums you pay for health insurance reduce your taxable income. You can claim for yourself + family, and separately for parents. Senior citizens (60+) get a higher limit.
            </div>
            <Row label="Are you 60 or older?" sectionTag="Affects max 80D limit">
              <div style={{ display:'flex', gap:6 }}>
                {[['Yes', true], ['No', false]].map(([l,v]) => (
                  <button key={String(v)} onClick={() => updateDed('selfSenior')(v as boolean)}
                    style={{ padding:'6px 14px', borderRadius:4, border:`1px solid ${ded.selfSenior===v?C.fg:C.border}`, background:ded.selfSenior===v?C.wl:C.card, color:ded.selfSenior===v?C.fg:C.muted, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', fontWeight:ded.selfSenior===v?600:400 }}>
                    {String(l)}
                  </button>
                ))}
              </div>
            </Row>
            <Row label={`Annual health insurance premium for you and your family (cap ${fmt(ded.selfSenior?50000:25000)})`} sectionTag="Section 80D — Self & Family">
              <AmtInput value={ded.selfFamily} onChange={updateDed('selfFamily')} max={ded.selfSenior?50000:25000} />
            </Row>
            <Row label="Are your parents 60 or older?" sectionTag="Senior citizens get higher 80D limit">
              <div style={{ display:'flex', gap:6 }}>
                {[['Yes', true], ['No', false]].map(([l,v]) => (
                  <button key={String(v)} onClick={() => updateDed('parentsSenior')(v as boolean)}
                    style={{ padding:'6px 14px', borderRadius:4, border:`1px solid ${ded.parentsSenior===v?C.fg:C.border}`, background:ded.parentsSenior===v?C.wl:C.card, color:ded.parentsSenior===v?C.fg:C.muted, fontSize:11.5, cursor:'pointer', fontFamily:'inherit', fontWeight:ded.parentsSenior===v?600:400 }}>
                    {String(l)}
                  </button>
                ))}
              </div>
            </Row>
            <Row label={`Annual health insurance premium for your parents (cap ${fmt(ded.parentsSenior?50000:25000)})`} sectionTag="Section 80D — Parents">
              <AmtInput value={ded.parents} onChange={updateDed('parents')} max={ded.parentsSenior?50000:25000} />
            </Row>
            <div style={{ padding:'10px 14px', background:C.wl, borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:12.5, fontWeight:600, color:C.fg }}>Total 80D deduction</span>
              <span style={{ fontSize:15, fontWeight:700, color:C.fg }}>{fmt(clamp(ded.selfFamily, ded.selfSenior?50000:25000) + clamp(ded.parents, ded.parentsSenior?50000:25000))}</span>
            </div>
          </div>
          <NavButtons onBack={() => goStep(3)} onReset={reset} onProceed={() => goStep(5)} proceedLabel="Proceed to Other Deductions →" />
        </div>
      )}

      {/* ── STEP 4: Other deductions ── */}
      {step === 5 && (
        <div>
          {/* 80CCD(1B) */}
          <div style={sCard}>
            <div style={sCH}>
              <span>NPS — Extra retirement savings, extra tax break
                <Info text="This is SEPARATE from 80C. You get an extra ₹50,000 deduction for investing in NPS (National Pension Scheme) over and above the ₹1.5L 80C limit. Total tax benefit can be 80C (₹1.5L) + 80CCD(1B) (₹50K) = ₹2L." />
              </span>
              <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Section 80CCD(1B) · cap ₹50,000</span>
            </div>
            <Row label="Did you invest in NPS this year? (beyond what your employer contributes)" sectionTag="Section 80CCD(1B) — extra ₹50,000 deduction beyond 80C"><AmtInput value={ded.nps} onChange={updateDed('nps')} max={50000} /></Row>
          </div>

          {/* 24B */}
          <div style={sCard}>
            <div style={sCH}>
              <span>Home Loan Interest
                <Info text="Not to be confused with 80C (home loan principal). This is the INTEREST portion of your home loan EMI. You can claim up to ₹2,00,000/year on a self-occupied property. No limit for let-out property." />
              </span>
              <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Section 24(b) · cap ₹2,00,000</span>
            </div>
            <Row label="Are you paying a home loan? Enter interest paid this year." sectionTag="Section 24(b) — home loan interest (cap ₹2L)"><AmtInput value={ded.homeLoanInterest} onChange={updateDed('homeLoanInterest')} max={200000} /></Row>
          </div>

          {/* 80TTA */}
          <div style={sCard}>
            <div style={sCH}>
              <span>Interest from Savings Account
                <Info text="Interest earned from your savings bank account (NOT FD) is exempt up to ₹10,000. If you're a senior citizen, use 80TTB instead — it covers both savings and FD interest up to ₹50,000." />
              </span>
              <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>{ded.selfSenior?'Section 80TTB · cap ₹50,000':'Section 80TTA · cap ₹10,000'}</span>
            </div>
            <Row label={ded.selfSenior?'Total interest earned from savings + FDs this year':'Total interest earned from savings account this year'} sectionTag={ded.selfSenior?'Section 80TTB — first ₹50K tax-free (senior citizens)':'Section 80TTA — first ₹10K tax-free'}><AmtInput value={ded.savingsInterest} onChange={updateDed('savingsInterest')} max={ded.selfSenior?50000:10000} /></Row>
          </div>

          {/* 80E */}
          <div style={sCard}>
            <div style={sCH}>Education Loan Interest <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Section 80E · no cap</span></div>
            <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:11.5, color:C.muted }}>The entire interest paid on an education loan is deductible. Available for 8 years or until interest is fully repaid.</div>
            <Row label="Are you paying an education loan? Enter interest paid this year." sectionTag="Section 80E — education loan interest (no cap)"><AmtInput value={ded.eduLoanInterest} onChange={updateDed('eduLoanInterest')} /></Row>
          </div>

          {/* 80G */}
          <div style={sCard}>
            <div style={sCH}>
              <span>Donations to Charities & Relief Funds
                <Info text="Donations to government-approved funds qualify. PM Relief Fund, CMs Relief Fund = 100% deduction. Most charitable trusts = 50% deduction. Cash donations above ₹2,000 are NOT eligible." />
              </span>
              <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Section 80G</span>
            </div>
            <Row label="Donations to government relief funds (PM, CM relief etc.)" sectionTag="Section 80G — 100% deduction"><AmtInput value={ded.donations100} onChange={updateDed('donations100')} /></Row>
            <Row label="Donations to charitable trusts / NGOs" sectionTag="Section 80G — 50% deduction"><AmtInput value={ded.donations50} onChange={updateDed('donations50')} /></Row>
          </div>

          <NavButtons onBack={() => goStep(4)} onReset={reset} onProceed={() => goStep(6)} proceedLabel="See my tax results →" />
        </div>
      )}

      {/* ── STEP 5: Results ── */}
      {step === 6 && tax && (
        <div>
          {/* Stat strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:20 }}>
            {[
              { l:otherTaxable > 0 ? 'Total annual income (salary + other)' : 'Gross annual income', v:fmt(annual + otherTaxable) },
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
              { l:'Rent / HRA exemption', v:tax.deductionBreakdown.hraExempt },
              { l:'Tax-saving investments & payments', v:tax.deductionBreakdown.c80 },
              { l:'Health insurance premiums', v:tax.deductionBreakdown.c80D },
              { l:'NPS additional', v:tax.deductionBreakdown.c80CCD },
              { l:'Savings account interest', v:tax.deductionBreakdown.c80TTA },
              { l:'Home loan interest', v:tax.deductionBreakdown.c24B },
              { l:'Education loan interest', v:tax.deductionBreakdown.c80E },
              { l:'Donations', v:tax.deductionBreakdown.c80G },
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

          {/* ── ITR Form Recommendation ── */}
          {(() => {
            const itr = recommendITRForm({
              salaryAnnual: annual,
              hasFreelancePresumptive, hasFreelanceActual,
              hasFNOIntraday, hasEquityGains, hasCrypto, hasInterestDividends,
              totalIncome: annual + otherTaxable,
            })
            return (
              <div style={{ ...sCard, marginBottom:16 }}>
                <div style={sCH}>Which ITR form should you file?</div>
                <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ flexShrink:0, padding:'10px 14px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:18, fontWeight:700, letterSpacing:'0.02em' }}>
                    {itr.form}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.04em', marginBottom:3, fontWeight:600 }}>Recommended form</div>
                    <div style={{ fontSize:12.5, color:C.text, lineHeight:1.55 }}>{itr.reasonDetail}</div>
                  </div>
                </div>
                <div style={{ padding:'10px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}`, fontSize:11, color:C.muted, lineHeight:1.55, fontStyle:'italic' as const }}>
                  Based on what you've told us. If you have rental income, property sales, or foreign income, your ITR form may differ — confirm with a CA before filing.
                </div>
              </div>
            )
          })()}

          {/* ── Headroom analysis: where the user can save more ── */}
          {(() => {
            const headroom = computeHeadroom(ded, tax.oldTaxable)
            if (headroom.length === 0) return null
            const totalSavings = headroom.reduce((s, h) => s + h.taxSaved, 0)
            const isNewRecommended = tax.recommended === 'new'
            return (
              <div style={{ ...sCard, marginBottom:16 }}>
                <div style={sCH}>Where you can save more this year <span style={{ fontSize:10, background:C.fg, color:C.wheat, padding:'2px 8px', borderRadius:3, fontWeight:600, textTransform:'none', letterSpacing:0 }}>Up to {fmt(totalSavings)}/year</span></div>
                {isNewRecommended && (
                  <div style={{ padding:'10px 14px', background:'#FFF8E8', borderBottom:`1px solid #E6CFA7`, fontSize:11.5, color:'#7A5A20', lineHeight:1.55 }}>
                    <strong>Note:</strong> You picked New Regime. These deductions only count under Old Regime. If you fill these in, Old Regime might become cheaper for you — re-check the comparison after.
                  </div>
                )}
                {!isNewRecommended && (
                  <div style={{ padding:'10px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:11.5, color:C.muted, lineHeight:1.55 }}>
                    Based on your current slab, every rupee you claim under these saves tax at <strong>{Math.round(oldRegimeMarginalRate(tax.oldTaxable) * 100)}%</strong>. Numbers below are the actual tax you'd save if you fill these to the cap.
                  </div>
                )}
                {headroom.map((h, i) => {
                  // Map each headroom key to the wizard step where its input lives.
                  // 80C → step 3 (Investments) · NPS (80CCD), home loan interest (24B), savings (80TTA) → step 5 (Other) · health (80D) → step 4 (Health)
                  const stepMap: Record<string, number> = { '80C': 3, '80CCD': 5, '80D_self': 4, '80D_par': 4, '24B': 5, '80TTA': 5 }
                  const targetStep = stepMap[h.key]
                  return (
                    <button
                      key={h.key}
                      onClick={() => targetStep !== undefined && goStep(targetStep)}
                      title={`Edit on ${STEPS[targetStep] || ''} step →`}
                      style={{
                        display:'grid', gridTemplateColumns:'1fr auto auto', gap:14, alignItems:'center', padding:'11px 14px',
                        borderBottom:i<headroom.length-1?`1px solid #FAF7F2`:'none',
                        width:'100%', textAlign:'left' as const, background:'transparent', border:'none',
                        borderTop: i === 0 ? 'none' : undefined, cursor:'pointer', fontFamily:'inherit',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div>
                        <div style={{ fontSize:12.5, color:C.text, fontWeight:500, marginBottom:2 }}>{h.question}</div>
                        <div style={{ fontSize:10.5, color:'#A09080', marginBottom:3 }}>{h.sectionTag}</div>
                        <div style={{ fontSize:11, color:C.muted }}>Currently claiming {fmt(h.currentUsed)} of {fmt(h.cap)} cap · {fmt(h.unused)} unused</div>
                      </div>
                      <div style={{ textAlign:'right' as const }}>
                        <div style={{ fontSize:10, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.04em' }}>You'd save</div>
                        <div style={{ fontSize:15, fontWeight:700, color:C.fg, fontVariantNumeric:'tabular-nums' as const }}>{fmt(h.taxSaved)}</div>
                      </div>
                      <div style={{ fontSize:14, color:C.fg, paddingLeft:4 }}>›</div>
                    </button>
                  )
                })}
                <div style={{ padding:'10px 14px', background:'#FAFAF8', borderTop:`1px solid ${C.border}`, fontSize:11, color:C.muted, lineHeight:1.5, fontStyle:'italic' as const }}>
                  These are the maximum tax savings if you fully use each cap. Real-world: invest only what fits your financial situation. PPF and EPF have lock-ins; ELSS has a 3-year lock-in.
                </div>
              </div>
            )
          })()}

          {/* Monthly view */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:12 }}>Monthly view</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { l:'Monthly income', v:fmt(salary?.netSalary||0) },
                { l:`Tax/mo (${tax.recommended==='new'?'New':'Old'} — recommended)`, v:fmt(Math.min(tax.newTax,tax.oldTax)/12) },
                { l:'Effective tax rate', v:`${((Math.min(tax.newTax,tax.oldTax)/(annual + otherTaxable))*100).toFixed(1)}%` },
              ].map(s => (
                <div key={s.l} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{s.l}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
            <button onClick={() => goStep(5)} style={{ flex:'1 1 110px', padding:'10px', background:C.card, color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
            <button onClick={reset} style={{ flex:'1 1 110px', padding:'10px', background:'#FBF0F0', color:C.danger, border:`1px solid #F0CECE`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>↺ Start over</button>
            <a href="/dashboard/tax/snapshot" target="_blank" rel="noopener noreferrer" style={{ flex:'1 1 180px', padding:'10px', background:'#fff', color:C.fg, border:`1px solid ${C.fg}`, borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>📄 Print tax computation →</a>
            <Link href="/dashboard/invest" style={{ flex:'2 1 220px', padding:'10px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>Proceed to Investments →</Link>
          </div>
        </div>
      )}
    </div>
  )
}
