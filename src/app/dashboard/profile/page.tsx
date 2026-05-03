'use client'
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import DematHoldings from '@/components/DematHoldings'
import { useAppStore } from '@/store/AppStore'
import { MEGA_CATEGORIES, MegaCategory, tagTransactions, detectSalaryCandidates, detectSalary, SalaryCandidate, SalaryDetectionResult, generateExpenseSuggestions, ExpenseSuggestion, loadMerchantMemory, saveMerchantMemory, extractMerchantKey } from '@/lib/categories'

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

type MainTab = 'docs' | 'review' | 'reports' | 'analytics'

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
    if (accounts.length === 0) { setTaggedTxns([]); setBankPeriod(null); setBankMonths(1); return }
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

    // ── Step 1: Auto-classify CERTAIN transactions ──
    taggedTxns.forEach(t => {
      // User override always wins
      if (bucketOverrides[t.id]) { assignments[t.id] = bucketOverrides[t.id]; return }

      // Check if user previously answered for this pattern
      const pk = getPatternKey(t)
      if (userClassifications[pk]) { assignments[t.id] = userClassifications[pk]; return }

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
  }, [taggedTxns, bucketOverrides, userClassifications, bankMonths])

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
    if (file.size > 15*1024*1024) { toast.error('File too large (max 15MB)'); return }
    setLoadingDoc('bank'); setPwdModal({ open:false, type:null, file:null, error:'' })
    const tid = toast.loading('Reading your bank statement…')
    try {
      const form = new FormData(); form.append('file', file); if (password) form.append('password', password)
      const res = await fetch('/api/parse-bank-statement', { method:'POST', body:form })
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
      const newAccount: BankAccount = { id: accId, bank: bd.bank || 'Bank', last4: bd.accountNumber?.slice(-4) || '', label: '', data: bd, txnCount: bd.transactions?.length || 0, period }
      const updated = uploadingAccountId ? bankAccounts.map(a => a.id === uploadingAccountId ? newAccount : a) : [...bankAccounts, newAccount]
      setBankAccounts(updated)
      try { localStorage.setItem('av_banks', JSON.stringify(updated)) } catch (e) { console.error('[av_banks] SAVE FAILED:', e) }
      rebuildMergedTransactions(updated)
      setUploadingAccountId(null)
      toast.success(`${bd.bank || 'Bank'} · ${bd.transactions?.length||0} transactions across ${period.months} month${period.months>1?'s':''}`, { id:tid, duration:5000 })
      // Auto-navigate to Review tab after upload
      setMainTab('review')
    } catch (e:any) {
      const errStr=(e.message||'').toLowerCase()
      if (errStr.includes('password')||errStr.includes('encrypted')) { setPwdModal({ open:true, type:'bank', file, error:'' }); setPwd(''); toast.dismiss(tid); return }
      toast.error(e.message||'Failed to parse', { id:tid })
    } finally { setLoadingDoc(null) }
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
    setManualOverrides(prev => ({ ...prev, [t.id]: newMega }))
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
              <p style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:6 }}>Bank statements</p>

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

              <div style={S.upload(false)} onClick={() => { setUploadingAccountId(null); bankRef.current?.click() }}>
                {loadingDoc==='bank' ? <p style={{ fontSize:13, color:C.fg }}>Reading…</p> : (
                  <>
                    <span style={{ fontSize:24 }}>🏦</span>
                    <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>
                      {bankAccounts.length > 0 ? '+ Add more accounts' : 'Upload bank statement'}
                    </p>
                    <p style={{ fontSize:10.5, color:C.muted, margin:0 }}>Any Indian bank · PDF, Excel, CSV or photo · password supported</p>
                  </>
                )}
              </div>
              <input ref={bankRef} type="file" accept=".pdf,.xls,.xlsx,.csv,image/*" style={{ display:'none' }} onChange={e => { if(e.target.files?.[0]) { handleBankFile(e.target.files[0]) }; e.target.value='' }} />
              <p onClick={() => { setUploadingAccountId(null); bankRef.current?.click() }} style={{ fontSize:12, color:C.fg, margin:'8px 0 18px', cursor:'pointer' }}>+ Add more accounts <span style={{ fontSize:11, color:C.muted }}>(salary, expenses, spouse, joint, etc.)</span></p>

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

              {bankAccounts.length > 0 && (
                <button onClick={() => setMainTab('review')} style={{ ...S.btn(true), width:'100%', padding:'11px', marginTop:12 }}>
                  Proceed to Review →
                </button>
              )}
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
                              {isOpen && (
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
                                            <div style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand ? `${t.brand} · ` : ''}{t.description}</div>
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
