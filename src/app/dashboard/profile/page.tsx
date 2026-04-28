'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/AppStore'
import { MEGA_CATEGORIES, MegaCategory, tagTransactions, detectSalaryCandidates, SalaryCandidate, generateExpenseSuggestions, ExpenseSuggestion, loadMerchantMemory, saveMerchantMemory, extractMerchantKey } from '@/lib/categories'

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
        onChange={e => setLocal(e.target.value.replace(/[^0-9]/g,''))}
        onBlur={() => onChange(parseFloat(local)||0)}
        onKeyDown={e => e.key==='Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="0"
        style={{ padding:'5px 8px', border:'none', fontSize:small?12:12.5, fontFamily:'inherit', outline:'none', width:small?70:90, color:C.text }} />
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
  cardHead: { padding:'10px 14px', background:C.wl, borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, display:'flex', justifyContent:'space-between', alignItems:'center' },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', borderBottom:`1px solid #FAF7F2`, fontSize:12.5, color:C.text } as React.CSSProperties,
  stab: (on:boolean): React.CSSProperties => ({ padding:'0 12px 9px', fontSize:12, cursor:'pointer', borderTop:'none', borderLeft:'none', borderRight:'none', borderBottom:`2px solid ${on?C.wm:'transparent'}`, color:on?C.fg:C.muted, fontWeight:on?600:400, background:'none', fontFamily:'inherit' }),
  maintab: (on:boolean): React.CSSProperties => ({ padding:'0 14px 10px', fontSize:12.5, cursor:'pointer', borderTop:'none', borderLeft:'none', borderRight:'none', borderBottom:`2px solid ${on?C.wheat:'transparent'}`, color:on?C.fg:C.muted, fontWeight:on?600:400, background:'none', fontFamily:'inherit', whiteSpace:'nowrap' as const }),
  btn: (primary=true): React.CSSProperties => ({ padding:'10px 14px', background:primary?C.fg:C.card, color:primary?C.wheat:C.muted, border:primary?'none':`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, fontWeight:primary?600:400, cursor:'pointer', fontFamily:'inherit' }),
  insight: { background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, padding:'9px 12px', fontSize:12, color:C.fg, lineHeight:1.6, marginBottom:12 } as React.CSSProperties,
  upload: (done=false): React.CSSProperties => ({ border:`1.5px dashed ${done?C.fg:C.border}`, borderRadius:6, padding:14, textAlign:'center' as const, background:done?'#EEF2EE':C.wl, cursor:done?'default':'pointer', display:'flex', flexDirection:'column' as const, alignItems:done?'flex-start':'center', justifyContent:done?'flex-start':'center', gap:6, minHeight:130 }),
  bulkBar: { padding:'9px 14px', background:'#1E293B', color:'rgba(230,207,167,0.9)', fontSize:11.5, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' as const } as React.CSSProperties,
  bulkBtn: { padding:'4px 11px', borderRadius:3, fontSize:11, cursor:'pointer', border:'1px solid rgba(230,207,167,0.3)', background:'transparent', color:C.wheat, fontFamily:'inherit', whiteSpace:'nowrap' as const } as React.CSSProperties,
}

interface SalaryBreakdown {
  netSalary: number          // take-home
  employeePF: number         // → 80C
  employerPF: number         // wealth tracker
  bonus: number              // variable
  otherBenefits: number      // LTA, vouchers, etc.
  employerName: string
}

interface CreditCard {
  id: string
  bank: string
  last4: string
}

interface BankAccount {
  id: string
  bank: string
  last4: string
  label: string
  data: any  // raw parsed data from API
  txnCount: number
  period: { from: string; to: string; months: number }
}

interface PnLLine {
  mega: MegaCategory
  label: string
  icon: string
  color: string
  amount: number
  monthlyAvg: number
  transactions: any[]
}

interface MonthlyPnL {
  monthKey: string
  monthLabel: string
  income: number
  expenses: number
  net: number
  byCategory: Record<MegaCategory, number>
}

function computePnL(transactions: any[], months: number, confirmedDetections: Record<string, boolean>, manualOverrides: Record<string, MegaCategory>, selectedSalaryIds: Set<string>, parkedIds: Set<string>) {
  const txns = transactions.map(t => {
    let mega: MegaCategory = manualOverrides[t.id] || t.mega || 'misc'
    if (selectedSalaryIds.has(t.id)) mega = 'salary'
    if (parkedIds.has(t.id)) mega = 'misc'
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
    const isIncome = mega === 'salary' || mega === 'interest' || mega === 'cashback' || (t.type === 'credit' && info?.routesTo === 'income')
    const target = (isIncome || (t.type === 'credit' && (mega === 'transfer' || mega === 'misc'))) ? incomeMap : expenseMap
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
    const mega: MegaCategory = t.megaFinal
    const info = MEGA_CATEGORIES[mega]
    const isIncome = mega === 'salary' || mega === 'interest' || mega === 'cashback' || (t.type === 'credit' && info?.routesTo === 'income')
    if (isIncome || (t.type === 'credit' && (mega === 'transfer' || mega === 'misc'))) m.income += t.amount
    else m.expenses += t.amount
    m.byCategory[mega] = (m.byCategory[mega] || 0) + t.amount
  })
  const monthlyPnL = Object.values(monthMap).map(m => ({ ...m, net: m.income - m.expenses })).sort((a,b)=>a.monthKey.localeCompare(b.monthKey))

  return { incomeLines, expenseLines, totalIncome, totalExpenses, netSurplus, monthlyIncome, monthlyExpenses, monthlyNet, monthlyPnL }
}

type MainTab = 'docs' | 'income' | 'expenses' | 'pnl'

export default function ProfilePage() {
  const { salary, setSalary, aisData, setAisData } = useAppStore() as any
  const [mainTab, setMainTab] = useState<MainTab>('docs')
  const [incTab, setIncTab] = useState<'review'|'salary'|'other'|'suggestions'>('review')
  const [salMode, setSalMode] = useState<'slip'|'offer'|'manual'>('slip')
  const [loadingDoc, setLoadingDoc] = useState<string|null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [taggedTxns, setTaggedTxns] = useState<any[]>([])
  const [bankPeriod, setBankPeriod] = useState<{from:string; to:string}|null>(null)
  const [bankMonths, setBankMonths] = useState(1)
  const [uploadingAccountId, setUploadingAccountId] = useState<string|null>(null)  // which account slot is being uploaded

  // Salary breakdown — full editable picture
  const [salBreakdown, setSalBreakdown] = useState<SalaryBreakdown>({
    netSalary: 0, employeePF: 0, employerPF: 0, bonus: 0, otherBenefits: 0, employerName: ''
  })

  // Credit cards
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [newCardBank, setNewCardBank] = useState('')
  const [newCardLast4, setNewCardLast4] = useState('')

  // Smart Review state
  const [salCardOpen, setSalCardOpen] = useState(true)
  const [rtCardOpen, setRtCardOpen] = useState(false)
  const [intCardOpen, setIntCardOpen] = useState(false)
  const [salShowAllCredits, setSalShowAllCredits] = useState(false)

  const [tickedSalary, setTickedSalary] = useState<Set<string>>(new Set())
  const [tickedRoundtrip, setTickedRoundtrip] = useState<Set<string>>(new Set())
  const [tickedInterest, setTickedInterest] = useState<Set<string>>(new Set())
  const [confirmedDetections, setConfirmedDetections] = useState<Record<string,boolean>>({})
  const [manualOverrides, setManualOverrides] = useState<Record<string, MegaCategory>>({})
  const [confirmedSalaryIds, setConfirmedSalaryIds] = useState<Set<string>>(new Set())
  const [parkedIds, setParkedIds] = useState<Set<string>>(new Set())

  // Suggestions state — for filling Expenses after Smart Review
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, 'accepted' | 'rejected' | 'parked'>>({})
  const [suggestionElssAmount, setSuggestionElssAmount] = useState<Record<string, number>>({})  // for splitting investments
  const [suggestionElssRegular, setSuggestionElssRegular] = useState<Record<string, {elss:number; reg:number}>>({})
  const [suggExpanded, setSuggExpanded] = useState<Record<string, boolean>>({})
  const [suggUnticked, setSuggUnticked] = useState<Record<string, Set<string>>>({})
  const [suggShowAll, setSuggShowAll] = useState<Record<string, boolean>>({})

  const [singleCategoryModal, setSingleCategoryModal] = useState<{ open:boolean; transaction:any|null; from?:'apply-expenses'; fromMega?:MegaCategory }>({ open:false, transaction:null })
  const [bulkCategoryModal, setBulkCategoryModal] = useState<{ open:boolean; transactions:any[]; label:string }>({ open:false, transactions:[], label:'' })
  const [pnlExpanded, setPnlExpanded] = useState<Record<string, boolean>>({})

  const [pwdModal, setPwdModal] = useState<{ open:boolean; type:string|null; file:File|null; error:string }>({ open:false, type:null, file:null, error:'' })
  const [pwd, setPwd] = useState('')
  const bankRef = useRef<HTMLInputElement>(null)
  const aisRef = useRef<HTMLInputElement>(null)
  const taxRef = useRef<HTMLInputElement>(null)
  const slipRef = useRef<HTMLInputElement>(null)
  const offerRef = useRef<HTMLInputElement>(null)
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

  // Load all data from localStorage on mount
  useEffect(() => {
    try {
      const p = localStorage.getItem('av_profile')
      if (p) { const d=JSON.parse(p); if(d.expenses)setExpenses(d.expenses); if(d.savings)setSavings(d.savings); if(d.variable)setVariable(d.variable) }
      const sb = localStorage.getItem('av_salary_breakdown')
      if (sb) setSalBreakdown(JSON.parse(sb))
      const cc = localStorage.getItem('av_credit_cards')
      if (cc) setCreditCards(JSON.parse(cc))
      const sd = localStorage.getItem('av_suggestion_decisions')
      if (sd) setSuggestionDecisions(JSON.parse(sd))
      const cd = localStorage.getItem('av_confirmed_detections')
      if (cd) setConfirmedDetections(JSON.parse(cd))
      const mo = localStorage.getItem('av_manual_overrides')
      if (mo) setManualOverrides(JSON.parse(mo))
      const csids = localStorage.getItem('av_confirmed_salary_ids')
      if (csids) setConfirmedSalaryIds(new Set(JSON.parse(csids)))
      const pids = localStorage.getItem('av_parked_ids')
      if (pids) setParkedIds(new Set(JSON.parse(pids)))
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

  // Merge all bank accounts into one tagged transaction pool
  function rebuildMergedTransactions(accounts: BankAccount[]) {
    if (accounts.length === 0) {
      setTaggedTxns([]); setBankPeriod(null); setBankMonths(1)
      return
    }
    // Pool all transactions, tagging each with its source account
    const allTxns: any[] = []
    accounts.forEach(acc => {
      const txns = acc.data?.transactions || []
      txns.forEach((t: any) => {
        allTxns.push({ ...t, sourceAccount: { id: acc.id, bank: acc.bank, last4: acc.last4, label: acc.label } })
      })
    })
    const tagged = tagTransactions(allTxns, creditCards)
    setTaggedTxns(tagged)
    const { months, from, to } = detectMonths(tagged)
    setBankMonths(months)
    setBankPeriod({ from, to })
    const candidates = detectSalaryCandidates(tagged)
    if (candidates.length > 0 && tickedSalary.size === 0) {
      setTickedSalary(new Set(candidates[0].transactions.map((t:any) => t.id)))
    }
  }

  // Load accounts from localStorage on mount (with migration from old av_bank)
  function loadSavedBankAccounts() {
    try {
      // Migration: if old av_bank exists, convert to av_banks
      const oldBank = localStorage.getItem('av_bank')
      const newBanks = localStorage.getItem('av_banks')
      if (oldBank && !newBanks) {
        const bd = JSON.parse(oldBank)
        const migrated: BankAccount = {
          id: uid(),
          bank: bd.bank || 'Bank',
          last4: bd.accountNumber?.slice(-4) || '',
          label: '',
          data: bd,
          txnCount: bd.transactions?.length || 0,
          period: detectMonths(bd.transactions || []),
        }
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

  // Sync salary breakdown to AppStore.salary (for downstream consumers)
  useEffect(() => {
    if (salBreakdown.netSalary > 0) {
      const gross = salBreakdown.netSalary + salBreakdown.employeePF + salBreakdown.employerPF + salBreakdown.bonus + salBreakdown.otherBenefits
      setSalary({
        netSalary: salBreakdown.netSalary,
        grossSalary: gross,
        employerName: salBreakdown.employerName || 'Your employer',
        employeePF: salBreakdown.employeePF,
        employerPF: salBreakdown.employerPF,
      } as any)
      try { localStorage.setItem('av_salary_breakdown', JSON.stringify(salBreakdown)) } catch {}
    }
  }, [salBreakdown])

  // Save credit cards
  useEffect(() => {
    try { localStorage.setItem('av_credit_cards', JSON.stringify(creditCards)) } catch {}
  }, [creditCards])

  // Save suggestion decisions
  useEffect(() => {
    try { localStorage.setItem('av_suggestion_decisions', JSON.stringify(suggestionDecisions)) } catch {}
  }, [suggestionDecisions])

  // Save Smart Review state so it persists across navigation and reload
  useEffect(() => {
    try { localStorage.setItem('av_confirmed_detections', JSON.stringify(confirmedDetections)) } catch {}
  }, [confirmedDetections])
  useEffect(() => {
    try { localStorage.setItem('av_manual_overrides', JSON.stringify(manualOverrides)) } catch {}
  }, [manualOverrides])
  useEffect(() => {
    try { localStorage.setItem('av_confirmed_salary_ids', JSON.stringify(Array.from(confirmedSalaryIds))) } catch {}
  }, [confirmedSalaryIds])
  useEffect(() => {
    try { localStorage.setItem('av_parked_ids', JSON.stringify(Array.from(parkedIds))) } catch {}
  }, [parkedIds])

  // Re-tag transactions when credit cards change
  useEffect(() => {
    if (bankAccounts.length > 0) {
      rebuildMergedTransactions(bankAccounts)
    }
  }, [creditCards.length])

  const saveProfile = useCallback((exp=expenses, sav=savings, vari=variable) => {
    try { localStorage.setItem('av_profile', JSON.stringify({ expenses:exp, savings:sav, variable:vari })) } catch {}
  }, [expenses, savings, variable])

  const updExp = (id:string, amount:number) => { const u=expenses.map(e=>e.id===id?{...e,amount}:e); setExpenses(u); saveProfile(u,savings,variable) }
  const updSav = (id:string, amount:number) => { const u=savings.map(s=>s.id===id?{...s,amount}:s); setSavings(u); saveProfile(expenses,u,variable) }
  const updVar = (id:string, amount:number) => { const u=variable.map(v=>v.id===id?{...v,amount}:v); setVariable(u); saveProfile(expenses,savings,u) }
  const addExp = () => { const u=[...expenses,{id:uid(),label:'Custom expense',amount:0,icon:'💸'}]; setExpenses(u); saveProfile(u,savings,variable) }
  const addVar = () => { const u=[...variable,{id:uid(),label:'Other',amount:0,icon:'📦'}]; setVariable(u); saveProfile(expenses,savings,u) }
  const addSav = () => { const u=[...savings,{id:uid(),label:'New goal',amount:0,icon:'🎯'}]; setSavings(u); saveProfile(expenses,u,variable) }

  useEffect(() => {
    if (!aisData) return
    const sel=new Set<string>(); const vals:Record<string,number>={}
    if((aisData as any).dividendIncome>0){sel.add('dividend');vals['dividend']=Math.round((aisData as any).dividendIncome)}
    if((aisData as any).totalInterestIncome>0){sel.add('fd');vals['fd']=Math.round((aisData as any).totalInterestIncome)}
    if((aisData as any).totalCapitalGains>0){sel.add('ltcg');vals['ltcg']=Math.round((aisData as any).totalCapitalGains)}
    if(sel.size>0){setOtherSel(sel);setOtherVals(vals)}
  }, [aisData])

  const grossMonthly = salBreakdown.netSalary + salBreakdown.employeePF + salBreakdown.employerPF + salBreakdown.bonus + salBreakdown.otherBenefits
  const annualCTC = grossMonthly * 12

  const salMonthly = salBreakdown.netSalary
  const otherAnnual = Array.from(otherSel).reduce((s,k)=>s+(otherVals[k]||0),0)
  const totalExp = expenses.reduce((s,e)=>s+e.amount,0)
  const totalSav = savings.reduce((s,sv)=>s+sv.amount,0)
  const totalVar = variable.reduce((s,v)=>s+v.amount,0)
  const trulyFree = Math.max(0, salMonthly-totalExp-totalVar-totalSav)
  let health=100
  if(totalSav/(salMonthly||1)<0.1)health-=25; else if(totalSav/(salMonthly||1)<0.2)health-=10
  if((totalExp+totalVar)/(salMonthly||1)>0.7)health-=20; else if((totalExp+totalVar)/(salMonthly||1)>0.6)health-=10
  if(trulyFree<0)health-=30
  health=Math.max(0,Math.min(100,health))

  const pnl = useMemo(() => taggedTxns.length ? computePnL(taggedTxns, bankMonths, confirmedDetections, manualOverrides, confirmedSalaryIds, parkedIds) : null,
    [taggedTxns, bankMonths, confirmedDetections, manualOverrides, confirmedSalaryIds, parkedIds])

  const allCredits = useMemo(() => taggedTxns.filter(t => t.type === 'credit').sort((a,b) => b.amount - a.amount), [taggedTxns])
  const largeCredits = useMemo(() => allCredits.filter(t => t.amount >= 5000), [allCredits])
  const salaryCandidates = useMemo(() => detectSalaryCandidates(taggedTxns), [taggedTxns])

  const roundtripPairs = useMemo(() => {
    const credits = taggedTxns.filter(t => t.type === 'credit')
    const debits = taggedTxns.filter(t => t.type === 'debit')
    const pairs: Array<{ id:string; credit:any; debit:any; amount:number }> = []
    const usedC = new Set<string>(), usedD = new Set<string>()
    debits.forEach(d => {
      if (usedD.has(d.id)) return
      const match = credits.find(c => !usedC.has(c.id) && Math.abs(c.amount - d.amount) < 1)
      if (match) {
        pairs.push({ id: `${match.id}_${d.id}`, credit: match, debit: d, amount: d.amount })
        usedC.add(match.id); usedD.add(d.id)
      }
    })
    return pairs
  }, [taggedTxns])

  const interestTxns = useMemo(() => taggedTxns.filter(t => t.mega === 'interest' && t.type === 'credit'), [taggedTxns])

  // Generate suggestions for Expenses tab — apply manual overrides so reassigned txns move cards
  const overriddenTxns = useMemo(() =>
    taggedTxns.map(t => manualOverrides[t.id] ? { ...t, mega: manualOverrides[t.id] } : t),
    [taggedTxns, manualOverrides])
  const suggestions = useMemo(() => generateExpenseSuggestions(overriddenTxns, bankMonths, confirmedSalaryIds, parkedIds), [overriddenTxns, bankMonths, confirmedSalaryIds, parkedIds])

  // Transactions grouped per-suggestion (sugg.id → list of txns), respects overrides + exclusions
  const suggestionTxns = useMemo(() => {
    const map: Record<string, any[]> = {}
    overriddenTxns.forEach(t => {
      if (t.type !== 'debit') return
      if (confirmedSalaryIds.has(t.id) || parkedIds.has(t.id)) return
      const sid = `sugg_${t.mega}`
      if (!map[sid]) map[sid] = []
      map[sid].push(t)
    })
    Object.values(map).forEach(arr => arr.sort((a,b) => b.amount - a.amount))
    return map
  }, [overriddenTxns, confirmedSalaryIds, parkedIds])

  // Live ticked-amount per suggestion (only counts ticked txns)
  const suggLiveMonthly = (suggId: string, fallback: number): number => {
    const txns = suggestionTxns[suggId]
    if (!txns) return fallback
    const unticked = suggUnticked[suggId] || new Set<string>()
    const total = txns.reduce((s,t) => unticked.has(t.id) ? s : s + t.amount, 0)
    return Math.round(total / Math.max(1, bankMonths))
  }

  useEffect(() => {
    if (interestTxns.length > 0 && tickedInterest.size === 0) setTickedInterest(new Set(interestTxns.map(t => t.id)))
  }, [interestTxns.length])

  useEffect(() => {
    if (roundtripPairs.length > 0 && tickedRoundtrip.size === 0) setTickedRoundtrip(new Set(roundtripPairs.map(p => p.id)))
  }, [roundtripPairs.length])

  const handleBankFile = async (file:File, password='') => {
    if (file.size > 15*1024*1024) { toast.error('File too large (max 15MB)'); return }
    setLoadingDoc('bank'); setPwdModal({ open:false, type:null, file:null, error:'' })
    const tid = toast.loading('Reading your bank statement…')
    try {
      const form = new FormData()
      form.append('file', file)
      if (password) form.append('password', password)
      const res = await fetch('/api/parse-bank-statement', { method:'POST', body:form })
      const text = await res.text()
      let json:any
      try { json = JSON.parse(text) } catch { json = { error: 'corrupt_file', message: text } }
      const errCode = json.error
      if (!res.ok || errCode) {
        toast.dismiss(tid)
        if (errCode==='incorrect_password' || res.status===422) {
          setPwdModal({ open:true, type:'bank', file, error: password ? 'Incorrect password. Try again.' : '' })
          setPwd(''); return
        }
        if (errCode==='aes_pdf_unsupported') { toast.error('This PDF is AES-encrypted. Try downloading as Excel from your bank app.', { duration:6000 }); return }
        toast.error(json.message || json.error || 'Failed to parse statement'); return
      }
      const bd = json.data
      const period = detectMonths(bd.transactions || [])
      const accId = uploadingAccountId || uid()
      const newAccount: BankAccount = {
        id: accId,
        bank: bd.bank || 'Bank',
        last4: bd.accountNumber?.slice(-4) || '',
        label: '',
        data: bd,
        txnCount: bd.transactions?.length || 0,
        period,
      }
      // If re-uploading an existing account, replace it; otherwise add
      const updated = uploadingAccountId
        ? bankAccounts.map(a => a.id === uploadingAccountId ? newAccount : a)
        : [...bankAccounts, newAccount]
      setBankAccounts(updated)
      try { localStorage.setItem('av_banks', JSON.stringify(updated)) } catch {}
      rebuildMergedTransactions(updated)
      setUploadingAccountId(null)
      toast.success(`${bd.bank || 'Bank'} · ${bd.transactions?.length||0} transactions across ${period.months} month${period.months>1?'s':''}`, { id:tid, duration:5000 })
      setMainTab('income'); setIncTab('review')
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
      setTickedSalary(new Set()); setTickedRoundtrip(new Set()); setTickedInterest(new Set())
      setConfirmedSalaryIds(new Set()); setParkedIds(new Set())
      setSuggestionDecisions({}); setSuggUnticked({}); setSuggExpanded({}); setSuggShowAll({})
      try {
        localStorage.removeItem('av_banks')
        localStorage.removeItem('av_confirmed_detections')
        localStorage.removeItem('av_manual_overrides')
        localStorage.removeItem('av_confirmed_salary_ids')
        localStorage.removeItem('av_parked_ids')
        localStorage.removeItem('av_suggestion_decisions')
      } catch {}
    } else {
      rebuildMergedTransactions(updated)
    }
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
      // Auto-fill the breakdown from slip data
      const slip = json.data
      const empPF = slip.deductions?.find?.((d:any) => /pf|provident/i.test(d.name||''))?.amount || 0
      const newBreakdown: SalaryBreakdown = {
        netSalary: slip.netSalary || slip.netPay || 0,
        employeePF: empPF,
        employerPF: empPF,  // typically equal — user can edit
        bonus: 0,
        otherBenefits: 0,
        employerName: slip.employerName || 'Your employer',
      }
      setSalBreakdown(newBreakdown)
      // Auto-fill ELSS field with employee PF (it goes to 80C)
      if (empPF > 0) {
        const newSav = savings.map(sv => sv.label.includes('ELSS') ? { ...sv, amount: empPF } : sv)
        setSavings(newSav); saveProfile(expenses, newSav, variable)
      }
      toast.success(`Slip parsed! Net ₹${(newBreakdown.netSalary).toLocaleString('en-IN')} + PF ₹${empPF.toLocaleString('en-IN')} → 80C`, { id:tid, duration:5000 })
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
      const estPF = Math.round(monthlyCTC * 0.12)  // approx 12% basic
      const estNet = Math.round(monthlyCTC * 0.75)  // rough net after deductions
      setSalBreakdown({
        netSalary: estNet,
        employeePF: estPF,
        employerPF: estPF,
        bonus: 0,
        otherBenefits: 0,
        employerName: data.employerName || 'Your employer',
      })
      toast.success('Offer letter parsed — review breakdown', { id:tid })
    } catch (e:any) { toast.error(e.message, { id:tid }) }
    finally { setLoadingDoc(null) }
  }

  const submitPassword = () => {
    if (!pwdModal.file || !pwdModal.type) return
    if (pwdModal.type==='bank') handleBankFile(pwdModal.file, pwd)
    else processAIS(pwdModal.file, pwdModal.type, pwd)
  }

  // Smart Review actions
  const useTickedAsSalary = () => {
    if (tickedSalary.size === 0) { toast.error('Tick at least one credit'); return }
    const txns = taggedTxns.filter(t => tickedSalary.has(t.id))
    const total = txns.reduce((s,t) => s + t.amount, 0)
    const monthly = Math.round(total / bankMonths)
    setConfirmedSalaryIds(new Set(tickedSalary))
    setSalBreakdown(prev => ({ ...prev, netSalary: monthly, employerName: txns[0]?.brand || (txns[0]?.description || '').split('/')[0].substring(0,30) || prev.employerName || 'Detected' }))
    toast.success(`Net salary set to ${fmt(monthly)}/month`)
    setSalCardOpen(false)
  }

  const noneIsSalary = () => { setConfirmedSalaryIds(new Set()); setTickedSalary(new Set()); toast('Park salary detection — set manually in Salary tab'); setSalCardOpen(false) }
  const parkSalaryReview = () => { setConfirmedSalaryIds(new Set()); toast('Salary parked for later'); setSalCardOpen(false) }
  const netOffTickedRoundtrips = () => {
    if (tickedRoundtrip.size === 0) { toast.error('Tick at least one pair'); return }
    setConfirmedDetections(p => ({ ...p, roundtrip: true }))
    toast.success(`${tickedRoundtrip.size} pair${tickedRoundtrip.size>1?'s':''} netted off`)
    setRtCardOpen(false)
  }
  const sendUntickedRtToMisc = () => {
    const untickedPairs = roundtripPairs.filter(p => !tickedRoundtrip.has(p.id))
    if (untickedPairs.length === 0) { toast('No unticked pairs'); return }
    const overrides = { ...manualOverrides }
    untickedPairs.forEach(p => { overrides[p.credit.id] = 'misc'; overrides[p.debit.id] = 'misc' })
    setManualOverrides(overrides)
    toast.success(`${untickedPairs.length} pairs sent to Miscellaneous`)
  }
  const routeTickedToOtherIncome = () => {
    if (tickedInterest.size === 0) { toast.error('Tick at least one'); return }
    const txns = taggedTxns.filter(t => tickedInterest.has(t.id))
    const total = txns.reduce((s,t) => s + t.amount, 0)
    const annual = Math.round(total * (12 / bankMonths))
    setConfirmedDetections(p => ({ ...p, interest: true }))
    const newSel = new Set(otherSel); newSel.add('fd'); setOtherSel(newSel)
    setOtherVals(p => ({ ...p, fd: annual }))
    toast.success(`${fmt(annual)} → Other Income (annual)`)
    setIntCardOpen(false)
  }
  const parkInterestReview = () => { toast('Interest parked for later'); setIntCardOpen(false) }

  const reassignSingle = (newMega: MegaCategory) => {
    if (!singleCategoryModal.transaction) return
    const t = singleCategoryModal.transaction
    const fromCtx = singleCategoryModal.from
    const fromMega = singleCategoryModal.fromMega
    setManualOverrides(prev => ({ ...prev, [t.id]: newMega }))
    // Save to memory
    const memory = loadMerchantMemory()
    memory[extractMerchantKey(t.description)] = newMega
    saveMerchantMemory(memory)
    setSingleCategoryModal({ open:false, transaction:null })

    // If reassign came from Apply to Expenses, also drop the txn from its source ticked-set
    // and incrementally adjust applied amounts on accepted source/destination cards.
    if (fromCtx === 'apply-expenses') {
      const marginal = Math.round(t.amount / Math.max(1, bankMonths))
      const destSugg = `sugg_${newMega}`
      const srcSugg  = fromMega ? `sugg_${fromMega}` : null

      // Remove from source's unticked set (no longer in source) so live total stays clean
      if (srcSugg) {
        setSuggUnticked(prev => {
          if (!prev[srcSugg]) return prev
          const n = new Set(prev[srcSugg]); n.delete(t.id)
          return { ...prev, [srcSugg]: n }
        })
      }

      // If the destination card was already accepted, top up its target field by the marginal
      if (suggestionDecisions[destSugg] === 'accepted' && marginal > 0) {
        const fieldMap: Record<string, { target:'fixed'|'variable'|'savings'|'tax_save'|'cc'; label:string }> = {
          food:{target:'variable',label:'Dining out / Takeaway'},
          shopping:{target:'variable',label:'Shopping / Clothing'},
          transport:{target:'variable',label:'Fuel / Transport'},
          entertainment:{target:'variable',label:'Entertainment / OTT'},
          healthcare:{target:'variable',label:'Medicine / Healthcare'},
          utilities:{target:'fixed',label:'Electricity / Gas'},
          housing:{target:'fixed',label:'Rent / Home loan EMI'},
          insurance:{target:'fixed',label:'Life Insurance'},
          investments_elss:{target:'tax_save',label:'ELSS — tax saving (80C)'},
          investments_regular:{target:'savings',label:'SIP / Mutual Funds (regular)'},
          cc_payment:{target:'cc',label:'Credit card bill'},
        }
        const fm = fieldMap[newMega]
        if (fm) {
          if (fm.target === 'fixed' || fm.target === 'cc') {
            const targetLabel = fm.target === 'cc' ? 'Credit card bill' : fm.label
            const newExp = expenses.map(e => e.label === targetLabel ? { ...e, amount: e.amount + marginal } : e)
            setExpenses(newExp); saveProfile(newExp, savings, variable)
          } else if (fm.target === 'variable') {
            const newVar = variable.map(v => v.label === fm.label ? { ...v, amount: v.amount + marginal } : v)
            setVariable(newVar); saveProfile(expenses, savings, newVar)
          } else if (fm.target === 'savings') {
            const newSav = savings.map(s => (s.label.includes('regular') || s.label.startsWith('SIP')) ? { ...s, amount: s.amount + marginal } : s)
            setSavings(newSav); saveProfile(expenses, newSav, variable)
          } else if (fm.target === 'tax_save') {
            const newSav = savings.map(s => s.label.includes('ELSS') ? { ...s, amount: s.amount + marginal } : s)
            setSavings(newSav); saveProfile(expenses, newSav, variable)
          }
          toast.success(`Moved to ${MEGA_CATEGORIES[newMega].label} · ${fmt(marginal)}/mo added to ${fm.label}`)
          return
        }
      }
    }

    toast.success(`Moved to ${MEGA_CATEGORIES[newMega].label} · remembered for next time`)
  }

  const reassignBulk = (newMega: MegaCategory) => {
    const overrides = { ...manualOverrides }
    bulkCategoryModal.transactions.forEach(t => { overrides[t.id] = newMega })
    setManualOverrides(overrides)
    // Save all to memory
    const memory = loadMerchantMemory()
    bulkCategoryModal.transactions.forEach(t => { memory[extractMerchantKey(t.description)] = newMega })
    saveMerchantMemory(memory)
    setBulkCategoryModal({ open:false, transactions:[], label:'' })
    toast.success(`${bulkCategoryModal.transactions.length} transactions moved · remembered for next time`)
  }

  // Suggestion actions ─────────────────────────────────────────────────
  const acceptSuggestion = (sugg: ExpenseSuggestion) => {
    const monthly = suggLiveMonthly(sugg.id, sugg.monthlyAmount)
    if (monthly <= 0) { toast.error('Tick at least one transaction'); return }
    if (sugg.targetField === 'fixed') {
      const newExp = expenses.map(e => e.label === sugg.targetLabel ? { ...e, amount: e.amount + monthly } : e)
      // If the target label doesn't exist, append
      if (!expenses.some(e => e.label === sugg.targetLabel)) newExp.push({ id:uid(), label:sugg.targetLabel, amount:monthly, icon:sugg.icon })
      setExpenses(newExp); saveProfile(newExp, savings, variable)
    } else if (sugg.targetField === 'variable') {
      const newVar = variable.map(v => v.label === sugg.targetLabel ? { ...v, amount: v.amount + monthly } : v)
      if (!variable.some(v => v.label === sugg.targetLabel)) newVar.push({ id:uid(), label:sugg.targetLabel, amount:monthly, icon:sugg.icon })
      setVariable(newVar); saveProfile(expenses, savings, newVar)
    } else if (sugg.targetField === 'savings') {
      const newSav = savings.map(s => s.label.includes('regular') || s.label.startsWith('SIP') ? { ...s, amount: s.amount + monthly } : s)
      setSavings(newSav); saveProfile(expenses, newSav, variable)
    } else if (sugg.targetField === 'tax_save') {
      const newSav = savings.map(s => s.label.includes('ELSS') ? { ...s, amount: s.amount + monthly } : s)
      setSavings(newSav); saveProfile(expenses, newSav, variable)
    } else if (sugg.targetField === 'cc') {
      const newExp = expenses.map(e => e.label === 'Credit card bill' ? { ...e, amount: e.amount + monthly } : e)
      setExpenses(newExp); saveProfile(newExp, savings, variable)
    }
    setSuggestionDecisions(prev => ({ ...prev, [sugg.id]: 'accepted' }))
    // Save to memory for all merchants in this group
    const memory = loadMerchantMemory()
    sugg.brands.forEach(brand => { memory[brand.toUpperCase()] = sugg.mega })
    saveMerchantMemory(memory)
    toast.success(`${fmt(monthly)} added to ${sugg.targetLabel} · remembered`)
  }

  const rejectSuggestion = (sugg: ExpenseSuggestion) => {
    setSuggestionDecisions(prev => ({ ...prev, [sugg.id]: 'rejected' }))
    toast(`Skipped — won't ask again unless you re-upload`)
  }

  const parkSuggestion = (sugg: ExpenseSuggestion) => {
    setSuggestionDecisions(prev => ({ ...prev, [sugg.id]: 'parked' }))
    toast('Parked — will ask next time')
  }

  // Special: split investments into ELSS + regular
  const splitInvestment = (sugg: ExpenseSuggestion, elssMonthly: number, regMonthly: number) => {
    if (elssMonthly > 0) {
      const newSav = savings.map(s => s.label.includes('ELSS') ? { ...s, amount: s.amount + elssMonthly } : s)
      if (regMonthly > 0) {
        const updated = newSav.map(s => (s.label.includes('regular') || s.label === 'SIP / Mutual Funds (regular)') ? { ...s, amount: s.amount + regMonthly } : s)
        setSavings(updated); saveProfile(expenses, updated, variable)
      } else {
        setSavings(newSav); saveProfile(expenses, newSav, variable)
      }
    } else if (regMonthly > 0) {
      const newSav = savings.map(s => (s.label.includes('regular') || s.label === 'SIP / Mutual Funds (regular)') ? { ...s, amount: s.amount + regMonthly } : s)
      setSavings(newSav); saveProfile(expenses, newSav, variable)
    }
    setSuggestionDecisions(prev => ({ ...prev, [sugg.id]: 'accepted' }))
    toast.success(`Split: ELSS ${fmt(elssMonthly)} · Regular ${fmt(regMonthly)}`)
  }

  // Credit card actions
  const addCreditCard = () => {
    if (!newCardBank || !newCardLast4 || newCardLast4.length !== 4) {
      toast.error('Pick a bank and enter exactly 4 digits')
      return
    }
    setCreditCards(prev => [...prev, { id: uid(), bank: newCardBank, last4: newCardLast4 }])
    setNewCardBank(''); setNewCardLast4('')
    toast.success(`${newCardBank} card ****${newCardLast4} added`)
  }

  const removeCreditCard = (id: string) => {
    setCreditCards(prev => prev.filter(c => c.id !== id))
  }

  const toggleSalaryTick = (id:string) => setTickedSalary(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleInterestTick = (id:string) => setTickedInterest(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleRoundtripTick = (id:string) => setTickedRoundtrip(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const tickedSalaryAmount = useMemo(() => taggedTxns.filter(t => tickedSalary.has(t.id)).reduce((s,t)=>s+t.amount,0), [taggedTxns, tickedSalary])
  const tickedInterestAmount = useMemo(() => taggedTxns.filter(t => tickedInterest.has(t.id)).reduce((s,t)=>s+t.amount,0), [taggedTxns, tickedInterest])
  const tickedRoundtripAmount = useMemo(() => roundtripPairs.filter(p => tickedRoundtrip.has(p.id)).reduce((s,p)=>s+p.amount,0), [roundtripPairs, tickedRoundtrip])

  const pendingSuggestionCount = suggestions.filter(s => !suggestionDecisions[s.id] || suggestionDecisions[s.id] === 'parked').length

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap'); .av-row:last-child{border-bottom:none!important}`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>My Profile</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Your complete financial picture</p>
      </div>

      <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:20, gap:0, overflowX:'auto' as const }}>
        {([
          { key:'docs', label:'📁 Documents' },
          { key:'income', label:'💰 Income' },
          { key:'expenses', label:'📤 Expenses & Savings' },
          { key:'pnl', label:'📊 P&L + Cash Flow' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)} style={S.maintab(mainTab===t.key)}>{t.label}</button>
        ))}
      </div>

      {/* DOCUMENTS TAB */}
      {mainTab==='docs' && (
        <div>
          <p style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8 }}>Step 1 — Bank statements</p>

          {/* Existing bank accounts list */}
          {bankAccounts.map((acc, idx) => (
            <div key={acc.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:10, display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:'#EEF2EE', border:`2px solid ${C.fg}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🏦</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:C.fg, margin:0 }}>✓ {acc.bank}{acc.last4 ? ` · ****${acc.last4}` : ''}</p>
                </div>
                <input
                  type="text"
                  value={acc.label}
                  onChange={e => updateAccountLabel(acc.id, e.target.value)}
                  placeholder="e.g. Rohit's salary"
                  style={{ padding:'3px 0', border:'none', borderBottom:`1px dashed ${C.border}`, fontSize:11.5, color:acc.label ? C.text : C.muted, fontFamily:'inherit', outline:'none', width:'100%', background:'transparent', fontStyle:acc.label?'normal':'italic' }}
                />
                <p style={{ fontSize:10.5, color:C.muted, margin:'4px 0 0' }}>{acc.txnCount} txns · {acc.period.months} month{acc.period.months>1?'s':''} · {acc.period.from} to {acc.period.to}</p>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={() => { setUploadingAccountId(acc.id); bankRef.current?.click() }} style={{ padding:'5px 10px', fontSize:10.5, color:C.fg, background:C.wl, border:`1px solid ${C.wm}`, borderRadius:4, cursor:'pointer', fontFamily:'inherit' }}>Re-upload</button>
                <button onClick={() => removeAccount(acc.id)} style={{ padding:'5px 10px', fontSize:10.5, color:C.danger, background:'#FBF0F0', border:`1px solid #F0CECE`, borderRadius:4, cursor:'pointer', fontFamily:'inherit' }}>Remove</button>
              </div>
            </div>
          ))}

          {/* Add another account button */}
          <div
            onClick={() => { setUploadingAccountId(null); bankRef.current?.click() }}
            style={{ background:C.card, border:`1.5px dashed ${C.border}`, borderRadius:8, padding:16, marginBottom:14, display:'flex', gap:14, alignItems:'center', cursor:loadingDoc==='bank'?'wait':'pointer' }}
          >
            <div style={{ width:42, height:42, borderRadius:'50%', background:C.wl, border:`2px solid ${C.wm}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
              {bankAccounts.length === 0 ? '🏦' : '＋'}
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:'0 0 3px' }}>
                {loadingDoc==='bank' ? 'Reading…' : bankAccounts.length === 0 ? 'Upload Bank Statement' : 'Add another bank account'}
              </p>
              <p style={{ fontSize:11, color:C.muted, margin:0 }}>
                {bankAccounts.length === 0
                  ? 'Any Indian bank · PDF, Excel, CSV or photo · password supported'
                  : 'Salary account, expense account, spouse\'s account, etc.'}
              </p>
            </div>
          </div>
          <input ref={bankRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleBankFile(e.target.files[0])} />

          {bankAccounts.length > 0 && bankPeriod && (
            <div style={{ ...S.insight, marginBottom:14 }}>
              📅 Merged period: {bankPeriod.from} to {bankPeriod.to} · {bankMonths} month{bankMonths>1?'s':''} · {taggedTxns.length} total transactions across {bankAccounts.length} account{bankAccounts.length>1?'s':''}
            </div>
          )}

          <p style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8 }}>Step 2 — Credit cards (helps track payments)</p>
          <div style={S.card}>
            <div style={S.cardHead}>Your credit cards</div>
            {creditCards.length === 0 ? (
              <div style={{ ...S.row, fontSize:12, color:C.muted, fontStyle:'italic' as const }}>
                <span>No cards added · adding one helps identify which UPI debits are credit card bill payments</span>
              </div>
            ) : (
              creditCards.map(card => (
                <div key={card.id} style={{ ...S.row, gap:8 }}>
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>💳</span>
                    <span><strong>{card.bank}</strong> · ending <strong style={{ fontFamily:'monospace', color:C.fg }}>{card.last4}</strong></span>
                  </span>
                  <button onClick={() => removeCreditCard(card.id)} style={{ fontSize:11, color:C.danger, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>Remove</button>
                </div>
              ))
            )}
            <div style={{ padding:'10px 14px', background:'#FAFAF8', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' as const }}>
              <select value={newCardBank} onChange={e=>setNewCardBank(e.target.value)} style={{ padding:'6px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:12, fontFamily:'inherit', flex:1, minWidth:140 }}>
                <option value="">Pick bank...</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input type="text" inputMode="numeric" maxLength={4} placeholder="Last 4 digits"
                value={newCardLast4}
                onChange={e => setNewCardLast4(e.target.value.replace(/[^0-9]/g,''))}
                style={{ padding:'6px 10px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:12, fontFamily:'monospace', width:110, outline:'none' }} />
              <button onClick={addCreditCard} disabled={!newCardBank || newCardLast4.length !== 4} style={{ padding:'6px 14px', background:newCardBank&&newCardLast4.length===4 ? C.fg : '#ccc', color:C.wheat, border:'none', borderRadius:4, fontSize:11.5, fontWeight:600, cursor:newCardBank&&newCardLast4.length===4?'pointer':'not-allowed', fontFamily:'inherit' }}>+ Add card</button>
            </div>
          </div>

          <p style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8, marginTop:6 }}>Step 3 — Tax documents (optional)</p>
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
                  {!loadingDoc && <div style={{ padding:'5px 14px', background:C.fg, color:C.wheat, borderRadius:4, fontSize:11, fontWeight:600 }}>Upload AIS</div>}
                </>
              )}
              <input ref={aisRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleAISFile(e.target.files[0],'ais')} />
            </div>
            <div style={S.upload(false)} onClick={() => !loadingDoc&&taxRef.current?.click()}>
              <span style={{ fontSize:24 }}>📋</span>
              <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>Form 26AS</p>
              <p style={{ fontSize:10.5, color:C.muted, margin:0, lineHeight:1.5 }}>Tax credit statement · no password</p>
              {!loadingDoc && <div style={{ padding:'5px 14px', background:'#fff', color:C.text, border:`1px solid ${C.border}`, borderRadius:4, fontSize:11 }}>Upload</div>}
              <input ref={taxRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleAISFile(e.target.files[0],'26as')} />
            </div>
          </div>

          {bankAccounts.length > 0 && (
            <button onClick={() => { setMainTab('income'); setIncTab('review') }} style={{ ...S.btn(true), width:'100%', padding:'11px' }}>
              Next: Smart Review →
            </button>
          )}
        </div>
      )}

      {/* INCOME TAB */}
      {mainTab==='income' && (
        <div>
          <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:18, gap:0, overflowX:'auto' as const }}>
            <button onClick={() => setIncTab('review')} style={S.stab(incTab==='review')}>🔍 Smart Review</button>
            <button onClick={() => setIncTab('salary')} style={S.stab(incTab==='salary')}>📄 Salary</button>
            <button onClick={() => setIncTab('other')} style={S.stab(incTab==='other')}>🏦 Other Income</button>
            {bankAccounts.length > 0 && (
              <button onClick={() => setIncTab('suggestions')} style={S.stab(incTab==='suggestions')}>
                💡 Apply to Expenses {pendingSuggestionCount > 0 && <span style={{ marginLeft:4, fontSize:10, background:C.fg, color:C.wheat, padding:'1px 6px', borderRadius:10 }}>{pendingSuggestionCount}</span>}
              </button>
            )}
          </div>

          {incTab==='review' && (
            <div>
              {!bankAccounts.length > 0 ? (
                <div style={S.insight}>Upload your bank statement in the Documents tab to see smart insights here.</div>
              ) : (
                <>
                  <div style={{ background:'#1E293B', borderRadius:8, padding:'12px 16px', marginBottom:14 }}>
                    <p style={{ fontSize:10, color:'rgba(230,207,167,0.5)', letterSpacing:'0.08em', margin:'0 0 6px' }}>SMART REVIEW · {bankPeriod?.from} → {bankPeriod?.to} · {bankMonths} month{bankMonths>1?'s':''}</p>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', margin:0, lineHeight:1.6 }}>
                      Confirm what's salary, what's a round-trip, and what's interest. Then go to "Apply to Expenses" tab to fill the rest.
                    </p>
                  </div>

                  {/* SALARY DETECTION */}
                  <div style={{ ...S.card, border:`2px solid ${confirmedSalaryIds.size>0 ? '#2A7A4A' : '#EDD898'}` }}>
                    <div style={{ padding:'11px 14px', background:confirmedSalaryIds.size>0?'#EEF2EE':'#FBF6EE', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:confirmedSalaryIds.size>0?'#2A7A4A':'#8A6A1A', display:'flex', alignItems:'center', gap:6 }}>
                        💰 {confirmedSalaryIds.size > 0 ? `Salary confirmed: ${fmt(salBreakdown.netSalary)}/mo` : 'Salary candidates — pick which credits are your salary'}
                      </span>
                      <button onClick={() => setSalCardOpen(!salCardOpen)} style={{ width:22, height:22, borderRadius:4, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:13, color:C.fg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600 }}>{salCardOpen?'−':'+'}</button>
                    </div>
                    {salCardOpen && (
                      <>
                        {salaryCandidates.length === 0 && (
                          <div style={{ ...S.row, fontSize:12, color:C.muted, fontStyle:'italic' as const }}>
                            <span>No clear pattern detected. Browse all credits below to pick yours.</span>
                          </div>
                        )}
                        {salaryCandidates.flatMap(c => c.transactions).map(t => {
                          const ticked = tickedSalary.has(t.id)
                          return (
                            <div key={t.id} style={{ display:'grid', gridTemplateColumns:'24px 75px 1fr 90px 28px', padding:'7px 14px', borderBottom:`0.5px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center', background: ticked ? '#F4F9F3' : '#fff' }}>
                              <input type="checkbox" checked={ticked} onChange={() => toggleSalaryTick(t.id)} style={{ width:14, height:14, cursor:'pointer', accentColor:C.fg }} />
                              <span style={{ color:C.muted }}>{t.date}</span>
                              <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                              <span style={{ color:'#2A7A4A', fontWeight:600, textAlign:'right' as const }}>+{fmt(t.amount)}</span>
                              <button onClick={() => setSingleCategoryModal({ open:true, transaction:t })} title="Reassign" style={{ width:22, height:22, borderRadius:3, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                            </div>
                          )
                        })}
                        {!salShowAllCredits && largeCredits.length > salaryCandidates.flatMap(c=>c.transactions).length && (
                          <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`0.5px solid #FAF7F2`, textAlign:'center' as const }}>
                            <button onClick={() => setSalShowAllCredits(true)} style={{ padding:'5px 14px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:4, fontSize:11.5, color:C.fg, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
                              + Show all other credits ({largeCredits.length - salaryCandidates.flatMap(c=>c.transactions).length} more, ≥₹5,000)
                            </button>
                          </div>
                        )}
                        {salShowAllCredits && largeCredits.filter(t => !salaryCandidates.flatMap(c=>c.transactions).find(st => st.id === t.id)).map(t => {
                          const ticked = tickedSalary.has(t.id)
                          return (
                            <div key={t.id} style={{ display:'grid', gridTemplateColumns:'24px 75px 1fr 90px 28px', padding:'7px 14px', borderBottom:`0.5px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center', background: ticked ? '#F4F9F3' : '#fff' }}>
                              <input type="checkbox" checked={ticked} onChange={() => toggleSalaryTick(t.id)} style={{ width:14, height:14, cursor:'pointer', accentColor:C.fg }} />
                              <span style={{ color:C.muted }}>{t.date}</span>
                              <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                              <span style={{ color:'#2A7A4A', fontWeight:500, textAlign:'right' as const }}>+{fmt(t.amount)}</span>
                              <button onClick={() => setSingleCategoryModal({ open:true, transaction:t })} title="Reassign" style={{ width:22, height:22, borderRadius:3, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                            </div>
                          )
                        })}
                        <div style={S.bulkBar}>
                          <span>{tickedSalary.size} ticked = {fmt(tickedSalaryAmount)} · avg {fmt(Math.round(tickedSalaryAmount/Math.max(1,bankMonths)))}/mo</span>
                          <span style={{ display:'flex', gap:5 }}>
                            <button onClick={useTickedAsSalary} style={S.bulkBtn}>Use as salary</button>
                            <button onClick={noneIsSalary} style={S.bulkBtn}>None are salary</button>
                            <button onClick={parkSalaryReview} style={S.bulkBtn}>Park</button>
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ROUND-TRIP */}
                  {roundtripPairs.length > 0 && (
                    <div style={{ ...S.card, border:`1px solid ${confirmedDetections['roundtrip']?C.fg:'#EDD898'}` }}>
                      <div style={{ padding:'11px 14px', background:'#FBF6EE', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#8A6A1A', display:'flex', alignItems:'center', gap:6 }}>
                          🔄 Round-trip transfers · {roundtripPairs.length} pair{roundtripPairs.length>1?'s':''} · {fmt(roundtripPairs.reduce((s,p)=>s+p.amount,0))}
                        </span>
                        <button onClick={() => setRtCardOpen(!rtCardOpen)} style={{ width:22, height:22, borderRadius:4, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:13, color:C.fg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600 }}>{rtCardOpen?'−':'+'}</button>
                      </div>
                      {rtCardOpen && (
                        <>
                          <div style={{ ...S.row, fontSize:12, background:'#FAFAF8', color:C.muted }}><span>Tick pairs to net off · untick to keep · or send unticked to Misc</span></div>
                          {roundtripPairs.slice(0,15).map(p => {
                            const ticked = tickedRoundtrip.has(p.id)
                            return (
                              <div key={p.id} style={{ borderBottom:`0.5px solid #FAF7F2`, background: ticked ? '#FBF6EE' : '#fff' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'24px 75px 1fr 90px', padding:'6px 14px', fontSize:11.5, gap:8, alignItems:'center' }}>
                                  <input type="checkbox" checked={ticked} onChange={() => toggleRoundtripTick(p.id)} style={{ width:14, height:14, cursor:'pointer', accentColor:C.fg, gridRow:'span 2' }} />
                                  <span style={{ color:C.muted }}>{p.credit.date}</span>
                                  <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>+ {p.credit.description}</span>
                                  <span style={{ color:'#2A7A4A', fontWeight:600, textAlign:'right' as const }}>+{fmt(p.credit.amount)}</span>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'24px 75px 1fr 90px', padding:'2px 14px 7px', fontSize:11.5, gap:8, alignItems:'center' }}>
                                  <span></span>
                                  <span style={{ color:C.muted }}>{p.debit.date}</span>
                                  <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>− {p.debit.description}</span>
                                  <span style={{ color:C.danger, fontWeight:600, textAlign:'right' as const }}>−{fmt(p.debit.amount)}</span>
                                </div>
                              </div>
                            )
                          })}
                          {roundtripPairs.length > 15 && <div style={{ padding:'7px 14px', fontSize:11, color:C.muted, background:'#FAFAF8' }}>+{roundtripPairs.length-15} more pairs</div>}
                          <div style={S.bulkBar}>
                            <span>{tickedRoundtrip.size} pairs ticked = {fmt(tickedRoundtripAmount)} netted</span>
                            <span style={{ display:'flex', gap:5 }}>
                              <button onClick={netOffTickedRoundtrips} style={S.bulkBtn}>Net off ticked</button>
                              <button onClick={sendUntickedRtToMisc} style={S.bulkBtn}>Unticked → Misc</button>
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* INTEREST */}
                  {interestTxns.length > 0 && (
                    <div style={{ ...S.card, border:`1px solid ${confirmedDetections['interest']?C.fg:'#C8D8C8'}` }}>
                      <div style={{ padding:'11px 14px', background:'#EEF2EE', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:13, fontWeight:600, color:'#2A7A4A', display:'flex', alignItems:'center', gap:6 }}>
                          💸 Interest / Dividend income · {fmt(interestTxns.reduce((s,t)=>s+t.amount,0))}
                        </span>
                        <button onClick={() => setIntCardOpen(!intCardOpen)} style={{ width:22, height:22, borderRadius:4, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:13, color:C.fg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600 }}>{intCardOpen?'−':'+'}</button>
                      </div>
                      {intCardOpen && (
                        <>
                          <div style={{ ...S.row, fontSize:12, background:'#FAFAF8', color:C.muted }}><span>Tick the actual interest/dividend credits — untick wrong matches</span></div>
                          {interestTxns.map(t => {
                            const ticked = tickedInterest.has(t.id)
                            return (
                              <div key={t.id} style={{ display:'grid', gridTemplateColumns:'24px 75px 1fr 90px 28px', padding:'7px 14px', borderBottom:`0.5px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center', background: ticked ? '#EEF2EE' : '#fff' }}>
                                <input type="checkbox" checked={ticked} onChange={() => toggleInterestTick(t.id)} style={{ width:14, height:14, cursor:'pointer', accentColor:C.fg }} />
                                <span style={{ color:C.muted }}>{t.date}</span>
                                <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                                <span style={{ color:'#2A7A4A', fontWeight:500, textAlign:'right' as const }}>+{fmt(t.amount)}</span>
                                <button onClick={() => setSingleCategoryModal({ open:true, transaction:t })} title="Reassign" style={{ width:22, height:22, borderRadius:3, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                              </div>
                            )
                          })}
                          <div style={S.bulkBar}>
                            <span>{tickedInterest.size} ticked = {fmt(tickedInterestAmount)} → {fmt(Math.round(tickedInterestAmount*(12/bankMonths)))} annual</span>
                            <span style={{ display:'flex', gap:5 }}>
                              <button onClick={routeTickedToOtherIncome} style={S.bulkBtn}>Route to Other Income</button>
                              <button onClick={parkInterestReview} style={S.bulkBtn}>Park</button>
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button onClick={() => setIncTab('salary')} style={{ ...S.btn(true), flex:1 }}>Next: Salary →</button>
              </div>
            </div>
          )}

          {/* SALARY TAB — full breakdown always editable */}
          {incTab==='salary' && (
            <div>
              <div style={{ display:'flex', gap:2, background:'#F0EBE0', borderRadius:5, padding:3, marginBottom:16, width:'fit-content' }}>
                {(['slip','offer','manual'] as const).map(k => (
                  <button key={k} onClick={() => setSalMode(k)} style={{ padding:'6px 12px', borderRadius:4, border:'none', fontSize:11.5, fontWeight:salMode===k?600:400, cursor:'pointer', fontFamily:'inherit', background:salMode===k?C.card:'transparent', color:salMode===k?C.fg:C.muted }}>
                    {k==='slip'?'📄 Slip':k==='offer'?'📨 Offer Letter':'✏️ Manual'}
                  </button>
                ))}
              </div>

              {/* Upload area — always available, collapses to a small re-upload button if data exists */}
              {salMode !== 'manual' && (
                salBreakdown.netSalary > 0 ? (
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
                    <button onClick={() => (salMode==='slip'?slipRef:offerRef).current?.click()} style={{ padding:'5px 12px', fontSize:11, color:C.fg, background:C.wl, border:`1px solid ${C.wm}`, borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
                      ↻ Re-upload {salMode==='slip'?'salary slip':'offer letter'}
                    </button>
                  </div>
                ) : (
                  <div style={S.upload(false)} onClick={() => !loadingDoc&&(salMode==='slip'?slipRef:offerRef).current?.click()}>
                    <span style={{ fontSize:28 }}>{salMode==='slip'?'📄':'📨'}</span>
                    <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>{loadingDoc?'Reading…':`Upload ${salMode==='slip'?'Salary Slip':'Offer Letter'}`}</p>
                    <p style={{ fontSize:11, color:C.muted, margin:0 }}>PDF, JPG, PNG · Max 10MB</p>
                    {!loadingDoc && <div style={{ marginTop:8, padding:'8px 24px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:12.5, fontWeight:600 }}>Browse Files</div>}
                  </div>
                )
              )}
              <input ref={slipRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleSlip(e.target.files[0])} />
              <input ref={offerRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleOffer(e.target.files[0])} />

              {/* 5-row editable salary breakdown — ALWAYS shows, always editable */}
              <div style={S.card}>
                <div style={{ ...S.cardHead, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>Monthly income breakdown {salBreakdown.employerName && `· ${salBreakdown.employerName}`}</span>
                  {salBreakdown.employerName && (
                    <button onClick={() => setSalBreakdown(prev => ({ ...prev, employerName: '' }))} style={{ fontSize:10, color:C.fg, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', textTransform:'none' as const, letterSpacing:'normal' }}>edit name</button>
                  )}
                </div>
                {!salBreakdown.employerName && (
                  <div style={{ padding:'8px 14px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, color:C.muted }}>Employer:</span>
                    <input type="text" placeholder="Company name" value={salBreakdown.employerName} onChange={e => setSalBreakdown(prev => ({ ...prev, employerName: e.target.value }))} style={{ flex:1, padding:'5px 8px', border:`1px solid ${C.border}`, borderRadius:4, fontSize:12, fontFamily:'inherit', outline:'none' }} />
                  </div>
                )}
                {[
                  { key:'netSalary' as const, icon:'💵', label:'Take-home (net)', sub:'What hits your bank', tag:null },
                  { key:'employeePF' as const, icon:'🏛️', label:'Employee PF', sub:'Deducted from salary', tag:{ text:'→ 80C ✓', bg:'#EEF2EE', color:'#2A7A4A' } },
                  { key:'employerPF' as const, icon:'🏢', label:'Employer PF', sub:'Direct to PF account, not via salary', tag:{ text:'wealth tracker', bg:'#F5F5F0', color:C.muted } },
                  { key:'bonus' as const, icon:'🎁', label:'Bonus this period', sub:'Variable component', tag:null },
                  { key:'otherBenefits' as const, icon:'🍽️', label:'Other benefits', sub:'LTA, vouchers, RSU vesting', tag:null },
                ].map(field => (
                  <div key={field.key} style={S.row}>
                    <div style={{ flex:1 }}>
                      <span style={{ display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
                        <span style={{ fontSize:14 }}>{field.icon}</span>
                        <span>{field.label}</span>
                        {field.tag && <span style={{ fontSize:9.5, padding:'1px 6px', borderRadius:3, fontWeight:500, background:field.tag.bg, color:field.tag.color }}>{field.tag.text}</span>}
                      </span>
                      <span style={{ fontSize:10.5, color:C.muted, marginLeft:21 }}>{field.sub}</span>
                    </div>
                    <AmtInput value={salBreakdown[field.key]} onChange={v => setSalBreakdown(prev => ({ ...prev, [field.key]: v }))} />
                  </div>
                ))}
                <div style={{ ...S.row, background:C.wl, fontWeight:700, fontSize:13.5, color:C.fg }}>
                  <span>Gross monthly</span>
                  <span>{fmt(grossMonthly)}</span>
                </div>
                <div style={{ ...S.row, background:C.wl, fontWeight:700, fontSize:13.5, color:C.fg }}>
                  <span>× 12 = Annual gross / CTC</span>
                  <span>{fmt(annualCTC)}</span>
                </div>
                {salBreakdown.employeePF > 0 && (
                  <div style={{ padding:'10px 14px', background:'#EEF2EE', borderTop:`1px solid #C8D8C8`, fontSize:11.5, color:'#2A7A4A', display:'flex', alignItems:'center', gap:6 }}>
                    <span>🛡️</span>
                    <span><strong>{fmt(salBreakdown.employeePF * 12)}</strong> auto-flowing to 80C from Employee PF · saves up to ₹{Math.round(salBreakdown.employeePF * 12 * 0.30).toLocaleString('en-IN')} in taxes (30% bracket)</span>
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button onClick={() => setIncTab('review')} style={{ ...S.btn(false), padding:'10px 16px' }}>← Back</button>
                <button onClick={() => setIncTab('other')} style={{ ...S.btn(true), flex:1 }}>Next: Other Income →</button>
              </div>
            </div>
          )}

          {incTab==='other' && (
            <div>
              {(aisData||otherSel.size>0)&&<div style={S.insight}>{otherSel.size} sources auto-filled from {aisData?'AIS':'bank statement'}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                {OTHER_TYPES.map(type => {
                  const sel = otherSel.has(type.key)
                  return (
                    <div key={type.key} style={{ border:`1px solid ${sel?C.fg:C.border}`, borderRadius:5, overflow:'hidden', background:C.card }}>
                      <button onClick={() => setOtherSel(prev=>{const n=new Set(prev);sel?n.delete(type.key):n.add(type.key);return n})} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:sel?C.wl:'#FAFAF8', border:'none', cursor:'pointer', textAlign:'left' as const, fontFamily:'inherit' }}>
                        <span style={{ fontSize:16 }}>{type.icon}</span>
                        <div style={{ flex:1 }}><p style={{ fontSize:12, fontWeight:sel?500:400, color:sel?C.fg:C.text, margin:0 }}>{type.label}</p><p style={{ fontSize:10, color:C.muted, margin:0 }}>{type.sub}</p></div>
                        <div style={{ width:14, height:14, borderRadius:3, border:`1.5px solid ${sel?C.fg:C.border}`, background:sel?C.fg:C.card, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{sel&&<span style={{ fontSize:9, color:C.wheat, fontWeight:700 }}>✓</span>}</div>
                      </button>
                      {sel&&<div style={{ padding:'8px 12px', borderTop:`1px solid ${C.border}` }}><p style={{ fontSize:10, color:C.muted, margin:'0 0 5px' }}>Annual amount</p><AmtInput value={otherVals[type.key]||0} onChange={v=>setOtherVals(prev=>({...prev,[type.key]:v}))} /></div>}
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setIncTab('salary')} style={{ ...S.btn(false), padding:'10px 16px' }}>← Back</button>
                <button onClick={() => bankAccounts.length > 0 ? setIncTab('suggestions') : setMainTab('expenses')} style={{ ...S.btn(true), flex:1 }}>
                  {bankAccounts.length > 0 ? 'Next: Apply to Expenses →' : 'Next: Expenses →'}
                </button>
              </div>
            </div>
          )}

          {/* APPLY TO EXPENSES TAB */}
          {incTab==='suggestions' && (
            <div>
              {!bankAccounts.length > 0 ? (
                <div style={S.insight}>Upload bank statement first.</div>
              ) : suggestions.length === 0 ? (
                <div style={S.insight}>No expense suggestions to apply yet. Run Smart Review first.</div>
              ) : (
                <>
                  <div style={{ background:'#1E293B', borderRadius:8, padding:'12px 16px', marginBottom:14 }}>
                    <p style={{ fontSize:10, color:'rgba(230,207,167,0.5)', letterSpacing:'0.08em', margin:'0 0 6px' }}>APPLY TO EXPENSES</p>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', margin:0, lineHeight:1.6 }}>
                      ArthVo asks before adding anything. Yes once = remembered next time. Skip = won't ask. Park = ask next session.
                    </p>
                  </div>

                  {suggestions.map(sugg => {
                    const decision = suggestionDecisions[sugg.id]
                    const isInvestment = sugg.targetField === 'tax_save' || sugg.targetField === 'savings' || sugg.mega.startsWith('investments')
                    const liveMonthly = suggLiveMonthly(sugg.id, sugg.monthlyAmount)
                    const split = suggestionElssRegular[sugg.id] || { elss:0, reg:liveMonthly }
                    const expanded = !!suggExpanded[sugg.id]
                    const txns = suggestionTxns[sugg.id] || []
                    const unticked = suggUnticked[sugg.id] || new Set<string>()
                    const showAll = !!suggShowAll[sugg.id]
                    const visibleTxns = showAll ? txns : txns.slice(0, 8)
                    const tickedCount = txns.length - unticked.size

                    if (decision === 'accepted') {
                      return (
                        <div key={sugg.id} style={{ ...S.card, border:`1px solid #C8D8C8` }}>
                          <div style={{ ...S.row, fontSize:12.5, justifyContent:'space-between' }}>
                            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:16 }}>{sugg.icon}</span>
                              <span>{sugg.label} → {sugg.targetLabel}</span>
                            </span>
                            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:11, color:'#2A7A4A' }}>✓ Added {fmt(sugg.monthlyAmount)}/mo</span>
                              <button onClick={() => setSuggestionDecisions(prev => { const n = {...prev}; delete n[sugg.id]; return n })} style={{ padding:'3px 10px', fontSize:10.5, color:C.fg, background:C.wl, border:`1px solid ${C.wm}`, borderRadius:3, cursor:'pointer', fontFamily:'inherit' }}>Undo / Edit</button>
                            </span>
                          </div>
                        </div>
                      )
                    }
                    if (decision === 'rejected') {
                      return (
                        <div key={sugg.id} style={{ ...S.card, border:`1px solid #F0CECE` }}>
                          <div style={{ ...S.row, fontSize:12.5, justifyContent:'space-between' }}>
                            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:16 }}>{sugg.icon}</span>
                              <span>{sugg.label}</span>
                            </span>
                            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:11, color:C.danger }}>✗ Skipped</span>
                              <button onClick={() => setSuggestionDecisions(prev => { const n = {...prev}; delete n[sugg.id]; return n })} style={{ padding:'3px 10px', fontSize:10.5, color:C.fg, background:C.wl, border:`1px solid ${C.wm}`, borderRadius:3, cursor:'pointer', fontFamily:'inherit' }}>Undo / Review</button>
                            </span>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div key={sugg.id} style={{ ...S.card, border:`1px solid ${decision==='parked'?'#EDD898':C.border}` }}>
                        <div style={{ padding:'12px 14px', background:decision==='parked'?'#FBF6EE':'#FAFAF8', borderBottom:`1px solid ${C.border}` }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:6 }}>
                            <span style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                              <button onClick={() => setSuggExpanded(p => ({ ...p, [sugg.id]: !p[sugg.id] }))} style={{ width:22, height:22, borderRadius:4, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:13, color:C.fg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, flexShrink:0 }}>{expanded?'−':'+'}</button>
                              <span style={{ fontSize:18 }}>{sugg.icon}</span>
                              <div>
                                <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>{sugg.label}</p>
                                <p style={{ fontSize:11, color:C.muted, margin:0 }}>{sugg.brands.length > 0 ? sugg.brands.slice(0,4).join(' · ') : `${sugg.count} transactions`}</p>
                              </div>
                            </span>
                            <span style={{ textAlign:'right' as const, flexShrink:0 }}>
                              <p style={{ fontSize:14, fontWeight:700, color:C.fg, margin:0 }}>{fmt(liveMonthly)}</p>
                              <p style={{ fontSize:10, color:C.muted, margin:0 }}>per month</p>
                            </span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap' as const, gap:8 }}>
                            <p style={{ fontSize:11.5, color:C.muted, margin:'6px 0 0' }}>
                              Add to: <strong style={{ color:C.fg }}>{sugg.targetLabel}</strong>
                              {sugg.targetField === 'tax_save' && <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:3, background:'#EEF2EE', color:'#2A7A4A' }}>flows to 80C</span>}
                              {sugg.targetField === 'cc' && <span style={{ marginLeft:6, fontSize:10, padding:'1px 6px', borderRadius:3, background:'#F5F5F0', color:C.muted }}>credit card bill</span>}
                            </p>
                            {!expanded && txns.length > 0 && (
                              <button onClick={() => setSuggExpanded(p => ({ ...p, [sugg.id]: true }))} style={{ fontSize:11, color:C.fg, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', padding:0 }}>
                                Show {txns.length} transaction{txns.length>1?'s':''} →
                              </button>
                            )}
                          </div>
                        </div>

                        {expanded && txns.length > 0 && (
                          <div style={{ background:'#FAFAF8' }}>
                            <div style={{ padding:'7px 14px', fontSize:11, color:C.muted, borderBottom:`0.5px solid #FAF7F2` }}>Untick wrong ones · use ↻ to send to a different category</div>
                            {visibleTxns.map(t => {
                              const ticked = !unticked.has(t.id)
                              return (
                                <div key={t.id} style={{ display:'grid', gridTemplateColumns:'24px 75px 1fr 90px 28px', padding:'7px 14px', borderBottom:`0.5px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center', background: ticked ? '#fff' : '#FBF0F0' }}>
                                  <input type="checkbox" checked={ticked} onChange={() => setSuggUnticked(p => { const n = new Set(p[sugg.id] || []); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return { ...p, [sugg.id]: n } })} style={{ width:14, height:14, cursor:'pointer', accentColor:C.fg }} />
                                  <span style={{ color:C.muted }}>{t.date}</span>
                                  <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                                  <span style={{ color:C.danger, fontWeight:500, textAlign:'right' as const }}>−{fmt(t.amount)}</span>
                                  <button onClick={() => setSingleCategoryModal({ open:true, transaction:t, from:'apply-expenses', fromMega: sugg.mega })} title="Reassign to a different category" style={{ width:22, height:22, borderRadius:3, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                                </div>
                              )
                            })}
                            {!showAll && txns.length > visibleTxns.length && (
                              <div style={{ padding:'7px 14px', textAlign:'center' as const, borderBottom:`0.5px solid #FAF7F2` }}>
                                <button onClick={() => setSuggShowAll(p => ({ ...p, [sugg.id]: true }))} style={{ padding:'4px 12px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:3, fontSize:11, color:C.fg, cursor:'pointer', fontFamily:'inherit' }}>
                                  Show {txns.length - visibleTxns.length} more
                                </button>
                              </div>
                            )}
                            <div style={{ padding:'7px 14px', fontSize:11, color:C.muted, background:C.wl, borderBottom:`0.5px solid ${C.border}` }}>
                              {tickedCount} of {txns.length} ticked = {fmt(liveMonthly)}/mo
                            </div>
                          </div>
                        )}

                        {/* Special: investments need split into ELSS / regular */}
                        {sugg.mega === 'investments_regular' || sugg.mega === 'investments_elss' ? (
                          <div style={{ padding:'10px 14px', background:'#EEF4FD', borderBottom:`1px solid ${C.border}` }}>
                            <p style={{ fontSize:11, color:'#2A5A8A', margin:'0 0 8px' }}>📊 Split into Tax-saving (ELSS → 80C) and Regular SIP:</p>
                            <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' as const }}>
                              <span style={{ fontSize:11, color:C.text, minWidth:90 }}>Tax-saving (ELSS):</span>
                              <AmtInput value={split.elss} onChange={v => setSuggestionElssRegular(p => ({ ...p, [sugg.id]: { elss:v, reg: Math.max(0, liveMonthly - v) } }))} small />
                              <span style={{ fontSize:11, color:C.text, marginLeft:8, minWidth:80 }}>Regular SIP:</span>
                              <AmtInput value={split.reg} onChange={v => setSuggestionElssRegular(p => ({ ...p, [sugg.id]: { elss: split.elss, reg: v } }))} small />
                            </div>
                            <p style={{ fontSize:10.5, color:C.muted, margin:0 }}>Total: {fmt(split.elss + split.reg)} (suggested ₹{liveMonthly.toLocaleString('en-IN')})</p>
                          </div>
                        ) : null}

                        <div style={{ padding:'9px 14px', display:'flex', gap:6, justifyContent:'flex-end', flexWrap:'wrap' as const, background:C.card }}>
                          {(sugg.mega === 'investments_regular' || sugg.mega === 'investments_elss') ? (
                            <button onClick={() => splitInvestment(sugg, split.elss, split.reg)} style={{ padding:'6px 14px', fontSize:11.5, background:C.fg, color:C.wheat, border:'none', borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                              Yes, apply split →
                            </button>
                          ) : (
                            <button onClick={() => acceptSuggestion(sugg)} disabled={liveMonthly<=0} style={{ padding:'6px 14px', fontSize:11.5, background: liveMonthly>0 ? '#EEF2EE' : '#F0EBE0', color: liveMonthly>0 ? '#2A7A4A' : C.muted, border:`1px solid ${liveMonthly>0 ? '#C8D8C8' : C.border}`, borderRadius:4, cursor: liveMonthly>0 ? 'pointer' : 'not-allowed', fontFamily:'inherit', fontWeight:600 }}>
                              ✓ Yes, add {fmt(liveMonthly)}
                            </button>
                          )}
                          <button onClick={() => rejectSuggestion(sugg)} style={{ padding:'6px 12px', fontSize:11.5, background:'#FBF0F0', color:C.danger, border:'1px solid #F0CECE', borderRadius:4, cursor:'pointer', fontFamily:'inherit' }}>
                            ✗ No
                          </button>
                          <button onClick={() => parkSuggestion(sugg)} style={{ padding:'6px 12px', fontSize:11.5, background:'#FBF6EE', color:'#8A6A1A', border:'1px solid #EDD898', borderRadius:4, cursor:'pointer', fontFamily:'inherit' }}>
                            🅿 Park
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button onClick={() => setIncTab('other')} style={{ ...S.btn(false), padding:'10px 16px' }}>← Back</button>
                <button onClick={() => setMainTab('expenses')} style={{ ...S.btn(true), flex:1 }}>Done · Go to Expenses tab →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPENSES & SAVINGS TAB */}
      {mainTab==='expenses' && (
        <div>
          {salMonthly>0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:'14px 16px', marginBottom:18, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' as const }}>
              <Donut exp={totalExp+totalVar} sav={totalSav} free={trulyFree} total={salMonthly} />
              <div style={{ flex:1, minWidth:150 }}>
                <p style={{ fontSize:20, fontWeight:700, color:C.fg, margin:'0 0 2px', letterSpacing:'-0.02em' }}>{fmt(trulyFree)}</p>
                <p style={{ fontSize:11, color:C.muted, margin:'0 0 8px' }}>truly free / month</p>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' as const }}>
                  {[{c:C.danger,l:`${fmt(totalExp)} fixed`},{c:'#D97706',l:`${fmt(totalVar)} variable`},{c:C.wm,l:`${fmt(totalSav)} savings`}].map(d => (
                    <span key={d.l} style={{ fontSize:11, color:C.muted, display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:d.c, display:'inline-block' }} />{d.l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign:'center' as const, flexShrink:0 }}>
                <div style={{ width:50, height:50, borderRadius:'50%', border:`2.5px solid ${C.wm}`, background:C.wl, display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', margin:'0 auto 4px' }}>
                  <p style={{ fontSize:15, fontWeight:700, color:C.fg, margin:0, lineHeight:1 }}>{health}</p>
                  <p style={{ fontSize:8, color:C.muted, margin:0 }}>/100</p>
                </div>
                <p style={{ fontSize:11, fontWeight:600, color:C.fg, margin:0 }}>{health>=80?'Excellent':health>=65?'Good':health>=50?'Fair':'Needs work'}</p>
              </div>
            </div>
          )}

          {bankAccounts.length > 0 && pendingSuggestionCount > 0 && (
            <div style={{ ...S.insight, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>💡 {pendingSuggestionCount} expense suggestion{pendingSuggestionCount>1?'s':''} pending review from your bank statement</span>
              <button onClick={() => { setMainTab('income'); setIncTab('suggestions') }} style={{ padding:'5px 12px', fontSize:11, background:C.fg, color:C.wheat, border:'none', borderRadius:4, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Review →</button>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 220px', gap:20 }}>
            <div>
              <div style={S.card}>
                <div style={S.cardHead}>Fixed Monthly Bills <button onClick={addExp} style={{ fontSize:11, color:C.fg, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500, textTransform:'none' as const, letterSpacing:0 }}>+ Add</button></div>
                {expenses.map((exp,i)=>(
                  <div key={exp.id} className="av-row" style={{ ...S.row, borderBottom:i<expenses.length-1?`1px solid #FAF7F2`:'none' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:7 }}><span>{exp.icon}</span>{exp.label}</span>
                    <AmtInput value={exp.amount} onChange={v=>updExp(exp.id,v)} />
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <div style={{ ...S.cardHead, background:'#FBF6EE', borderColor:'#EDD898' }}>Variable Monthly Expenses <button onClick={addVar} style={{ fontSize:11, color:'#8A6A1A', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500, textTransform:'none' as const, letterSpacing:0 }}>+ Add</button></div>
                {variable.map((v,i)=>(
                  <div key={v.id} className="av-row" style={{ ...S.row, borderBottom:i<variable.length-1?`1px solid #FAF7F2`:'none' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:7 }}><span>{v.icon}</span>{v.label}</span>
                    <AmtInput value={v.amount} onChange={amt=>updVar(v.id,amt)} />
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <div style={S.cardHead}>Monthly Savings & Investments <button onClick={addSav} style={{ fontSize:11, color:C.fg, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500, textTransform:'none' as const, letterSpacing:0 }}>+ Add</button></div>
                {savings.map((sv,i)=>{
                  const is80c = sv.label.includes('ELSS') || sv.label.includes('80C')
                  return (
                    <div key={sv.id} className="av-row" style={{ ...S.row, borderBottom:i<savings.length-1?`1px solid #FAF7F2`:'none' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span>{sv.icon}</span>{sv.label}
                        {is80c && <span style={{ fontSize:9.5, padding:'1px 6px', borderRadius:3, background:'#EEF2EE', color:'#2A7A4A', fontWeight:500 }}>→ 80C</span>}
                      </span>
                      <AmtInput value={sv.amount} onChange={v=>updSav(sv.id,v)} />
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <div style={S.card}>
                <div style={{ ...S.cardHead, justifyContent:'center' }}>Summary</div>
                <div style={{ padding:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
                    <Donut exp={totalExp+totalVar} sav={totalSav} free={trulyFree} total={salMonthly} />
                  </div>
                  {[{dot:C.danger,label:'Fixed',val:fmt(totalExp)},{dot:'#D97706',label:'Variable',val:fmt(totalVar)},{dot:C.wm,label:'Savings',val:fmt(totalSav)},{dot:C.fg,label:'Truly free',val:fmt(trulyFree),bold:true}].map(r => (
                    <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, padding:'5px 0', paddingTop:r.bold?6:5, borderTop:r.bold?`1px solid ${C.border}`:'none', marginTop:r.bold?4:0 }}>
                      <span style={{ display:'flex', alignItems:'center', gap:5, color:r.bold?C.fg:C.muted, fontWeight:r.bold?600:400 }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:r.dot, display:'inline-block' }} />{r.label}
                      </span>
                      <span style={{ fontWeight:r.bold?700:500, color:r.bold?C.fg:C.text, fontSize:r.bold?14:12 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <Link href="/dashboard/tax" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', background:C.fg, borderRadius:6, textDecoration:'none', marginTop:4 }}>
            <div><p style={{ fontSize:13, fontWeight:600, color:C.wheat, margin:'0 0 2px' }}>Go to Tax Optimiser →</p><p style={{ fontSize:11, color:'rgba(230,207,167,0.5)', margin:0 }}>Profile complete · 80C amount: {fmt(savings.filter(s=>s.label.includes('ELSS')||s.label.includes('80C')).reduce((s,sv)=>s+sv.amount,0)*12)}/year</p></div>
            <span style={{ color:C.wheat, fontSize:18 }}>→</span>
          </Link>
        </div>
      )}

      {/* P&L + CASH FLOW TAB */}
      {mainTab==='pnl' && (
        <div>
          {!bankAccounts.length > 0 ? (
            <div style={S.insight}>
              📊 Upload your bank statement in the Documents tab to see P&L and cash flow.
              <div style={{ marginTop:8 }}>
                <button onClick={() => setMainTab('docs')} style={{ ...S.btn(true), padding:'8px 16px' }}>Upload Statement →</button>
              </div>
            </div>
          ) : pnl ? (
            <>
              <div style={{ ...S.insight, marginBottom:14 }}>
                📅 Period: <strong>{bankPeriod?.from} to {bankPeriod?.to}</strong> · {bankMonths} month{bankMonths>1?'s':''} · monthly averages applied · {taggedTxns.length} transactions
              </div>

              <div style={S.card}>
                <div style={S.cardHead}>Profit & Loss · monthly average</div>

                <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:'#2A7A4A', letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Income</div>
                {pnl.incomeLines.length === 0 ? (
                  <div style={{ ...S.row, fontSize:12, color:C.muted, fontStyle:'italic' as const }}>
                    <span>No income detected — confirm salary in Income tab</span>
                  </div>
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
                            <div key={t.id} style={{ display:'grid', gridTemplateColumns:'70px 1fr 90px 28px', padding:'6px 14px 6px 38px', borderBottom:`1px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center' }}>
                              <span style={{ color:C.muted }}>{t.date}</span>
                              <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                              <span style={{ color:'#2A7A4A', fontWeight:600, textAlign:'right' as const }}>+{fmt(t.amount)}</span>
                              <button onClick={() => setSingleCategoryModal({ open:true, transaction:t })} title="Reassign category" style={{ width:22, height:22, borderRadius:3, border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                            </div>
                          ))}
                          {line.transactions.length > 15 && (
                            <div style={{ padding:'6px 14px 6px 38px', fontSize:11, color:C.muted }}>+{line.transactions.length-15} more transactions</div>
                          )}
                          <div style={{ padding:'6px 14px 6px 38px', display:'flex', gap:6 }}>
                            <button onClick={() => setBulkCategoryModal({ open:true, transactions:line.transactions, label:line.label })} style={{ padding:'4px 10px', fontSize:11, background:'#fff', color:C.fg, border:`1px solid ${C.border}`, borderRadius:3, cursor:'pointer', fontFamily:'inherit' }}>Reassign all</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 14px', background:C.wl, fontWeight:700, fontSize:13 }}>
                  <span>Total income</span>
                  <span style={{ color:'#2A7A4A' }}>+{fmt(pnl.monthlyIncome)}/mo</span>
                </div>

                <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.danger, letterSpacing:'0.06em', textTransform:'uppercase' as const, marginTop:1 }}>Expenses</div>
                {pnl.expenseLines.length === 0 ? (
                  <div style={{ ...S.row, fontSize:12, color:C.muted, fontStyle:'italic' as const }}>
                    <span>No expenses detected</span>
                  </div>
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
                            <div key={t.id} style={{ display:'grid', gridTemplateColumns:'70px 1fr 90px 28px', padding:'6px 14px 6px 38px', borderBottom:`1px solid #FAF7F2`, fontSize:11.5, gap:8, alignItems:'center' }}>
                              <span style={{ color:C.muted }}>{t.date}</span>
                              <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{t.brand?<strong>{t.brand} · </strong>:''}{t.description}</span>
                              <span style={{ color:C.danger, fontWeight:500, textAlign:'right' as const }}>−{fmt(t.amount)}</span>
                              <button onClick={() => setSingleCategoryModal({ open:true, transaction:t })} title="Reassign category" style={{ width:22, height:22, borderRadius:3, border:`1px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:11, color:C.muted, display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                            </div>
                          ))}
                          {line.transactions.length > 15 && (
                            <div style={{ padding:'6px 14px 6px 38px', fontSize:11, color:C.muted }}>+{line.transactions.length-15} more transactions</div>
                          )}
                          <div style={{ padding:'6px 14px 6px 38px', display:'flex', gap:6 }}>
                            <button onClick={() => setBulkCategoryModal({ open:true, transactions:line.transactions, label:line.label })} style={{ padding:'4px 10px', fontSize:11, background:'#fff', color:C.fg, border:`1px solid ${C.border}`, borderRadius:3, cursor:'pointer', fontFamily:'inherit' }}>Reassign all</button>
                          </div>
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
                  <span style={{ color:pnl.monthlyNet>=0?'#2A7A4A':C.danger }}>
                    {pnl.monthlyNet>=0?'+':''}{fmt(pnl.monthlyNet)}/mo
                  </span>
                </div>
              </div>

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
                            <td style={{ padding:'8px 14px', textAlign:'right' as const, color:m.net>=0?'#2A7A4A':C.danger, fontWeight:700 }}>
                              {m.net>=0?'+':''}{fmt(m.net)}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background:C.wl, fontWeight:700 }}>
                          <td style={{ padding:'10px 14px' }}>Total</td>
                          <td style={{ padding:'10px 14px', textAlign:'right' as const, color:'#2A7A4A' }}>+{fmt(pnl.totalIncome)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right' as const, color:C.danger }}>−{fmt(pnl.totalExpenses)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right' as const, color:pnl.netSurplus>=0?'#2A7A4A':C.danger }}>
                            {pnl.netSurplus>=0?'+':''}{fmt(pnl.netSurplus)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* SINGLE CATEGORY MODAL */}
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
            <p style={{ fontSize:11, color:C.muted, margin:'0 0 8px' }}>This choice is remembered for future bank uploads:</p>
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

      {/* BULK CATEGORY MODAL */}
      {bulkCategoryModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setBulkCategoryModal({ open:false, transactions:[], label:'' })}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:520, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)', maxHeight:'80vh', overflowY:'auto' as const }}>
            <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>Reassign {bulkCategoryModal.transactions.length} transactions</p>
            <p style={{ fontSize:12, color:C.muted, margin:'0 0 14px' }}>Currently in <strong>{bulkCategoryModal.label}</strong> · pick the new category. Choice remembered for future uploads.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {(Object.keys(MEGA_CATEGORIES) as MegaCategory[]).map(key => {
                const info = MEGA_CATEGORIES[key]
                return (
                  <button key={key} onClick={() => reassignBulk(key)} style={{ padding:'10px 12px', background:info.bgColor, border:`1px solid ${info.borderColor}`, borderRadius:5, cursor:'pointer', fontFamily:'inherit', textAlign:'left' as const, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{info.icon}</span>
                    <span style={{ fontSize:12, fontWeight:500, color:info.color }}>{info.label}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setBulkCategoryModal({ open:false, transactions:[], label:'' })} style={{ marginTop:14, width:'100%', padding:9, background:'#fff', color:C.muted, border:`1px solid ${C.border}`, borderRadius:5, fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* PASSWORD MODAL */}
      {pwdModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,34,0.5)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setPwdModal({ open:false, type:null, file:null, error:'' })}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:10, padding:20, maxWidth:400, width:'100%', boxShadow:'0 12px 40px rgba(0,0,0,0.18)' }}>
            <p style={{ fontSize:16, fontWeight:700, color:C.text, margin:'0 0 4px' }}>🔐 {pwdModal.type==='bank'?'Bank Statement':'AIS'} Password</p>
            {pwdModal.type==='bank' ? (
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
            ) : (
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
