'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/AppStore'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
const uid = () => Math.random().toString(36).slice(2,8)

function AmtInput({ value, onChange }: { value:number; onChange:(n:number)=>void }) {
  const [local, setLocal] = useState(value > 0 ? String(value) : '')
  useEffect(() => { setLocal(value > 0 ? String(value) : '') }, [value])
  return (
    <div style={{ display:'flex', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:4, overflow:'hidden' }}>
      <span style={{ padding:'6px 8px', background:C.wl, fontSize:11, color:C.fg, fontWeight:600, borderRight:`1px solid ${C.border}` }}>₹</span>
      <input type="text" inputMode="numeric" value={local}
        onChange={e => setLocal(e.target.value.replace(/[^0-9]/g,''))}
        onBlur={() => onChange(parseFloat(local)||0)}
        onKeyDown={e => e.key==='Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="0"
        style={{ padding:'6px 9px', border:'none', fontSize:12.5, fontFamily:'inherit', outline:'none', width:90, color:C.text }} />
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
}

// ── Smart detection helpers ──────────────────────────────────────────────────
interface Detection {
  id: string
  type: 'salary' | 'roundtrip' | 'merchant' | 'misc'
  title: string
  subtitle: string
  amount: number
  color: string
  bgColor: string
  transactions: any[]
  note: string
  confirmLabel: string
  rejectLabel: string
  confirmed: boolean | null
}

function detectPatterns(transactions: any[], months: number): Detection[] {
  const detections: Detection[] = []
  if (!transactions?.length) return detections

  // 1. Detect likely salary — consistent large credit, same source, same date range
  const credits = transactions.filter((t:any) => t.type === 'credit' && t.amount > 5000)
  const sourceGroups: Record<string, any[]> = {}
  credits.forEach((t:any) => {
    const key = t.description.split('/')[0].trim().substring(0,20)
    if (!sourceGroups[key]) sourceGroups[key] = []
    sourceGroups[key].push(t)
  })
  Object.entries(sourceGroups).forEach(([source, txns]) => {
    if (txns.length >= 2) {
      const amounts = txns.map((t:any) => t.amount)
      const avg = amounts.reduce((a:number,b:number)=>a+b,0) / amounts.length
      const variance = amounts.every((a:number) => Math.abs(a - avg) / avg < 0.25)
      if (variance && avg > 10000) {
        detections.push({
          id: 'salary_' + source,
          type: 'salary',
          title: `Likely salary from ${source}`,
          subtitle: `Consistent ${fmt(avg)}/month credit — same source, similar date each month`,
          amount: Math.round(avg),
          color: '#2A7A4A',
          bgColor: '#EEF2EE',
          transactions: txns,
          note: 'Same source · consistent amount · monthly pattern → looks like salary or regular income',
          confirmLabel: 'Yes, this is my salary',
          rejectLabel: 'Not salary',
          confirmed: null
        })
      }
    }
  })

  // 2. Detect round-trip transactions (same amount sent and received within 7 days)
  const debits = transactions.filter((t:any) => t.type === 'debit')
  const rtPairs: any[] = []
  debits.forEach((d:any) => {
    const match = credits.find((c:any) =>
      Math.abs(c.amount - d.amount) < 1 &&
      c !== d &&
      !rtPairs.find((p:any) => p.credit === c || p.debit === d)
    )
    if (match) rtPairs.push({ credit: match, debit: d, amount: d.amount })
  })
  if (rtPairs.length > 0) {
    const total = rtPairs.reduce((s:number, p:any) => s + p.amount, 0)
    detections.push({
      id: 'roundtrip',
      type: 'roundtrip',
      title: 'Round-trip transfers found',
      subtitle: `${rtPairs.length} transfer${rtPairs.length>1?'s':''} sent and returned — likely temporary`,
      amount: total,
      color: '#8A6A1A',
      bgColor: '#FBF6EE',
      transactions: rtPairs.flatMap((p:any) => [p.credit, p.debit]),
      note: 'Same amount in and out. Netting off removes these from both income and expenses for accurate P&L.',
      confirmLabel: 'Net off (recommended)',
      rejectLabel: 'Keep both',
      confirmed: null
    })
  }

  // 3. Known merchant name resolution
  const merchantMap: Record<string, string> = {
    'NEXTBILLION': 'Groww (Nextbillion Technology)',
    'BILLIONBRAINS': 'Groww',
    'MYNTRA': 'Myntra — Shopping',
    'SWIGGY': 'Swiggy — Food delivery',
    'ZOMATO': 'Zomato — Food delivery',
    'AMAZON': 'Amazon',
    'FLIPKART': 'Flipkart',
  }
  Object.entries(merchantMap).forEach(([key, name]) => {
    const matched = transactions.filter((t:any) => t.description?.toUpperCase().includes(key))
    if (matched.length > 0) {
      const total = matched.reduce((s:number,t:any) => s + t.amount, 0)
      if (total > 500) {
        detections.push({
          id: 'merchant_' + key,
          type: 'merchant',
          title: `${key.charAt(0)+key.slice(1).toLowerCase()} identified`,
          subtitle: `${matched.length} transactions totalling ${fmt(Math.round(total/months))}/month`,
          amount: Math.round(total/months),
          color: '#2A5A8A',
          bgColor: '#EEF4FD',
          transactions: matched.slice(0,5),
          note: `Registered as: ${name}`,
          confirmLabel: 'Categorisation looks right',
          rejectLabel: 'Change category',
          confirmed: null
        })
      }
    }
  })

  return detections
}

function computePnL(transactions: any[], expenses: any[], variable: any[], savings: any[], salary: any, otherIncome: number, months: number, confirmedDetections: Record<string, boolean>) {
  if (!transactions?.length) return null
  const mo = (n:number) => Math.round((n||0) / months)
  const s: Record<string, number> = {}
  transactions.forEach((t:any) => {
    if (!s[t.category]) s[t.category] = 0
    s[t.category] += t.amount
  })

  // Round-trip netting
  const netRoundtrip = confirmedDetections['roundtrip'] === true
  const rtAmount = netRoundtrip ? (transactions.filter((t:any)=>t.type==='credit').reduce((sum:number,t:any)=>{
    const match = transactions.find((d:any)=>d.type==='debit'&&Math.abs(d.amount-t.amount)<1)
    return match ? sum + t.amount : sum
  },0)) : 0

  const totalCredits = transactions.filter((t:any)=>t.type==='credit').reduce((s:number,t:any)=>s+t.amount,0)
  const totalDebits = transactions.filter((t:any)=>t.type==='debit').reduce((s:number,t:any)=>s+t.amount,0)

  const mappedDebits = (s.food||0)+(s.grocery||0)+(s.fuel||0)+(s.shopping||0)+(s.entertainment||0)+(s.insurance||0)+(s.utility||0)+(s.medical||0)+(s.education||0)+(s.emi||0)+(s.rent||0)+(s.sip||0)+(s.investment||0)
  const miscDebits = totalDebits - mappedDebits - (s.transfer||0) - rtAmount

  // Income
  const salaryIncome = salary?.netSalary || mo(s.salary||0)
  const totalIncome = salaryIncome + otherIncome

  // Expenses
  const expenseItems = [
    { label:'Food & Dining', amount: mo(s.food||0), icon:'🍽️' },
    { label:'Groceries', amount: mo(s.grocery||0), icon:'🛒' },
    { label:'Shopping', amount: mo(s.shopping||0), icon:'🛍️' },
    { label:'Investments / SIP', amount: mo(s.sip||0)+mo(s.investment||0), icon:'📈' },
    { label:'Fuel & Transport', amount: mo(s.fuel||0), icon:'🚗' },
    { label:'Utilities & Recharges', amount: mo(s.utility||0), icon:'⚡' },
    { label:'Insurance', amount: mo(s.insurance||0), icon:'🛡️' },
    { label:'EMI / Loan', amount: mo(s.emi||0)+mo(s.rent||0), icon:'🏠' },
    { label:'Entertainment', amount: mo(s.entertainment||0), icon:'🎬' },
    { label:'Medical', amount: mo(s.medical||0), icon:'💊' },
    { label:'Personal transfers (net)', amount: netRoundtrip ? 0 : mo(s.transfer||0), icon:'🔄', netted: netRoundtrip },
    { label:'Miscellaneous / Unaccounted', amount: Math.max(0, mo(miscDebits)), icon:'📦' },
  ].filter(e => e.amount > 0)

  const totalExpenses = expenseItems.reduce((sum,e)=>sum+e.amount,0)
  const netSurplus = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (netSurplus/totalIncome)*100 : 0

  // Monthly cash flows
  const monthlyData: Record<string, {in:number, out:number}> = {}
  transactions.forEach((t:any) => {
    const parts = t.date?.split(/[-/]/) || []
    if (parts.length < 3) return
    const key = `${parts[1]?.padStart?.(2,'0')}-${parts[2]}`
    if (!monthlyData[key]) monthlyData[key] = { in:0, out:0 }
    if (t.type==='credit') monthlyData[key].in += t.amount
    else monthlyData[key].out += t.amount
  })

  const monthNames: Record<string,string> = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'}
  const cashFlows = Object.entries(monthlyData)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([key,val]) => {
      const [mo, yr] = key.split('-')
      return { month:`${monthNames[mo]||mo} ${yr}`, in:Math.round(val.in), out:Math.round(val.out), net:Math.round(val.in-val.out) }
    })

  return { totalIncome, totalExpenses, netSurplus, savingsRate, expenseItems, cashFlows, salaryIncome }
}

type MainTab = 'docs' | 'income' | 'expenses' | 'pnl'

export default function ProfilePage() {
  const { salary, setSalary, aisData, setAisData } = useAppStore()
  const [mainTab, setMainTab] = useState<MainTab>('docs')
  const [incTab, setIncTab] = useState<'review'|'salary'|'other'>('review')
  const [salMode, setSalMode] = useState<'slip'|'offer'|'manual'>('slip')
  const [loadingDoc, setLoadingDoc] = useState<string|null>(null)
  const [bankData, setBankData] = useState<any>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [confirmedDetections, setConfirmedDetections] = useState<Record<string,boolean>>({})
  const [expandedDetections, setExpandedDetections] = useState<Record<string,boolean>>({})
  const [bankMonths, setBankMonths] = useState(1)
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
    { id:uid(), label:'SIP / Mutual Funds', amount:0, icon:'📈' },
    { id:uid(), label:'Emergency Fund', amount:0, icon:'🆘' },
    { id:uid(), label:'RD / FD', amount:0, icon:'🏦' },
  ])

  useEffect(() => {
    try {
      const p = localStorage.getItem('av_profile')
      if (p) { const d=JSON.parse(p); if(d.expenses)setExpenses(d.expenses); if(d.savings)setSavings(d.savings); if(d.variable)setVariable(d.variable) }
      const b = localStorage.getItem('av_bank')
      if (b) {
        const bd = JSON.parse(b)
        setBankData(bd)
        const months = detectMonths(bd.transactions||[])
        setBankMonths(months)
        setDetections(detectPatterns(bd.transactions||[], months))
      }
    } catch {}
  }, [])

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

  function detectMonths(transactions: any[]): number {
    if (!transactions.length) return 1
    const keys = new Set<string>()
    transactions.forEach((t:any) => {
      const parts = (t.date||'').split(/[-/]/)
      if (parts.length >= 3) keys.add(`${parts[1]}-${parts[2]}`)
    })
    return Math.max(1, keys.size)
  }

  const salMonthly = salary?.netSalary || 0
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

  const pnl = bankData ? computePnL(bankData.transactions||[], expenses, variable, savings, salary, otherAnnual/12, bankMonths, confirmedDetections) : null

  // ─ Bank statement upload ──────────────────────────────────────────────────
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
      setBankData(json.data)
      try { localStorage.setItem('av_bank', JSON.stringify(json.data)) } catch {}
      const months = detectMonths(json.data.transactions||[])
      setBankMonths(months)
      const dets = detectPatterns(json.data.transactions||[], months)
      setDetections(dets)
      const mo = (n:number) => Math.round((n||0)/months)
      const s = json.data.summary || {}
      const newExp = expenses.map(e => {
        if (e.label.includes('Rent')) return { ...e, amount: mo(s.rent)||e.amount }
        if (e.label.includes('Car')||e.label.includes('EMI')) return { ...e, amount: mo(s.emi)||e.amount }
        if (e.label.includes('Groceries')) return { ...e, amount: mo(s.grocery)||e.amount }
        if (e.label.includes('Insurance')) return { ...e, amount: mo(s.insurance)||e.amount }
        return e
      })
      const newVar = variable.map(v => {
        if (v.label.includes('Fuel')||v.label.includes('Transport')) return { ...v, amount: mo(s.fuel)||v.amount }
        if (v.label.includes('Dining')||v.label.includes('Takeaway')) return { ...v, amount: mo(s.food)||v.amount }
        if (v.label.includes('Shopping')) return { ...v, amount: mo(s.shopping)||v.amount }
        if (v.label.includes('Entertainment')) return { ...v, amount: mo(s.entertainment)||v.amount }
        if (v.label.includes('Medicine')) return { ...v, amount: mo(s.medical)||v.amount }
        return v
      })
      const newSav = savings.map(sv => {
        if (sv.label.includes('SIP')||sv.label.includes('Mutual')) return { ...sv, amount: mo(s.sip)||sv.amount }
        if (sv.label.includes('RD')||sv.label.includes('FD')) return { ...sv, amount: mo(s.investment)||sv.amount }
        return sv
      })
      const salaryCredits = (json.data.transactions||[]).filter((t:any)=>t.type==='credit'&&t.category==='salary').reduce((sum:number,t:any)=>sum+t.amount,0)
      const monthlySal = mo(salaryCredits)
      if (monthlySal > 0 && !salary) {
        const empTxn = (json.data.transactions||[]).find((t:any)=>t.type==='credit'&&t.category==='salary')
        setSalary({ netSalary:monthlySal, grossSalary:Math.round(monthlySal*1.2), employerName: empTxn?.description?.split('/')?.[0]?.replace(/NEFT\s*IN\s*/i,'')?.trim()||'Employer' } as any)
      }
      setExpenses(newExp); setVariable(newVar); setSavings(newSav)
      saveProfile(newExp, newSav, newVar)
      toast.success(`Statement read · ${json.data.transactions?.length||0} transactions · ${months} months · ${dets.length} items to review`, { id:tid, duration:5000 })
      setMainTab('income'); setIncTab('review')
    } catch (e:any) {
      const errStr=(e.message||'').toLowerCase()
      if (errStr.includes('password')||errStr.includes('encrypted')) { setPwdModal({ open:true, type:'bank', file, error:'' }); setPwd(''); toast.dismiss(tid); return }
      toast.error(e.message||'Failed to parse', { id:tid })
    } finally { setLoadingDoc(null) }
  }

  const clearBank = () => { setBankData(null); setDetections([]); setConfirmedDetections({}); try { localStorage.removeItem('av_bank') } catch {} }

  const fileToBase64 = (f:File): Promise<string> => new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res((r.result as string).split(',')[1]); r.onerror=rej; r.readAsDataURL(f) })

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
      setSalary(json.data); toast.success('Salary parsed!', { id:tid })
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
      setSalary({ ...json.data, netSalary:Math.round((json.data.fixedCTC||json.data.totalCTC||0)/12*0.75), grossSalary:Math.round((json.data.fixedCTC||0)/12), employerName:json.data.employerName } as any)
      toast.success('Offer letter parsed!', { id:tid })
    } catch (e:any) { toast.error(e.message, { id:tid }) }
    finally { setLoadingDoc(null) }
  }

  const submitPassword = () => {
    if (!pwdModal.file || !pwdModal.type) return
    if (pwdModal.type==='bank') handleBankFile(pwdModal.file, pwd)
    else processAIS(pwdModal.file, pwdModal.type, pwd)
  }

  const confirmDetection = (id:string, confirmed:boolean) => {
    setConfirmedDetections(prev => ({ ...prev, [id]: confirmed }))
    if (confirmed) {
      const det = detections.find(d=>d.id===id)
      if (det?.type==='salary') {
        setSalary({ netSalary:det.amount, grossSalary:Math.round(det.amount*1.2), employerName:det.title.replace('Likely salary from ','') } as any)
        toast.success(`Salary set to ${fmt(det.amount)}/month`)
      }
    }
  }

  const pnlData = pnl

  return (
    <div style={{ fontFamily:'"Sora",-apple-system,sans-serif', maxWidth:860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap'); .av-row:last-child{border-bottom:none!important}`}</style>

      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:'0 0 4px', letterSpacing:'-0.02em' }}>My Profile</h2>
        <p style={{ fontSize:13, color:C.muted, margin:0 }}>Your complete financial picture</p>
      </div>

      {/* MAIN TABS */}
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

      {/* ── DOCUMENTS TAB ── */}
      {mainTab==='docs' && (
        <div>
          <p style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8 }}>Step 1 — Bank statement (recommended)</p>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:14, display:'flex', gap:14, alignItems:'center' }}>
            <div style={{ width:54, height:54, borderRadius:'50%', background:bankData?'#EEF2EE':C.wl, border:`2px solid ${bankData?C.fg:C.wm}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>🏦</div>
            <div style={{ flex:1 }}>
              {bankData ? (
                <>
                  <p style={{ fontSize:14, fontWeight:700, color:C.fg, margin:'0 0 3px' }}>✓ {bankData.bank||'Bank'} statement uploaded</p>
                  <p style={{ fontSize:11.5, color:C.muted, margin:0 }}>{bankData.transactions?.length||0} transactions · {bankMonths} month{bankMonths>1?'s':''} · {detections.length} items to review</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize:14, fontWeight:700, color:C.text, margin:'0 0 3px' }}>Bank Statement</p>
                  <p style={{ fontSize:11.5, color:C.muted, margin:0, lineHeight:1.55 }}>Any Indian bank · PDF, Excel, CSV or photo · Password supported</p>
                  <p style={{ fontSize:10.5, color:C.muted, margin:'4px 0 0' }}>⚡ Auto-fills income, expenses & savings · monthly averages calculated</p>
                </>
              )}
            </div>
            {bankData ? (
              <button onClick={clearBank} style={{ padding:'6px 12px', fontSize:11, color:C.danger, background:'#FBF0F0', border:`1px solid #F0CECE`, borderRadius:4, cursor:'pointer', fontFamily:'inherit' }}>Remove</button>
            ) : (
              <button onClick={() => bankRef.current?.click()} disabled={loadingDoc==='bank'} style={{ padding:'8px 16px', background:C.fg, color:C.wheat, border:'none', borderRadius:5, fontSize:12, fontWeight:600, cursor:loadingDoc==='bank'?'wait':'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const }}>
                {loadingDoc==='bank' ? 'Reading…' : 'Upload Statement'}
              </button>
            )}
            <input ref={bankRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={e => e.target.files?.[0] && handleBankFile(e.target.files[0])} />
          </div>

          <p style={{ fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:8 }}>Step 2 — Tax documents (optional)</p>
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

          {bankData && (
            <button onClick={() => { setMainTab('income'); setIncTab('review') }} style={{ ...S.btn(true), width:'100%', padding:'11px' }}>
              Next: Review statement →
            </button>
          )}
        </div>
      )}

      {/* ── INCOME TAB ── */}
      {mainTab==='income' && (
        <div>
          <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:18 }}>
            <button onClick={() => setIncTab('review')} style={S.stab(incTab==='review')}>
              🔍 Smart Review {detections.length > 0 && <span style={{ marginLeft:4, fontSize:10, background:C.fg, color:C.wheat, padding:'1px 6px', borderRadius:10 }}>{detections.filter(d=>confirmedDetections[d.id]===undefined).length}</span>}
            </button>
            <button onClick={() => setIncTab('salary')} style={S.stab(incTab==='salary')}>📄 Salary</button>
            <button onClick={() => setIncTab('other')} style={S.stab(incTab==='other')}>🏦 Other Income</button>
          </div>

          {/* Smart Review */}
          {incTab==='review' && (
            <div>
              {!bankData ? (
                <div style={S.insight}>Upload your bank statement in the Documents tab to get smart insights here.</div>
              ) : detections.length === 0 ? (
                <div style={S.insight}>✓ No ambiguous entries found. Your statement looks clean.</div>
              ) : (
                <>
                  <div style={{ background:'#1E293B', borderRadius:8, padding:'12px 16px', marginBottom:14 }}>
                    <p style={{ fontSize:10, color:'rgba(230,207,167,0.5)', letterSpacing:'0.08em', margin:'0 0 6px' }}>SMART REVIEW</p>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.75)', margin:0, lineHeight:1.6 }}>
                      ArthVo found {detections.length} items that need your input. Confirm or reject each to improve your P&L accuracy.
                    </p>
                  </div>
                  {detections.map(det => {
                    const confirmed = confirmedDetections[det.id]
                    const expanded = expandedDetections[det.id]
                    return (
                      <div key={det.id} style={{ ...S.card, border:`1px solid ${confirmed===true?C.fg:confirmed===false?C.border:det.bgColor==='#EEF2EE'?'#C8D8C8':det.bgColor==='#EEF4FD'?'#B5D4F4':'#EDD898'}` }}>
                        <div style={{ padding:'10px 14px', background:det.bgColor, borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:det.color }}>{det.title}</span>
                          <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                            {confirmed === undefined || confirmed === null ? (
                              <>
                                <button onClick={() => confirmDetection(det.id, true)} style={{ padding:'3px 10px', borderRadius:4, fontSize:11, cursor:'pointer', fontFamily:'inherit', background:'#EEF2EE', color:'#2A7A4A', border:'0.5px solid #C8D8C8' }}>{det.confirmLabel}</button>
                                <button onClick={() => confirmDetection(det.id, false)} style={{ padding:'3px 10px', borderRadius:4, fontSize:11, cursor:'pointer', fontFamily:'inherit', background:'#FBF0F0', color:C.danger, border:`0.5px solid #F0CECE` }}>{det.rejectLabel}</button>
                              </>
                            ) : (
                              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:4, background:confirmed?'#EEF2EE':'#FBF0F0', color:confirmed?'#2A7A4A':C.danger, border:`0.5px solid ${confirmed?'#C8D8C8':'#F0CECE'}` }}>
                                {confirmed ? '✓ Confirmed' : '✗ Rejected'}
                              </span>
                            )}
                            <button onClick={() => setExpandedDetections(prev=>({...prev,[det.id]:!expanded}))} style={{ width:22, height:22, borderRadius:4, border:`0.5px solid ${C.border}`, background:'#fff', cursor:'pointer', fontSize:14, color:C.fg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {expanded ? '−' : '+'}
                            </button>
                          </div>
                        </div>
                        <div style={{ ...S.row, fontSize:12.5 }}>
                          <span>{det.subtitle}</span>
                          <span style={{ fontWeight:600, color:det.color }}>{fmt(det.amount)}/mo</span>
                        </div>
                        {expanded && (
                          <div>
                            {det.transactions.slice(0,6).map((t:any, i:number) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 14px', fontSize:11.5, borderBottom:`1px solid #FAF7F2`, background:'#FAFAF8', gap:12 }}>
                                <span style={{ color:C.muted, flexShrink:0 }}>{t.date}</span>
                                <span style={{ color:C.text, flex:1 }}>{t.description}</span>
                                <span style={{ fontWeight:600, color:t.type==='credit'?'#2A7A4A':C.danger, flexShrink:0 }}>{t.type==='credit'?'+':'-'}{fmt(t.amount)}</span>
                              </div>
                            ))}
                            <div style={{ padding:'8px 14px', background:C.wl, fontSize:11.5, color:C.fg, lineHeight:1.6 }}>{det.note}</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={() => setIncTab('salary')} style={{ ...S.btn(true), flex:1 }}>Next: Confirm Salary →</button>
              </div>
            </div>
          )}

          {/* Salary */}
          {incTab==='salary' && (
            <div>
              <div style={{ display:'flex', gap:2, background:'#F0EBE0', borderRadius:5, padding:3, marginBottom:16, width:'fit-content' }}>
                {(['slip','offer','manual'] as const).map(k => (
                  <button key={k} onClick={() => setSalMode(k)} style={{ padding:'6px 12px', borderRadius:4, border:'none', fontSize:11.5, fontWeight:salMode===k?600:400, cursor:'pointer', fontFamily:'inherit', background:salMode===k?C.card:'transparent', color:salMode===k?C.fg:C.muted }}>
                    {k==='slip'?'📄 Slip':k==='offer'?'📨 Offer Letter':'✏️ Manual'}
                  </button>
                ))}
              </div>
              {salary ? (
                <div style={{ background:C.fg, borderRadius:6, padding:'14px 16px', marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div><p style={{ fontSize:9, color:'rgba(230,207,167,0.45)', letterSpacing:'0.08em', margin:'0 0 2px' }}>SALARY</p><p style={{ fontSize:14, fontWeight:600, color:'#fff', margin:0 }}>{(salary as any).employerName||'Your employer'}</p></div>
                    <button onClick={() => setSalary(null)} style={{ fontSize:11, padding:'4px 10px', background:'rgba(230,207,167,0.1)', border:'1px solid rgba(230,207,167,0.2)', borderRadius:4, color:'rgba(230,207,167,0.7)', cursor:'pointer', fontFamily:'inherit' }}>↺ Change</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
                    {[{lbl:'TAKE-HOME/MO',val:fmt(salary.netSalary||0),col:C.wheat},{lbl:'GROSS/MO',val:fmt(salary.grossSalary||0),col:'#fff'},{lbl:'ANNUAL',val:fmt((salary.grossSalary||0)*12),col:C.wheat}].map(s => (
                      <div key={s.lbl} style={{ background:'rgba(230,207,167,0.08)', border:'1px solid rgba(230,207,167,0.12)', borderRadius:4, padding:'8px 10px' }}>
                        <p style={{ fontSize:9, color:'rgba(230,207,167,0.45)', margin:'0 0 2px', letterSpacing:'0.06em' }}>{s.lbl}</p>
                        <p style={{ fontSize:15, fontWeight:700, color:s.col, margin:0 }}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (salMode==='slip'||salMode==='offer') && (
                <div style={S.upload(false)} onClick={() => !loadingDoc&&(salMode==='slip'?slipRef:offerRef).current?.click()}>
                  <span style={{ fontSize:28 }}>{salMode==='slip'?'📄':'📨'}</span>
                  <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:0 }}>{loadingDoc?'Reading…':`Upload ${salMode==='slip'?'Salary Slip':'Offer Letter'}`}</p>
                  <p style={{ fontSize:11, color:C.muted, margin:0 }}>PDF, JPG, PNG · Max 10MB</p>
                  {!loadingDoc && <div style={{ marginTop:8, padding:'8px 24px', background:C.fg, color:C.wheat, borderRadius:5, fontSize:12.5, fontWeight:600 }}>Browse Files</div>}
                  <input ref={slipRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleSlip(e.target.files[0])} />
                  <input ref={offerRef} type="file" accept=".pdf,image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleOffer(e.target.files[0])} />
                </div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button onClick={() => setIncTab('review')} style={{ ...S.btn(false), padding:'10px 16px' }}>← Back</button>
                <button onClick={() => setIncTab('other')} style={{ ...S.btn(true), flex:1 }}>Next: Other Income →</button>
              </div>
            </div>
          )}

          {/* Other income */}
          {incTab==='other' && (
            <div>
              {aisData&&otherSel.size>0&&<div style={S.insight}>{otherSel.size} sources auto-filled from AIS</div>}
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
                <button onClick={() => setMainTab('expenses')} style={{ ...S.btn(true), flex:1 }}>Next: Add Expenses →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSES & SAVINGS TAB ── */}
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
                <div style={S.cardHead}>Monthly Savings <button onClick={addSav} style={{ fontSize:11, color:C.fg, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:500, textTransform:'none' as const, letterSpacing:0 }}>+ Add</button></div>
                {savings.map((sv,i)=>(
                  <div key={sv.id} className="av-row" style={{ ...S.row, borderBottom:i<savings.length-1?`1px solid #FAF7F2`:'none' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:7 }}><span>{sv.icon}</span>{sv.label}</span>
                    <AmtInput value={sv.amount} onChange={v=>updSav(sv.id,v)} />
                  </div>
                ))}
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
            <div><p style={{ fontSize:13, fontWeight:600, color:C.wheat, margin:'0 0 2px' }}>Go to Tax Optimiser →</p><p style={{ fontSize:11, color:'rgba(230,207,167,0.5)', margin:0 }}>Profile complete</p></div>
            <span style={{ color:C.wheat, fontSize:18 }}>→</span>
          </Link>
        </div>
      )}

      {/* ── P&L + CASH FLOW TAB ── */}
      {mainTab==='pnl' && (
        <div>
          {!bankData ? (
            <div style={S.insight}>
              📊 Upload your bank statement in the Documents tab to see your P&L and cash flow.
              <div style={{ marginTop:8 }}>
                <button onClick={() => setMainTab('docs')} style={{ ...S.btn(true), padding:'8px 16px' }}>Upload Statement →</button>
              </div>
            </div>
          ) : pnlData ? (
            <>
              {/* Metric strip */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:C.border, border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden', marginBottom:16 }}>
                {[
                  { l:'Monthly income', v:fmt(pnlData.totalIncome), pos:true },
                  { l:'Monthly expenses', v:fmt(pnlData.totalExpenses), pos:false },
                  { l:'Net surplus', v:fmt(pnlData.netSurplus), pos:pnlData.netSurplus>=0 },
                  { l:'Savings rate', v:`${Math.round(pnlData.savingsRate)}%`, pos:pnlData.savingsRate>=20 },
                ].map((s,i) => (
                  <div key={i} style={{ background:C.card, padding:'13px 16px' }}>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{s.l}</div>
                    <div style={{ fontSize:17, fontWeight:700, color:s.pos?C.fg:C.danger, letterSpacing:'-0.02em' }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* P&L */}
              <div style={S.card}>
                <div style={S.cardHead}>Profit & Loss — monthly avg ({bankData.period||`${bankMonths} months`})</div>
                <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Income</div>
                <div style={{ ...S.row, fontWeight:500 }}>
                  <span>Salary / Regular income</span>
                  <span style={{ color:'#2A7A4A', fontWeight:600 }}>+{fmt(pnlData.salaryIncome)}</span>
                </div>
                {otherAnnual > 0 && (
                  <div style={S.row}>
                    <span>Other income</span>
                    <span style={{ color:'#2A7A4A', fontWeight:600 }}>+{fmt(Math.round(otherAnnual/12))}</span>
                  </div>
                )}
                <div style={{ ...S.row, background:C.wl, fontWeight:700, fontSize:13 }}>
                  <span>Total income</span>
                  <span style={{ color:'#2A7A4A' }}>+{fmt(pnlData.totalIncome)}</span>
                </div>

                <div style={{ padding:'8px 14px', background:'#FAFAF8', borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.muted, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>Expenses</div>
                {pnlData.expenseItems.map((e:any) => (
                  <div key={e.label} style={S.row}>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:14 }}>{e.icon}</span>
                      {e.label}
                      {e.netted && <span style={{ fontSize:10, background:'#EEF2EE', color:'#2A7A4A', padding:'1px 7px', borderRadius:3, border:'1px solid #C8D8C8' }}>netted</span>}
                    </span>
                    <span style={{ color:e.amount===0?C.muted:C.danger, fontWeight:500 }}>
                      {e.amount===0?'₹0':`−${fmt(e.amount)}`}
                    </span>
                  </div>
                ))}
                <div style={{ ...S.row, background:C.wl, fontWeight:700, fontSize:13 }}>
                  <span>Total expenses</span>
                  <span style={{ color:C.danger }}>−{fmt(pnlData.totalExpenses)}</span>
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', padding:'13px 16px', fontSize:15, fontWeight:700, borderTop:`1.5px solid ${C.border}` }}>
                  <span style={{ color:C.text }}>Net surplus / deficit</span>
                  <span style={{ color:pnlData.netSurplus>=0?'#2A7A4A':C.danger }}>
                    {pnlData.netSurplus>=0?'+':''}{fmt(pnlData.netSurplus)}
                  </span>
                </div>
              </div>

              {/* Cash flow */}
              <div style={S.card}>
                <div style={S.cardHead}>Cash flow by month</div>
                <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr 1fr', gap:0, padding:'7px 14px', background:C.wl, fontSize:10, fontWeight:700, color:C.fg, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>
                  <span>Month</span>
                  <span style={{ textAlign:'right' as const }}>In</span>
                  <span style={{ textAlign:'right' as const }}>Out</span>
                  <span style={{ textAlign:'right' as const }}>Net</span>
                </div>
                {pnlData.cashFlows.map((cf:any,i:number) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr 1fr', gap:0, padding:'8px 14px', borderBottom:`1px solid #FAF7F2`, fontSize:12.5, alignItems:'center' }}>
                    <span style={{ color:C.muted }}>{cf.month}</span>
                    <span style={{ textAlign:'right' as const, color:'#2A7A4A', fontWeight:500 }}>+{fmt(cf.in)}</span>
                    <span style={{ textAlign:'right' as const, color:C.danger }}>−{fmt(cf.out)}</span>
                    <span style={{ textAlign:'right' as const, color:cf.net>=0?'#2A7A4A':C.danger, fontWeight:600 }}>{cf.net>=0?'+':''}{fmt(cf.net)}</span>
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr 1fr', gap:0, padding:'9px 14px', background:C.wl, fontSize:13, fontWeight:700 }}>
                  <span>Total</span>
                  <span style={{ textAlign:'right' as const, color:'#2A7A4A' }}>+{fmt(pnlData.cashFlows.reduce((s:number,cf:any)=>s+cf.in,0))}</span>
                  <span style={{ textAlign:'right' as const, color:C.danger }}>−{fmt(pnlData.cashFlows.reduce((s:number,cf:any)=>s+cf.out,0))}</span>
                  <span style={{ textAlign:'right' as const, color:pnlData.cashFlows.reduce((s:number,cf:any)=>s+cf.net,0)>=0?'#2A7A4A':C.danger }}>
                    {pnlData.cashFlows.reduce((s:number,cf:any)=>s+cf.net,0)>=0?'+':''}{fmt(pnlData.cashFlows.reduce((s:number,cf:any)=>s+cf.net,0))}
                  </span>
                </div>
              </div>

              {pnlData.netSurplus < 0 && (
                <div style={{ background:'#FBF0F0', border:`1px solid #F0CECE`, borderRadius:6, padding:'10px 14px', fontSize:12.5, color:C.danger, lineHeight:1.65 }}>
                  ⚠️ Your expenses exceed income by {fmt(Math.abs(pnlData.netSurplus))}/month. Review your miscellaneous and variable expenses.
                </div>
              )}
              {pnlData.netSurplus > 0 && pnlData.savingsRate < 20 && (
                <div style={S.insight}>
                  💡 Savings rate is {Math.round(pnlData.savingsRate)}%. The 20% target means {fmt(Math.round(pnlData.totalIncome*0.2))}/month — you're {fmt(Math.round(pnlData.totalIncome*0.2-pnlData.netSurplus))} short. One SIP increase away.
                </div>
              )}
            </>
          ) : null}
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
