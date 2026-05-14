'use client'
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import DematHoldings from '@/components/DematHoldings'
import { useAppStore } from '@/store/AppStore'
import { MEGA_CATEGORIES, MegaCategory, tagTransactions, detectSalaryCandidates, detectSalary, SalaryCandidate, SalaryDetectionResult, generateExpenseSuggestions, ExpenseSuggestion, loadMerchantMemory, saveMerchantMemory, extractMerchantKey } from '@/lib/categories'
import type { IntelligenceReport, ClassifiedTransaction } from '@/lib/txn-intelligence'
import type { ParsedSalaryData } from '@/types'
import { calcOldRegime, calcNewRegime, calcHRAExemption } from '@/lib/tax-engine'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
const uid = () => Math.random().toString(36).slice(2,8)

const BANKS = ['HDFC Bank','ICICI Bank','SBI','Axis Bank','Kotak Mahindra','American Express','RBL Bank','IndusInd Bank','Yes Bank','PNB','BOB','Canara','HSBC','Citibank','Standard Chartered','IDFC FIRST','AU Bank','Other']

function AmtInput({ value, onChange, small=false }: { value:number; onChange:(n:number)=>void; small?:boolean }) {
  const [local, setLocal] = useState(value > 0 ? String(value) : '')
  useEffect(() => { setLocal(value > 0 ? String(value) : '') }, [value])
  return (
    <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:4, overflow:'hidden' }}>
      <span style={{ padding:'5px 7px', background:C.wl, fontSize:11, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
      <input type="text" inputMode="numeric" value={local}
        onChange={e => { const v=e.target.value.replace(/[^0-9]/g,''); setLocal(v); if(v)onChange(parseInt(v)); else onChange(0) }}
        style={{ border:'none', outline:'none', padding:`5px ${small?'6px':'8px'}`, fontSize:small?11.5:12.5, width:small?70:90, fontFamily:'inherit', color:C.text }} />
    </div>
  )
}

function Donut({ exp, sav, free, total }: { exp:number; sav:number; free:number; total:number }) {
  if (!total) return <div style={{ width:72, height:72, borderRadius:'50%', background:'#F0EBE0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:C.muted }}>—</div>
  const r=14, circ=2*Math.PI*r
  const eL=Math.min((exp/total)*circ, circ-0.5), sL=Math.min((sav/total)*circ, circ-0.5), fL=Math.min((free/total)*circ, circ-0.5)
  return (
    <svg viewBox="0 0 36 36" width="72" height="72" style={{ transform:'rotate(-90deg)' }}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="#F0EBE0" strokeWidth="5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={C.danger} strokeWidth="5" strokeDasharray={`${eL-0.5} ${circ-eL+0.5}`} strokeDashoffset="0" strokeLinecap="round" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={C.wm} strokeWidth="5" strokeDasharray={`${sL-0.5} ${circ-sL+0.5}`} strokeDashoffset={-eL} strokeLinecap="round" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={C.fg} strokeWidth="5" strokeDasharray={`${fL-0.5} ${circ-fL+0.5}`} strokeDashoffset={-(eL+sL)} strokeLinecap="round" />
    </svg>
  )
}

const OTHER_TYPES = [
  { key:'dividend', icon:'📈', label:'Dividend Income', sub:'Shares / mutual funds' },
  { key:'fd', icon:'🏦', label:'FD / Savings Interest', sub:'Bank deposits' },
  { key:'ltcg', icon:'📊', label:'Capital Gains', sub:'MF, shares, property' },
  { key:'rental', icon:'🏠', label:'Rental Income', sub:'From property you own' },
  { key:'freelance', icon:'💻', label:'Freelance / Consulting', sub:'Professional income' },
  { key:'other', icon:'💼', label:'Other Income', sub:'Any other taxable income' },
]

const fileToBase64 = (f:File): Promise<string> => new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res((r.result as string).split(',')[1]); r.onerror=rej; r.readAsDataURL(f) })

