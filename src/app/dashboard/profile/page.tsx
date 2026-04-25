'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/AppStore'

// ─── Palette tokens ───────────────────────────────────────────────────────────
const C = {
  fg: '#3A4B41', wheat: '#E6CFA7', wl: '#F5ECD8', wm: '#D4B98A',
  bg: '#FDFAF6', card: '#fff', border: '#E4DDD1',
  text: '#1C2B22', muted: '#7A8A7E', danger: '#B94040',
}

// ─── Amount input — outside component ─────────────────────────────────────────
function AmtInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [local, setLocal] = useState(value > 0 ? String(value) : '')
  useEffect(() => { setLocal(value > 0 ? String(value) : '') }, [value])
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
      <span style={{ padding: '6px 8px', background: C.wl, fontSize: 11, color: C.fg, fontWeight: 600, borderRight: `1px solid ${C.border}` }}>₹</span>
      <input
        type="text" inputMode="numeric" value={local}
        onChange={e => setLocal(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => onChange(parseFloat(local) || 0)}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="0"
        style={{ padding: '6px 9px', border: 'none', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', width: 84, color: C.text }}
      />
    </div>
  )
}

// ─── Donut chart ──────────────────────────────────────────────────────────────
function Donut({ exp, sav, free, total }: { exp: number; sav: number; free: number; total: number }) {
  if (!total) return <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F0EBE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.muted }}>—</div>
  const r = 14, circ = 2 * Math.PI * r
  const eL = (exp / total) * circ, sL = (sav / total) * circ, fL = (free / total) * circ
  return (
    <svg viewBox="0 0 36 36" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="#F0EBE0" strokeWidth="5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={C.danger} strokeWidth="5" strokeDasharray={`${eL - 0.5} ${circ - eL + 0.5}`} strokeDashoffset="0" strokeLinecap="round" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={C.wm} strokeWidth="5" strokeDasharray={`${sL - 0.5} ${circ - sL + 0.5}`} strokeDashoffset={-eL} strokeLinecap="round" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={C.fg} strokeWidth="5" strokeDasharray={`${fL - 0.5} ${circ - fL + 0.5}`} strokeDashoffset={-(eL + sL)} strokeLinecap="round" />
    </svg>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const uid = () => Math.random().toString(36).slice(2, 8)
const fileToBase64 = (f: File): Promise<string> => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(f)
})