const S = {
  card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:12 } as React.CSSProperties,
  cardHead: { padding:'10px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, display:'flex', justifyContent:'space-between', alignItems:'center' },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', borderBottom:`1px solid #FAF7F2`, fontSize:12.5, color:C.text } as React.CSSProperties,
  stab: (on:boolean): React.CSSProperties => ({ padding:'0 12px 9px', fontSize:12, cursor:'pointer', borderTop:'none', borderLeft:'none', borderRight:'none', borderBottom:`2px solid ${on?C.wm:'transparent'}`, color:on?C.fg:C.muted, fontWeight:on?600:400, background:'none', fontFamily:'inherit' }),
  maintab: (on:boolean): React.CSSProperties => ({ padding:'0 14px 10px', fontSize:12.5, cursor:'pointer', borderTop:'none', borderLeft:'none', borderRight:'none', borderBottom:`2px solid ${on?C.wheat:'transparent'}`, color:on?C.fg:C.muted, fontWeight:on?600:400, background:'none', fontFamily:'inherit', whiteSpace:'nowrap' as const }),
  btn: (primary=true): React.CSSProperties => ({ padding:'10px 14px', background:primary?C.fg:C.card, color:primary?C.wheat:C.muted, border:primary?'none':`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, fontWeight:primary?600:400, cursor:'pointer', fontFamily:'inherit' }),
  insight: { background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'9px 12px', fontSize:12, color:C.fg, lineHeight:1.6, marginBottom:12 } as React.CSSProperties,
  upload: (done=false): React.CSSProperties => ({ border:`1.5px dashed ${done?C.fg:C.border}`, borderRadius:6, padding:14, textAlign:'center' as const, background:done?'#EEF2EE':C.wl, cursor:done?'default':'pointer', display:'flex', flexDirection:'column' as const, alignItems:done?'flex-start':'center', justifyContent:done?'flex-start':'center', gap:6, minHeight:130 }),
  bulkBar: { padding:'9px 14px', background:'#1E293B', color:'rgba(230,207,167,0.9)', fontSize:11.5, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' as const } as React.CSSProperties,
  bulkBtn: { padding:'4px 11px', borderRadius:3, fontSize:11, cursor:'pointer', border:'1px solid rgba(230,207,167,0.3)', background:'transparent', color:C.wheat, fontFamily:'inherit', whiteSpace:'nowrap' as const } as React.CSSProperties,
  // Review tab bucket styles
  bucket: { background:C.card, border:`1px solid ${C.border}`, borderRadius:6, marginBottom:8, overflow:'hidden' } as React.CSSProperties,
  bucketHead: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', cursor:'pointer', userSelect:'none' as const, fontSize:12.5 } as React.CSSProperties,
  txnRow: { display:'grid', gridTemplateColumns:'1fr 80px 28px', padding:'6px 12px', fontSize:11.5, gap:6, alignItems:'center', borderBottom:`0.5px solid #FAF7F2`, cursor:'grab' } as React.CSSProperties,
}

interface SalaryBreakdown {
  netSalary: number; employeePF: number; employerPF: number; bonus: number; incentive: number; otherBenefits: number; employerName: string; bonusRecurring: boolean; otherBenefitsRecurring: boolean
}

interface CreditCard { id: string; bank: string; last4: string }

interface BankAccount {
  id: string; bank: string; last4: string; label: string; data: any; txnCount: number; period: { from: string; to: string; months: number }
  intelligenceData?: IntelligenceReport
}

interface PnLLine { mega: MegaCategory; label: string; icon: string; color: string; amount: number; monthlyAvg: number; transactions: any[] }
interface MonthlyPnL { monthKey: string; monthLabel: string; income: number; expenses: number; net: number; byCategory: Record<MegaCategory, number> }

function computePnL(transactions: any[], months: number, confirmedDetections: Record<string, boolean>, manualOverrides: Record<string, MegaCategory>, selectedSalaryIds: Set<string>, parkedIds: Set<string>) {
  const txns = transactions.map(t => {
    let mega: MegaCategory = manualOverrides[t.id] || t.mega || 'misc'
    if (selectedSalaryIds.has(t.id)) mega = 'salary'
    return { ...t, megaFinal: mega }
  })

  const rtNetOff = confirmedDetections['roundtrip'] === true
  const usedCredits = new Set<string>(), usedDebits = new Set<string>()
  if (rtNetOff) {
    const credits = txns.filter((t:any) => t.type === 'credit')
    const debits = txns.filter((t:any) => t.type === 'debit')
    debits.forEach((d:any) => {
      if (usedDebits.has(d.id)) return
      const match = credits.find((c:any) => !usedCredits.has(c.id) && Math.abs(c.amount - d.amount) < 1 && (c.megaFinal === 'transfer' || c.megaFinal === 'misc') && (d.megaFinal === 'transfer' || d.megaFinal === 'misc'))
      if (match) { usedCredits.add(match.id); usedDebits.add(d.id) }
    })
  }

  const incomeMap: Record<string, PnLLine> = {}
  const expenseMap: Record<string, PnLLine> = {}

  txns.forEach((t:any) => {
    if (rtNetOff && (usedCredits.has(t.id) || usedDebits.has(t.id))) return
    const mega: MegaCategory = t.megaFinal
    const info = MEGA_CATEGORIES[mega]
    const isIncome = t.type === 'credit'
    const target = isIncome ? incomeMap : expenseMap
    if (!target[mega]) {
      target[mega] = { mega, label: info.label, icon: info.icon, color: info.color, amount: 0, monthlyAvg: 0, transactions: [] }
    }
    target[mega].amount += t.amount
    target[mega].transactions.push(t)
  })

  const incomeLines = Object.values(incomeMap).map(l => ({ ...l, monthlyAvg: Math.round(l.amount/months) })).sort((a,b)=>b.amount-a.amount)
  const expenseLines = Object.values(expenseMap).map(l => ({ ...l, monthlyAvg: Math.round(l.amount/months) })).sort((a,b)=>b.amount-a.amount)

  const totalIncome = incomeLines.reduce((s,l)=>s+l.amount,0)
  const totalExpenses = expenseLines.reduce((s,l)=>s+l.amount,0)
  const netSurplus = totalIncome - totalExpenses
  const monthlyIncome = Math.round(totalIncome/months)
  const monthlyExpenses = Math.round(totalExpenses/months)
  const monthlyNet = Math.round(netSurplus/months)

  const monthMap: Record<string, MonthlyPnL> = {}
  const monthNames: Record<string,string> = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'}
  txns.forEach((t:any) => {
    if (rtNetOff && (usedCredits.has(t.id) || usedDebits.has(t.id))) return
    const parts = (t.date||'').split(/[-/]/)
    if (parts.length < 3) return
    const mo = parts[1]?.padStart?.(2,'0') || parts[1]
    const yr = parts[2]
    const key = `${yr}-${mo}`
    if (!monthMap[key]) monthMap[key] = { monthKey:key, monthLabel:`${monthNames[mo]||mo} ${yr}`, income:0, expenses:0, net:0, byCategory:{} as any }
    const m = monthMap[key]
    if (t.type === 'credit') m.income += t.amount
    else m.expenses += t.amount
    const mc = t.megaFinal as MegaCategory
    m.byCategory[mc] = (m.byCategory[mc] || 0) + t.amount
  })
  const monthlyPnL = Object.values(monthMap).map(m => ({ ...m, net: m.income - m.expenses })).sort((a,b)=>a.monthKey.localeCompare(b.monthKey))

  return { incomeLines, expenseLines, totalIncome, totalExpenses, netSurplus, monthlyIncome, monthlyExpenses, monthlyNet, monthlyPnL }
}

// ── REVIEW TAB: Bucket definitions ──
interface BucketDef {
  id: string; icon: string; label: string; megas: MegaCategory[]
  descMatch?: string[]; brandMatch?: string[]
}

const REVIEW_BUCKETS: Record<string, BucketDef[]> = {
  income: [
    { id:'salary', icon:'💰', label:'Salary', megas:['salary'], descMatch:['SALARY','SAL CR','SAL/','PAYROLL','STIPEND'] },
    { id:'bonus', icon:'🎁', label:'Bonus', megas:[], brandMatch:['Bonus/Incentive'], descMatch:['BONUS','BONU','PERF BONUS','INCENTIVE','AWARD','DIWALI BONUS','PROJECT BONUS','JOINING BONUS','ANNUAL BONUS'] },
    { id:'freelance', icon:'💼', label:'Freelance / other income', megas:[], brandMatch:['Freelance Income'], descMatch:['FREELANCE','CONSULTING FEE','PROFESSIONAL FEE','CONTRACT PAYMENT'] },
    { id:'self_transfer', icon:'🔄', label:'Self-transfers (not income)', megas:[], descMatch:['SELF TRANSFER','SELF TRF','OWN A/C','OWN ACCOUNT'] },
    { id:'transfers', icon:'👤', label:'Person transfers', megas:['transfer'] },
    { id:'dividends', icon:'💸', label:'Dividend / interest', megas:['interest','cashback'], descMatch:['INTEREST','INT.PD','INT CR','INT.COLL','DIVIDEND','DIV CR','FD INTEREST','CASHBACK','CASH BACK','REFUND'] },
  ],
  expenses: [
    { id:'rent', icon:'🏠', label:'House rent', megas:[], descMatch:['RENT PAYMENT','HOUSE RENT'] },
    { id:'emi', icon:'🏦', label:'EMIs / loans', megas:[], descMatch:['EMI-','EMI ','HOME LOAN','CAR LOAN','PERSONAL LOAN','EDUCATION LOAN','GOLD LOAN','CONSUMER DURABLE','LAPTOP LOAN','VEHICLE LOAN','BAJAJ FINANCE','BAJAJ FINSERV','BAJAJFIN','HDFC LTD','HDFCHL','HDFCCL','HDFCPL','HDFCGL','HDFCDL','HDFCLL','LOAN REPAY'] },
    { id:'insurance', icon:'🛡', label:'Insurance', megas:['insurance'], descMatch:['LIC PREMIUM','LIC-','LIC ','NACH-LIC','NACH/LIC','STAR HEALTH','NACH-STAR','NACH/STAR','INSURANCE','MEDICLAIM','ICICI LOMBARD','HDFC ERGO','PREMIUM-POL','NIVA BUPA','CARE HEALTH','MAX LIFE','HDFC LIFE','SBI LIFE','TATA AIA','GO DIGIT','ACKO'] },
    { id:'cc_payment', icon:'💳', label:'Credit card payments', megas:['cc_payment'], descMatch:['CC AUTOPAY','CC PAYMENT','CREDIT CARD','CRED MINT','CRED PAY','CRED CLUB','AMEX CC','SIMPLY SAVE CC','REGALIA CC'] },
    { id:'fuel', icon:'⛽', label:'Fuel / transport', megas:['transport'] },
    { id:'utilities', icon:'⚡', label:'Utilities', megas:['utilities'], descMatch:['ELECTRICITY','BESCOM','BWSSB','WATER BILL','BROADBAND','AIRTEL','JIO','RECHARGE','GAS CYLINDER','LPG'] },
    { id:'food', icon:'🍽', label:'Food / dining', megas:['food'] },
    { id:'shopping', icon:'🛍', label:'Shopping', megas:['shopping'] },
    { id:'healthcare', icon:'💊', label:'Healthcare', megas:['healthcare'] },
    { id:'entertainment', icon:'🎬', label:'Entertainment', megas:['entertainment'] },
    { id:'home_services', icon:'🏠', label:'Home services', megas:[], descMatch:['URBAN COMPANY','URBAN CLAP','URBANCLAP','HOME CLEANING','PLUMBER','ELECTRICIAN'] },
    { id:'tax', icon:'📋', label:'Tax payments', megas:[], descMatch:['ADVANCE TAX','INCOME TAX','TAX PAYMENT','TDS','CHALLAN','NSDL/ADTAX'] },
    { id:'misc', icon:'📦', label:'Miscellaneous', megas:['misc'] },
  ],
  savings: [
    { id:'sip', icon:'📈', label:'SIPs (mutual fund)', megas:[], descMatch:['MUTUAL FUND SIP','MUTUAL FUND','SIP-','SIP ','NACH/AXIS','NACH-AXIS','NACH/HDFC','NACH-HDFC','NACH/PPFAS','NACH-PPFAS','NACH/SBI MF','NACH-SBI MF','NACH/NIPPON','NACH-NIPPON','NACH/DSP','NACH-DSP','NACH/MIRAE','NACH-MIRAE','NACH/QUANT','NACH-QUANT','NACH/CANARA','NACH-CANARA','NACH-MUTUAL','BLUECHIP','MID CAP','PARAG PARIKH','FLEXI CAP','AXIS BLUECHIP','HDFC MID CAP'] },
    { id:'stocks', icon:'📊', label:'Stock purchases', megas:[], descMatch:['ZERODHA','STOCK PURCHASE','GROWW','ANGELONE','ANGEL ONE','UPSTOX','DHAN ','KITE ','5PAISA'] },
    { id:'elss', icon:'🛡', label:'ELSS / 80C', megas:['investments_elss'], descMatch:['ELSS','TAX SAVING','TAX SAVER'] },
    { id:'ppf_nps', icon:'🏛', label:'PPF / NPS', megas:[], descMatch:['PPF','PPF DEPOSIT','NPS CONTRIBUTION','NPS TIER','NPS-','NATIONAL PENSION','PUBLIC PROVIDENT','NACH-PPF','NACH-NPS','NACH/PPF','NACH/NPS'] },
    { id:'fd_rd', icon:'🏛', label:'FD / RD', megas:[], descMatch:['FD BOOKING','FIXED DEPOSIT','RECURRING DEPOSIT','RD INST','FD OPENING'] },
  ],
}

const ALL_BUCKET_LIST: BucketDef[] = [...REVIEW_BUCKETS.income, ...REVIEW_BUCKETS.expenses, ...REVIEW_BUCKETS.savings]

// Map intelligence engine's category/subcategory → review bucket id
// Returns null if engine output cannot be confidently mapped — caller falls back to keyword logic
function bucketIdFromIntelligence(c: ClassifiedTransaction): string | null {
  const cat = c.category
  const sub = c.subcategory || ''
  if (cat === 'Income') {
    if (sub === 'Salary') return 'salary'
    if (sub === 'Bonus') return 'bonus'
    if (sub === 'Freelance' || sub.includes('Business')) return 'freelance'
    if (sub === 'Interest' || sub === 'Cashback') return 'dividends'
    return null
  }
  if (cat === 'Refund') return 'dividends'
  if (cat === 'EMI') return 'emi'
  if (cat === 'Housing') return 'rent'
  if (cat === 'Credit Card') return 'cc_payment'
  if (cat === 'Insurance') return 'insurance'
  if (cat === 'Tax') return 'tax'
  if (cat === 'Cash') return 'misc'
  if (cat === 'Self Transfer') return 'self_transfer'
  if (cat === 'Transfer to Persons' || cat === 'Transfer to Account') return 'transfers'
  if (cat === 'Utilities') return 'utilities'
  if (cat === 'Investment') {
    if (sub === 'SIP/Mutual Fund') return 'sip'
    if (sub === 'PPF' || sub === 'NPS') return 'ppf_nps'
    if (sub === 'Recurring Deposit') return 'fd_rd'
    return 'sip'
  }
  if (cat === 'Auto-Debit') return null  // unknown auto-debit — let keyword fallback or question handle it
  return null
}

// Map a MegaCategory → review bucket id (mirrors the assignments inside the bucket useMemo)
function bucketIdFromMega(mega: MegaCategory, type?: 'credit' | 'debit'): string {
  switch (mega) {
    case 'salary': return 'salary'
    case 'food': return 'food'
    case 'shopping': return 'shopping'
    case 'transport': return 'fuel'
    case 'utilities': return 'utilities'
    case 'healthcare': return 'healthcare'
    case 'entertainment': return 'entertainment'
    case 'cc_payment': return 'cc_payment'
    case 'insurance': return 'insurance'
    case 'investments_elss': return 'elss'
    case 'investments_regular': return 'stocks'
    case 'interest': return 'dividends'
    case 'cashback': return 'dividends'
    case 'transfer': return 'transfers'
    case 'misc': return type === 'credit' ? 'freelance' : 'misc'
    default: return 'misc'
  }
}

function assignToBucket(t: any): string {
  const desc = (t.description || '').toUpperCase()
  const mega: MegaCategory = t.mega || 'misc'
  const brand = t.brand || ''

  // 1. Description matches first
  for (const b of ALL_BUCKET_LIST) {
    if (b.descMatch && b.descMatch.some(dm => desc.includes(dm))) return b.id
  }

  // 2. Brand matches
  for (const b of ALL_BUCKET_LIST) {
    if (b.brandMatch && b.brandMatch.some(bm => brand === bm)) return b.id
  }

  // 3. Mega category matches
  for (const b of ALL_BUCKET_LIST) {
    if (b.megas.includes(mega)) return b.id
  }

  return t.type === 'credit' ? 'freelance' : 'misc'
}

type MainTab = 'docs' | 'salary' | 'review' | 'reports' | 'analytics'

// ─── Salary Timeline types & helpers ──────────────────────────────────────

interface SlipComponent {
  label: string
  amount: number
  type: 'earning' | 'deduction'
  flag: 'recurring' | 'one_time'
}

interface SlipData {
  id: string
  monthKey: string                  // "2026-04"
  parsed: ParsedSalaryData
  components: SlipComponent[]
  uploadedAt: string
  fileName: string
}

interface Employment {
  id: string
  employerName: string
  fromMonth: string                  // "2026-04"
  toMonth: string | null             // null = current
  slips: SlipData[]
}

interface MonthOverride {
  monthKey: string
  components: { label: string; amount: number; type: 'earning' | 'deduction' }[]
}

interface SalaryTimeline {
  fy: string                         // "FY 2026-27"
  fyStartYear: number                // 2026 (means Apr 2026 – Mar 2027)
  employments: Employment[]
  overrides: MonthOverride[]         // user-edited projected months
}

// Default classification of components — recurring unless name suggests one-time
const ONE_TIME_KEYWORDS = ['BONUS', 'INCENTIVE', 'ARREAR', 'LTA', 'LEAVE TRAVEL', 'LEAVE ENCASH', 'GRATUITY', 'JOINING', 'RETENTION', 'VARIABLE', 'PERFORMANCE', 'AWARD', 'EX-GRATIA', 'EX GRATIA', 'REIMBURSEM']
function classifyComponent(label: string): 'recurring' | 'one_time' {
  const u = (label || '').toUpperCase()
  return ONE_TIME_KEYWORDS.some(kw => u.includes(kw)) ? 'one_time' : 'recurring'
}

// Parse "Apr 2026" / "April 2026" / "04/2026" / "2026-04" → "2026-04"
function parseMonthKey(month: string, year: string): string {
  const m = (month || '').trim()
  const y = (year || '').trim()
  const monthNames: Record<string, string> = { jan:'01', january:'01', feb:'02', february:'02', mar:'03', march:'03', apr:'04', april:'04', may:'05', jun:'06', june:'06', jul:'07', july:'07', aug:'08', august:'08', sep:'09', september:'09', oct:'10', october:'10', nov:'11', november:'11', dec:'12', december:'12' }
  let monthNum = ''
  if (/^\d{1,2}$/.test(m)) monthNum = m.padStart(2, '0')
  else if (monthNames[m.toLowerCase()]) monthNum = monthNames[m.toLowerCase()]
  let yearNum = y
  if (/^\d{2}$/.test(y)) yearNum = `20${y}`
  if (!monthNum || !/^\d{4}$/.test(yearNum)) {
    // fallback to current month
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return `${yearNum}-${monthNum}`
}

// Indian FY: Apr 1 → Mar 31. monthKey "2026-04" → fyStartYear 2026; "2026-03" → 2025
function fyStartYearForMonthKey(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  return m >= 4 ? y : y - 1
}
function fyLabel(startYear: number): string {
  const endShort = String((startYear + 1) % 100).padStart(2, '0')
  return `FY ${startYear}-${endShort}`
}
function fyMonths(startYear: number): string[] {
  const out: string[] = []
  for (let i = 0; i < 12; i++) {
    const m = ((i + 3) % 12) + 1   // Apr=4, May=5, ..., Mar=3
    const y = m >= 4 ? startYear : startYear + 1
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[Number(m)]} ${y.slice(2)}`
}

// Employee-name comparator — returns true if two names plausibly refer to the same person
// Strips honorifics (Mr/Ms/Dr/Shri/Smt), normalizes whitespace, then checks token overlap.
// Considered "same person" if ≥50% of tokens from the shorter name appear in the longer name.
function normalizeEmployeeName(name: string): string[] {
  if (!name) return []
  return name.toUpperCase()
    .replace(/^(MR\.?|MS\.?|MRS\.?|MISS|SHRI|SMT\.?|DR\.?)\s+/i, '')
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)
}
function namesPlausiblyMatch(a: string, b: string): boolean {
  const ta = normalizeEmployeeName(a)
  const tb = normalizeEmployeeName(b)
  if (ta.length === 0 || tb.length === 0) return true   // missing data → don't block
  const shorter = ta.length <= tb.length ? ta : tb
  const longer = ta.length <= tb.length ? tb : ta
  const overlap = shorter.filter(t => longer.includes(t)).length
  return overlap / shorter.length >= 0.5
}

// Build a SlipData from API result
function slipFromParsed(parsed: ParsedSalaryData, fileName: string): SlipData {
  const monthKey = parseMonthKey(parsed.month, parsed.year)
  const components: SlipComponent[] = []
  const earnings: Array<[string, number]> = [
    ['Basic Salary', parsed.basicSalary],
    ['HRA', parsed.hra],
    ['Dearness Allowance', parsed.da],
    ['Travel Allowance', parsed.ta],
    ['LTA', parsed.lta],
    ['Medical Allowance', parsed.medicalAllowance],
    ['Special Allowance', parsed.specialAllowance],
    ['Other Allowances', parsed.otherAllowances],
  ]
  earnings.forEach(([label, amount]) => {
    if (amount && amount > 0) components.push({ label, amount, type: 'earning', flag: classifyComponent(label) })
  })
  const deductions: Array<[string, number]> = [
    ['Employee PF', parsed.employeePF],
    ['ESIC', parsed.esic],
    ['Professional Tax', parsed.professionalTax],
    ['TDS', parsed.tdsDeducted],
    ['Loan Deduction', parsed.loanDeduction],
    ['Other Deductions', parsed.otherDeductions],
  ]
  deductions.forEach(([label, amount]) => {
    if (amount && amount > 0) components.push({ label, amount, type: 'deduction', flag: classifyComponent(label) })
  })
  // If parser returned a richer components array, prefer those (preserves any custom labels)
  if (Array.isArray(parsed.components) && parsed.components.length > 0) {
    const fromParsed = parsed.components
      .filter(c => c.type === 'earning' || c.type === 'deduction')
      .map(c => ({ label: c.label, amount: c.amount, type: c.type as 'earning' | 'deduction', flag: classifyComponent(c.label) }))
    if (fromParsed.length >= components.length) {
      return { id: uid(), monthKey, parsed, components: fromParsed, uploadedAt: new Date().toISOString(), fileName }
    }
  }
  return { id: uid(), monthKey, parsed, components, uploadedAt: new Date().toISOString(), fileName }
}

// For an employment, get the most recent slip strictly before or at a target monthKey
function latestSlipBefore(employment: Employment, monthKey: string): SlipData | null {
  const eligible = employment.slips.filter(s => s.monthKey <= monthKey).sort((a, b) => b.monthKey.localeCompare(a.monthKey))
  return eligible[0] || null
}
function employmentForMonth(timeline: SalaryTimeline, monthKey: string): Employment | null {
  for (const emp of timeline.employments) {
    if (monthKey >= emp.fromMonth && (emp.toMonth === null || monthKey <= emp.toMonth)) return emp
  }
  // If the month is BEFORE any employment's fromMonth → no income (return null)
  // This prevents phantom income being projected onto months that pre-date the user's first job in the timeline.
  const earliestFrom = timeline.employments.reduce((min, e) => e.fromMonth < min ? e.fromMonth : min, timeline.employments[0]?.fromMonth || '9999-99')
  if (monthKey < earliestFrom) return null
  // Otherwise (month is past the latest employment's toMonth) — fall through to latest employment for forward projection
  return timeline.employments[timeline.employments.length - 1] || null
}

interface MonthRollup { earnings: number; deductions: number; net: number; isActual: boolean; isOverride: boolean }
function rollupMonth(timeline: SalaryTimeline, monthKey: string): MonthRollup {
  const override = timeline.overrides.find(o => o.monthKey === monthKey)
  if (override) {
    const earnings = override.components.filter(c => c.type === 'earning').reduce((s, c) => s + c.amount, 0)
    const deductions = override.components.filter(c => c.type === 'deduction').reduce((s, c) => s + c.amount, 0)
    return { earnings, deductions, net: earnings - deductions, isActual: false, isOverride: true }
  }
  const emp = employmentForMonth(timeline, monthKey)
  if (!emp) return { earnings: 0, deductions: 0, net: 0, isActual: false, isOverride: false }
  const exact = emp.slips.find(s => s.monthKey === monthKey)
  if (exact) {
    const earnings = exact.components.filter(c => c.type === 'earning').reduce((s, c) => s + c.amount, 0)
    const deductions = exact.components.filter(c => c.type === 'deduction').reduce((s, c) => s + c.amount, 0)
    return { earnings, deductions, net: earnings - deductions, isActual: true, isOverride: false }
  }
  // Project from latest slip in this employment, RECURRING components only
  const base = latestSlipBefore(emp, monthKey) || emp.slips[0]
  if (!base) return { earnings: 0, deductions: 0, net: 0, isActual: false, isOverride: false }
  const earnings = base.components.filter(c => c.type === 'earning' && c.flag === 'recurring').reduce((s, c) => s + c.amount, 0)
  const deductions = base.components.filter(c => c.type === 'deduction' && c.flag === 'recurring').reduce((s, c) => s + c.amount, 0)
  return { earnings, deductions, net: earnings - deductions, isActual: false, isOverride: false }
}

interface AnnualSummary {
  annualGross: number
  annualDeductions: number
  annualNet: number
  actualsCount: number
  projectedCount: number
  monthlyAvgGross: number
  monthlyAvgNet: number
  recurringMonthlyGross: number      // for store contract
  recurringMonthlyEPF: number
  recurringMonthlyEmployerPF: number
  latestEmployerName: string
}
function computeAnnual(timeline: SalaryTimeline | null): AnnualSummary | null {
  if (!timeline || timeline.employments.length === 0) return null
  const months = fyMonths(timeline.fyStartYear)
  let annualGross = 0, annualDeductions = 0, actuals = 0, projected = 0
  for (const mk of months) {
    const r = rollupMonth(timeline, mk)
    annualGross += r.earnings
    annualDeductions += r.deductions
    if (r.isActual) actuals++
    else projected++
  }
  const annualNet = annualGross - annualDeductions
  // Recurring monthly figures for store contract — use latest employment's latest slip
  const latestEmp = timeline.employments[timeline.employments.length - 1]
  const latestSlip = latestEmp ? latestEmp.slips.sort((a,b) => b.monthKey.localeCompare(a.monthKey))[0] : null
  const recurringEarnings = latestSlip ? latestSlip.components.filter(c => c.type === 'earning' && c.flag === 'recurring').reduce((s, c) => s + c.amount, 0) : 0
  const epfComp = latestSlip?.components.find(c => /EMPLOYEE PF|EPF/i.test(c.label) && c.type === 'deduction')
  const employerPF = latestSlip?.parsed.employerPF || 0
  return {
    annualGross,
    annualDeductions,
    annualNet,
    actualsCount: actuals,
    projectedCount: projected,
    monthlyAvgGross: Math.round(annualGross / 12),
    monthlyAvgNet: Math.round(annualNet / 12),
    recurringMonthlyGross: recurringEarnings,
    recurringMonthlyEPF: epfComp?.amount || 0,
    recurringMonthlyEmployerPF: employerPF,
    latestEmployerName: latestEmp?.employerName || '',
  }
}

// ─── Multi-employer TDS shortfall (Build 2c) ──────────────────────────────
// Detects when ≥2 employments in same FY → computes expected tax (both regimes)
// against TDS actually deducted across all slips, surfaces shortfall.
// Returns null when not applicable (single employer / no data / computation error).
interface EmploymentMonth { monthKey: string; earnings: number; kind: 'actual' | 'override' | 'projected' }
interface EmploymentBreakdown { name: string; from: string; to: string | null; slipCount: number; tdsDeducted: number; subtotal: number; months: EmploymentMonth[] }
interface MultiEmployerTDS {
  employmentsList: Array<{ name: string; from: string; to: string | null; slipCount: number; tdsDeducted: number; grossSum: number }>
  breakdown: EmploymentBreakdown[]
  emptyMonths: string[]   // monthKeys with 0 earnings (no employment covered them)
  combinedAnnualGross: number
  totalTdsDeducted: number
  expectedTaxOld: number
  expectedTaxNew: number
  shortfallOld: number    // positive = owe more; negative = surplus / refund
  shortfallNew: number
  hraExemption: number    // derived from latest slip's basic + HRA
  epfAnnual: number       // EPF deducted annually
}
function computeMultiEmployerTDS(timeline: SalaryTimeline | null, annual: AnnualSummary | null): MultiEmployerTDS | null {
  if (!timeline || !annual) return null
  // Only count employments with at least 1 slip uploaded
  const realEmployments = timeline.employments.filter(e => e.slips.length > 0)
  if (realEmployments.length < 2) return null
  try {
    // Per-employer breakdown: walk each FY month, attribute to the employment that owns it
    const months = fyMonths(timeline.fyStartYear)
    const breakdown: EmploymentBreakdown[] = realEmployments.map(emp => ({
      name: emp.employerName, from: emp.fromMonth, to: emp.toMonth,
      slipCount: emp.slips.length, tdsDeducted: emp.slips.reduce((s, sl) => s + (sl.parsed.tdsDeducted || 0), 0),
      subtotal: 0, months: [],
    }))
    const emptyMonths: string[] = []
    for (const mk of months) {
      const r = rollupMonth(timeline, mk)
      const emp = employmentForMonth(timeline, mk)
      if (!emp || r.earnings === 0) {
        emptyMonths.push(mk)
        continue
      }
      const target = breakdown.find(b => b.name === emp.employerName && b.from === emp.fromMonth)
      if (target) {
        target.subtotal += r.earnings
        target.months.push({ monthKey: mk, earnings: r.earnings, kind: r.isActual ? 'actual' : r.isOverride ? 'override' : 'projected' })
      }
    }

    const employmentsList = realEmployments.map(emp => ({
      name: emp.employerName,
      from: emp.fromMonth,
      to: emp.toMonth,
      slipCount: emp.slips.length,
      tdsDeducted: emp.slips.reduce((s, sl) => s + (sl.parsed.tdsDeducted || 0), 0),
      grossSum: emp.slips.reduce((s, sl) => s + (sl.parsed.grossSalary || 0), 0),
    }))
    const totalTdsDeducted = employmentsList.reduce((s, e) => s + e.tdsDeducted, 0)
    const combinedAnnualGross = annual.annualGross
    if (combinedAnnualGross <= 0) return null

    // Use latest employment's latest slip for HRA + basic auto-derive
    const latestEmp = realEmployments[realEmployments.length - 1]
    const latestSlip = latestEmp.slips.sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
    const basic = latestSlip?.parsed.basicSalary || 0
    const hraReceived = latestSlip?.parsed.hra || 0
    const epfMonthly = latestSlip?.parsed.employeePF || 0
    const epfAnnual = epfMonthly * 12

    // HRA exemption — assume rent = 0 (not entered yet on Salary tab); banner notes this
    // (When user fills rent in Tax Optimiser, that page does the real HRA math.)
    const hraExemption = calcHRAExemption(basic, hraReceived, 0, true)

    // Build a minimal Deductions object — only what's known from slips
    const dedFromSlip = {
      section80C: epfAnnual,
      section80CCD1B: 0,
      section80D: 0,
      section24b: 0,
      hraExemption,
      standardDeduction: 50000,
      otherDeductions: 0,
    }
    const oldResult = calcOldRegime(combinedAnnualGross, dedFromSlip)
    const newResult = calcNewRegime(combinedAnnualGross)
    return {
      employmentsList,
      breakdown,
      emptyMonths,
      combinedAnnualGross,
      totalTdsDeducted,
      expectedTaxOld: oldResult.totalTax,
      expectedTaxNew: newResult.totalTax,
      shortfallOld: oldResult.totalTax - totalTdsDeducted,
      shortfallNew: newResult.totalTax - totalTdsDeducted,
      hraExemption,
      epfAnnual,
    }
  } catch (e) {
    if (typeof window !== 'undefined') console.warn('[multi-employer TDS] computation failed:', e)
    return null
  }
}

// ─── Salary Month Editor (modal body) ─────────────────────────────────────
function SalaryMonthEditor({ monthKey, isActual, isOverride, initialRows, onClose, onSave, onClearOverride, onUploadHere }: {
  monthKey: string
  isActual: boolean
  isOverride: boolean
  initialRows: Array<{ label: string; amount: number; type: 'earning' | 'deduction' }>
  onClose: () => void
  onSave: (rows: Array<{ label: string; amount: number; type: 'earning' | 'deduction' }>) => void
  onClearOverride: (() => void) | null
  onUploadHere: () => void
}) {
  const [rows, setRows] = useState(initialRows)
  const totalEarning = rows.filter(r => r.type === 'earning').reduce((s, r) => s + r.amount, 0)
  const totalDeduction = rows.filter(r => r.type === 'deduction').reduce((s, r) => s + r.amount, 0)
  const updateRow = (i: number, patch: Partial<typeof rows[number]>) => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))
  const addRow = (type: 'earning' | 'deduction') => setRows(prev => [...prev, { label: '', amount: 0, type }])
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:560, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)', maxHeight:'85vh', overflowY:'auto' as const }}>
        <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>{(() => { const [y,m] = monthKey.split('-'); const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${names[Number(m)]} ${y}` })()}</p>
        <p style={{ fontSize:11, color:C.muted, margin:'0 0 12px' }}>
          {isActual ? 'Actual slip — values from uploaded slip. Upload a new slip to replace these.' :
           isOverride ? 'Edited projection. Adjust any line below.' :
           'Auto-projected from your latest slip. Edit to override for this month only.'}
        </p>
        <div style={{ border:`1px solid ${C.border}`, borderRadius:5, overflow:'hidden' }}>
          <div style={{ padding:'7px 12px', background:'#FAFAF8', fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>Earnings</div>
          {rows.filter(r => r.type === 'earning').length === 0 && <div style={{ padding:'10px 12px', fontSize:12, color:C.muted, fontStyle:'italic' as const }}>No earnings</div>}
          {rows.map((r, i) => r.type !== 'earning' ? null : (
            <div key={`e-${i}`} style={{ display:'grid', gridTemplateColumns:'1fr 110px 24px', gap:6, padding:'6px 12px', borderBottom:`0.5px solid #FAF7F2`, alignItems:'center' }}>
              <input type="text" value={r.label} onChange={e => updateRow(i, { label: e.target.value })} placeholder="Component name" disabled={isActual} style={{ fontSize:12, padding:'5px 8px', border:`1px solid ${C.border}`, borderRadius:3, fontFamily:'inherit', outline:'none', color:C.text, background: isActual ? '#FAFAF8' : '#fff' }} />
              <input type="text" inputMode="numeric" value={r.amount > 0 ? String(r.amount) : ''} onChange={e => updateRow(i, { amount: parseInt(e.target.value.replace(/[^0-9]/g,'')) || 0 })} placeholder="0" disabled={isActual} style={{ fontSize:12, padding:'5px 8px', border:`1px solid ${C.border}`, borderRadius:3, fontFamily:'inherit', outline:'none', color:C.text, textAlign:'right' as const, background: isActual ? '#FAFAF8' : '#fff' }} />
              {!isActual && <button onClick={() => removeRow(i)} style={{ background:'none', border:'none', color:C.danger, fontSize:14, cursor:'pointer' }}>×</button>}
              {isActual && <span />}
            </div>
          ))}
          {!isActual && <button onClick={() => addRow('earning')} style={{ width:'100%', padding:'6px 12px', background:'#FAFAF8', border:'none', borderTop:`0.5px solid ${C.border}`, fontSize:11, color:C.fg, cursor:'pointer', fontFamily:'inherit' }}>+ Add earning</button>}

          <div style={{ padding:'7px 12px', background:'#FAFAF8', fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.05em', textTransform:'uppercase' as const, borderTop:`1px solid ${C.border}` }}>Deductions</div>
          {rows.filter(r => r.type === 'deduction').length === 0 && <div style={{ padding:'10px 12px', fontSize:12, color:C.muted, fontStyle:'italic' as const }}>No deductions</div>}
          {rows.map((r, i) => r.type !== 'deduction' ? null : (
            <div key={`d-${i}`} style={{ display:'grid', gridTemplateColumns:'1fr 110px 24px', gap:6, padding:'6px 12px', borderBottom:`0.5px solid #FAF7F2`, alignItems:'center' }}>
              <input type="text" value={r.label} onChange={e => updateRow(i, { label: e.target.value })} placeholder="Component name" disabled={isActual} style={{ fontSize:12, padding:'5px 8px', border:`1px solid ${C.border}`, borderRadius:3, fontFamily:'inherit', outline:'none', color:C.text, background: isActual ? '#FAFAF8' : '#fff' }} />
              <input type="text" inputMode="numeric" value={r.amount > 0 ? String(r.amount) : ''} onChange={e => updateRow(i, { amount: parseInt(e.target.value.replace(/[^0-9]/g,'')) || 0 })} placeholder="0" disabled={isActual} style={{ fontSize:12, padding:'5px 8px', border:`1px solid ${C.border}`, borderRadius:3, fontFamily:'inherit', outline:'none', color:C.danger, textAlign:'right' as const, background: isActual ? '#FAFAF8' : '#fff' }} />
              {!isActual && <button onClick={() => removeRow(i)} style={{ background:'none', border:'none', color:C.danger, fontSize:14, cursor:'pointer' }}>×</button>}
              {isActual && <span />}
            </div>
          ))}
          {!isActual && <button onClick={() => addRow('deduction')} style={{ width:'100%', padding:'6px 12px', background:'#FAFAF8', border:'none', borderTop:`0.5px solid ${C.border}`, fontSize:11, color:C.fg, cursor:'pointer', fontFamily:'inherit' }}>+ Add deduction</button>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:10, fontSize:11.5 }}>
          <div style={{ padding:'8px 10px', background:C.wl, borderRadius:4 }}><p style={{ fontSize:10, color:C.muted, margin:0 }}>Earnings</p><p style={{ fontWeight:600, color:C.text, margin:0 }}>₹{totalEarning.toLocaleString('en-IN')}</p></div>
          <div style={{ padding:'8px 10px', background:'#FBEFEF', borderRadius:4 }}><p style={{ fontSize:10, color:C.muted, margin:0 }}>Deductions</p><p style={{ fontWeight:600, color:C.danger, margin:0 }}>−₹{totalDeduction.toLocaleString('en-IN')}</p></div>
          <div style={{ padding:'8px 10px', background:'#EEF2EE', borderRadius:4 }}><p style={{ fontSize:10, color:C.muted, margin:0 }}>Net</p><p style={{ fontWeight:600, color:'#2A7A4A', margin:0 }}>₹{(totalEarning - totalDeduction).toLocaleString('en-IN')}</p></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' as const }}>
          {!isActual && <button onClick={() => onSave(rows)} style={{ flex:2, minWidth:140, padding:10, background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Save override</button>}
          <button onClick={onUploadHere} style={{ flex:1, minWidth:120, padding:10, background:C.card, color:C.fg, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Upload slip for this month</button>
          {onClearOverride && <button onClick={onClearOverride} style={{ flex:1, minWidth:120, padding:10, background:C.card, color:C.danger, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Clear override</button>}
          <button onClick={onClose} style={{ flex:1, minWidth:90, padding:10, background:C.card, color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'#7A8A7E', fontFamily:'"Sora",sans-serif' }}>Loading…</div>}><ProfileContent /></Suspense>
}

function ProfileContent() {
  const { salary, setSalary, aisData, setAisData } = useAppStore() as any
  const searchParams = useSearchParams()
  const router = useRouter()
  const mainTab = (searchParams.get('tab') || 'docs') as MainTab
  const setMainTab = (tab: MainTab) => router.push(tab === 'docs' ? '/dashboard/profile' : `/dashboard/profile?tab=${tab}`)
  const [loadingDoc, setLoadingDoc] = useState<string|null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [intelligence, setIntelligence] = useState<IntelligenceReport | null>(null)
  const [salaryTimeline, setSalaryTimeline] = useState<SalaryTimeline | null>(null)
  const [salaryComponentsExpanded, setSalaryComponentsExpanded] = useState(true)
  const [salaryMonthEditor, setSalaryMonthEditor] = useState<{ open: boolean; monthKey: string | null }>({ open: false, monthKey: null })
  const [pendingMonthIntent, setPendingMonthIntent] = useState<string | null>(null)
  const [employmentPrompt, setEmploymentPrompt] = useState<{ open: boolean; pendingSlip: SlipData | null; reason: 'employer_changed' | 'basic_jumped' | null; oldEmployerName?: string; newEmployerName?: string }>({ open: false, pendingSlip: null, reason: null })
  const [nameMismatchPrompt, setNameMismatchPrompt] = useState<{ open: boolean; pendingSlip: SlipData | null; existingName: string; newName: string }>({ open: false, pendingSlip: null, existingName: '', newName: '' })
  const [emptyMonthsDismissed, setEmptyMonthsDismissed] = useState(false)
  const [extendRangeModal, setExtendRangeModal] = useState<{ open: boolean; fromMonth: string; toMonth: string; gapMin: string; gapMax: string }>({ open: false, fromMonth: '', toMonth: '', gapMin: '', gapMax: '' })
  const [otherIncomeModal, setOtherIncomeModal] = useState<{ open: boolean }>({ open: false })
  const [breakdownExpanded, setBreakdownExpanded] = useState(false)
  const [salaryFlagsModal, setSalaryFlagsModal] = useState<{ open: boolean; slipId: string | null; employmentId: string | null }>({ open: false, slipId: null, employmentId: null })
  const [taxCta, setTaxCta] = useState<{ submittedAt: string | null }>({ submittedAt: null })
  const [taggedTxns, setTaggedTxns] = useState<any[]>([])
  const [bankPeriod, setBankPeriod] = useState<{from:string; to:string}|null>(null)
  const [bankMonths, setBankMonths] = useState(1)
  const [uploadingAccountId, setUploadingAccountId] = useState<string|null>(null)

  const [salBreakdown, setSalBreakdown] = useState<SalaryBreakdown>({
    netSalary: 0, employeePF: 0, employerPF: 0, bonus: 0, incentive: 0, otherBenefits: 0, employerName: '', bonusRecurring: false, otherBenefitsRecurring: false
  })

  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [newCardBank, setNewCardBank] = useState('')
  const [newCardLast4, setNewCardLast4] = useState('')

  const [confirmedSalaryIds, setConfirmedSalaryIds] = useState<Set<string>>(new Set())
  const [confirmedDetections, setConfirmedDetections] = useState<Record<string,boolean>>({})
  const [manualOverrides, setManualOverrides] = useState<Record<string, MegaCategory>>({})
  const [parkedIds, setParkedIds] = useState<Set<string>>(new Set())

  // Review tab: bucket overrides (user drags txn from one bucket to another)
  const [bucketOverrides, setBucketOverrides] = useState<Record<string, string>>({})
  const [openBuckets, setOpenBuckets] = useState<Set<string>>(new Set())
  const [dragTxnId, setDragTxnId] = useState<string|null>(null)
  const [selectedTxn, setSelectedTxn] = useState<Record<string, string>>({})

  // User classifications — answers to "what is this?" questions
  // Key: pattern (counterparty name, NACH mandate, etc.) → bucket id
  // Once answered, auto-applied forever
  const [userClassifications, setUserClassifications] = useState<Record<string, string>>({})
  const [singleCategoryModal, setSingleCategoryModal] = useState<{ open:boolean; transaction:any|null }>({ open:false, transaction:null })
  const [pnlExpanded, setPnlExpanded] = useState<Record<string, boolean>>({})

  const [pwdModal, setPwdModal] = useState<{ open:boolean; type:string|null; file:File|null; error:string }>({ open:false, type:null, file:null, error:'' })
  const [pwd, setPwd] = useState('')
  const bankRef = useRef<HTMLInputElement>(null)
  const salaryRef = useRef<HTMLInputElement>(null)
  const aisRef = useRef<HTMLInputElement>(null)
  const taxRef = useRef<HTMLInputElement>(null)
  const slipRef = useRef<HTMLInputElement>(null)
  const offerRef = useRef<HTMLInputElement>(null)
  const casRef = useRef<HTMLInputElement>(null)
  const [casData, setCasData] = useState<any>(null)
  const [casPassword, setCasPassword] = useState('')
  const [otherSel, setOtherSel] = useState<Set<string>>(new Set())
  const [otherVals, setOtherVals] = useState<Record<string,number>>({})

  const [expenses, setExpenses] = useState([
    { id:uid(), label:'Rent / Home loan EMI', amount:0, icon:'🏠' },
    { id:uid(), label:'Car / Vehicle EMI', amount:0, icon:'🚗' },
    { id:uid(), label:'Credit card bill', amount:0, icon:'💳' },
    { id:uid(), label:'Groceries', amount:0, icon:'🛒' },
    { id:uid(), label:'Electricity / Gas', amount:0, icon:'⚡' },
    { id:uid(), label:'Internet + Phone', amount:0, icon:'📱' },
    { id:uid(), label:'Life Insurance', amount:0, icon:'🛡️' },
    { id:uid(), label:'Health Insurance', amount:0, icon:'🏥' },
  ])
  const [variable, setVariable] = useState([
    { id:uid(), label:'Fuel / Transport', amount:0, icon:'🚗' },
    { id:uid(), label:'Dining out / Takeaway', amount:0, icon:'🍽️' },
    { id:uid(), label:'Shopping / Clothing', amount:0, icon:'🛍️' },
    { id:uid(), label:'Medicine / Healthcare', amount:0, icon:'💊' },
    { id:uid(), label:'Entertainment / OTT', amount:0, icon:'🎬' },
    { id:uid(), label:'Travel (monthly avg)', amount:0, icon:'✈️' },
    { id:uid(), label:'Other variable spend', amount:0, icon:'📦' },
  ])
  const [savings, setSavings] = useState([
    { id:uid(), label:'SIP / Mutual Funds (regular)', amount:0, icon:'📈' },
    { id:uid(), label:'ELSS — tax saving (80C)', amount:0, icon:'🛡️' },
    { id:uid(), label:'Emergency Fund', amount:0, icon:'🆘' },
    { id:uid(), label:'RD / FD', amount:0, icon:'🏦' },
  ])

  // ── Load from localStorage ──
  useEffect(() => {
    try {
      const p = localStorage.getItem('av_profile')
      if (p) { const d=JSON.parse(p); if(d.expenses)setExpenses(d.expenses); if(d.savings)setSavings(d.savings); if(d.variable)setVariable(d.variable) }
      const sb = localStorage.getItem('av_salary_breakdown')
      if (sb) setSalBreakdown(JSON.parse(sb))
      const cc = localStorage.getItem('av_credit_cards')
      if (cc) setCreditCards(JSON.parse(cc))
      const cd = localStorage.getItem('av_confirmed_detections')
      if (cd) setConfirmedDetections(JSON.parse(cd))
      const mo = localStorage.getItem('av_manual_overrides')
      if (mo) setManualOverrides(JSON.parse(mo))
      const csids = localStorage.getItem('av_confirmed_salary_ids')
      if (csids) setConfirmedSalaryIds(new Set(JSON.parse(csids)))
      const pids = localStorage.getItem('av_parked_ids')
      if (pids) setParkedIds(new Set(JSON.parse(pids)))
      const cas = localStorage.getItem('av_cas_holdings')
      if (cas) setCasData(JSON.parse(cas))
      const bo = localStorage.getItem('av_bucket_overrides')
      if (bo) setBucketOverrides(JSON.parse(bo))
      const uc = localStorage.getItem('av_user_classifications')
      if (uc) setUserClassifications(JSON.parse(uc))
      const stl = localStorage.getItem('av_salary_timeline')
      if (stl) setSalaryTimeline(JSON.parse(stl))
      const sct = localStorage.getItem('av_salary_cta')
      if (sct) {
        try {
          const parsed = JSON.parse(sct)
          setTaxCta({ submittedAt: parsed?.submittedAt || null })
        } catch {}
      }
      const emd = localStorage.getItem('av_empty_months_dismissed')
      if (emd === '1') setEmptyMonthsDismissed(true)
      loadSavedBankAccounts()
    } catch {}
  }, [])

  function detectMonths(transactions: any[]): { months:number; from:string; to:string } {
    if (!transactions.length) return { months:1, from:'', to:'' }
    const keys = new Set<string>()
    let minDate='', maxDate=''
    transactions.forEach((t:any) => {
      const parts = (t.date||'').split(/[-/]/)
      if (parts.length >= 3) {
        keys.add(`${parts[2]}-${parts[1]}`)
        if (!minDate || t.date < minDate) minDate = t.date
        if (!maxDate || t.date > maxDate) maxDate = t.date
      }
    })
    return { months: Math.max(1, keys.size), from:minDate, to:maxDate }
  }

  function rebuildMergedTransactions(accounts: BankAccount[]) {
    if (accounts.length === 0) { setTaggedTxns([]); setBankPeriod(null); setBankMonths(1); setIntelligence(null); return }
    const allTxns: any[] = []
    accounts.forEach(acc => {
      const txns = acc.data?.transactions || []
      txns.forEach((t: any) => { allTxns.push({ ...t, sourceAccount: { id: acc.id, bank: acc.bank, last4: acc.last4, label: acc.label } }) })
    })
    const tagged = tagTransactions(allTxns, creditCards)
    setTaggedTxns(tagged)
    const { months, from, to } = detectMonths(tagged)
    setBankMonths(months)
    setBankPeriod({ from, to })

    // Merge per-account intelligence reports into one combined report
    const merged: IntelligenceReport | null = (() => {
      const reports = accounts.map(a => a.intelligenceData).filter(Boolean) as IntelligenceReport[]
      if (reports.length === 0) return null
      if (reports.length === 1) return reports[0]
      const allClassified: ClassifiedTransaction[] = reports.flatMap(r => r.transactions)
      // Discoveries deduped, persons/channels left simple — page only needs .transactions for bucket assignment
      return {
        transactions: allClassified,
        pnl: reports[0].pnl,
        persons: reports.flatMap(r => r.persons),
        channels: reports.flatMap(r => r.channels),
        questions: reports.flatMap(r => r.questions),
        discoveries: Array.from(new Set(reports.flatMap(r => r.discoveries))),
      }
    })()
    setIntelligence(merged)

    // Smart salary detection
    const salaryResult = detectSalary(tagged.filter(t => !manualOverrides[t.id]))
    if (salaryResult.autoConfirmed.length > 0) {
      const primary = salaryResult.autoConfirmed[0]
      const salaryIds = new Set(primary.transactions.map((t: any) => t.id))
      setConfirmedSalaryIds(salaryIds)
      const monthlyNet = Math.round(primary.totalAmount / Math.max(1, months))
      let employerName = primary.source || ''
      employerName = employerName.replace(/^(NEFT|IMPS|UPI|RTGS)[-/\s]*/i, '').replace(/^(CR|DR)[-/\s]*/i, '').replace(/^SALARY[-/\s]*/i, '').trim()
      if (employerName.length < 3) employerName = 'Detected'
      setSalBreakdown(prev => ({
        ...prev,
        netSalary: prev.netSalary > 0 ? prev.netSalary : monthlyNet,
        employerName: prev.employerName || employerName,
      }))
      const bonusTxns = tagged.filter(t => t.type === 'credit' && t.brand === 'Bonus/Incentive')
      if (bonusTxns.length > 0) {
        const bonusTotal = bonusTxns.reduce((s: number, t: any) => s + t.amount, 0)
        setSalBreakdown(prev => ({ ...prev, bonus: prev.bonus > 0 ? prev.bonus : bonusTotal, bonusRecurring: false }))
      }
      const freelanceTxns = tagged.filter(t => t.type === 'credit' && t.brand === 'Freelance Income')
      if (freelanceTxns.length > 0) {
        const freelanceMonthly = Math.round(freelanceTxns.reduce((s: number, t: any) => s + t.amount, 0) / Math.max(1, months))
        setSalBreakdown(prev => ({ ...prev, otherBenefits: prev.otherBenefits > 0 ? prev.otherBenefits : freelanceMonthly, otherBenefitsRecurring: true }))
      }
      if (!salaryResult.hasGap) {
        toast.success(`Salary auto-detected: ${fmt(monthlyNet)}/mo from ${employerName}`, { duration: 4000 })
      } else {
        toast(`Salary found for ${salaryResult.salaryMonths} of ${salaryResult.statementMonths} months`, { icon: '⚠️', duration: 5000 })
      }
    }
  }

  function loadSavedBankAccounts() {
    try {
      const oldBank = localStorage.getItem('av_bank')
      const newBanks = localStorage.getItem('av_banks')
      if (oldBank && !newBanks) {
        const bd = JSON.parse(oldBank)
        const migrated: BankAccount = { id: uid(), bank: bd.bank || 'Bank', last4: bd.accountNumber?.slice(-4) || '', label: '', data: bd, txnCount: bd.transactions?.length || 0, period: detectMonths(bd.transactions || []) }
        const accounts = [migrated]
        setBankAccounts(accounts)
        localStorage.setItem('av_banks', JSON.stringify(accounts))
        localStorage.removeItem('av_bank')
        rebuildMergedTransactions(accounts)
        return
      }
      if (newBanks) {
        const accounts = JSON.parse(newBanks) as BankAccount[]
        setBankAccounts(accounts)
        rebuildMergedTransactions(accounts)
      }
    } catch {}
  }

  // ── Sync & persist ──
  useEffect(() => {
    if (salBreakdown.netSalary > 0) {
      const gross = salBreakdown.netSalary + salBreakdown.employeePF + salBreakdown.employerPF + salBreakdown.bonus + salBreakdown.otherBenefits
      setSalary({ netSalary: salBreakdown.netSalary, grossSalary: gross, employerName: salBreakdown.employerName || 'Your employer', employeePF: salBreakdown.employeePF, employerPF: salBreakdown.employerPF } as any)
      try { localStorage.setItem('av_salary_breakdown', JSON.stringify(salBreakdown)) } catch {}
    }
  }, [salBreakdown])
  useEffect(() => { try { localStorage.setItem('av_credit_cards', JSON.stringify(creditCards)) } catch {} }, [creditCards])
  useEffect(() => { try { localStorage.setItem('av_confirmed_detections', JSON.stringify(confirmedDetections)) } catch {} }, [confirmedDetections])
  useEffect(() => { try { localStorage.setItem('av_manual_overrides', JSON.stringify(manualOverrides)) } catch {} }, [manualOverrides])
  useEffect(() => { try { localStorage.setItem('av_confirmed_salary_ids', JSON.stringify(Array.from(confirmedSalaryIds))) } catch {} }, [confirmedSalaryIds])
  useEffect(() => { try { localStorage.setItem('av_parked_ids', JSON.stringify(Array.from(parkedIds))) } catch {} }, [parkedIds])
  useEffect(() => { try { localStorage.setItem('av_bucket_overrides', JSON.stringify(bucketOverrides)) } catch {} }, [bucketOverrides])
  useEffect(() => { try { localStorage.setItem('av_user_classifications', JSON.stringify(userClassifications)) } catch {} }, [userClassifications])
  useEffect(() => {
    try {
      if (salaryTimeline) localStorage.setItem('av_salary_timeline', JSON.stringify(salaryTimeline))
      else localStorage.removeItem('av_salary_timeline')
    } catch {}
  }, [salaryTimeline])
  useEffect(() => {
    try { localStorage.setItem('av_salary_cta', JSON.stringify(taxCta)) } catch {}
  }, [taxCta])
  // When salary timeline changes, push annual figures into AppStore using the existing contract
  // (Tax Optimizer reads salary.grossSalary * 12, so we store annualGross/12 here)
  useEffect(() => {
    const a = computeAnnual(salaryTimeline)
    if (!a) return
    setSalary({
      netSalary: a.monthlyAvgNet,
      grossSalary: Math.round(a.annualGross / 12),
      employerName: a.latestEmployerName || 'Your employer',
      employeePF: a.recurringMonthlyEPF,
      employerPF: a.recurringMonthlyEmployerPF,
    } as any)
  }, [salaryTimeline])
  useEffect(() => { if (bankAccounts.length === 0) rebuildMergedTransactions(bankAccounts) }, [creditCards.length])

  const saveProfile = useCallback((exp=expenses, sav=savings, vari=variable) => {
    try { localStorage.setItem('av_profile', JSON.stringify({ expenses:exp, savings:sav, variable:vari })) } catch {}
  }, [expenses, savings, variable])

  useEffect(() => {
    if (!aisData) return
    const sel=new Set<string>(); const vals:Record<string,number>={}
    if((aisData as any).dividendIncome>0){sel.add('dividend');vals['dividend']=Math.round((aisData as any).dividendIncome)}
    if((aisData as any).totalInterestIncome>0){sel.add('fd');vals['fd']=Math.round((aisData as any).totalInterestIncome)}
    if((aisData as any).totalCapitalGains>0){sel.add('ltcg');vals['ltcg']=Math.round((aisData as any).totalCapitalGains)}
    if(sel.size>0){setOtherSel(sel);setOtherVals(vals)}
  }, [aisData])

  const grossMonthly = salBreakdown.netSalary + salBreakdown.employeePF + salBreakdown.employerPF + salBreakdown.incentive + (salBreakdown.bonusRecurring ? salBreakdown.bonus : 0) + (salBreakdown.otherBenefitsRecurring ? salBreakdown.otherBenefits : 0)
  const annualCTC = grossMonthly * 12 + (!salBreakdown.bonusRecurring ? salBreakdown.bonus : 0) + (!salBreakdown.otherBenefitsRecurring ? salBreakdown.otherBenefits : 0)
  const salMonthly = salBreakdown.netSalary
  const totalExp = expenses.reduce((s,e)=>s+e.amount,0)
  const totalSav = savings.reduce((s,sv)=>s+sv.amount,0)
  const totalVar = variable.reduce((s,v)=>s+v.amount,0)
  const trulyFree = Math.max(0, salMonthly-totalExp-totalVar-totalSav)

  const pnl = useMemo(() => taggedTxns.length ? computePnL(taggedTxns, bankMonths, confirmedDetections, manualOverrides, confirmedSalaryIds, parkedIds) : null,
    [taggedTxns, bankMonths, confirmedDetections, manualOverrides, confirmedSalaryIds, parkedIds])

  // ══════════════════════════════════════════════════════════════════════
  // SMART CLASSIFICATION — ask when uncertain, remember forever
  //
  // Certain: auto-classify (keyword is explicit — SALARY, EMI, RENT, BONUS)
  // Uncertain: generate question cards, user picks once, stored forever
  // ══════════════════════════════════════════════════════════════════════

  // Extract a "pattern key" for a transaction — used to match user answers to future transactions
  function getPatternKey(t: any): string {
    const desc = (t.description || '').toUpperCase()
    // Person name is the strongest key
    if (t.personName) return `PERSON:${t.personName.toUpperCase()}`
    // NACH mandate — use the entity name after NACH-
    const nachMatch = desc.match(/NACH[-/]([A-Z0-9 ]{3,30})/)
    if (nachMatch) return `NACH:${nachMatch[1].trim()}`
    // Company/brand
    if (t.brand && t.brand !== 'Salary' && t.brand !== 'EMI/Loan') return `BRAND:${t.brand.toUpperCase()}`
    // Fallback: first meaningful words
    const words = desc.replace(/^(UPI|NEFT|IMPS|RTGS)[-/\s]*/i, '').substring(0, 30).trim()
    return `DESC:${words}`
  }

  interface Question {
    id: string
    patternKey: string
    description: string
    amount: number
    date: string
    occurrences: number
    monthlyAmount: number
    question: string
    options: Array<{ bucketId: string; label: string }>
    txnIds: string[]
  }

  const { txnBuckets, questions } = useMemo(() => {
    const map: Record<string, any[]> = {}
    ALL_BUCKET_LIST.forEach(b => { map[b.id] = [] })
    const qList: Question[] = []
    const assignments: Record<string, string> = {}
    const questionedPatterns = new Set<string>()

    // Build description+amount+date → ClassifiedTransaction lookup for engine results
    const intelLookup: Map<string, ClassifiedTransaction> = new Map()
    if (intelligence) {
      intelligence.transactions.forEach(c => {
        const key = `${(c.raw || '').trim()}|${c.amount}|${c.date}`
        intelLookup.set(key, c)
      })
    }
    const lookupIntel = (t: any): ClassifiedTransaction | null => {
      if (intelLookup.size === 0) return null
      const key = `${(t.description || '').trim()}|${t.amount}|${t.date}`
      return intelLookup.get(key) || null
    }

    // ── Step 1: Auto-classify CERTAIN transactions ──
    taggedTxns.forEach(t => {
      // User override always wins
      if (bucketOverrides[t.id]) { assignments[t.id] = bucketOverrides[t.id]; return }

      // Check if user previously answered for this pattern
      const pk = getPatternKey(t)
      if (userClassifications[pk]) { assignments[t.id] = userClassifications[pk]; return }

      // ── PRELUDE: trust v3 intelligence engine when it has a confident classification ──
      const intel = lookupIntel(t)
      if (intel && intel.clarity === 'certain') {
        const bid = bucketIdFromIntelligence(intel)
        if (bid) { assignments[t.id] = bid; return }
      }
      // P2P transfers are routed straight to transfers bucket — person ledger handles classification, no question card
      if (intel && (intel.category === 'Transfer to Persons' || intel.category === 'Transfer to Account')) {
        assignments[t.id] = 'transfers'; return
      }

      const desc = (t.description || '').toUpperCase()
      const brand = t.brand || ''

      // ── CERTAIN: explicit keywords ──
      // Salary: says SALARY
      if (desc.includes('SALARY') || desc.includes('SAL CR') || desc.includes('PAYROLL')) { assignments[t.id] = 'salary'; return }
      // Bonus: says BONUS
      if (desc.includes('BONUS') || desc.includes('BONU')) { assignments[t.id] = 'bonus'; return }
      // Freelance: says FREELANCE
      if (desc.includes('FREELANCE') || desc.includes('CONSULTING FEE') || desc.includes('PROFESSIONAL FEE')) { assignments[t.id] = 'freelance'; return }
      // Self-transfer: says SELF TRANSFER
      if (desc.includes('SELF TRANSFER') || desc.includes('SELF TRF') || desc.includes('OWN A/C') || desc.includes('OWN ACCOUNT')) { assignments[t.id] = 'self_transfer'; return }
      // EMI: says EMI
      if (desc.match(/\bEMI[-\s]/) || desc.includes('HOME LOAN') || desc.includes('CAR LOAN') || desc.includes('PERSONAL LOAN') || desc.includes('EDUCATION LOAN') || desc.includes('GOLD LOAN') || desc.includes('LAPTOP LOAN') || desc.includes('CONSUMER DURABLE') || desc.includes('VEHICLE LOAN') || desc.includes('LOAN REPAY')) { assignments[t.id] = 'emi'; return }
      // Rent: says RENT
      if (desc.includes('RENT PAYMENT') || desc.includes('HOUSE RENT')) { assignments[t.id] = 'rent'; return }
      // CC payment: says CC / CREDIT CARD
      if (desc.includes('CC AUTOPAY') || desc.includes('CC PAYMENT') || desc.includes('CREDIT CARD') || desc.includes('CRED MINT') || desc.includes('CRED PAY')) { assignments[t.id] = 'cc_payment'; return }
      // Interest: says INTEREST
      if (desc.includes('INTEREST CREDIT') || desc.includes('INT.PD') || desc.includes('INT PD') || desc.includes('INT CR') || desc.includes('INT.COLL') || desc.includes('FD INTEREST')) { assignments[t.id] = 'dividends'; return }
      // Dividend: says DIVIDEND
      if (desc.includes('DIVIDEND') || desc.includes('DIV CREDIT') || desc.includes('DIV CR')) { assignments[t.id] = 'dividends'; return }
      // Cashback/refund
      if (desc.includes('CASHBACK') || desc.includes('CASH BACK') || desc.includes('REFUND') || desc.includes('REVERSAL')) { assignments[t.id] = 'dividends'; return }
      // Insurance: says INSURANCE/PREMIUM/LIC
      if (desc.includes('INSURANCE') || desc.includes('MEDICLAIM') || desc.includes('LIC PREMIUM') || desc.match(/\bLIC[-\s]/) || desc.includes('PREMIUM-POL')) { assignments[t.id] = 'insurance'; return }
      // PPF/NPS: says PPF or NPS
      if (desc.includes('PPF') || desc.includes('NPS CONTRIBUTION') || desc.includes('NPS TIER') || desc.includes('NATIONAL PENSION') || desc.includes('PUBLIC PROVIDENT')) { assignments[t.id] = 'ppf_nps'; return }
      // Tax: says TAX
      if (desc.includes('ADVANCE TAX') || desc.includes('INCOME TAX') || desc.includes('TAX PAYMENT') || desc.includes('CHALLAN') || desc.includes('NSDL/ADTAX')) { assignments[t.id] = 'tax'; return }
      // ATM
      if (desc.includes('ATM') || desc.includes('CASH WDL') || desc.includes('CASH WITHDRAWAL')) { assignments[t.id] = 'misc'; return }
      // Home services: says URBAN COMPANY, HOME CLEANING
      if (desc.includes('URBAN COMPANY') || desc.includes('URBAN CLAP') || desc.includes('URBANCLAP') || desc.includes('HOME CLEANING')) { assignments[t.id] = 'home_services'; return }
      // Known shopping/entertainment/food merchants that might not have mega set
      if (desc.includes('FERNS N PETALS') || desc.includes('FNP')) { assignments[t.id] = 'shopping'; return }
      if (desc.includes('BOOKMYSHOW') || desc.includes('PVR') || desc.includes('INOX')) { assignments[t.id] = 'entertainment'; return }
      if (desc.includes('CLEARTRIP') || desc.includes('MAKEMYTRIP') || desc.includes('GOIBIBO') || desc.includes('AIRBNB') || desc.includes('OYO')) { assignments[t.id] = 'entertainment'; return }
      // Mutual fund SIP: says MUTUAL FUND or BLUECHIP or MID CAP etc
      if (desc.includes('MUTUAL FUND') || desc.includes('BLUECHIP') || desc.includes('MID CAP') || desc.includes('FLEXI CAP') || desc.includes('PARAG PARIKH') || desc.includes('AXIS BLUECHIP') || desc.includes('HDFC MID')) { assignments[t.id] = 'sip'; return }
      // Stock purchase
      if (desc.includes('STOCK PURCHASE') || desc.includes('ZERODHA') || desc.includes('GROWW') || desc.includes('ANGELONE') || desc.includes('UPSTOX')) { assignments[t.id] = 'stocks'; return }
      // FD/RD
      if (desc.includes('FIXED DEPOSIT') || desc.includes('FD BOOKING') || desc.includes('RECURRING DEPOSIT') || desc.includes('RD INST')) { assignments[t.id] = 'fd_rd'; return }

      // ── CERTAIN: known merchants (from mega category) ──
      const mega = t.mega as string
      if (mega === 'food') { assignments[t.id] = 'food'; return }
      if (mega === 'shopping') { assignments[t.id] = 'shopping'; return }
      if (mega === 'transport') { assignments[t.id] = 'fuel'; return }
      if (mega === 'utilities') { assignments[t.id] = 'utilities'; return }
      if (mega === 'healthcare') { assignments[t.id] = 'healthcare'; return }
      if (mega === 'entertainment') { assignments[t.id] = 'entertainment'; return }
      if (mega === 'cc_payment') { assignments[t.id] = 'cc_payment'; return }
      if (mega === 'insurance') { assignments[t.id] = 'insurance'; return }
      if (mega === 'investments_elss') { assignments[t.id] = 'elss'; return }
      if (mega === 'investments_regular') { assignments[t.id] = 'stocks'; return }
      if (mega === 'interest') { assignments[t.id] = 'dividends'; return }
      if (mega === 'cashback') { assignments[t.id] = 'dividends'; return }
      if (mega === 'salary' && t.type === 'credit') { assignments[t.id] = 'salary'; return }
      if (mega === 'transfer') { assignments[t.id] = 'transfers'; return }

      // ── UNCERTAIN: only if mega is misc AND no known merchant ──
      assignments[t.id] = '__uncertain__'
    })

    // ── Step 2: Group uncertain transactions by pattern key and generate questions ──
    const uncertainGroups: Record<string, any[]> = {}
    taggedTxns.forEach(t => {
      if (assignments[t.id] !== '__uncertain__') return
      const pk = getPatternKey(t)
      if (!uncertainGroups[pk]) uncertainGroups[pk] = []
      uncertainGroups[pk].push(t)
    })

    for (const [pk, group] of Object.entries(uncertainGroups)) {
      const first = group[0]
      const desc = (first.description || '').toUpperCase()
      const total = group.reduce((s: number, t: any) => s + t.amount, 0)
      const monthly = Math.round(total / Math.max(1, bankMonths))
      const isCredit = first.type === 'credit'
      const personName = first.personName || ''

      // Build contextual question and options
      let question = ''
      let options: Array<{ bucketId: string; label: string }> = []

      if (pk.startsWith('PERSON:') && !isCredit) {
        question = `You pay ${personName} ${fmt(group[0].amount)} ${group.length > 1 ? 'every month' : ''}. What is this?`
        options = [
          { bucketId: 'rent', label: '🏠 Rent' },
          { bucketId: 'transfers', label: '👤 Family / household' },
          { bucketId: 'home_services', label: '🏠 Domestic help / services' },
          { bucketId: 'misc', label: '📦 Something else' },
        ]
      } else if (desc.includes('NACH') && !isCredit) {
        const entity = desc.replace(/^.*NACH[-/]/, '').split(/[-/]/)[0].trim()
        question = `Auto-debit (NACH) of ${fmt(group[0].amount)} to "${entity}". What is this for?`
        options = [
          { bucketId: 'sip', label: '📈 Mutual fund SIP' },
          { bucketId: 'emi', label: '🏦 EMI / loan repayment' },
          { bucketId: 'insurance', label: '🛡 Insurance premium' },
          { bucketId: 'ppf_nps', label: '🏛 PPF / NPS' },
          { bucketId: 'utilities', label: '⚡ Utility bill' },
          { bucketId: 'misc', label: '📦 Something else' },
        ]
      } else if (isCredit && !desc.includes('SALARY') && !desc.includes('SELF') && !desc.includes('INTEREST')) {
        question = `Credit of ${fmt(first.amount)} — "${first.description?.substring(0, 40)}". What is this?`
        options = [
          { bucketId: 'salary', label: '💰 Salary' },
          { bucketId: 'bonus', label: '🎁 Bonus / incentive' },
          { bucketId: 'freelance', label: '💼 Freelance / consulting' },
          { bucketId: 'dividends', label: '💸 Dividend / interest' },
          { bucketId: 'self_transfer', label: '🔄 Self-transfer (not income)' },
          { bucketId: 'misc', label: '📦 Something else' },
        ]
      } else {
        question = `${fmt(first.amount)} — "${first.description?.substring(0, 40)}". What category?`
        options = [
          { bucketId: 'food', label: '🍽 Food / dining' },
          { bucketId: 'shopping', label: '🛍 Shopping' },
          { bucketId: 'fuel', label: '⛽ Fuel / transport' },
          { bucketId: 'utilities', label: '⚡ Utilities' },
          { bucketId: 'healthcare', label: '💊 Healthcare' },
          { bucketId: 'entertainment', label: '🎬 Entertainment' },
          { bucketId: 'home_services', label: '🏠 Home services' },
          { bucketId: 'emi', label: '🏦 EMI / loan' },
          { bucketId: 'misc', label: '📦 Other' },
        ]
      }

      // Don't ask the same pattern twice
      if (!questionedPatterns.has(pk)) {
        questionedPatterns.add(pk)
        qList.push({
          id: pk,
          patternKey: pk,
          description: first.description || '',
          amount: first.amount,
          date: first.date || '',
          occurrences: group.length,
          monthlyAmount: monthly,
          question,
          options,
          txnIds: group.map((t: any) => t.id),
        })
      }

      // For now, put uncertain in misc until user answers
      group.forEach((t: any) => { assignments[t.id] = 'misc' })
    }

    // Build final bucket map
    taggedTxns.forEach(t => {
      const bucket = assignments[t.id] || 'misc'
      if (map[bucket]) map[bucket].push(t)
      else if (map['misc']) map['misc'].push(t)
    })

    // Sort questions: largest amounts first
    qList.sort((a, b) => (b.monthlyAmount * b.occurrences) - (a.monthlyAmount * a.occurrences))

    return { txnBuckets: map, questions: qList }
  }, [taggedTxns, bucketOverrides, userClassifications, bankMonths, intelligence])

  // Answer a question — store classification forever, apply to all matching transactions
  const answerQuestion = (q: Question, bucketId: string) => {
    // Store the answer for this pattern
    setUserClassifications(prev => ({ ...prev, [q.patternKey]: bucketId }))
    // Also override all current transactions with this pattern
    setBucketOverrides(prev => {
      const updated = { ...prev }
      q.txnIds.forEach(id => { updated[id] = bucketId })
      return updated
    })
    const bucketInfo = ALL_BUCKET_LIST.find(b => b.id === bucketId)
    toast.success(`Got it — "${q.description.substring(0, 25)}…" → ${bucketInfo?.label}. Remembered for next time.`)
  }

  // ── File handlers (unchanged) ──
  const handleBankFile = async (file:File, password='') => {
    if (file.size > 50*1024*1024) { toast.error('File too large (max 50MB)'); return }
    setLoadingDoc('bank'); setPwdModal({ open:false, type:null, file:null, error:'' })
    const tid = toast.loading('Reading your bank statement…')
    try {
      let res: Response

      if (file.size > 4 * 1024 * 1024) {
        // Large file: upload to Blob first, then send URL to parser
        toast.loading('Uploading large file…', { id: tid })
        const { upload } = await import('@vercel/blob/client')
        const blob = await upload(file.name, file, {
          access: 'private',
          handleUploadUrl: '/api/blob-upload',
        })
        toast.loading('Parsing statement…', { id: tid })
        res = await fetch('/api/parse-bank-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blobUrl: blob.url, password, fileName: file.name, fileType: file.type }),
        })
      } else {
        // Small file: direct upload
        const form = new FormData(); form.append('file', file); if (password) form.append('password', password)
        res = await fetch('/api/parse-bank-statement', { method:'POST', body:form })
      }
      const text = await res.text()
      let json:any
      try { json = JSON.parse(text) } catch { json = { error: 'corrupt_file', message: text } }
      const errCode = json.error
      if (!res.ok || errCode) {
        toast.dismiss(tid)
        if (errCode==='incorrect_password' || res.status===422) { setPwdModal({ open:true, type:'bank', file, error: password ? 'Incorrect password. Try again.' : '' }); setPwd(''); return }
        if (errCode==='aes_pdf_unsupported') { toast.error('This PDF is AES-encrypted. Try downloading as Excel from your bank app.', { duration:6000 }); return }
        toast.error(json.message || json.error || 'Failed to parse statement'); return
      }
      const bd = json.data
      const period = detectMonths(bd.transactions || [])
      const accId = uploadingAccountId || uid()
      const newAccount: BankAccount = { id: accId, bank: bd.bank || 'Bank', last4: bd.accountNumber?.slice(-4) || '', label: '', data: bd, txnCount: bd.transactions?.length || 0, period, intelligenceData: json.intelligence || undefined }
      const updated = uploadingAccountId ? bankAccounts.map(a => a.id === uploadingAccountId ? newAccount : a) : [...bankAccounts, newAccount]
      setBankAccounts(updated)
      try { localStorage.setItem('av_banks', JSON.stringify(updated)) } catch (e) { console.error('[av_banks] SAVE FAILED:', e) }
      rebuildMergedTransactions(updated)
      setUploadingAccountId(null)
      toast.success(`${bd.bank || 'Bank'} · ${bd.transactions?.length||0} transactions across ${period.months} month${period.months>1?'s':''}`, { id:tid, duration:5000 })
    } catch (e:any) {
      const errStr=(e.message||'').toLowerCase()
      if (errStr.includes('password')||errStr.includes('encrypted')) { setPwdModal({ open:true, type:'bank', file, error:'' }); setPwd(''); toast.dismiss(tid); return }
      toast.error(e.message||'Failed to parse', { id:tid })
    } finally { setLoadingDoc(null) }
  }

  // ─── Salary Slip Upload ────────────────────────────────────────────────
  const handleSalaryFile = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { toast.error('File too large (max 50MB)'); return }
    setLoadingDoc('salary')
    const tid = toast.loading('Reading your salary slip…')
    try {
      const base64Data = await fileToBase64(file)
      const mediaType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
      const res = await fetch('/api/parse-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType, fileName: file.name }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to parse salary slip', { id: tid })
        return
      }
      // Backend now returns an array of slips. Defensive: handle legacy single-object too.
      const parsedSlips: ParsedSalaryData[] = Array.isArray(json.data) ? json.data : [json.data]
      if (parsedSlips.length === 0) {
        toast.error('No slips found in the file', { id: tid })
        return
      }

      // Build SlipData for each parsed slip, sorted earliest first
      const slips = parsedSlips
        .map(p => slipFromParsed(p, file.name))
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

      // pendingMonthIntent only meaningful for single-slip uploads (from a clicked projected month).
      // For multi-slip files, the user uploaded a batch; per-month intent doesn't apply.
      if (slips.length === 1 && pendingMonthIntent && pendingMonthIntent !== slips[0].monthKey) {
        toast(`Slip is for ${monthLabel(slips[0].monthKey)} — added there instead of ${monthLabel(pendingMonthIntent)}`, { icon: 'ℹ️', duration: 5000 })
      }
      setPendingMonthIntent(null)

      // Employee-name guard runs against the FIRST slip in the batch.
      // All slips in one file should be the same person; we only check once.
      const firstName = (parsedSlips[0] as any)?.employeeName || ''
      if (firstName && salaryTimeline && salaryTimeline.employments.some(e => e.slips.length > 0)) {
        const lastEmp = salaryTimeline.employments[salaryTimeline.employments.length - 1]
        const lastSlip = lastEmp.slips.sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
        const existingName = (lastSlip?.parsed as any)?.employeeName || ''
        if (existingName && !namesPlausiblyMatch(existingName, firstName)) {
          toast.dismiss(tid)
          // Stash the whole batch (we'll add all of them if user confirms)
          if (slips.length === 1) {
            setNameMismatchPrompt({ open: true, pendingSlip: slips[0], existingName, newName: firstName })
          } else {
            // Multi-slip batch with name mismatch — discard and tell user
            toast.error(`Different employee detected (${firstName} vs ${existingName}). Discarded ${slips.length} slips.`, { duration: 6000 })
          }
          return
        }
      }

      if (slips.length === 1) {
        addSlipToTimeline(slips[0], tid)
      } else {
        addMultipleSlipsToTimeline(slips, tid)
      }
    } catch (e: any) {
      setPendingMonthIntent(null)
      toast.error(e.message || 'Failed to read salary slip', { id: tid })
    } finally { setLoadingDoc(null) }
  }

  // Add multiple slips from the same uploaded file in ONE state update.
  // Same-document means same-employer by definition, so we don't fire the
  // "employer changed / basic jumped" prompts between slips in the batch.
  // Existing slips with same monthKey in any employment get REPLACED silently
  // (typical case: user re-uploads to refresh data).
  const addMultipleSlipsToTimeline = (slips: SlipData[], toastId?: string) => {
    if (slips.length === 0) return
    setEmptyMonthsDismissed(false)
    try { localStorage.removeItem('av_empty_months_dismissed') } catch {}

    setSalaryTimeline(prev => {
      // First batch ever — create timeline from the earliest slip's FY
      if (!prev) {
        const earliest = slips[0]
        const fyStart = fyStartYearForMonthKey(earliest.monthKey)
        const newTimeline: SalaryTimeline = {
          fy: fyLabel(fyStart),
          fyStartYear: fyStart,
          employments: [{
            id: uid(),
            employerName: earliest.parsed.employerName || 'Employer',
            fromMonth: slips[0].monthKey,
            toMonth: null,
            slips: [...slips].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
          }],
          overrides: [],
        }
        if (toastId) toast.success(`${slips.length} slips added`, { id: toastId })
        return newTimeline
      }

      // Existing timeline — fold all slips into the latest employment.
      // (Same file = same employer = same employment.)
      const latestEmpIdx = prev.employments.length - 1
      const latestEmp = prev.employments[latestEmpIdx]
      const existingMonthKeys = new Set(latestEmp.slips.map(s => s.monthKey))
      // Other employments also can't have duplicate months — collect for replacement
      const allOtherEmpMonths = new Set<string>()
      prev.employments.forEach((e, i) => {
        if (i !== latestEmpIdx) e.slips.forEach(s => allOtherEmpMonths.add(s.monthKey))
      })

      const newSlipsForLatest: SlipData[] = []
      const replacedMonths: string[] = []
      const skippedMonths: string[] = []
      for (const slip of slips) {
        if (existingMonthKeys.has(slip.monthKey)) {
          // Replace in-place
          replacedMonths.push(slip.monthKey)
          newSlipsForLatest.push(slip)
        } else if (allOtherEmpMonths.has(slip.monthKey)) {
          // Month belongs to another employment — skip to avoid silent reassignment
          skippedMonths.push(slip.monthKey)
        } else {
          newSlipsForLatest.push(slip)
        }
      }

      const replacedSet = new Set(replacedMonths)
      const mergedSlips = [
        ...latestEmp.slips.filter(s => !replacedSet.has(s.monthKey)),
        ...newSlipsForLatest,
      ].sort((a, b) => a.monthKey.localeCompare(b.monthKey))

      const newFromMonth = mergedSlips[0].monthKey < latestEmp.fromMonth
        ? mergedSlips[0].monthKey
        : latestEmp.fromMonth

      const updated = {
        ...prev,
        employments: prev.employments.map((e, i) => i === latestEmpIdx
          ? { ...e, slips: mergedSlips, fromMonth: newFromMonth }
          : e),
        overrides: prev.overrides.filter(o => !mergedSlips.some(s => s.monthKey === o.monthKey)),
      }

      const added = newSlipsForLatest.length - replacedMonths.length
      const parts: string[] = []
      if (added > 0) parts.push(`${added} added`)
      if (replacedMonths.length > 0) parts.push(`${replacedMonths.length} replaced`)
      if (skippedMonths.length > 0) parts.push(`${skippedMonths.length} skipped (already in another employment)`)
      if (toastId) toast.success(parts.join(' · ') || `${slips.length} slips processed`, { id: toastId })
      return updated
    })
  }


  // Add slip to timeline — auto-detects same employer / hike / new employer
  // Prompts user only when ambiguous (employer name change OR basic salary jump >5%)
  const addSlipToTimeline = (slip: SlipData, toastId?: string) => {
    // Reset dismissed empty-months notice — uploading a new slip may have closed a gap
    setEmptyMonthsDismissed(false)
    try { localStorage.removeItem('av_empty_months_dismissed') } catch {}
    setSalaryTimeline(prev => {
      // First slip ever — create timeline
      if (!prev) {
        const fyStart = fyStartYearForMonthKey(slip.monthKey)
        const newTimeline: SalaryTimeline = {
          fy: fyLabel(fyStart),
          fyStartYear: fyStart,
          employments: [{
            id: uid(),
            employerName: slip.parsed.employerName || 'Employer',
            fromMonth: slip.monthKey,
            toMonth: null,
            slips: [slip],
          }],
          overrides: [],
        }
        if (toastId) toast.success(`Salary slip added · ${monthLabel(slip.monthKey)}`, { id: toastId })
        return newTimeline
      }
      // Compare with latest slip in latest employment
      const latestEmp = prev.employments[prev.employments.length - 1]
      const latestSlip = latestEmp.slips.sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
      const newEmployerName = (slip.parsed.employerName || '').trim()
      const oldEmployerName = (latestSlip.parsed.employerName || latestEmp.employerName || '').trim()
      const employerSame = newEmployerName.toLowerCase() === oldEmployerName.toLowerCase() || (newEmployerName === '' || oldEmployerName === '')
      const oldBasic = latestSlip.parsed.basicSalary || 0
      const newBasic = slip.parsed.basicSalary || 0
      const basicJumped = oldBasic > 0 && Math.abs(newBasic - oldBasic) / oldBasic > 0.05

      // Same month already exists in any employment — ask to replace
      const existingEmp = prev.employments.find(e => e.slips.some(s => s.monthKey === slip.monthKey))
      if (existingEmp) {
        const ok = typeof window !== 'undefined' && window.confirm(`A slip for ${monthLabel(slip.monthKey)} already exists. Replace it?`)
        if (!ok) {
          if (toastId) toast.dismiss(toastId)
          return prev
        }
        const updated = {
          ...prev,
          employments: prev.employments.map(e => {
            if (e.id !== existingEmp.id) return e
            const newSlips = e.slips.filter(s => s.monthKey !== slip.monthKey).concat(slip).sort((a,b) => a.monthKey.localeCompare(b.monthKey))
            const newFromMonth = newSlips[0].monthKey < e.fromMonth ? newSlips[0].monthKey : e.fromMonth
            return { ...e, slips: newSlips, fromMonth: newFromMonth }
          }),
          overrides: prev.overrides.filter(o => o.monthKey !== slip.monthKey),
        }
        if (toastId) toast.success(`Replaced ${monthLabel(slip.monthKey)} slip`, { id: toastId })
        return updated
      }

      // Ambiguous case — prompt the user
      if (!employerSame || basicJumped) {
        setEmploymentPrompt({
          open: true,
          pendingSlip: slip,
          reason: !employerSame ? 'employer_changed' : 'basic_jumped',
          oldEmployerName: oldEmployerName,
          newEmployerName: newEmployerName,
        })
        if (toastId) toast.dismiss(toastId)
        return prev
      }

      // Silent path: same employer, stable basic — just add to latest employment
      const updated = {
        ...prev,
        employments: prev.employments.map((e, i) => {
          if (i !== prev.employments.length - 1) return e
          const newSlips = [...e.slips, slip].sort((a,b) => a.monthKey.localeCompare(b.monthKey))
          // Extend fromMonth backward if this slip pre-dates the employment's start
          const newFromMonth = newSlips[0].monthKey < e.fromMonth ? newSlips[0].monthKey : e.fromMonth
          return { ...e, slips: newSlips, fromMonth: newFromMonth }
        }),
      }
      if (toastId) toast.success(`Salary slip added · ${monthLabel(slip.monthKey)}`, { id: toastId })
      return updated
    })
  }

  // Resolve the employment prompt — user picked one of three options
  const resolveEmploymentPrompt = (choice: 'same_employer' | 'hike' | 'new_employer') => {
    const slip = employmentPrompt.pendingSlip
    if (!slip) { setEmploymentPrompt({ open: false, pendingSlip: null, reason: null }); return }
    setSalaryTimeline(prev => {
      if (!prev) return prev
      if (choice === 'new_employer') {
        // Close out the current employment at the month before this slip; start a new employment
        const prevMonth = (() => {
          const [y, m] = slip.monthKey.split('-').map(Number)
          const pm = m === 1 ? 12 : m - 1
          const py = m === 1 ? y - 1 : y
          return `${py}-${String(pm).padStart(2, '0')}`
        })()
        const closed = prev.employments.map((e, i) => i === prev.employments.length - 1 ? { ...e, toMonth: prevMonth } : e)
        const newEmp: Employment = {
          id: uid(),
          employerName: slip.parsed.employerName || 'New Employer',
          fromMonth: slip.monthKey,
          toMonth: null,
          slips: [slip],
        }
        toast.success(`New employer added · ${newEmp.employerName}`)
        return { ...prev, employments: [...closed, newEmp] }
      }
      // same_employer or hike — both attach to latest employment.
      // For 'hike', the new slip's components naturally have higher recurring values, projection adjusts forward
      const updated = {
        ...prev,
        employments: prev.employments.map((e, i) => {
          if (i !== prev.employments.length - 1) return e
          const newSlips = [...e.slips, slip].sort((a,b) => a.monthKey.localeCompare(b.monthKey))
          const newFromMonth = newSlips[0].monthKey < e.fromMonth ? newSlips[0].monthKey : e.fromMonth
          return { ...e, slips: newSlips, fromMonth: newFromMonth }
        }),
      }
      toast.success(choice === 'hike' ? `Hike recorded from ${monthLabel(slip.monthKey)}` : `Slip added · ${monthLabel(slip.monthKey)}`)
      return updated
    })
    setEmploymentPrompt({ open: false, pendingSlip: null, reason: null })
  }

  const removeSlip = (slipId: string) => {
    if (!confirm('Remove this slip?')) return
    setSalaryTimeline(prev => {
      if (!prev) return prev
      const updated = {
        ...prev,
        employments: prev.employments.map(e => ({ ...e, slips: e.slips.filter(s => s.id !== slipId) })).filter(e => e.slips.length > 0),
      }
      return updated.employments.length === 0 ? null : updated
    })
  }

  const updateComponentFlag = (employmentId: string, slipId: string, componentLabel: string, newFlag: 'recurring' | 'one_time') => {
    setSalaryTimeline(prev => {
      if (!prev) return prev
      return {
        ...prev,
        employments: prev.employments.map(e => e.id !== employmentId ? e : {
          ...e,
          slips: e.slips.map(s => s.id !== slipId ? s : {
            ...s,
            components: s.components.map(c => c.label === componentLabel ? { ...c, flag: newFlag } : c),
          }),
        }),
      }
    })
  }

  const setMonthOverride = (monthKey: string, components: { label: string; amount: number; type: 'earning' | 'deduction' }[]) => {
    setSalaryTimeline(prev => {
      if (!prev) return prev
      const others = prev.overrides.filter(o => o.monthKey !== monthKey)
      return { ...prev, overrides: [...others, { monthKey, components }] }
    })
  }
  const clearMonthOverride = (monthKey: string) => {
    setSalaryTimeline(prev => prev ? { ...prev, overrides: prev.overrides.filter(o => o.monthKey !== monthKey) } : prev)
  }
  const resetSalaryTimeline = () => {
    if (!confirm('Reset entire salary timeline? This will remove all uploaded slips and overrides.')) return
    setSalaryTimeline(null)
    toast.success('Salary timeline reset')
  }

  // Path 3: merge user's CTA inputs + auto-derived values from latest slip into av_tax_progress
  // Auto-syncs salary-derived deductions (HRA monthly, EPF annual) into av_tax_progress
  // and navigates user to Tax Optimiser, where they enter rent/80D/80C themselves.
  // CRITICAL: write a complete Deductions object so Tax Optimiser's sums never hit `undefined` (which produces NaN).
  const syncToTaxOptimiser = () => {
    try {
      const existing = localStorage.getItem('av_tax_progress')
      const current = existing ? JSON.parse(existing) : { step: 0, ded: {} }
      const prior = current.ded || {}

      // Auto-derive from latest slip in latest employment
      let hraReceived = 0, epfMonthly = 0, basicMonthly = 0
      if (salaryTimeline && salaryTimeline.employments.length > 0) {
        const latestEmp = salaryTimeline.employments[salaryTimeline.employments.length - 1]
        const latestSlip = latestEmp.slips.sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
        if (latestSlip) {
          const hraComp = latestSlip.components.find(c => c.type === 'earning' && /HRA|HOUSE RENT/i.test(c.label))
          if (hraComp) hraReceived = hraComp.amount
          const epfComp = latestSlip.components.find(c => c.type === 'deduction' && /EMPLOYEE PF|^EPF$|PROVIDENT FUND/i.test(c.label))
          if (epfComp) epfMonthly = epfComp.amount
          // Prefer the parsed.basicSalary field (clean number from API), fall back to component match
          if (latestSlip.parsed.basicSalary && latestSlip.parsed.basicSalary > 0) {
            basicMonthly = latestSlip.parsed.basicSalary
          } else {
            const basicComp = latestSlip.components.find(c => c.type === 'earning' && /^BASIC|BASIC\s*(SALARY|PAY)/i.test(c.label))
            if (basicComp) basicMonthly = basicComp.amount
          }
        }
      }

      // Build a complete Deductions object — every field defaulted, then auto-derived where applicable
      // Tax Optimiser's calcTax() expects exact shape — see tax page lines 122-128
      const num = (v: any) => (typeof v === 'number' && !isNaN(v) ? v : 0)
      const bool = (v: any, def: boolean) => (typeof v === 'boolean' ? v : def)
      const merged: any = {
        // HRA — hraReceived + basic auto-derived (rentPaid is asked in Tax Optimiser's HRA step)
        rentPaid: num(prior.rentPaid),
        hraReceived: num(prior.hraReceived) || hraReceived,
        isMetro: bool(prior.isMetro, true),
        basic: num(prior.basic) || basicMonthly,
        // 80C — EPF auto-derived from slip (other buckets asked in Tax Optimiser)
        ppf: num(prior.ppf),
        elss: num(prior.elss),
        lic: num(prior.lic),
        homeLoanPrincipal: num(prior.homeLoanPrincipal),
        tuition: num(prior.tuition),
        nsc: num(prior.nsc),
        epf: num(prior.epf) || (epfMonthly * 12),
        // 80D — user fills in Tax Optimiser
        selfFamily: num(prior.selfFamily),
        parents: num(prior.parents),
        parentsSenior: bool(prior.parentsSenior, false),
        selfSenior: bool(prior.selfSenior, false),
        // Other deductions — user fills in Tax Optimiser
        nps: num(prior.nps),
        savingsInterest: num(prior.savingsInterest),
        donations100: num(prior.donations100),
        donations50: num(prior.donations50),
        homeLoanInterest: num(prior.homeLoanInterest),
        eduLoanInterest: num(prior.eduLoanInterest),
      }

      localStorage.setItem('av_tax_progress', JSON.stringify({ step: current.step || 0, ded: merged }))
      setTaxCta({ submittedAt: new Date().toISOString() })
      router.push('/dashboard/tax')
    } catch (e: any) {
      toast.error('Could not open Tax Optimiser')
    }
  }

  const removeAccount = (accId: string) => {
    const updated = bankAccounts.filter(a => a.id !== accId)
    setBankAccounts(updated)
    try { localStorage.setItem('av_banks', JSON.stringify(updated)) } catch {}
    if (updated.length === 0) {
      setTaggedTxns([]); setBankPeriod(null); setBankMonths(1)
      setConfirmedDetections({}); setManualOverrides({})
      setConfirmedSalaryIds(new Set()); setParkedIds(new Set()); setBucketOverrides({})
      try { localStorage.removeItem('av_banks'); localStorage.removeItem('av_confirmed_detections'); localStorage.removeItem('av_manual_overrides'); localStorage.removeItem('av_confirmed_salary_ids'); localStorage.removeItem('av_parked_ids'); localStorage.removeItem('av_bucket_overrides') } catch {}
    } else { rebuildMergedTransactions(updated) }
    toast.success('Account removed')
  }

  const updateAccountLabel = (accId: string, label: string) => {
    const updated = bankAccounts.map(a => a.id === accId ? { ...a, label } : a)
    setBankAccounts(updated)
    try { localStorage.setItem('av_banks', JSON.stringify(updated)) } catch {}
  }

  const handleAISFile = (file:File, type:'ais'|'26as') => {
    if (file.type==='application/pdf'&&type==='ais') { setPwdModal({ open:true, type, file, error:'' }); setPwd(''); return }
    processAIS(file, type, '')
  }

  const processAIS = async (file:File, type:string, password:string) => {
    setLoadingDoc(type); setPwdModal({ open:false, type:null, file:null, error:'' })
    const tid = toast.loading(`Reading ${type.toUpperCase()}…`)
    try {
      const b64 = await fileToBase64(file)
      const res = await fetch('/api/parse-ais', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ base64Data:b64, mediaType:file.type, password:password||undefined }) })
      const json = await res.json()
      if (res.status===422||json.error==='incorrect_password') { toast.dismiss(tid); setPwdModal({ open:true, type:type as any, file, error:password?'Incorrect password.':'' }); return }
      if (!res.ok) throw new Error(json.error)
      setAisData(json.data); toast.success(`${type.toUpperCase()} parsed!`, { id:tid })
    } catch (e:any) { toast.error(e.message, { id:tid }) }
    finally { setLoadingDoc(null) }
  }

  const handleSlip = async (file:File) => {
    setLoadingDoc('slip'); const tid = toast.loading('Reading salary slip…')
    try {
      const b64 = await fileToBase64(file)
      const res = await fetch('/api/parse-salary', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ base64Data:b64, mediaType:file.type }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const slip = json.data
      const empPF = slip.deductions?.find?.((d:any) => /pf|provident/i.test(d.name||''))?.amount || 0
      setSalBreakdown({ netSalary: slip.netSalary || slip.netPay || 0, employeePF: empPF, employerPF: empPF, bonus: 0, incentive: 0, otherBenefits: 0, employerName: slip.employerName || 'Your employer', bonusRecurring: false, otherBenefitsRecurring: false })
      toast.success(`Slip parsed! Net ₹${(slip.netSalary||slip.netPay||0).toLocaleString('en-IN')}`, { id:tid, duration:5000 })
    } catch (e:any) { toast.error(e.message, { id:tid }) }
    finally { setLoadingDoc(null) }
  }

  const handleOffer = async (file:File) => {
    setLoadingDoc('offer'); const tid = toast.loading('Reading offer letter…')
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/parse-offer-letter', { method:'POST', body:form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const data = json.data
      const monthlyCTC = (data.fixedCTC || data.totalCTC || 0) / 12
      setSalBreakdown({ netSalary: Math.round(monthlyCTC * 0.75), employeePF: Math.round(monthlyCTC * 0.12), employerPF: Math.round(monthlyCTC * 0.12), bonus: 0, incentive: 0, otherBenefits: 0, employerName: data.employerName || 'Your employer', bonusRecurring: false, otherBenefitsRecurring: false })
      toast.success('Offer letter parsed — review breakdown', { id:tid })
    } catch (e:any) { toast.error(e.message, { id:tid }) }
    finally { setLoadingDoc(null) }
  }

  const submitPassword = () => {
    if (!pwdModal.type) return
    if (pwdModal.type==='bank') { if (pwdModal.file) handleBankFile(pwdModal.file, pwd); return }
    if (pwdModal.type==='cas') {
      setCasPassword(pwd)
      if (pwdModal.file) {
        const file = pwdModal.file
        setLoadingDoc('cas'); setPwdModal({ open:false, type:null, file:null, error:'' })
        const tid = toast.loading('Reading your CAS statement…')
        const form = new FormData(); form.append('file', file); form.append('password', pwd)
        fetch('/api/parse-cas', { method:'POST', body:form })
          .then(res => res.json())
          .then(json => {
            if (json.error) { toast.dismiss(tid); if (json.error === 'incorrect_password') { setPwdModal({ open:true, type:'cas', file, error:'Incorrect password.' }); setPwd(''); return }; toast.error(json.message || json.error); return }
            setCasData(json.data); try { localStorage.setItem('av_cas_holdings', JSON.stringify(json.data)) } catch {}
            const s = json.data.summary; toast.success(`CAS parsed · ${s.equityCount} stocks · ${s.mfCount} MF schemes · Total ${fmt(s.totalValue)}`, { id:tid, duration:6000 })
          }).catch(e => toast.error(e.message || 'Failed', { id:tid })).finally(() => setLoadingDoc(null))
      } else { setPwdModal({ open:false, type:null, file:null, error:'' }); casRef.current?.click() }
      return
    }
    if (pwdModal.file) processAIS(pwdModal.file, pwdModal.type, pwd)
  }

  const addCreditCard = () => {
    if (!newCardBank || !newCardLast4 || newCardLast4.length !== 4) { toast.error('Pick a bank and enter exactly 4 digits'); return }
    setCreditCards(prev => [...prev, { id: uid(), bank: newCardBank, last4: newCardLast4 }])
    setNewCardBank(''); setNewCardLast4('')
    toast.success(`${newCardBank} card ****${newCardLast4} added`)
  }
  const removeCreditCard = (id: string) => setCreditCards(prev => prev.filter(c => c.id !== id))

  // Review tab: move transaction to another bucket
  const moveToBucket = (txnId: string, newBucketId: string) => {
    setBucketOverrides(prev => ({ ...prev, [txnId]: newBucketId }))
    const bucketInfo = ALL_BUCKET_LIST.find(b => b.id === newBucketId)
    const txn = taggedTxns.find(t => t.id === txnId)
    // Also save to merchant memory so future uploads remember
    if (txn) {
      const memory = loadMerchantMemory()
      const megaForBucket = bucketInfo?.megas?.[0]
      if (megaForBucket) {
        memory[extractMerchantKey(txn.description)] = megaForBucket
        saveMerchantMemory(memory)
        setManualOverrides(prev => ({ ...prev, [txnId]: megaForBucket }))
      }
    }
    toast.success(`Moved to ${bucketInfo?.label || newBucketId}`)
  }

  const reassignSingle = (newMega: MegaCategory) => {
    if (!singleCategoryModal.transaction) return
    const t = singleCategoryModal.transaction
    const newBucketId = bucketIdFromMega(newMega, t.type)
    setManualOverrides(prev => ({ ...prev, [t.id]: newMega }))
    setBucketOverrides(prev => ({ ...prev, [t.id]: newBucketId }))
    const memory = loadMerchantMemory()
    memory[extractMerchantKey(t.description)] = newMega
    saveMerchantMemory(memory)
    setSingleCategoryModal({ open:false, transaction:null })
    toast.success(`Moved to ${MEGA_CATEGORIES[newMega].label} · remembered`)
  }

  // ── Analytics computations ──
  const analytics = useMemo(() => {
    if (!pnl) return null
    const emiTxns = taggedTxns.filter(t => t.type === 'debit' && ((t.description||'').toUpperCase().includes('EMI') || (t.description||'').toUpperCase().includes('LOAN') || (t.description||'').toUpperCase().includes('NACH')))
    const totalEMI = emiTxns.reduce((s,t) => s + t.amount, 0)
    const monthlyEMI = Math.round(totalEMI / bankMonths)
    const emiBurden = pnl.monthlyIncome > 0 ? Math.round((monthlyEMI / pnl.monthlyIncome) * 100) : 0
    const savingsRate = pnl.monthlyIncome > 0 ? Math.round((pnl.monthlyNet / pnl.monthlyIncome) * 100) : 0
    const sipTxns = taggedTxns.filter(t => t.type === 'debit' && (t.mega === 'investments_regular' || t.mega === 'investments_elss'))
    const monthlySIP = Math.round(sipTxns.reduce((s,t) => s + t.amount, 0) / bankMonths)
    const investmentRate = pnl.monthlyIncome > 0 ? Math.round((monthlySIP / pnl.monthlyIncome) * 100) : 0

    // Category spending by month for spikes
    const byMonth: Record<string, Record<string, number>> = {}
    taggedTxns.filter(t => t.type === 'debit').forEach(t => {
      const month = (t.date || '').substring(0, 7)
      const cat = t.mega || 'misc'
      if (!byMonth[month]) byMonth[month] = {}
      byMonth[month][cat] = (byMonth[month][cat] || 0) + t.amount
    })
    const monthKeys = Object.keys(byMonth).sort()
    const spikes: Array<{ category: string; label: string; pct: number; lastMonth: number; avg: number }> = []
    if (monthKeys.length >= 2) {
      const lastMonth = byMonth[monthKeys[monthKeys.length - 1]]
      const prevMonths = monthKeys.slice(0, -1)
      for (const cat of Object.keys(lastMonth)) {
        if (cat === 'misc' || cat === 'transfer' || cat === 'cc_payment') continue
        const prevAvg = prevMonths.reduce((s, m) => s + (byMonth[m]?.[cat] || 0), 0) / prevMonths.length
        if (prevAvg > 0 && lastMonth[cat] > prevAvg * 1.4 && lastMonth[cat] - prevAvg > 2000) {
          const info = MEGA_CATEGORIES[cat as MegaCategory]
          spikes.push({ category: cat, label: info?.label || cat, pct: Math.round(((lastMonth[cat] - prevAvg) / prevAvg) * 100), lastMonth: lastMonth[cat], avg: prevAvg })
        }
      }
    }

    return { monthlyEMI, emiBurden, savingsRate, monthlySIP, investmentRate, spikes }
  }, [pnl, taggedTxns, bankMonths])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:1000 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap'); .av-row:last-child{border-bottom:none!important}`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>My Profile</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Your complete financial picture</p>
      </div>

      {/* ── LAYOUT: content only (sidebar is in layout.tsx) ── */}
      <div>

          {/* ════════════ DOCUMENTS TAB ════════════ */}
          {mainTab==='docs' && (
            <div>
              {/* ── Salary slip + Bank statement uploaders side by side ── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                {/* Salary uploader (left) */}
                <div>
                  <p style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:6 }}>Salary slips</p>
                  <div style={{ ...S.upload(!!salaryTimeline), minHeight:108 }} onClick={() => !loadingDoc && salaryRef.current?.click()}>
                    {loadingDoc==='salary' ? <p style={{ fontSize:13, color:C.fg }}>Reading…</p> : salaryTimeline ? (
                      <>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', width:'100%', marginBottom:4 }}>
                          <div>
                            <p style={{ fontSize:13, fontWeight:600, color:C.fg, margin:0 }}>{salaryTimeline.fy}</p>
                            <p style={{ fontSize:11, color:C.muted, margin:0 }}>
                              {(() => { const a = computeAnnual(salaryTimeline); return a ? `${a.actualsCount} actual + ${a.projectedCount} projected` : '' })()}
                            </p>
                          </div>
                          <span style={{ fontSize:10, background:'#EEF2EE', color:C.fg, padding:'2px 7px', borderRadius:3, border:'1px solid #C8D8C8', fontWeight:500 }}>✓</span>
                        </div>
                        <p style={{ fontSize:11.5, color:C.text, margin:0, fontWeight:500 }}>{(() => { const a = computeAnnual(salaryTimeline); return a ? `${fmt(a.annualGross)} annual gross` : '' })()}</p>
                        <p onClick={e => { e.stopPropagation(); setMainTab('salary') }} style={{ fontSize:11, color:C.fg, margin:'4px 0 0', cursor:'pointer', textDecoration:'underline' }}>View timeline →</p>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize:22 }}>💼</span>
                        <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>Upload salary slip</p>
                        <p style={{ fontSize:10.5, color:C.muted, margin:0 }}>PDF, image, any format · any month of FY</p>
                      </>
                    )}
                  </div>
                  {salaryTimeline && (
                    <>
                      <p onClick={() => salaryRef.current?.click()} style={{ fontSize:12, color:C.fg, margin:'8px 0 0', cursor:'pointer' }}>+ Upload another month's slip</p>
                      <button onClick={() => setMainTab('salary')} style={{ marginTop:10, width:'100%', padding:'9px 14px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>View salary timeline →</button>
                    </>
                  )}
                </div>

                {/* Bank uploader (right) */}
                <div>
                  <p style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:6 }}>Bank statements</p>
                  <div style={{ ...S.upload(false), minHeight:108 }} onClick={() => { setUploadingAccountId(null); bankRef.current?.click() }}>
                    {loadingDoc==='bank' ? <p style={{ fontSize:13, color:C.fg }}>Reading…</p> : (
                      <>
                        <span style={{ fontSize:22 }}>🏦</span>
                        <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>
                          {bankAccounts.length > 0 ? '+ Add another account' : 'Upload bank statement'}
                        </p>
                        <p style={{ fontSize:10.5, color:C.muted, margin:0, textAlign:'center' as const }}>Any Indian bank · PDF, Excel, CSV or photo</p>
                      </>
                    )}
                  </div>
                  <input ref={bankRef} type="file" accept=".pdf,.xls,.xlsx,.csv,image/*" style={{ display:'none' }} onChange={e => { if(e.target.files?.[0]) { handleBankFile(e.target.files[0]) }; e.target.value='' }} />
                  {bankAccounts.length > 0 && (
                    <>
                      <p onClick={() => { setUploadingAccountId(null); bankRef.current?.click() }} style={{ fontSize:12, color:C.fg, margin:'8px 0 0', cursor:'pointer' }}>+ Add more accounts <span style={{ fontSize:11, color:C.muted }}>(spouse, joint, etc.)</span></p>
                      <button onClick={() => setMainTab('review')} style={{ marginTop:10, width:'100%', padding:'9px 14px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Proceed to Review →</button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Bank accounts list (kept as-is below the uploaders) ── */}
              {bankAccounts.length > 0 && (
                <>
                  <p style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:6 }}>Your bank accounts</p>
                  {bankAccounts.map((acc, idx) => (
                    <div key={acc.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
                      <div style={{ width:40, height:40, borderRadius:8, background:C.wl, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🏦</div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 2px' }}>{acc.bank}{acc.last4 ? ` ···${acc.last4}` : ''}</p>
                        <p style={{ fontSize:11, color:C.muted, margin:0 }}>{acc.txnCount} transactions · {acc.period.months} month{acc.period.months>1?'s':''}</p>
                        <input type="text" placeholder="Label (e.g. Salary account)" value={acc.label} onChange={e => updateAccountLabel(acc.id, e.target.value)} style={{ fontSize:11, border:'none', outline:'none', color:C.fg, padding:0, marginTop:4, width:'100%', fontFamily:'inherit', background:'transparent' }} />
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button onClick={() => { setUploadingAccountId(acc.id); bankRef.current?.click() }} style={{ fontSize:11, color:C.fg, background:C.wl, border:`1px solid ${C.wm}`, borderRadius:4, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit' }}>Re-upload</button>
                        <button onClick={() => removeAccount(acc.id)} style={{ fontSize:11, color:C.danger, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              <div style={{ marginBottom:12 }}></div>
              <p style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8 }}>Credit cards</p>
              <div style={S.card}>
                <div style={S.cardHead}>Your credit cards</div>
                {creditCards.length === 0 ? (
                  <div style={{ ...S.row, fontSize:12, color:C.muted, fontStyle:'italic' as const }}>
                    <span>No cards added · adding one helps identify which UPI debits are credit card bill payments</span>
                  </div>
                ) : creditCards.map(card => (
                  <div key={card.id} style={{ ...S.row, gap:8 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:18 }}>💳</span>
                      <span><strong>{card.bank}</strong> · ending <strong style={{ fontFamily:'monospace', color:C.fg }}>{card.last4}</strong></span>
                    </span>
                    <button onClick={() => removeCreditCard(card.id)} style={{ fontSize:11, color:C.danger, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>Remove</button>
                  </div>
                ))}
                <div style={{ padding:'10px 14px', background:'#FAFAF8', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' as const }}>
                  <select value={newCardBank} onChange={e=>setNewCardBank(e.target.value)} style={{ padding:'6px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:12, fontFamily:'inherit', flex:1, minWidth:140 }}>
                    <option value="">Pick bank...</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <input type="text" inputMode="numeric" maxLength={4} placeholder="Last 4 digits" value={newCardLast4} onChange={e => setNewCardLast4(e.target.value.replace(/[^0-9]/g,''))} style={{ padding:'6px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:12, fontFamily:'monospace', width:110, outline:'none' }} />
                  <button onClick={addCreditCard} disabled={!newCardBank || newCardLast4.length !== 4} style={{ padding:'6px 14px', background:newCardBank&&newCardLast4.length===4 ? C.fg : '#ccc', color:C.wheat, border:'none', borderRadius:4, fontSize:11.5, fontWeight:600, cursor:newCardBank&&newCardLast4.length===4?'pointer':'not-allowed', fontFamily:'inherit' }}>+ Add card</button>
                </div>
              </div>

              <p style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8, marginTop:6 }}>Tax documents (optional)</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div style={S.upload(!!aisData)} onClick={() => !aisData&&!loadingDoc&&aisRef.current?.click()}>
                  {aisData ? (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', width:'100%', marginBottom:6 }}>
                        <div><p style={{ fontSize:13, fontWeight:600, color:C.fg, margin:0 }}>AIS</p><p style={{ fontSize:11, color:C.muted, margin:0 }}>Annual Information Statement</p></div>
                        <span style={{ fontSize:10, background:'#EEF2EE', color:C.fg, padding:'2px 7px', borderRadius:3, border:'1px solid #C8D8C8', fontWeight:500 }}>✓</span>
                      </div>
                      <button onClick={e=>{e.stopPropagation();setAisData(null)}} style={{ fontSize:11, color:C.danger, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0, textDecoration:'underline' }}>Remove</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize:24 }}>📑</span>
                      <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>AIS</p>
                      <p style={{ fontSize:10.5, color:C.muted, margin:0, lineHeight:1.5 }}>incometax.gov.in · password protected</p>
                    </>
                  )}
                  <input ref={aisRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleAISFile(e.target.files[0],'ais')} />
                </div>
                <div style={S.upload(false)} onClick={() => !loadingDoc&&taxRef.current?.click()}>
                  <span style={{ fontSize:24 }}>📋</span>
                  <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>Form 26AS</p>
                  <p style={{ fontSize:10.5, color:C.muted, margin:0, lineHeight:1.5 }}>Tax credit statement · no password</p>
                  <input ref={taxRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleAISFile(e.target.files[0],'26as')} />
                </div>
              </div>

              <p style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8, marginTop:6 }}>Demat holdings</p>
              <DematHoldings
                existingHoldings={casData ? { investor: casData.investor?.name || '', pan: casData.investor?.pan || '', total_value: casData.summary?.totalValue || 0, fetched_at: casData.fetchedAt || new Date().toISOString() } : null}
                onSuccess={(holdings) => { setCasData(holdings); try { localStorage.setItem('av_cas_holdings', JSON.stringify(holdings)) } catch {} }}
              />
            </div>
          )}

          {/* ════════════ SALARY TAB — timeline, employments, components ════════════ */}
          {mainTab==='salary' && (
            <div>
              {!salaryTimeline ? (
                <div style={S.insight}>Upload a salary slip in Documents first to see your annual salary timeline.</div>
              ) : (() => {
                const annual = computeAnnual(salaryTimeline)!
                const months = fyMonths(salaryTimeline.fyStartYear)
                const allComps = (() => {
                  const latestEmp = salaryTimeline.employments[salaryTimeline.employments.length - 1]
                  const latestSlip = latestEmp?.slips.sort((a,b) => b.monthKey.localeCompare(a.monthKey))[0]
                  return latestSlip?.components || []
                })()
                const recurringEarnings = allComps.filter(c => c.type === 'earning' && c.flag === 'recurring')
                const recurringDeductions = allComps.filter(c => c.type === 'deduction' && c.flag === 'recurring')
                const oneTimeEarnings = (() => {
                  const out: Array<{ label: string; amount: number; monthKey: string }> = []
                  salaryTimeline.employments.forEach(e => e.slips.forEach(s => {
                    s.components.filter(c => c.type === 'earning' && c.flag === 'one_time').forEach(c => out.push({ label: c.label, amount: c.amount, monthKey: s.monthKey }))
                  }))
                  return out
                })()
                return (
                  <>
                    {/* Annual income card */}
                    <div style={{ ...S.card, padding:0 }}>
                      <div style={{ ...S.cardHead, justifyContent:'space-between' }}>
                        <span>{salaryTimeline.fy} · Salary</span>
                        <span style={{ fontSize:9, color:C.muted, fontWeight:500, textTransform:'none' as const, letterSpacing:0 }}>{annual.actualsCount} actual + {annual.projectedCount} projected</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ padding:'14px 16px', borderRight:`1px solid ${C.border}` }}>
                          <p style={{ fontSize:10, color:C.muted, margin:'0 0 4px', textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>Annual gross</p>
                          <p style={{ fontSize:20, fontWeight:700, color:C.text, margin:0 }}>{fmt(annual.annualGross)}</p>
                          <p style={{ fontSize:11, color:C.muted, margin:'2px 0 0' }}>{fmt(annual.monthlyAvgGross)}/mo avg</p>
                        </div>
                        <div style={{ padding:'14px 16px' }}>
                          <p style={{ fontSize:10, color:C.muted, margin:'0 0 4px', textTransform:'uppercase' as const, letterSpacing:'0.05em' }}>Annual net (take-home)</p>
                          <p style={{ fontSize:20, fontWeight:700, color:'#2A7A4A', margin:0 }}>{fmt(annual.annualNet)}</p>
                          <p style={{ fontSize:11, color:C.muted, margin:'2px 0 0' }}>{fmt(annual.monthlyAvgNet)}/mo avg</p>
                        </div>
                      </div>
                      <div style={{ padding:'10px 16px', fontSize:11, color:C.muted, background:'#FAFAF8' }}>
                        Annual figure feeds Tax Optimiser. Click any projected month below to override its values.
                      </div>
                    </div>

                    {/* ── Empty-months notice (four-option) ── */}
                    {!emptyMonthsDismissed && (() => {
                      const months = fyMonths(salaryTimeline.fyStartYear)
                      const empty = months.filter(mk => {
                        const r = rollupMonth(salaryTimeline, mk)
                        return r.earnings === 0
                      })
                      if (empty.length === 0) return null
                      const rangeLabel = empty.length === 1
                        ? monthLabel(empty[0])
                        : `${monthLabel(empty[0])} – ${monthLabel(empty[empty.length - 1])}`
                      // Find earliest employment (chronologically) — that's what "Same" extends backward
                      const earliestEmp = salaryTimeline.employments.slice().sort((a, b) => a.fromMonth.localeCompare(b.fromMonth))[0]
                      const earliestEmpStart = earliestEmp?.fromMonth || ''
                      // What's the latest empty month BEFORE the earliest employment starts?
                      // That's the natural cap for "Same — extend backward"
                      const emptyBeforeEarliest = empty.filter(mk => mk < earliestEmpStart)
                      const canExtendBackward = emptyBeforeEarliest.length > 0 && earliestEmp
                      const sameLabel = canExtendBackward && earliestEmp
                        ? `Same as ${earliestEmp.employerName.length > 18 ? earliestEmp.employerName.slice(0, 18) + '…' : earliestEmp.employerName}`
                        : 'Same as existing'
                      return (
                        <div style={{ ...S.card, border:`1px solid #E6CFA7`, background:'#FFF8E8' }}>
                          <div style={{ padding:'12px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
                            <span style={{ fontSize:14, lineHeight:1 }}>ℹ</span>
                            <div style={{ flex:1 }}>
                              <p style={{ fontSize:12, fontWeight:600, color:C.text, margin:'0 0 4px' }}>{empty.length} month{empty.length !== 1 ? 's' : ''} have no salary data ({rangeLabel})</p>
                              <p style={{ fontSize:11.5, color:C.muted, margin:'0 0 10px', lineHeight:1.55 }}>
                                These months are currently treated as <strong>₹0 income</strong>. What were you doing during this period?
                              </p>
                              <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
                                {canExtendBackward && (
                                  <button
                                    onClick={() => {
                                      const defaultTo = emptyBeforeEarliest[emptyBeforeEarliest.length - 1]
                                      const defaultFrom = emptyBeforeEarliest[0]
                                      setExtendRangeModal({ open: true, fromMonth: defaultFrom, toMonth: defaultTo, gapMin: defaultFrom, gapMax: defaultTo })
                                    }}
                                    style={{ padding:'7px 12px', background:C.fg, color:C.wheat, border:'none', borderRadius:4, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                                    {sameLabel}
                                  </button>
                                )}
                                <button onClick={() => salaryRef.current?.click()} style={{ padding:'7px 12px', background:'#fff', color:C.fg, border:`1px solid ${C.border}`, borderRadius:4, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Different — upload slip</button>
                                <button onClick={() => setOtherIncomeModal({ open: true })} style={{ padding:'7px 12px', background:'#fff', color:C.fg, border:`1px solid ${C.border}`, borderRadius:4, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Other (freelance / business)</button>
                                <button onClick={() => {
                                  // NIL: write empty-component overrides for every empty month, then dismiss notice
                                  setSalaryTimeline(prev => {
                                    if (!prev) return prev
                                    const newOverrides = empty.map(mk => ({ monthKey: mk, components: [] as { label: string; amount: number; type: 'earning' | 'deduction' }[] }))
                                    const filtered = prev.overrides.filter(o => !empty.includes(o.monthKey))
                                    return { ...prev, overrides: [...filtered, ...newOverrides] }
                                  })
                                  setEmptyMonthsDismissed(true)
                                  try { localStorage.setItem('av_empty_months_dismissed', '1') } catch {}
                                  toast.success(`${empty.length} month${empty.length !== 1 ? 's' : ''} marked as ₹0`)
                                }} style={{ padding:'7px 12px', background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:4, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>NIL — no income</button>
                              </div>
                              <p style={{ fontSize:10.5, color:C.muted, margin:'10px 0 0', fontStyle:'italic' as const, lineHeight:1.5 }}>
                                Tip: After answering, if any gap remains, this notice will update with the remaining months.
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* ── Multi-employer TDS shortfall banner (Build 2c) ── */}
                    {(() => {
                      const mte = computeMultiEmployerTDS(salaryTimeline, annual)
                      if (!mte) return null
                      const empNames = mte.employmentsList.map(e => e.name).join(' and ')
                      const empRanges = mte.employmentsList.map(e => `${e.name} (${monthLabel(e.from)}${e.to ? `–${monthLabel(e.to)}` : ' onwards'})`).join(', ')
                      const isSurplusOld = mte.shortfallOld < 0
                      const isSurplusNew = mte.shortfallNew < 0
                      return (
                        <div style={{ ...S.card, border:`1.5px solid #D85A30`, background:'#FFF8F4' }}>
                          <div style={{ padding:'10px 16px', background:'#FBEFEF', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:14 }}>⚠</span>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'#A04020', letterSpacing:'0.04em', textTransform:'uppercase' as const }}>Multi-employer FY · TDS may be short</span>
                          </div>
                          <div style={{ padding:'14px 16px' }}>
                            <p style={{ fontSize:12, color:C.text, margin:'0 0 12px', lineHeight:1.55 }}>
                              You worked at <strong>{empRanges}</strong>. Each employer deducts TDS based only on the income <em>they</em> pay you — not your total. Combined gross can push you into a higher tax slab, leaving TDS short.
                            </p>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11.5, marginBottom:10 }}>
                              <div style={{ padding:'8px 10px', background:'#FAFAF8', borderRadius:4 }}>
                                <p style={{ fontSize:10, color:C.muted, margin:0, textTransform:'uppercase' as const, letterSpacing:'0.04em' }}>Combined annual gross</p>
                                <p style={{ fontWeight:700, color:C.text, margin:'2px 0 0' }}>{fmt(mte.combinedAnnualGross)}</p>
                              </div>
                              <div style={{ padding:'8px 10px', background:'#FAFAF8', borderRadius:4 }}>
                                <p style={{ fontSize:10, color:C.muted, margin:0, textTransform:'uppercase' as const, letterSpacing:'0.04em' }}>TDS deducted to date</p>
                                <p style={{ fontWeight:700, color:C.text, margin:'2px 0 0' }}>{fmt(mte.totalTdsDeducted)}</p>
                              </div>
                            </div>
                            <button onClick={() => setBreakdownExpanded(v => !v)} style={{ width:'100%', padding:'8px 10px', background:'transparent', border:`1px dashed ${C.border}`, borderRadius:4, fontSize:11, color:C.fg, cursor:'pointer', fontFamily:'inherit', marginBottom:10, textAlign:'left' as const, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span>{breakdownExpanded ? '▼' : '▶'} How is {fmt(mte.combinedAnnualGross)} calculated?</span>
                              <span style={{ fontSize:10, color:C.muted }}>{breakdownExpanded ? 'hide' : 'audit the math'}</span>
                            </button>
                            {breakdownExpanded && (
                              <div style={{ background:'#FAFAF8', border:`1px solid ${C.border}`, borderRadius:5, padding:'10px 12px', marginBottom:10, fontSize:11 }}>
                                {mte.breakdown.map((b, idx) => (
                                  <div key={idx} style={{ marginBottom: idx === mte.breakdown.length - 1 ? 0 : 10, paddingBottom: idx === mte.breakdown.length - 1 ? 0 : 8, borderBottom: idx === mte.breakdown.length - 1 ? 'none' : `1px solid ${C.border}` }}>
                                    <p style={{ fontSize:11.5, fontWeight:600, color:C.text, margin:'0 0 4px' }}>{b.name} <span style={{ fontSize:10, color:C.muted, fontWeight:400 }}>· {monthLabel(b.from)} {b.to ? `– ${monthLabel(b.to)}` : 'onwards'} · {b.slipCount} slip{b.slipCount !== 1 ? 's' : ''}</span></p>
                                    <table style={{ width:'100%', fontSize:10.5, borderCollapse:'collapse' as const }}>
                                      <tbody>
                                        {b.months.map(m => (
                                          <tr key={m.monthKey}>
                                            <td style={{ padding:'2px 0', color:C.muted, width:60 }}>{monthLabel(m.monthKey)}</td>
                                            <td style={{ padding:'2px 0', textAlign:'right' as const, fontVariantNumeric:'tabular-nums' as const, color:C.text }}>{fmt(m.earnings)}</td>
                                            <td style={{ padding:'2px 0 2px 10px', color:C.muted, fontStyle:m.kind === 'projected' ? 'italic' as const : 'normal' as const }}>{m.kind === 'actual' ? 'actual' : m.kind === 'override' ? 'edited' : 'projected from recurring components'}</td>
                                          </tr>
                                        ))}
                                        <tr><td colSpan={3} style={{ borderTop:`1px dashed ${C.border}`, padding:'4px 0 0', textAlign:'right' as const, fontWeight:700, color:C.text, fontVariantNumeric:'tabular-nums' as const }}>Subtotal &nbsp;&nbsp; {fmt(b.subtotal)}</td></tr>
                                      </tbody>
                                    </table>
                                  </div>
                                ))}
                                {mte.emptyMonths.length > 0 && (
                                  <div style={{ marginTop:8, padding:'8px 10px', background:'#FFF3DD', border:`1px solid #E6CFA7`, borderRadius:4 }}>
                                    <p style={{ fontSize:11, color:'#7A5A20', margin:0, lineHeight:1.5 }}>
                                      <strong>⚠ {mte.emptyMonths.length} month{mte.emptyMonths.length !== 1 ? 's' : ''} have no income</strong> ({monthLabel(mte.emptyMonths[0])}{mte.emptyMonths.length > 1 ? ` – ${monthLabel(mte.emptyMonths[mte.emptyMonths.length - 1])}` : ''}). System assumed ₹0. If you were employed during this period, upload those slips for an accurate total.
                                    </p>
                                  </div>
                                )}
                                <div style={{ marginTop:10, paddingTop:8, borderTop:`2px solid ${C.fg}`, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                                  <span style={{ fontWeight:700, color:C.text }}>Combined annual gross</span>
                                  <span style={{ fontWeight:700, color:C.text, fontVariantNumeric:'tabular-nums' as const }}>{fmt(mte.combinedAnnualGross)}</span>
                                </div>
                              </div>
                            )}
                            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', gap:0, border:`1px solid ${C.border}`, borderRadius:5, overflow:'hidden', fontSize:11.5, marginBottom:10 }}>
                              <div style={{ padding:'8px 10px', background:'#FAFAF8', fontWeight:600, color:C.muted, fontSize:10, letterSpacing:'0.04em', textTransform:'uppercase' as const }}>&nbsp;</div>
                              <div style={{ padding:'8px 10px', background:'#FAFAF8', textAlign:'center' as const, fontWeight:700, color:C.fg, fontSize:10.5, letterSpacing:'0.04em', textTransform:'uppercase' as const, borderLeft:`1px solid ${C.border}` }}>Old Regime</div>
                              <div style={{ padding:'8px 10px', background:'#FAFAF8', textAlign:'center' as const, fontWeight:700, color:C.fg, fontSize:10.5, letterSpacing:'0.04em', textTransform:'uppercase' as const, borderLeft:`1px solid ${C.border}` }}>New Regime</div>
                              <div style={{ padding:'8px 10px', borderTop:`1px solid ${C.border}`, color:C.text }}>Expected tax</div>
                              <div style={{ padding:'8px 10px', borderTop:`1px solid ${C.border}`, borderLeft:`1px solid ${C.border}`, textAlign:'right' as const, fontWeight:600, color:C.text }}>{fmt(mte.expectedTaxOld)}</div>
                              <div style={{ padding:'8px 10px', borderTop:`1px solid ${C.border}`, borderLeft:`1px solid ${C.border}`, textAlign:'right' as const, fontWeight:600, color:C.text }}>{fmt(mte.expectedTaxNew)}</div>
                              <div style={{ padding:'8px 10px', borderTop:`1px solid ${C.border}`, fontWeight:600, color:C.text, background:isSurplusOld || isSurplusNew ? '#EEF2EE' : '#FBEFEF' }}>{isSurplusOld && isSurplusNew ? 'TDS surplus' : 'Shortfall'}</div>
                              <div style={{ padding:'8px 10px', borderTop:`1px solid ${C.border}`, borderLeft:`1px solid ${C.border}`, textAlign:'right' as const, fontWeight:700, color: isSurplusOld ? '#2A7A4A' : '#D85A30', background:isSurplusOld ? '#EEF2EE' : '#FBEFEF' }}>{isSurplusOld ? `+${fmt(Math.abs(mte.shortfallOld))}` : fmt(mte.shortfallOld)}</div>
                              <div style={{ padding:'8px 10px', borderTop:`1px solid ${C.border}`, borderLeft:`1px solid ${C.border}`, textAlign:'right' as const, fontWeight:700, color: isSurplusNew ? '#2A7A4A' : '#D85A30', background:isSurplusNew ? '#EEF2EE' : '#FBEFEF' }}>{isSurplusNew ? `+${fmt(Math.abs(mte.shortfallNew))}` : fmt(mte.shortfallNew)}</div>
                            </div>
                            <p style={{ fontSize:10.5, color:C.muted, margin:'0 0 8px', lineHeight:1.5 }}>
                              <strong style={{ color:C.text }}>Note:</strong> Expected tax assumes only what's on your slips (EPF + HRA exemption based on slip's basic/HRA, rent assumed ₹0). Once you finish in Tax Optimiser with rent, 80D, and other deductions, the real shortfall will be lower.
                            </p>
                            <p style={{ fontSize:10.5, color:C.muted, margin:0, lineHeight:1.5 }}>
                              {isSurplusOld && isSurplusNew
                                ? 'TDS appears over-deducted across employers — you may receive a refund after filing.'
                                : 'To avoid Section 234B/234C interest: pay advance tax in installments (15 Jun · 15 Sep · 15 Dec · 15 Mar) or top up via self-assessment in March.'}
                            </p>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Timeline */}
                    <div style={S.card}>
                      <div style={S.cardHead}>Timeline · click a month to upload or edit</div>
                      <div style={{ padding:'12px 14px' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:4 }}>
                          {months.map(mk => {
                            const r = rollupMonth(salaryTimeline, mk)
                            const status = r.isActual ? 'actual' : r.isOverride ? 'override' : 'projected'
                            const bg = status === 'actual' ? '#3A4B41' : status === 'override' ? '#C9A84C' : '#E4DDD1'
                            const fg = status === 'actual' ? '#fff' : status === 'override' ? '#fff' : '#7A8A7E'
                            return (
                              <button key={mk} onClick={() => {
                                if (r.isActual) {
                                  // Actual slip — open editor to view/edit components
                                  setSalaryMonthEditor({ open: true, monthKey: mk })
                                } else {
                                  // Projected — open override editor
                                  setSalaryMonthEditor({ open: true, monthKey: mk })
                                }
                              }} style={{ background:bg, color:fg, border:'none', borderRadius:4, padding:'10px 4px', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                                <div style={{ fontSize:9.5, opacity:0.85 }}>{monthLabel(mk).split(' ')[0]}</div>
                                <div style={{ fontSize:11, marginTop:2 }}>{status === 'actual' ? '●' : status === 'override' ? '✎' : '○'}</div>
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display:'flex', gap:14, marginTop:10, fontSize:10.5, color:C.muted }}>
                          <span><span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'#3A4B41', marginRight:4 }} /> Slip uploaded</span>
                          <span><span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'#C9A84C', marginRight:4 }} /> Edited projection</span>
                          <span><span style={{ display:'inline-block', width:8, height:8, borderRadius:2, background:'#E4DDD1', marginRight:4 }} /> Auto-projected</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                          <button onClick={() => salaryRef.current?.click()} disabled={loadingDoc==='salary'} style={{ padding:'8px 14px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12, fontWeight:600, cursor: loadingDoc==='salary' ? 'wait' : 'pointer', fontFamily:'inherit', opacity: loadingDoc==='salary' ? 0.6 : 1 }}>
                            {loadingDoc==='salary' ? 'Reading…' : '+ Upload a salary slip'}
                          </button>
                          <span style={{ fontSize:11, color:C.muted }}>{annual.actualsCount} actual · {annual.projectedCount} projected</span>
                        </div>
                      </div>
                    </div>

                    {/* Employments */}
                    <div style={S.card}>
                      <div style={S.cardHead}>Employment{salaryTimeline.employments.length > 1 ? 's' : ''}</div>
                      {salaryTimeline.employments.map(emp => {
                        const empSlips = emp.slips.length
                        const fromLabel = monthLabel(emp.fromMonth)
                        const toLabel = emp.toMonth ? monthLabel(emp.toMonth) : 'present'
                        const empAvg = emp.slips.reduce((s, sl) => s + sl.components.filter(c => c.type === 'earning').reduce((x, c) => x + c.amount, 0), 0) / Math.max(1, empSlips)
                        return (
                          <div key={emp.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                            <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 2px' }}>{emp.employerName}</p>
                            <p style={{ fontSize:11, color:C.muted, margin:0 }}>{fromLabel} – {toLabel} · {empSlips} slip{empSlips !== 1 ? 's' : ''} uploaded · {fmt(Math.round(empAvg))}/mo avg gross</p>
                            <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' as const }}>
                              {emp.slips.sort((a,b) => a.monthKey.localeCompare(b.monthKey)).map(s => (
                                <span key={s.id} style={{ fontSize:10.5, background:C.wl, border:`1px solid ${C.wm}`, padding:'3px 8px', borderRadius:3, color:C.fg, display:'inline-flex', alignItems:'center', gap:6 }}>
                                  {monthLabel(s.monthKey)}
                                  <button onClick={() => removeSlip(s.id)} title="Remove slip" style={{ fontSize:10, color:C.danger, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>×</button>
                                </span>
                              ))}
                              <button onClick={() => setSalaryFlagsModal({ open: true, slipId: null, employmentId: emp.id })} style={{ fontSize:10.5, padding:'3px 8px', borderRadius:3, border:`1px solid ${C.border}`, background:C.card, color:C.fg, cursor:'pointer', fontFamily:'inherit' }}>Edit components</button>
                              {emp.toMonth !== null && (
                                <a href={`/dashboard/profile/form-12b?empId=${emp.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:10.5, padding:'3px 8px', borderRadius:3, border:`1px solid ${C.fg}`, background:C.fg, color:C.wheat, cursor:'pointer', fontFamily:'inherit', textDecoration:'none', fontWeight:600 }}>📄 Generate Form 12B →</a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Components — collapsed summary by default */}
                    <div style={S.card}>
                      <div style={{ ...S.cardHead, cursor:'pointer', justifyContent:'space-between' }} onClick={() => setSalaryComponentsExpanded(v => !v)}>
                        <span>Components · {recurringEarnings.length + recurringDeductions.length} recurring, {oneTimeEarnings.length} one-time</span>
                        <span style={{ fontSize:10, color:C.muted, transition:'transform 0.2s', transform: salaryComponentsExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </div>
                      {salaryComponentsExpanded && (
                        <div>
                          <div style={{ padding:'8px 16px 4px', background:'#FAFAF8', fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>Recurring · projected forward</div>
                          {recurringEarnings.length === 0 && recurringDeductions.length === 0 && (
                            <div style={{ padding:'10px 16px', fontSize:12, color:C.muted, fontStyle:'italic' as const }}>No recurring components detected</div>
                          )}
                          {recurringEarnings.map(c => (
                            <div key={`re-${c.label}`} style={{ ...S.row, padding:'7px 16px' }}>
                              <span>{c.label}</span>
                              <span style={{ fontWeight:500 }}>{fmt(c.amount)}/mo</span>
                            </div>
                          ))}
                          {recurringDeductions.map(c => (
                            <div key={`rd-${c.label}`} style={{ ...S.row, padding:'7px 16px', color:C.danger }}>
                              <span>− {c.label}</span>
                              <span style={{ fontWeight:500 }}>{fmt(c.amount)}/mo</span>
                            </div>
                          ))}
                          <div style={{ padding:'8px 16px 4px', background:'#FAFAF8', fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.05em', textTransform:'uppercase' as const, borderTop:`1px solid ${C.border}` }}>One-time · counted only when received</div>
                          {oneTimeEarnings.length === 0 ? (
                            <div style={{ padding:'10px 16px', fontSize:12, color:C.muted, fontStyle:'italic' as const }}>No one-time components</div>
                          ) : oneTimeEarnings.map((c, i) => (
                            <div key={`ot-${i}`} style={{ ...S.row, padding:'7px 16px' }}>
                              <span>{c.label} <span style={{ fontSize:10, color:C.muted }}>· {monthLabel(c.monthKey)}</span></span>
                              <span style={{ fontWeight:500 }}>{fmt(c.amount)}</span>
                            </div>
                          ))}
                          <div style={{ padding:'10px 16px', fontSize:11, color:C.muted, background:'#FAFAF8' }}>
                            To change a component's classification, open <strong>Edit components</strong> on an employment.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Annual breakdown */}
                    <div style={S.card}>
                      <div style={S.cardHead}>Annual breakdown</div>
                      <div style={S.row}><span>Total earnings</span><span style={{ fontWeight:600 }}>{fmt(annual.annualGross)}</span></div>
                      <div style={S.row}><span>Total deductions</span><span style={{ fontWeight:600, color:C.danger }}>−{fmt(annual.annualDeductions)}</span></div>
                      <div style={{ ...S.row, background:C.wl, fontWeight:700 }}><span>Net annual</span><span style={{ color:'#2A7A4A' }}>{fmt(annual.annualNet)}</span></div>
                    </div>

                    {/* ── CTA: continue to Tax Optimiser ── */}
                    <div style={{ ...S.card, border:`1.5px solid ${C.wm}` }}>
                      <div style={{ ...S.cardHead, background:C.wl, color:C.fg }}>Next step · see your tax picture</div>
                      <div style={{ padding:'14px 16px' }}>
                        <p style={{ fontSize:12, color:C.muted, margin:'0 0 12px', lineHeight:1.55 }}>
                          We've sent your salary data — annual gross <strong style={{ color:C.text }}>{fmt(annual.annualGross)}</strong>, HRA, EPF, and basic — to Tax Optimiser. Continue there to add rent, health insurance, and any other deductions to estimate your actual tax.
                        </p>
                        <button onClick={syncToTaxOptimiser} style={{ padding:'9px 18px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Continue to Tax Optimiser →</button>
                        {taxCta.submittedAt && (
                          <p style={{ fontSize:11, color:C.muted, margin:'10px 0 0' }}>
                            ✓ Synced · last sent {new Date(taxCta.submittedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
                      <button onClick={resetSalaryTimeline} style={{ padding:'7px 14px', background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:11.5, cursor:'pointer', fontFamily:'inherit' }}>Reset timeline</button>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* ════════════ REVIEW TAB — drag & drop cards ════════════ */}
          {mainTab==='review' && (
            <div>
              {taggedTxns.length === 0 ? (
                <div style={S.insight}>Upload a bank statement in Documents first.</div>
              ) : (
                <>
                  {/* ── QUESTIONS: needs your input ── */}
                  {questions.length > 0 && (
                    <div style={{ marginBottom:20 }}>
                      <div style={{ background:'#1E293B', borderRadius:8, padding:'12px 16px', marginBottom:12 }}>
                        <p style={{ fontSize:10, color:'rgba(230,207,167,0.5)', letterSpacing:'0.08em', margin:'0 0 4px' }}>NEEDS YOUR INPUT</p>
                        <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', margin:0, lineHeight:1.6 }}>
                          {questions.length} transaction{questions.length > 1 ? 's' : ''} we're not sure about. Pick once — we'll remember forever.
                        </p>
                      </div>
                      {questions.map(q => (
                        <div key={q.id} style={{ ...S.card, border:`1px solid ${C.wm}` }}>
                          <div style={{ padding:'12px 14px', background:C.wl, borderBottom:`1px solid ${C.wm}` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                              <div style={{ flex:1 }}>
                                <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 4px' }}>{q.question}</p>
                                <p style={{ fontSize:11, color:C.muted, margin:0 }}>
                                  {q.description.substring(0, 50)}{q.description.length > 50 ? '…' : ''} · {q.date}
                                  {q.occurrences > 1 && <span style={{ marginLeft:6, fontWeight:500 }}>× {q.occurrences} times</span>}
                                </p>
                              </div>
                              <span style={{ fontSize:14, fontWeight:700, color: q.amount > 0 ? (q.txnIds.length > 0 && taggedTxns.find(t => t.id === q.txnIds[0])?.type === 'credit' ? '#1D9E75' : '#D85A30') : C.text, flexShrink:0 }}>
                                {fmt(q.monthlyAmount)}{q.occurrences > 1 ? '/mo' : ''}
                              </span>
                            </div>
                          </div>
                          <div style={{ padding:'10px 14px', display:'flex', flexWrap:'wrap' as const, gap:6 }}>
                            {q.options.map(opt => (
                              <button key={opt.bucketId} onClick={() => answerQuestion(q, opt.bucketId)} style={{
                                padding:'7px 14px', fontSize:11.5, fontWeight:500,
                                background:C.card, border:`1px solid ${C.border}`, borderRadius:5,
                                cursor:'pointer', fontFamily:'inherit', color:C.text,
                                transition:'all 0.15s',
                              }}
                              onMouseEnter={e => { (e.target as HTMLElement).style.background = C.wl; (e.target as HTMLElement).style.borderColor = C.wm }}
                              onMouseLeave={e => { (e.target as HTMLElement).style.background = C.card; (e.target as HTMLElement).style.borderColor = C.border }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── CLASSIFIED BUCKETS ── */}
                  {questions.length === 0 && (
                    <div style={{ ...S.insight, marginBottom:16, background:'#EEF2EE', borderColor:'#C8D8C8' }}>
                      All transactions classified. Drag between buckets or click ✎ to reassign. Changes are remembered forever.
                    </div>
                  )}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                    {(['income','expenses','savings'] as const).map(colKey => (
                      <div key={colKey}>
                        <p style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:8 }}>
                          {colKey === 'savings' ? 'Savings & investments' : colKey}
                        </p>
                        {REVIEW_BUCKETS[colKey].map(bucket => {
                          const items = txnBuckets[bucket.id] || []
                          const total = items.reduce((s: number, t: any) => s + t.amount, 0)
                          const isOpen = openBuckets.has(bucket.id)
                          return (
                            <div key={bucket.id} style={{ ...S.bucket, borderColor: dragTxnId ? '#7A8A7E' : C.border }}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.preventDefault(); if (dragTxnId) { moveToBucket(dragTxnId, bucket.id); setDragTxnId(null) } }}
                            >
                              <div style={S.bucketHead} onClick={() => { const s = new Set(openBuckets); s.has(bucket.id) ? s.delete(bucket.id) : s.add(bucket.id); setOpenBuckets(s) }}>
                                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <span style={{ fontSize:14 }}>{bucket.icon}</span>
                                  <span style={{ fontWeight:500, color:C.text }}>{bucket.label}</span>
                                  <span style={{ fontSize:10, color:C.muted }}>{items.length}</span>
                                </span>
                                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:12, fontWeight:500, color:C.muted }}>{fmt(total)}</span>
                                  <span style={{ fontSize:10, color:C.muted, transition:'transform 0.2s', transform:isOpen?'rotate(180deg)':'none' }}>▼</span>
                                </span>
                              </div>
                              {isOpen && bucket.id === 'transfers' ? (
                                <div style={{ borderTop:`0.5px solid ${C.border}` }}>
                                  {(() => {
                                    if (items.length === 0) {
                                      return <div style={{ padding:'16px 12px', textAlign:'center' as const, fontSize:11, color:C.muted }}>No person transfers</div>
                                    }
                                    // Group by person name (use intelligence .who when available, else fall back to t.personName / brand / description leading word)
                                    const groups: Record<string, any[]> = {}
                                    items.forEach((t: any) => {
                                      const intel = intelligence?.transactions.find(c => `${(c.raw||'').trim()}|${c.amount}|${c.date}` === `${(t.description||'').trim()}|${t.amount}|${t.date}`)
                                      const name = (intel?.who || t.personName || t.brand || '').trim() || 'Unknown'
                                      if (!groups[name]) groups[name] = []
                                      groups[name].push({ ...t, _intel: intel })
                                    })
                                    const groupArr = Object.entries(groups).map(([name, txns]) => ({
                                      name,
                                      txns: txns.sort((a:any,b:any) => (a.date||'').localeCompare(b.date||'')),
                                      total: txns.reduce((s:number,t:any) => s + t.amount, 0),
                                      count: txns.length,
                                    }))
                                    const significant = groupArr.filter(g => g.count >= 2 || g.total > 5000).sort((a,b) => b.total - a.total)
                                    const small = groupArr.filter(g => !(g.count >= 2 || g.total > 5000)).sort((a,b) => b.total - a.total)
                                    const renderRow = (t: any, idx: number) => {
                                      const nature = (t._intel?.why && t._intel.why !== 'TRANSFER' ? t._intel.why : '') || t._intel?.channel || ''
                                      return (
                                        <div key={t.id} draggable
                                          onDragStart={() => setDragTxnId(t.id)}
                                          onDragEnd={() => setDragTxnId(null)}
                                          style={{ display:'grid', gridTemplateColumns:'24px 60px 1fr 90px 28px', gap:6, padding:'5px 12px 5px 24px', fontSize:11, alignItems:'center', borderBottom:'0.5px solid #FAF7F2', cursor:'grab' }}
                                        >
                                          <span style={{ color:C.muted }}>{idx + 1}</span>
                                          <span style={{ color:C.muted, fontSize:10 }}>{t.date}</span>
                                          <span title={t.description || ''} style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, textTransform:'capitalize' as const }}>{(nature || t.description || '').toString().toLowerCase()}</span>
                                          <span style={{ textAlign:'right' as const, fontWeight:500, color: t.type==='credit' ? '#1D9E75' : '#D85A30' }}>{t.type==='credit'?'+':'−'}{fmt(t.amount)}</span>
                                          <button onClick={() => setSingleCategoryModal({ open:true, transaction:t })} style={{ width:22, height:22, borderRadius:3, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted }}>✎</button>
                                        </div>
                                      )
                                    }
                                    return (
                                      <>
                                        {significant.map(g => {
                                          const open = openBuckets.has(`person:${g.name}`)
                                          return (
                                            <div key={g.name} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                                              <div onClick={() => { const s = new Set(openBuckets); s.has(`person:${g.name}`) ? s.delete(`person:${g.name}`) : s.add(`person:${g.name}`); setOpenBuckets(s) }}
                                                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', cursor:'pointer', background: open ? '#FAF7F2' : 'transparent', fontSize:12 }}>
                                                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                  <span style={{ fontSize:10, color:C.muted, transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
                                                  <span style={{ fontWeight:500, color:C.text, textTransform:'capitalize' as const }}>{g.name.toLowerCase()}</span>
                                                  <span style={{ fontSize:10, color:C.muted }}>({g.count})</span>
                                                </span>
                                                <span style={{ fontSize:11.5, fontWeight:500, color:C.muted }}>{fmt(g.total)}</span>
                                              </div>
                                              {open && g.txns.map((t:any, idx:number) => renderRow(t, idx))}
                                            </div>
                                          )
                                        })}
                                        {small.length > 0 && (
                                          <>
                                            <div style={{ padding:'6px 12px', fontSize:9.5, fontWeight:700, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase' as const, background:'#FAFAF8', borderTop:`0.5px solid ${C.border}`, borderBottom:`0.5px solid ${C.border}` }}>Small transfers</div>
                                            {small.flatMap(g => g.txns).map((t: any) => (
                                              <div key={t.id} draggable
                                                onDragStart={() => setDragTxnId(t.id)}
                                                onDragEnd={() => setDragTxnId(null)}
                                                style={{ display:'grid', gridTemplateColumns:'1fr 60px 80px 28px', gap:6, padding:'5px 12px', fontSize:11, alignItems:'center', borderBottom:'0.5px solid #FAF7F2', cursor:'grab' }}>
                                                <span title={t.description || ''} style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, textTransform:'capitalize' as const }}>{((t._intel?.who || t.personName || t.brand || t.description || '').toString().toLowerCase())}</span>
                                                <span style={{ color:C.muted, fontSize:10 }}>{t.date}</span>
                                                <span style={{ textAlign:'right' as const, fontWeight:500, color: t.type==='credit' ? '#1D9E75' : '#D85A30' }}>{t.type==='credit'?'+':'−'}{fmt(t.amount)}</span>
                                                <button onClick={() => setSingleCategoryModal({ open:true, transaction:t })} style={{ width:22, height:22, borderRadius:3, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted }}>✎</button>
                                              </div>
                                            ))}
                                          </>
                                        )}
                                      </>
                                    )
                                  })()}
                                </div>
                              ) : isOpen && (
                                <div style={{ borderTop:`0.5px solid ${C.border}` }}>
                                  {items.length === 0 ? (
                                    <div style={{ padding:'16px 12px', textAlign:'center' as const, fontSize:11, color:C.muted }}>Drop transactions here</div>
                                  ) : (
                                    <>
                                      {items.slice(0, 20).map((t: any) => (
                                        <div key={t.id} draggable
                                          onDragStart={() => setDragTxnId(t.id)}
                                          onDragEnd={() => setDragTxnId(null)}
                                          onClick={() => setSelectedTxn(prev => ({ ...prev, [bucket.id]: prev[bucket.id] === t.id ? '' : t.id }))}
                                          style={{ ...S.txnRow, background: selectedTxn[bucket.id] === t.id ? C.wl : 'transparent', opacity: dragTxnId === t.id ? 0.35 : 1 }}
                                        >
                                          <div>
                                            <div title={`${t.brand ? `${t.brand} · ` : ''}${t.description || ''}`} style={{ color:C.text, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const, lineHeight:1.35, wordBreak:'break-word' as const }}>{t.brand ? `${t.brand} · ` : ''}{t.description}</div>
                                            <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{t.date}</div>
                                          </div>
                                          <div style={{ textAlign:'right' as const, fontWeight:500, color: t.type==='credit' ? '#1D9E75' : '#D85A30' }}>
                                            {t.type==='credit'?'+':'−'}{fmt(t.amount)}
                                          </div>
                                          <button onClick={e => { e.stopPropagation(); setSingleCategoryModal({ open:true, transaction:t }) }} style={{ width:22, height:22, borderRadius:3, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>✎</button>
                                        </div>
                                      ))}
                                      {items.length > 20 && <div style={{ padding:'6px 12px', fontSize:10, color:C.muted }}>+{items.length - 20} more</div>}
                                      {/* Reassign dropdown for selected txn */}
                                      {selectedTxn[bucket.id] && items.find((t: any) => t.id === selectedTxn[bucket.id]) && (
                                        <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderTop:`0.5px solid ${C.border}` }}>
                                          <select id={`sel_${bucket.id}`} defaultValue={bucket.id} style={{ flex:1, fontSize:11, padding:'3px 6px', borderRadius:4, border:`0.5px solid ${C.border}`, background:C.card, color:C.text, fontFamily:'inherit' }}>
                                            {ALL_BUCKET_LIST.map(b => (
                                              <option key={b.id} value={b.id} disabled={b.id === bucket.id}>{b.icon} {b.label}</option>
                                            ))}
                                          </select>
                                          <button onClick={() => {
                                            const sel = document.getElementById(`sel_${bucket.id}`) as HTMLSelectElement
                                            if (sel && sel.value !== bucket.id) {
                                              moveToBucket(selectedTxn[bucket.id], sel.value)
                                              setSelectedTxn(prev => { const n = { ...prev }; delete n[bucket.id]; return n })
                                            }
                                          }} style={{ fontSize:10, padding:'3px 8px', borderRadius:4, border:`0.5px solid ${C.border}`, background:C.card, color:C.text, cursor:'pointer', fontFamily:'inherit' }}>Move</button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setMainTab('reports')} style={{ ...S.btn(true), width:'100%', marginTop:16 }}>Proceed to Reports →</button>
                </>
              )}
            </div>
          )}

          {/* ════════════ REPORTS TAB — P&L + Cash Flow ════════════ */}
          {mainTab==='reports' && (
            <div>
              {!pnl ? (
                <div style={S.insight}>Upload a bank statement first to see your P&L and cash flow.</div>
              ) : (
                <>
                  {/* P&L */}
                  <div style={S.card}>
                    <div style={S.cardHead}>Profit & loss · {bankMonths} month{bankMonths>1?'s':''}{bankPeriod ? ` · ${bankPeriod.from} to ${bankPeriod.to}` : ''}</div>
                    <div style={{ padding:'8px 14px', background:'#EEF2EE', borderBottom:`1px solid #C8D8C8`, fontSize:10, fontWeight:700, color:'#2A7A4A', letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Income</div>
                    {pnl.incomeLines.length === 0 ? (
                      <div style={{ ...S.row, fontSize:12, color:C.muted, fontStyle:'italic' as const }}>No income detected</div>
                    ) : pnl.incomeLines.map(line => {
                      const expanded = pnlExpanded[`inc_${line.mega}`]
                      return (
                        <div key={`inc_${line.mega}`}>
                          <div style={{ ...S.row, fontWeight:500 }}>
                            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <button onClick={() => setPnlExpanded(p=>({...p, [`inc_${line.mega}`]:!expanded}))} style={{ width:18, height:18, borderRadius:3, border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.fg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:600 }}>{expanded?'−':'+'}</button>
                              <span style={{ fontSize:14 }}>{line.icon}</span>
                              {line.label}
                            </span>
                            <span style={{ color:'#2A7A4A', fontWeight:600 }}>+{fmt(line.monthlyAvg)}/mo</span>
                          </div>
                          {expanded && (
                            <div style={{ background:'#FAFAF8' }}>
                              {line.transactions.slice(0,15).map(t => (
                                <div key={t.id} style={{ display:'grid', gridTemplateColumns:'70px 1fr 90px', padding:'6px 14px 6px 38px', borderBottom:`1px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center' }}>
                                  <span style={{ color:C.muted }}>{t.date}</span>
                                  <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                                  <span style={{ color:'#2A7A4A', fontWeight:600, textAlign:'right' as const }}>+{fmt(t.amount)}</span>
                                </div>
                              ))}
                              {line.transactions.length > 15 && <div style={{ padding:'6px 14px 6px 38px', fontSize:11, color:C.muted }}>+{line.transactions.length-15} more</div>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 14px', background:C.wl, fontWeight:700, fontSize:13 }}>
                      <span>Total income</span>
                      <span style={{ color:'#2A7A4A' }}>+{fmt(pnl.monthlyIncome)}/mo</span>
                    </div>

                    <div style={{ padding:'8px 14px', background:'#FBF0F0', borderBottom:`1px solid #F0CECE`, fontSize:10, fontWeight:700, color:C.danger, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginTop:1 }}>Expenses</div>
                    {pnl.expenseLines.length === 0 ? (
                      <div style={{ ...S.row, fontSize:12, color:C.muted, fontStyle:'italic' as const }}>No expenses detected</div>
                    ) : pnl.expenseLines.map(line => {
                      const expanded = pnlExpanded[`exp_${line.mega}`]
                      return (
                        <div key={`exp_${line.mega}`}>
                          <div style={S.row}>
                            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <button onClick={() => setPnlExpanded(p=>({...p, [`exp_${line.mega}`]:!expanded}))} style={{ width:18, height:18, borderRadius:3, border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.fg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:600 }}>{expanded?'−':'+'}</button>
                              <span style={{ fontSize:14 }}>{line.icon}</span>
                              {line.label}
                            </span>
                            <span style={{ color:C.danger, fontWeight:500 }}>−{fmt(line.monthlyAvg)}/mo</span>
                          </div>
                          {expanded && (
                            <div style={{ background:'#FAFAF8' }}>
                              {line.transactions.slice(0,15).map(t => (
                                <div key={t.id} style={{ display:'grid', gridTemplateColumns:'70px 1fr 90px', padding:'6px 14px 6px 38px', borderBottom:`1px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center' }}>
                                  <span style={{ color:C.muted }}>{t.date}</span>
                                  <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                                  <span style={{ color:C.danger, fontWeight:500, textAlign:'right' as const }}>−{fmt(t.amount)}</span>
                                </div>
                              ))}
                              {line.transactions.length > 15 && <div style={{ padding:'6px 14px 6px 38px', fontSize:11, color:C.muted }}>+{line.transactions.length-15} more</div>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 14px', background:C.wl, fontWeight:700, fontSize:13 }}>
                      <span>Total expenses</span>
                      <span style={{ color:C.danger }}>−{fmt(pnl.monthlyExpenses)}/mo</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'13px 16px', fontSize:15, fontWeight:700, borderTop:`1.5px solid ${C.border}` }}>
                      <span>Net surplus / deficit</span>
                      <span style={{ color:pnl.monthlyNet>=0?'#2A7A4A':C.danger }}>{pnl.monthlyNet>=0?'+':''}{fmt(pnl.monthlyNet)}/mo</span>
                    </div>
                  </div>

                  {/* Cash Flow by month */}
                  {pnl.monthlyPnL.length > 1 && (
                    <div style={S.card}>
                      <div style={S.cardHead}>Cash flow by month</div>
                      <div style={{ overflowX:'auto' as const }}>
                        <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12.5 }}>
                          <thead>
                            <tr style={{ background:C.wl }}>
                              <th style={{ padding:'8px 14px', textAlign:'left' as const, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>Month</th>
                              <th style={{ padding:'8px 14px', textAlign:'right' as const, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>Income</th>
                              <th style={{ padding:'8px 14px', textAlign:'right' as const, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>Expenses</th>
                              <th style={{ padding:'8px 14px', textAlign:'right' as const, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pnl.monthlyPnL.map(m => (
                              <tr key={m.monthKey} style={{ borderBottom:`1px solid #FAF7F2` }}>
                                <td style={{ padding:'8px 14px', color:C.text, fontWeight:500 }}>{m.monthLabel}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right' as const, color:'#2A7A4A', fontWeight:500 }}>+{fmt(m.income)}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right' as const, color:C.danger, fontWeight:500 }}>−{fmt(m.expenses)}</td>
                                <td style={{ padding:'8px 14px', textAlign:'right' as const, color:m.net>=0?'#2A7A4A':C.danger, fontWeight:700 }}>{m.net>=0?'+':''}{fmt(m.net)}</td>
                              </tr>
                            ))}
                            <tr style={{ background:C.wl, fontWeight:700 }}>
                              <td style={{ padding:'10px 14px' }}>Total</td>
                              <td style={{ padding:'10px 14px', textAlign:'right' as const, color:'#2A7A4A' }}>+{fmt(pnl.totalIncome)}</td>
                              <td style={{ padding:'10px 14px', textAlign:'right' as const, color:C.danger }}>−{fmt(pnl.totalExpenses)}</td>
                              <td style={{ padding:'10px 14px', textAlign:'right' as const, color:pnl.netSurplus>=0?'#2A7A4A':C.danger }}>{pnl.netSurplus>=0?'+':''}{fmt(pnl.netSurplus)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════ ANALYTICS TAB ════════════ */}
          {mainTab==='analytics' && (
            <div>
              {!pnl || !analytics ? (
                <div style={S.insight}>Upload a bank statement and review transactions to see analytics.</div>
              ) : (
                <>
                  {/* Metric cards */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
                    {[
                      { label:'Monthly income', value:fmt(pnl.monthlyIncome), color:'#2A7A4A' },
                      { label:'Monthly expenses', value:fmt(pnl.monthlyExpenses), color:C.danger },
                      { label:'Net surplus', value:`${pnl.monthlyNet>=0?'+':''}${fmt(pnl.monthlyNet)}`, color:pnl.monthlyNet>=0?'#2A7A4A':C.danger },
                    ].map(m => (
                      <div key={m.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'14px 16px' }}>
                        <p style={{ fontSize:10, color:C.muted, margin:'0 0 4px', letterSpacing:'0.05em', textTransform:'uppercase' as const }}>{m.label}</p>
                        <p style={{ fontSize:20, fontWeight:700, color:m.color, margin:0 }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Health indicators */}
                  <div style={S.card}>
                    <div style={S.cardHead}>Financial health indicators</div>
                    {[
                      { label:'EMI burden', value:`${analytics.emiBurden}%`, sub:`${fmt(analytics.monthlyEMI)}/mo in EMIs`, severity: analytics.emiBurden > 50 ? 'danger' : analytics.emiBurden > 35 ? 'warning' : 'good' },
                      { label:'Savings rate', value:`${analytics.savingsRate}%`, sub:`Net ${fmt(pnl.monthlyNet)}/mo saved`, severity: analytics.savingsRate < 10 ? 'danger' : analytics.savingsRate < 20 ? 'warning' : 'good' },
                      { label:'Investment rate', value:`${analytics.investmentRate}%`, sub:`${fmt(analytics.monthlySIP)}/mo in SIPs`, severity: analytics.investmentRate < 10 ? 'warning' : 'good' },
                    ].map(h => (
                      <div key={h.label} style={{ ...S.row, gap:12 }}>
                        <span style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                          <span style={{ width:8, height:8, borderRadius:4, background: h.severity === 'danger' ? C.danger : h.severity === 'warning' ? '#D4B020' : '#2A7A4A', flexShrink:0 }} />
                          <span>{h.label}</span>
                        </span>
                        <span style={{ fontWeight:600, color: h.severity === 'danger' ? C.danger : h.severity === 'warning' ? '#8A6A1A' : '#2A7A4A' }}>{h.value}</span>
                        <span style={{ fontSize:11, color:C.muted, minWidth:140, textAlign:'right' as const }}>{h.sub}</span>
                      </div>
                    ))}
                  </div>

                  {/* Spending spikes */}
                  {analytics.spikes.length > 0 && (
                    <div style={S.card}>
                      <div style={{ ...S.cardHead, background:'#FBF0F0', borderColor:'#F0CECE' }}>Spending spikes — last month vs average</div>
                      {analytics.spikes.map(s => (
                        <div key={s.category} style={{ ...S.row, gap:8 }}>
                          <span style={{ flex:1 }}>
                            <span style={{ fontWeight:500 }}>{s.label}</span>
                            <span style={{ fontSize:11, color:C.muted, marginLeft:8 }}>{fmt(s.lastMonth)} vs {fmt(s.avg)} avg</span>
                          </span>
                          <span style={{ fontWeight:600, color:C.danger }}>↑ {s.pct}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>{/* end content */}

      {/* ── SINGLE CATEGORY MODAL ── */}
      {singleCategoryModal.open && singleCategoryModal.transaction && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setSingleCategoryModal({ open:false, transaction:null })}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:480, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)', maxHeight:'80vh', overflowY:'auto' as const }}>
            <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>Change category</p>
            <div style={{ background:'#FAFAF8', border:`1px solid ${C.border}`, borderRadius:5, padding:'10px 12px', marginBottom:12 }}>
              <p style={{ fontSize:11, color:C.muted, margin:'0 0 2px' }}>{singleCategoryModal.transaction.date}</p>
              <p style={{ fontSize:13, color:C.text, margin:'0 0 4px' }}>{singleCategoryModal.transaction.description}</p>
              <p style={{ fontSize:14, fontWeight:600, color:singleCategoryModal.transaction.type==='credit'?'#2A7A4A':C.danger, margin:0 }}>
                {singleCategoryModal.transaction.type==='credit'?'+':'-'}{fmt(singleCategoryModal.transaction.amount)}
              </p>
            </div>
            <p style={{ fontSize:11, color:C.muted, margin:'0 0 8px' }}>This choice is remembered for future uploads:</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {(Object.keys(MEGA_CATEGORIES) as MegaCategory[]).map(key => {
                const info = MEGA_CATEGORIES[key]
                return (
                  <button key={key} onClick={() => reassignSingle(key)} style={{ padding:'10px 12px', background:info.bgColor, border:`1px solid ${info.borderColor}`, borderRadius:5, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:16 }}>{info.icon}</span>
                    <span style={{ fontSize:11.5, fontWeight:500, color:info.color }}>{info.label}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setSingleCategoryModal({ open:false, transaction:null })} style={{ marginTop:14, width:'100%', padding:9, background:'#fff', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── ALWAYS-MOUNTED HIDDEN SALARY INPUT ── */}
      {/* Lives outside any tab block so salaryRef.current is always valid, no matter which tab the user is on */}
      <input ref={salaryRef} type="file" accept=".pdf,.xls,.xlsx,.csv,image/*" style={{ display:'none' }} onChange={e => { if(e.target.files?.[0]) { handleSalaryFile(e.target.files[0]) }; e.target.value='' }} />

      {/* ── EMPLOYMENT PROMPT MODAL ── */}
      {employmentPrompt.open && employmentPrompt.pendingSlip && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setEmploymentPrompt({ open: false, pendingSlip: null, reason: null })}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:480, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)' }}>
            <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>{employmentPrompt.reason === 'employer_changed' ? 'Different employer detected' : 'Salary changed'}</p>
            <p style={{ fontSize:12, color:C.muted, margin:'0 0 14px', lineHeight:1.5 }}>
              {employmentPrompt.reason === 'employer_changed'
                ? <>The new slip names <strong>{employmentPrompt.newEmployerName || 'a different employer'}</strong> instead of <strong>{employmentPrompt.oldEmployerName || 'the previous one'}</strong>. Did you switch jobs?</>
                : <>The basic salary on this slip differs significantly from the previous slip. What happened?</>}
            </p>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
              <button onClick={() => resolveEmploymentPrompt('hike')} style={{ padding:'10px 14px', background:C.card, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, color:C.text }}>
                <strong>Same employer · I got a hike</strong>
                <p style={{ fontSize:11, color:C.muted, margin:'2px 0 0' }}>New basic projects forward from this month</p>
              </button>
              <button onClick={() => resolveEmploymentPrompt('same_employer')} style={{ padding:'10px 14px', background:C.card, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, color:C.text }}>
                <strong>Same employer · just one-time component</strong>
                <p style={{ fontSize:11, color:C.muted, margin:'2px 0 0' }}>Bonus / arrears in this month, no real change</p>
              </button>
              <button onClick={() => resolveEmploymentPrompt('new_employer')} style={{ padding:'10px 14px', background:C.card, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, color:C.text }}>
                <strong>New employer (job switch)</strong>
                <p style={{ fontSize:11, color:C.muted, margin:'2px 0 0' }}>Tracked as a separate employment for this FY</p>
              </button>
            </div>
            <button onClick={() => setEmploymentPrompt({ open: false, pendingSlip: null, reason: null })} style={{ marginTop:12, width:'100%', padding:9, background:'#fff', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Cancel · don't add this slip</button>
          </div>
        </div>
      )}

      {/* ── EXTEND RANGE MODAL (Same as existing employer) ── */}
      {extendRangeModal.open && salaryTimeline && (() => {
        const earliestEmp = salaryTimeline.employments.slice().sort((a, b) => a.fromMonth.localeCompare(b.fromMonth))[0]
        if (!earliestEmp) return null
        // Build month options between gapMin and gapMax (inclusive)
        const optionRange: string[] = []
        const [minY, minM] = extendRangeModal.gapMin.split('-').map(Number)
        const [maxY, maxM] = extendRangeModal.gapMax.split('-').map(Number)
        let cy = minY, cm = minM
        while (cy < maxY || (cy === maxY && cm <= maxM)) {
          optionRange.push(`${cy}-${String(cm).padStart(2, '0')}`)
          cm += 1
          if (cm > 12) { cm = 1; cy += 1 }
        }
        const close = () => setExtendRangeModal({ open: false, fromMonth: '', toMonth: '', gapMin: '', gapMax: '' })
        const confirm = () => {
          const from = extendRangeModal.fromMonth
          const to = extendRangeModal.toMonth
          if (from > to) { toast.error('From must be earlier than To'); return }
          setSalaryTimeline(prev => {
            if (!prev) return prev
            // Find the earliest employment and extend its fromMonth to 'from'
            const sorted = [...prev.employments].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth))
            const earliest = sorted[0]
            const updatedEmployments = prev.employments.map(e => e.id === earliest.id ? { ...e, fromMonth: from } : e)
            // Months between 'to' and 'earliest.fromMonth - 1' that remain empty after extension → those are still gaps
            // For now we just extend; if user still has remaining gap, the notice will re-render
            return { ...prev, employments: updatedEmployments }
          })
          toast.success(`Extended ${earliestEmp.employerName} backward · ${monthLabel(from)} – ${monthLabel(to)}`)
          close()
        }
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={close}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:480, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)' }}>
              <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>Extend {earliestEmp.employerName} backward</p>
              <p style={{ fontSize:12, color:C.muted, margin:'0 0 14px', lineHeight:1.55 }}>
                Pick the range you were at this employer. We'll use {earliestEmp.employerName}'s recurring components (basic, HRA, etc.) for those months.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                <div>
                  <p style={{ fontSize:11, color:C.muted, margin:'0 0 4px' }}>From</p>
                  <select value={extendRangeModal.fromMonth} onChange={e => setExtendRangeModal(p => ({ ...p, fromMonth: e.target.value }))} style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:13, background:'#fff', fontFamily:'inherit' }}>
                    {optionRange.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize:11, color:C.muted, margin:'0 0 4px' }}>To</p>
                  <select value={extendRangeModal.toMonth} onChange={e => setExtendRangeModal(p => ({ ...p, toMonth: e.target.value }))} style={{ width:'100%', padding:'8px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:13, background:'#fff', fontFamily:'inherit' }}>
                    {optionRange.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
                  </select>
                </div>
              </div>
              <p style={{ fontSize:10.5, color:C.muted, margin:'0 0 14px', fontStyle:'italic' as const, lineHeight:1.5 }}>
                We project from your earliest uploaded slip's recurring components. If you got a hike during this period, that won't be reflected — upload those slips instead for accuracy.
              </p>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={close} style={{ padding:'9px 16px', background:'#fff', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button onClick={confirm} style={{ padding:'9px 18px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Extend backward</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── OTHER INCOME STUB MODAL (freelance / business — placeholder for Build 4) ── */}
      {otherIncomeModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setOtherIncomeModal({ open: false })}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:480, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)' }}>
            <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 8px' }}>Freelance / business income</p>
            <p style={{ fontSize:12.5, color:C.text, margin:'0 0 10px', lineHeight:1.6 }}>
              You had non-salary income during this period — freelancing, consulting, business turnover, rental, or capital gains. These are different from salary in how tax is computed.
            </p>
            <p style={{ fontSize:12, color:C.muted, margin:'0 0 14px', lineHeight:1.6 }}>
              We're building proper support for non-salary income (with Section 44ADA, 44AD, and other presumptive schemes) in a coming update. For now:
            </p>
            <ul style={{ fontSize:11.5, color:C.text, margin:'0 0 16px', paddingLeft:20, lineHeight:1.7 }}>
              <li>If most of these months had no other income too, click <strong>NIL</strong> — we'll mark them ₹0 and you can add the freelance income separately later.</li>
              <li>If you have payslip-format records of the freelance income, upload them as slips via <strong>Different — upload slip</strong>.</li>
              <li>For now, keep records of gross earnings and TDS (typically under Section 194J) so you can reconcile when this feature ships.</li>
            </ul>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setOtherIncomeModal({ open: false })} style={{ padding:'9px 18px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NAME MISMATCH PROMPT (Fix A) ── */}
      {nameMismatchPrompt.open && nameMismatchPrompt.pendingSlip && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setNameMismatchPrompt({ open: false, pendingSlip: null, existingName: '', newName: '' })}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:500, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)' }}>
            <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>Different employee detected</p>
            <p style={{ fontSize:12, color:C.muted, margin:'0 0 14px', lineHeight:1.55 }}>
              The name on this slip doesn't match your earlier slips. A typo or nickname is fine; a genuinely different person's slip will produce wrong tax math.
            </p>
            <div style={{ background:C.wl, border:`1px solid ${C.border}`, borderRadius:6, padding:'10px 12px', marginBottom:14, fontSize:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:'4px 12px' }}>
                <span style={{ color:C.muted }}>This slip is for:</span>
                <span style={{ fontWeight:600, color:C.text }}>{nameMismatchPrompt.newName}</span>
                <span style={{ color:C.muted }}>Existing slips are for:</span>
                <span style={{ fontWeight:600, color:C.text }}>{nameMismatchPrompt.existingName}</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
              <button onClick={() => { setNameMismatchPrompt({ open: false, pendingSlip: null, existingName: '', newName: '' }); toast.success('Slip discarded') }} style={{ padding:'10px 14px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Discard this slip</button>
              <button onClick={() => { const pending = nameMismatchPrompt.pendingSlip!; setNameMismatchPrompt({ open: false, pendingSlip: null, existingName: '', newName: '' }); addSlipToTimeline(pending) }} style={{ padding:'10px 14px', background:'#fff', color:C.text, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Use anyway · this is the same person</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SALARY MONTH EDITOR MODAL ── */}
      {salaryMonthEditor.open && salaryMonthEditor.monthKey && salaryTimeline && (() => {
        const mk = salaryMonthEditor.monthKey
        const r = rollupMonth(salaryTimeline, mk)
        const emp = employmentForMonth(salaryTimeline, mk)
        const exact = emp?.slips.find(s => s.monthKey === mk) || null
        const override = salaryTimeline.overrides.find(o => o.monthKey === mk)
        // Build editable rows
        const baseRows: Array<{ label: string; amount: number; type: 'earning' | 'deduction' }> =
          override ? override.components.map(c => ({ ...c })) :
          exact ? exact.components.map(c => ({ label: c.label, amount: c.amount, type: c.type })) :
          (() => {
            const base = emp ? latestSlipBefore(emp, mk) || emp.slips[0] : null
            if (!base) return []
            return base.components.filter(c => c.flag === 'recurring').map(c => ({ label: c.label, amount: c.amount, type: c.type }))
          })()
        return (
          <SalaryMonthEditor
            monthKey={mk}
            isActual={r.isActual}
            isOverride={r.isOverride}
            initialRows={baseRows}
            onClose={() => setSalaryMonthEditor({ open: false, monthKey: null })}
            onSave={(rows) => { setMonthOverride(mk, rows); setSalaryMonthEditor({ open: false, monthKey: null }); toast.success(`${monthLabel(mk)} updated`) }}
            onClearOverride={r.isOverride ? () => { clearMonthOverride(mk); setSalaryMonthEditor({ open: false, monthKey: null }); toast.success('Override cleared') } : null}
            onUploadHere={() => { setPendingMonthIntent(mk); setSalaryMonthEditor({ open: false, monthKey: null }); salaryRef.current?.click() }}
          />
        )
      })()}

      {/* ── SALARY COMPONENT FLAGS MODAL ── */}
      {salaryFlagsModal.open && salaryTimeline && salaryFlagsModal.employmentId && (() => {
        const emp = salaryTimeline.employments.find(e => e.id === salaryFlagsModal.employmentId)
        if (!emp) return null
        const slip = salaryFlagsModal.slipId ? emp.slips.find(s => s.id === salaryFlagsModal.slipId) : emp.slips[emp.slips.length - 1]
        if (!slip) return null
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setSalaryFlagsModal({ open: false, slipId: null, employmentId: null })}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:520, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)', maxHeight:'80vh', overflowY:'auto' as const }}>
              <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>Edit components · {monthLabel(slip.monthKey)}</p>
              <p style={{ fontSize:11, color:C.muted, margin:'0 0 12px' }}>Flag each line as recurring (projected forward) or one-time (counted only this month).</p>
              <div style={{ border:`1px solid ${C.border}`, borderRadius:5, overflow:'hidden' }}>
                {slip.components.map((c, i) => (
                  <div key={`${c.label}-${i}`} style={{ display:'grid', gridTemplateColumns:'1fr 90px 80px 80px', gap:8, padding:'8px 12px', borderBottom: i < slip.components.length - 1 ? `1px solid ${C.border}` : 'none', alignItems:'center', fontSize:12 }}>
                    <span style={{ color: c.type === 'deduction' ? C.danger : C.text }}>{c.type === 'deduction' ? '− ' : ''}{c.label}</span>
                    <span style={{ textAlign:'right' as const, fontWeight:500, color:C.text }}>{fmt(c.amount)}</span>
                    <button onClick={() => updateComponentFlag(emp.id, slip.id, c.label, 'recurring')} style={{ padding:'5px 8px', borderRadius:4, fontSize:11, fontFamily:'inherit', cursor:'pointer', border: c.flag === 'recurring' ? `1px solid ${C.fg}` : `1px solid ${C.border}`, background: c.flag === 'recurring' ? C.fg : C.card, color: c.flag === 'recurring' ? C.wheat : C.muted, fontWeight: c.flag === 'recurring' ? 600 : 400 }}>Recurring</button>
                    <button onClick={() => updateComponentFlag(emp.id, slip.id, c.label, 'one_time')} style={{ padding:'5px 8px', borderRadius:4, fontSize:11, fontFamily:'inherit', cursor:'pointer', border: c.flag === 'one_time' ? `1px solid ${C.wm}` : `1px solid ${C.border}`, background: c.flag === 'one_time' ? '#C9A84C' : C.card, color: c.flag === 'one_time' ? '#fff' : C.muted, fontWeight: c.flag === 'one_time' ? 600 : 400 }}>One-time</button>
                  </div>
                ))}
              </div>
              {emp.slips.length > 1 && (
                <div style={{ marginTop:12 }}>
                  <p style={{ fontSize:11, color:C.muted, margin:'0 0 6px' }}>Switch to another month's slip:</p>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
                    {emp.slips.sort((a,b) => a.monthKey.localeCompare(b.monthKey)).map(s => (
                      <button key={s.id} onClick={() => setSalaryFlagsModal({ open: true, slipId: s.id, employmentId: emp.id })} style={{ padding:'4px 10px', borderRadius:3, fontSize:11, fontFamily:'inherit', cursor:'pointer', border:`1px solid ${s.id === slip.id ? C.fg : C.border}`, background: s.id === slip.id ? C.wl : C.card, color: s.id === slip.id ? C.fg : C.muted, fontWeight: s.id === slip.id ? 600 : 400 }}>{monthLabel(s.monthKey)}</button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setSalaryFlagsModal({ open: false, slipId: null, employmentId: null })} style={{ marginTop:14, width:'100%', padding:9, background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Done</button>
            </div>
          </div>
        )
      })()}

      {/* ── PASSWORD MODAL ── */}
      {pwdModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setPwdModal({ open:false, type:null, file:null, error:'' })}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:400, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)' }}>
            <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>🔐 {pwdModal.type==='bank'?'Bank Statement':pwdModal.type==='cas'?'CAS Statement':'AIS'} Password</p>
            {pwdModal.type==='bank' && (
              <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 12px', marginBottom:14 }}>
                <p style={{ fontSize:11, color:C.fg, margin:0, lineHeight:1.85 }}>
                  • <strong>SBI</strong>: First 4 letters of name + DOB (DDMMYY)<br/>
                  • <strong>HDFC</strong>: Customer ID<br/>
                  • <strong>ICICI</strong>: First 4 of name + DOB (DDMM)<br/>
                  • <strong>Axis</strong>: PAN + DOB<br/>
                  • <strong>Kotak</strong>: First 4 of name + DOB<br/>
                  • <strong>PNB</strong>: Account number
                </p>
              </div>
            )}
            {pwdModal.type==='cas' && (
              <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 12px', marginBottom:14 }}>
                <p style={{ fontSize:11, color:C.fg, margin:0, lineHeight:1.85 }}>Your CAS password is your <strong>PAN in CAPITALS</strong><br/><span style={{ fontFamily:'monospace' }}>e.g. ABCDE1234F</span></p>
              </div>
            )}
            {pwdModal.type!=='bank'&&pwdModal.type!=='cas' && (
              <div style={{ background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'10px 12px', marginBottom:14 }}>
                <p style={{ fontSize:11, color:C.fg, margin:0 }}>PAN lowercase + DOB (DDMMYYYY)<br/><span style={{ fontFamily:'monospace' }}>e.g. abcde1234f01011990</span></p>
              </div>
            )}
            <input type="password" autoFocus value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitPassword()} placeholder="Enter password"
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${pwdModal.error?C.danger:C.border}`, borderRadius:5, fontSize:13, outline:'none', marginBottom:6, fontFamily:'monospace', boxSizing:'border-box' as const }} />
            {pwdModal.error && <p style={{ fontSize:11, color:C.danger, margin:'0 0 8px' }}>{pwdModal.error}</p>}
            <p style={{ fontSize:11, color:C.muted, margin:'0 0 14px' }}>Leave empty if not password-protected</p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setPwdModal({open:false,type:null,file:null,error:''})} style={{ flex:1, padding:9, background:'#fff', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={submitPassword} style={{ flex:2, padding:9, background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Open →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