const OTHER_TYPES = [
  { key: 'dividend', icon: '📈', label: 'Dividend Income', sub: 'Shares / mutual funds' },
  { key: 'fd', icon: '🏦', label: 'FD / Savings Interest', sub: 'Bank deposits' },
  { key: 'ltcg', icon: '📊', label: 'Capital Gains', sub: 'MF, shares, property' },
  { key: 'rental', icon: '🏠', label: 'Rental Income', sub: 'From property you own' },
  { key: 'freelance', icon: '💻', label: 'Freelance / Consulting', sub: 'Professional income' },
  { key: 'other', icon: '💼', label: 'Other Income', sub: 'Any other taxable income' },
]

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 12 } as React.CSSProperties,
  cardHead: { padding: '10px 14px', background: C.wl, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.fg, letterSpacing: '0.07em', textTransform: 'uppercase' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: `1px solid #FAF7F2`, fontSize: 12.5, color: C.text } as React.CSSProperties,
  btn: (primary = true): React.CSSProperties => ({ padding: '10px 14px', background: primary ? C.fg : C.card, color: primary ? C.wheat : C.muted, border: primary ? 'none' : `1px solid ${C.border}`, borderRadius: 5, fontSize: 12.5, fontWeight: primary ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }),
  upload: (done = false): React.CSSProperties => ({ border: `1.5px dashed ${done ? C.fg : C.border}`, borderRadius: 6, padding: '16px', textAlign: 'center', background: done ? '#EEF2EE' : C.wl, cursor: done ? 'default' : 'pointer' }),
  insight: { background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 5, padding: '9px 12px', fontSize: 12, color: C.fg, lineHeight: 1.6, marginBottom: 12 } as React.CSSProperties,
  stab: (on: boolean): React.CSSProperties => ({ padding: '0 12px 9px', fontSize: 12, cursor: 'pointer', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: `2px solid ${on ? C.wm : 'transparent'}`, color: on ? C.fg : C.muted, fontWeight: on ? 600 : 400, background: 'none', fontFamily: 'inherit' }),
  maintab: (on: boolean): React.CSSProperties => ({ padding: '0 16px 10px', fontSize: 13, cursor: 'pointer', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: `2px solid ${on ? C.wheat : 'transparent'}`, color: on ? C.fg : C.muted, fontWeight: on ? 600 : 400, background: 'none', fontFamily: 'inherit' }),
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { salary, setSalary, aisData, setAisData } = useAppStore()
  const [mainTab, setMainTab] = useState<'income' | 'expenses'>('income')
  const [incTab, setIncTab] = useState<'tax' | 'salary' | 'other'>('tax')
  const [salMode, setSalMode] = useState<'slip' | 'offer' | 'manual'>('slip')
  const [loading, setLoading] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingType, setPendingType] = useState<'ais' | '26as'>('ais')
  const [pwd, setPwd] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [otherSel, setOtherSel] = useState<Set<string>>(new Set())
  const [otherVals, setOtherVals] = useState<Record<string, number>>({})
  const aisRef = useRef<HTMLInputElement>(null)
  const taxRef = useRef<HTMLInputElement>(null)
  const slipRef = useRef<HTMLInputElement>(null)
  const offerRef = useRef<HTMLInputElement>(null)

  const [expenses, setExpenses] = useState([
    { id: uid(), label: 'Rent / Home loan EMI', amount: 0, icon: '🏠' },
    { id: uid(), label: 'Car / Vehicle EMI', amount: 0, icon: '🚗' },
    { id: uid(), label: 'Groceries', amount: 0, icon: '🛒' },
    { id: uid(), label: 'Electricity / Gas', amount: 0, icon: '⚡' },
    { id: uid(), label: 'Internet + Phone', amount: 0, icon: '📱' },
    { id: uid(), label: 'Life Insurance', amount: 0, icon: '🛡️' },
    { id: uid(), label: 'Health Insurance', amount: 0, icon: '🏥' },
  ])
  const [savings, setSavings] = useState([
    { id: uid(), label: 'SIP / Mutual Funds', amount: 0, icon: '📈' },
    { id: uid(), label: 'Emergency Fund', amount: 0, icon: '🆘' },
    { id: uid(), label: 'RD / FD', amount: 0, icon: '🏦' },
  ])
  const [variable, setVariable] = useState([
    { id: uid(), label: 'Fuel / Transport', amount: 0, icon: '🚗' },
    { id: uid(), label: 'Dining out / Takeaway', amount: 0, icon: '🍽️' },
    { id: uid(), label: 'Shopping / Clothing', amount: 0, icon: '🛍️' },
    { id: uid(), label: 'Medicine / Healthcare', amount: 0, icon: '💊' },
    { id: uid(), label: 'Entertainment / OTT', amount: 0, icon: '🎬' },
    { id: uid(), label: 'Travel (monthly avg)', amount: 0, icon: '✈️' },
    { id: uid(), label: 'Other variable spend', amount: 0, icon: '📦' },
  ])

  // Load saved profile
  useEffect(() => {
    try {
      const p = localStorage.getItem('av_profile')
      if (p) { const d = JSON.parse(p); if (d.expenses) setExpenses(d.expenses); if (d.savings) setSavings(d.savings); if (d.variable) setVariable(d.variable) }
    } catch {}
  }, [])

  const saveProfile = useCallback((exp = expenses, sav = savings, vari = variable) => {
    try { localStorage.setItem('av_profile', JSON.stringify({ expenses: exp, savings: sav, variable: vari })) } catch {}
  }, [expenses, savings, variable])

  const updExp  = (id: string, amount: number) => { const u = expenses.map(e => e.id === id ? { ...e, amount } : e); setExpenses(u); saveProfile(u, savings, variable) }
  const updSav  = (id: string, amount: number) => { const u = savings.map(s => s.id === id ? { ...s, amount } : s); setSavings(u); saveProfile(expenses, u, variable) }
  const updVar  = (id: string, amount: number) => { const u = variable.map(v => v.id === id ? { ...v, amount } : v); setVariable(u); saveProfile(expenses, savings, u) }
  const addExp  = () => { const u = [...expenses, { id: uid(), label: 'Custom expense', amount: 0, icon: '💸' }]; setExpenses(u); saveProfile(u, savings, variable) }
  const addSav  = () => { const u = [...savings, { id: uid(), label: 'New savings goal', amount: 0, icon: '🎯' }]; setSavings(u); saveProfile(expenses, u, variable) }
  const addVar  = () => { const u = [...variable, { id: uid(), label: 'Other', amount: 0, icon: '📦' }]; setVariable(u); saveProfile(expenses, savings, u) }

  // Auto-fill from AIS
  useEffect(() => {
    if (!aisData) return
    const sel = new Set<string>(); const vals: Record<string, number> = {}
    if ((aisData as any).dividendIncome > 0) { sel.add('dividend'); vals['dividend'] = Math.round((aisData as any).dividendIncome) }
    if ((aisData as any).totalInterestIncome > 0) { sel.add('fd'); vals['fd'] = Math.round((aisData as any).totalInterestIncome) }
    if ((aisData as any).totalCapitalGains > 0) { sel.add('ltcg'); vals['ltcg'] = Math.round((aisData as any).totalCapitalGains) }
    if (sel.size > 0) { setOtherSel(sel); setOtherVals(vals) }
  }, [aisData])

  // Calculations
  const salMonthly = salary?.netSalary || 0
  const otherAnnual = Array.from(otherSel).reduce((s, k) => s + (otherVals[k] || 0), 0)
  const totalAnnual = salMonthly * 12 + otherAnnual
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
  const totalSav = savings.reduce((s, sv) => s + sv.amount, 0)
  const totalVar = variable.reduce((s, v) => s + v.amount, 0)
  const trulyFree = Math.max(0, salMonthly - totalExp - totalVar - totalSav)
  const freeToSpend = trulyFree  // alias kept for backward compat
  const savRate = salMonthly > 0 ? totalSav / salMonthly : 0

  // Health score
  let health = 100
  if (savRate < 0.1) health -= 25; else if (savRate < 0.2) health -= 10
  const totalCommitted = (totalExp + totalVar) / (salMonthly || 1)
  if (totalCommitted > 0.7) health -= 20; else if (totalCommitted > 0.6) health -= 10
  if (trulyFree < 0) health -= 30
  health = Math.max(0, Math.min(100, health))
  const healthGrade = health >= 80 ? 'Excellent' : health >= 65 ? 'Good' : health >= 50 ? 'Fair' : 'Needs work'

  // Doc upload handlers
  const handleDocFile = (file: File, type: 'ais' | '26as') => {
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Max 10MB.'); return }
    if (file.type === 'application/pdf' && type === 'ais') { setPendingFile(file); setPendingType(type); setPwd(''); setPwdErr(''); setShowPwd(true); return }
    processDoc(file, type, '')
  }

  const processDoc = async (file: File, type: string, password: string) => {
    setLoading(type); setShowPwd(false)
    const tid = toast.loading(`Reading ${type.toUpperCase()}…`)
    try {
      const b64 = await fileToBase64(file)
      const res = await fetch('/api/parse-ais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64Data: b64, mediaType: file.type, password: password || undefined }) })
      const json = await res.json()
      if (res.status === 422 || json.error === 'incorrect_password') { setShowPwd(true); setPendingFile(file); setPwdErr('Incorrect. Format: PAN lowercase + DOB DDMMYYYY  e.g. abcde1234f01011990'); toast.dismiss(tid); return }
      if (!res.ok) throw new Error(json.error)
      setAisData(json.data)
      toast.success(`${type.toUpperCase()} parsed! ${json.data.totalTDSDeducted ? fmt(json.data.totalTDSDeducted) + ' TDS found' : ''}`, { id: tid })
      setIncTab('salary')
    } catch (e: any) { toast.error(e.message, { id: tid }) }
    finally { setLoading(null) }
  }

  const handleSlip = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Max 10MB.'); return }
    setLoading('slip')
    const tid = toast.loading('Reading salary slip…')
    try {
      const b64 = await fileToBase64(file)
      const res = await fetch('/api/parse-salary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64Data: b64, mediaType: file.type }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSalary(json.data)
      toast.success('Salary slip parsed!', { id: tid })
    } catch (e: any) { toast.error(e.message, { id: tid }) }
    finally { setLoading(null) }
  }

  const handleOffer = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Max 10MB.'); return }
    setLoading('offer')
    const tid = toast.loading('Reading offer letter…')
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/parse-offer-letter', { method: 'POST', body: form })
      const text = await res.text()
      let json: any
      try { json = JSON.parse(text) } catch { throw new Error('Server error. Please try again.') }
      if (!res.ok) throw new Error(json.error)
      // Map offer letter to salary structure
      setSalary({ ...json.data, netSalary: Math.round((json.data.fixedCTC || json.data.totalCTC || 0) / 12 * 0.75), grossSalary: Math.round((json.data.fixedCTC || 0) / 12), employerName: json.data.employerName })
      toast.success('Offer letter parsed!', { id: tid })
    } catch (e: any) { toast.error(e.message, { id: tid }) }
    finally { setLoading(null) }
  }

  return (
    <div style={{ fontFamily: '"Sora",-apple-system,sans-serif', maxWidth: 860 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        .av-row:last-child{border-bottom:none!important}
        .av-link:hover{opacity:0.8}
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>My Profile</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Income and expenses in one place</p>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 22 }}>
        {[
          { label: 'Annual income', val: fmt(totalAnnual), pos: true },
          { label: 'Monthly take-home', val: fmt(salMonthly), pos: false },
          { label: 'Free to spend / mo', val: fmt(freeToSpend), pos: true },
          { label: '', val: '' },
        ].map((s, i) => i < 3 ? (
          <div key={i} style={{ background: C.card, padding: '13px 16px' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: s.pos ? C.fg : C.text, letterSpacing: '-0.02em' }}>{s.val || '—'}</div>
          </div>
        ) : (
          <div key={i} style={{ background: C.card, padding: '13px 16px' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Financial health</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              {health}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}> / 100 · {healthGrade}</span>
            </div>
            <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${health}%`, height: '100%', background: C.wm, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {(['income', 'expenses'] as const).map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={S.maintab(mainTab === t)}>
            {t === 'income' ? '💰 Income' : '📤 Expenses & Savings'}
          </button>
        ))}
      </div>

      {/* ── INCOME TAB ── */}
      {mainTab === 'income' && (
        <div>
          {/* Sub tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
            {([['tax', 'Tax Document'], ['salary', 'Salary'], ['other', 'Other Income']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setIncTab(k)} style={S.stab(incTab === k)}>{l}</button>
            ))}
          </div>

          {/* Tax document */}
          {incTab === 'tax' && (
            <div>
              <div style={S.insight}>Upload AIS or Form 26AS — auto-fills everything below. Both are optional.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>

                {/* AIS card */}
                <div style={S.upload(!!aisData)} onClick={() => !aisData && !loading && aisRef.current?.click()}>
                  {aisData ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div><p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>AIS</p><p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Annual Information Statement</p></div>
                        <span style={{ fontSize: 10, background: '#EEF2EE', color: C.fg, padding: '2px 7px', borderRadius: 3, border: `1px solid #C8D8C8`, fontWeight: 500 }}>Uploaded ✓</span>
                      </div>
                      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px' }}>Income sources found and auto-filled</p>
                      <button onClick={e => { e.stopPropagation(); setAisData(null) }} style={{ fontSize: 11, color: C.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Remove</button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 22 }}>📑</span>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{loading === 'ais' ? 'Reading…' : 'AIS'}</p>
                      <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>incometax.gov.in · Max 10MB</p>
                      {!loading && <div style={{ marginTop: 6, display: 'inline-block', padding: '6px 16px', background: C.fg, color: C.wheat, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Upload AIS</div>}
                    </div>
                  )}
                  <input ref={aisRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleDocFile(e.target.files[0], 'ais')} />
                </div>

                {/* 26AS card */}
                <div style={S.upload(false)} onClick={() => !loading && taxRef.current?.click()}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 22 }}>📋</span>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{loading === '26as' ? 'Reading…' : 'Form 26AS'}</p>
                    <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>No password · Max 10MB</p>
                    {!loading && <div style={{ marginTop: 6, display: 'inline-block', padding: '6px 16px', background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11 }}>Upload 26AS</div>}
                  </div>
                  <input ref={taxRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleDocFile(e.target.files[0], '26as')} />
                </div>
              </div>

              {/* Password modal */}
              {showPwd && pendingFile && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '16px 18px', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>🔐 AIS Password</p>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px', lineHeight: 1.6 }}>Format: PAN lowercase + DOB (DDMMYYYY)<br /><span style={{ fontFamily: 'monospace', color: C.fg }}>e.g. abcde1234f01011990</span></p>
                  <input type="text" value={pwd} onChange={e => { setPwd(e.target.value); setPwdErr('') }}
                    onKeyDown={e => e.key === 'Enter' && pendingFile && processDoc(pendingFile, pendingType, pwd)}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${pwdErr ? C.danger : C.border}`, borderRadius: 5, fontSize: 12.5, outline: 'none', marginBottom: 8, boxSizing: 'border-box', fontFamily: 'monospace' }} />
                  {pwdErr && <p style={{ fontSize: 11, color: C.danger, margin: '0 0 8px' }}>{pwdErr}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowPwd(false); setPendingFile(null) }} style={{ ...S.btn(false), flex: 1 }}>Cancel</button>
                    <button onClick={() => pendingFile && processDoc(pendingFile, pendingType, pwd)} style={{ ...S.btn(true), flex: 2 }}>Open →</button>
                  </div>
                </div>
              )}

              <button onClick={() => setIncTab('salary')} style={{ ...S.btn(true), width: '100%', padding: '11px' }}>Next: Add Salary →</button>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button onClick={() => setIncTab('salary')} style={{ background: 'none', border: 'none', fontSize: 12, color: C.fg, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Skip — enter salary manually →</button>
              </div>
            </div>
          )}

          {/* Salary */}
          {incTab === 'salary' && (
            <div>
              <div style={{ display: 'flex', gap: 2, background: '#F0EBE0', borderRadius: 5, padding: 3, marginBottom: 16, width: 'fit-content' }}>
                {([['slip', '📄 Salary Slip'], ['offer', '📨 Offer Letter'], ['manual', '✏️ Manual']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setSalMode(k)} style={{ padding: '6px 12px', borderRadius: 4, border: 'none', fontSize: 11.5, fontWeight: salMode === k ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', background: salMode === k ? C.card : 'transparent', color: salMode === k ? C.fg : C.muted, boxShadow: salMode === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Parsed salary result */}
              {salary ? (
                <div>
                  <div style={{ background: C.fg, borderRadius: 6, padding: '14px 16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 9, color: 'rgba(230,207,167,0.45)', letterSpacing: '0.08em', margin: '0 0 2px' }}>SALARY PARSED</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{salary.employerName || 'Your employer'}</p>
                      </div>
                      <button onClick={() => setSalary(null)} style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(230,207,167,0.1)', border: '1px solid rgba(230,207,167,0.2)', borderRadius: 4, color: 'rgba(230,207,167,0.7)', cursor: 'pointer', fontFamily: 'inherit' }}>↺ Change</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                      {[
                        { lbl: 'TAKE-HOME/MO', val: fmt(salary.netSalary || 0), col: C.wheat },
                        { lbl: 'GROSS/MO', val: fmt(salary.grossSalary || 0), col: '#fff' },
                        { lbl: 'ANNUAL', val: fmt((salary.grossSalary || 0) * 12), col: C.wheat },
                      ].map(s => (
                        <div key={s.lbl} style={{ background: 'rgba(230,207,167,0.08)', border: '1px solid rgba(230,207,167,0.12)', borderRadius: 4, padding: '8px 10px' }}>
                          <p style={{ fontSize: 9, color: 'rgba(230,207,167,0.45)', margin: '0 0 2px', letterSpacing: '0.06em' }}>{s.lbl}</p>
                          <p style={{ fontSize: 15, fontWeight: 700, color: s.col, margin: 0 }}>{s.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FBF0F0', border: `1px solid #F0CECE`, borderRadius: 5, padding: '9px 14px', marginBottom: 12 }}>
                    <span style={{ fontSize: 12.5, color: '#7A2020' }}>Uploaded the wrong document?</span>
                    <button onClick={() => setSalary(null)} style={{ fontSize: 11, padding: '5px 12px', background: C.danger, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>↺ Start over</button>
                  </div>
                </div>
              ) : (
                /* Upload zones */
                (salMode === 'slip' || salMode === 'offer') && (
                  <div style={S.upload(false)} onClick={() => !loading && (salMode === 'slip' ? slipRef : offerRef).current?.click()}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 28 }}>{salMode === 'slip' ? '📄' : '📨'}</span>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{loading ? 'Reading…' : `Upload ${salMode === 'slip' ? 'Salary Slip' : 'Offer Letter'}`}</p>
                      <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>PDF, JPG, PNG · Max 10MB</p>
                      {!loading && <div style={{ marginTop: 8, padding: '8px 24px', background: C.fg, color: C.wheat, borderRadius: 5, fontSize: 12.5, fontWeight: 600 }}>Browse Files</div>}
                    </div>
                    <input ref={slipRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleSlip(e.target.files[0])} />
                    <input ref={offerRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleOffer(e.target.files[0])} />
                  </div>
                )
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setIncTab('tax')} style={{ ...S.btn(false), padding: '10px 16px' }}>← Back</button>
                <button onClick={() => setIncTab('other')} style={{ ...S.btn(true), flex: 1 }}>Next: Other Income →</button>
              </div>
            </div>
          )}

          {/* Other income */}
          {incTab === 'other' && (
            <div>
              {aisData && otherSel.size > 0 && (
                <div style={S.insight}>{otherSel.size} income sources auto-filled from your AIS</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {OTHER_TYPES.map(type => {
                  const sel = otherSel.has(type.key)
                  return (
                    <div key={type.key} style={{ border: `1px solid ${sel ? C.fg : C.border}`, borderRadius: 5, overflow: 'hidden', background: C.card }}>
                      <button onClick={() => setOtherSel(prev => { const n = new Set(prev); sel ? n.delete(type.key) : n.add(type.key); return n })}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: sel ? C.wl : '#FAFAF8', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        <span style={{ fontSize: 16 }}>{type.icon}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: sel ? C.fg : C.text, margin: 0 }}>{type.label}</p>
                          <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{type.sub}</p>
                        </div>
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${sel ? C.fg : C.border}`, background: sel ? C.fg : C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {sel && <span style={{ fontSize: 9, color: C.wheat, fontWeight: 700 }}>✓</span>}
                        </div>
                      </button>
                      {sel && (
                        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}` }}>
                          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 5px' }}>Annual amount</p>
                          <AmtInput value={otherVals[type.key] || 0} onChange={v => setOtherVals(prev => ({ ...prev, [type.key]: v }))} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {totalAnnual > 0 && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '12px 16px', background: C.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 12.5, color: C.muted }}>Total annual income</span>
                  <span style={{ fontSize: 19, fontWeight: 700, color: C.fg }}>{fmt(totalAnnual)}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setIncTab('salary')} style={{ ...S.btn(false), padding: '10px 16px' }}>← Back</button>
                <button onClick={() => setMainTab('expenses')} style={{ ...S.btn(true), flex: 1 }}>Next: Add Expenses →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {mainTab === 'expenses' && (
        <div>
          {salMonthly > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <Donut exp={totalExp + totalVar} sav={totalSav} free={trulyFree} total={salMonthly} />
              <div style={{ flex: 1, minWidth: 150 }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 2px', letterSpacing: '-0.02em' }}>{fmt(trulyFree)}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>truly free / month</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                  {[{ c: C.danger, l: `${fmt(totalExp)} fixed` }, { c: '#D97706', l: `${fmt(totalVar)} variable` }, { c: C.wm, l: `${fmt(totalSav)} savings` }].map(d => (
                    <span key={d.l} style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.c, display: 'inline-block' }} />{d.l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', border: `2.5px solid ${C.wm}`, background: C.wl, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.fg, margin: 0, lineHeight: 1 }}>{health}</p>
                  <p style={{ fontSize: 8, color: C.muted, margin: 0 }}>/100</p>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.fg, margin: 0 }}>{healthGrade}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20 }}>
            <div>
              <div style={S.card}>
                <div style={S.cardHead}>Fixed Monthly Bills <button onClick={addExp} style={{ fontSize: 11, color: C.fg, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>+ Add</button></div>
                {expenses.map((exp, i) => (
                  <div key={exp.id} className="av-row" style={{ ...S.row, borderBottom: i < expenses.length - 1 ? `1px solid #FAF7F2` : 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span>{exp.icon}</span>{exp.label}</span>
                    <AmtInput value={exp.amount} onChange={v => updExp(exp.id, v)} />
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <div style={{ ...S.cardHead, background: '#FBF6EE', borderColor: '#EDD898' }}>
                  Variable Monthly Expenses
                  <button onClick={addVar} style={{ fontSize: 11, color: '#8A6A1A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>+ Add</button>
                </div>
                <div style={{ padding: '8px 14px', background: '#FAFAF6', borderBottom: `1px solid #FAF7F2`, fontSize: 11.5, color: C.muted, lineHeight: 1.6 }}>
                  Your typical monthly variable spend. Enter honest averages — this makes every ArthVo decision accurate.
                </div>
                {variable.map((v, i) => (
                  <div key={v.id} className="av-row" style={{ ...S.row, borderBottom: i < variable.length - 1 ? `1px solid #FAF7F2` : 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span>{v.icon}</span>{v.label}</span>
                    <AmtInput value={v.amount} onChange={amt => updVar(v.id, amt)} />
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <div style={S.cardHead}>Monthly Savings <button onClick={addSav} style={{ fontSize: 11, color: C.fg, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>+ Add</button></div>
                {savings.map((sv, i) => (
                  <div key={sv.id} className="av-row" style={{ ...S.row, borderBottom: i < savings.length - 1 ? `1px solid #FAF7F2` : 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span>{sv.icon}</span>{sv.label}</span>
                    <AmtInput value={sv.amount} onChange={v => updSav(sv.id, v)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Summary panel */}
            <div>
              <div style={S.card}>
                <div style={{ ...S.cardHead, justifyContent: 'center' }}>Monthly Breakdown</div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <Donut exp={totalExp} sav={totalSav} free={freeToSpend} total={salMonthly} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {[
                      { dot: C.danger, label: 'Fixed bills', val: fmt(totalExp) },
                      { dot: '#D97706', label: 'Variable', val: fmt(totalVar) },
                      { dot: C.wm, label: 'Savings', val: fmt(totalSav) },
                      { dot: C.fg, label: 'Truly free', val: fmt(trulyFree), bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, paddingTop: r.bold ? 6 : 0, borderTop: r.bold ? `1px solid ${C.border}` : 'none' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: r.bold ? C.fg : C.muted, fontWeight: r.bold ? 600 : 400 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.dot, display: 'inline-block' }} />{r.label}
                        </span>
                        <span style={{ fontWeight: r.bold ? 700 : 500, color: r.bold ? C.fg : C.text, fontSize: r.bold ? 14 : 12 }}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                  {salMonthly > 0 && savRate < 0.2 && (
                    <div style={S.insight}>💡 Savings rate {(savRate * 100).toFixed(0)}% — increase SIP by {fmt(salMonthly * 0.2 - totalSav)}/mo to hit 20%</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Link href="/dashboard/tax" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: C.fg, borderRadius: 6, textDecoration: 'none', marginTop: 4 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.wheat, margin: 0 }}>Go to Tax Optimiser →</p>
              <p style={{ fontSize: 11, color: 'rgba(230,207,167,0.5)', margin: 0 }}>Profile complete — see your tax breakdown</p>
            </div>
            <span style={{ color: C.wheat, fontSize: 18 }}>→</span>
          </Link>
        </div>
      )}
    </div>
  )
}
