'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/AppStore'
import { formatINRFull, formatINR, calcTotalTaxWithAIS } from '@/lib/tax-engine'
import { Card, SectionHeader, InfoBox, Badge, ProgressRow, PillTabs, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Tax slab breakdown visual ───────────────────────────────────────────
function SlabChart({ taxableIncome, regime }: { taxableIncome: number; regime: 'old' | 'new' }) {
  const slabs = regime === 'new'
    ? [
        { slab: '0–3L', rate: 0,  tax: 0 },
        { slab: '3–7L', rate: 5,  tax: Math.min(Math.max(0, taxableIncome - 300000), 400000) * 0.05 },
        { slab: '7–10L', rate: 10, tax: Math.min(Math.max(0, taxableIncome - 700000), 300000) * 0.10 },
        { slab: '10–12L', rate: 15, tax: Math.min(Math.max(0, taxableIncome - 1000000), 200000) * 0.15 },
        { slab: '12–15L', rate: 20, tax: Math.min(Math.max(0, taxableIncome - 1200000), 300000) * 0.20 },
        { slab: '15L+', rate: 30, tax: Math.max(0, taxableIncome - 1500000) * 0.30 },
      ].filter(s => s.tax > 0 || taxableIncome > 300000)
    : [
        { slab: '0–2.5L', rate: 0,  tax: 0 },
        { slab: '2.5–5L', rate: 5,  tax: Math.min(Math.max(0, taxableIncome - 250000), 250000) * 0.05 },
        { slab: '5–10L', rate: 20, tax: Math.min(Math.max(0, taxableIncome - 500000), 500000) * 0.20 },
        { slab: '10L+', rate: 30, tax: Math.max(0, taxableIncome - 1000000) * 0.30 },
      ].filter(s => s.tax > 0 || taxableIncome > 250000)

  const data = slabs.map(s => ({ name: `${s.slab}\n${s.rate}%`, tax: Math.round(s.tax), rate: s.rate }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={32} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5D6D7E' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          formatter={(v: any) => [`₹${v.toLocaleString('en-IN')}`, 'Tax in slab']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E9ED', fontSize: 12 }}
        />
        <Bar dataKey="tax" radius={[5, 5, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.rate === 30 ? '#C0392B' : d.rate === 20 ? '#E67E22' : d.rate === 15 ? '#F0A500' : d.rate > 0 ? '#1A3C5E' : '#E5E9ED'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Regime card ─────────────────────────────────────────────────────────
function RegimeCard({ result, recommended }: { result: any; recommended: boolean }) {
  return (
    <div style={{ background: '#fff', border: `2px solid ${recommended ? '#E67E22' : '#E5E9ED'}`, borderRadius: 14, padding: '22px 24px', flex: 1, position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.2s', boxShadow: recommended ? '0 4px 20px rgba(230,126,34,0.15)' : 'none' }}>
      {recommended && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: '#E67E22', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: '0 14px 0 10px', letterSpacing: '0.05em' }}>
          ✓ RECOMMENDED
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#5D6D7E', marginBottom: 6 }}>
        {result.regime === 'old' ? 'Old Tax Regime' : 'New Tax Regime (Default)'}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: recommended ? '#E67E22' : '#1C2833', marginBottom: 4 }}>
        ₹{result.totalTax?.toLocaleString('en-IN')}
      </div>
      <div style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 18 }}>
        Annual tax · ₹{result.monthlyTDS?.toLocaleString('en-IN')}/mo TDS · {result.effectiveRate}% effective rate
      </div>
      {[
        ['Gross Income', `₹${result.grossIncome?.toLocaleString('en-IN')}`],
        ['Deductions', `₹${result.totalDeductions?.toLocaleString('en-IN')}`],
        ['Taxable Income', `₹${result.taxableIncome?.toLocaleString('en-IN')}`],
        ['Basic Tax', `₹${result.basicTax?.toLocaleString('en-IN')}`],
        result.rebate87A > 0 && ['Rebate (87A)', `−₹${result.rebate87A?.toLocaleString('en-IN')}`],
        result.surcharge > 0 && ['Surcharge', `₹${result.surcharge?.toLocaleString('en-IN')}`],
        ['Cess (4%)', `₹${result.cess?.toLocaleString('en-IN')}`],
      ].filter((x): x is string[] => Array.isArray(x)).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #F5F5F5', fontSize: 12 }}>
          <span style={{ color: '#5D6D7E' }}>{k}</span>
          <span style={{ fontWeight: 600, color: k.startsWith('Rebate') ? '#1E8449' : '#1C2833' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Deduction suggestion card ────────────────────────────────────────────
function SuggestionCard({ s }: { s: any }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, background: '#FEF3E2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💰</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833' }}>Section {s.section}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E8449' }}>Save ~₹{s.potentialSaving?.toLocaleString('en-IN')}</div>
        </div>
        <ProgressRow label={`Used ₹${s.current?.toLocaleString('en-IN')}`} value={s.current} max={s.max} color="#1A3C5E"
          format={v => `₹${v.toLocaleString('en-IN')}`} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {s.products?.map((p: string) => (
            <span key={p} style={{ fontSize: 11, background: '#E8F1FA', color: '#1A3C5E', padding: '2px 8px', borderRadius: 20 }}>{p}</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#5D6D7E', marginTop: 5 }}>Gap: ₹{s.gap?.toLocaleString('en-IN')} still available this FY</div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function TaxPage() {
  const { salary, taxComparison, setTaxComparison } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('Comparison')
  const [deductions, setDeductions] = useState({ section80C: 0, section80CCD1B: 0, section80D: 0, section24b: 0, otherDeductions: 0 })
  const [rentPaid, setRentPaid] = useState(0)
  const [isMetro, setIsMetro] = useState(true)
  const [aisData, setAisData] = useState<any>(null)
  const [aisLoading, setAisLoading] = useState(false)
  const aisRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)

  // Password modal state
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pdfPassword, setPdfPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (salary?.employeePF) {
      setDeductions(d => ({ ...d, section80C: Math.min(salary.employeePF * 12, 150000) }))
    }
  }, [salary])

  // Handle AIS PDF or image upload
  const handleAISFile = useCallback(async (file: File) => {
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a PDF or image'); return
    }
    if (file.type === 'application/pdf') {
      setPendingFile(file)
      setPdfPassword('')
      setPasswordError('')
      setShowPasswordModal(true)
      return
    }
    await processAISFile(file, '')
  }, [])

  // Send file directly to server for rendering
  const processAISFile = useCallback(async (file: File, password: string) => {
    setAisLoading(true)
    setShowPasswordModal(false)
    const tid = toast.loading('Reading your AIS / Form 26AS…')
    try {
      const base64Data = await fileToBase64(file)
      const res = await fetch('/api/parse-ais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mediaType: file.type,
          password: password || undefined,
        }),
      })
      const json = await res.json()
      if (res.status === 422 || json.error === 'incorrect_password') {
        setShowPasswordModal(true)
        setPendingFile(file)
        setPasswordError('Incorrect password. Format: PAN lowercase + DOB as DDMMYYYY. Example: aizpn6725a05121998')
        toast.dismiss(tid)
        return
      }
      if (!res.ok) throw new Error(json.error)
      setAisData(json.data)
      setPendingFile(null)
      setPdfPassword('')
      toast.success(`Parsed! TDS: ₹${(json.data.totalTDSDeducted || 0).toLocaleString('en-IN')}`, { id: tid })
    } catch (e: any) {
      toast.error(e.message || 'Failed. Try a screenshot instead.', { id: tid })
    } finally {
      setAisLoading(false)
    }
  }, [])

  // Handle JSON file from IT portal
  const uploadAISJson = useCallback(async (file: File) => {
    setAisLoading(true)
    const tid = toast.loading('Reading AIS JSON…')
    try {
      const text = await file.text()
      const jsonData = JSON.parse(text)
      const res = await fetch('/api/parse-ais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonData }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAisData(json.data)
      toast.success(`AIS loaded! TDS: ₹${(json.data.totalTDSDeducted || 0).toLocaleString('en-IN')}`, { id: tid })
    } catch (e: any) {
      toast.error(e.message || 'Failed to read JSON. Make sure it is the AIS JSON from incometax.gov.in', { id: tid })
    } finally {
      setAisLoading(false)
    }
  }, [])

  const uploadAIS = handleAISFile

  const calculate = async () => {
    if (!salary) return
    setLoading(true)
    const toastId = toast.loading('Calculating both regimes…')
    try {
      const res = await fetch('/api/tax-calc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salary, deductions, rentPaidMonthly: rentPaid, isMetroCity: isMetro }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setTaxComparison(json.comparison)
      setSuggestions(json.suggestions || [])
      toast.success(`Best regime: ${json.comparison.recommendation === 'new' ? 'New' : 'Old'} · saves ₹${json.comparison.savings.toLocaleString('en-IN')}/yr`, { id: toastId })
    } catch (e: any) {
      toast.error(e.message || 'Calculation failed', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  if (!salary) {
    return (
      <EmptyState icon="📊" title="No salary data yet"
        desc="Upload your salary slip first to get a personalised tax regime comparison."
        action={<Link href="/dashboard/salary" style={{ padding: '11px 24px', background: '#E67E22', color: '#fff', borderRadius: 9, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Upload Salary Slip →</Link>} />
    )
  }

  const deductionFields = [
    { key: 'section80C', label: '80C — EPF, ELSS, PPF, NSC, LIC', max: 150000, hint: 'Auto-filled from your PF. Add ELSS/PPF top-up.' },
    { key: 'section80CCD1B', label: '80CCD(1B) — NPS (Additional)', max: 50000, hint: 'Over and above 80C — NPS Tier 1 only' },
    { key: 'section80D', label: '80D — Health Insurance Premiums', max: 50000, hint: 'Self/family ₹25K + parents ₹25K (₹50K if senior)' },
    { key: 'section24b', label: 'Sec 24(b) — Home Loan Interest', max: 200000, hint: 'Self-occupied property only — max ₹2L' },
    { key: 'otherDeductions', label: 'Others — 80E, 80G, 80TTA…', max: 100000, hint: 'Education loan, donations, savings interest' },
  ]

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ─── Input Panel ────────────────────────────── */}
        <Card style={{ position: 'sticky', top: 80 }}>
          <SectionHeader title="Your Deductions" sub="Old Regime only — New Regime ignores these" />

          {deductionFields.map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1C2833' }}>{f.label}</label>
                <span style={{ fontSize: 10, color: '#95A5A6' }}>Max ₹{(f.max / 100000).toFixed(1)}L</span>
              </div>
              <input type="number" value={(deductions as any)[f.key] || ''}
                onChange={e => setDeductions(d => ({ ...d, [f.key]: Number(e.target.value) || 0 }))}
                placeholder="0"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, color: '#1C2833', outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => (e.target.style.borderColor = '#1A3C5E')}
                onBlur={e => (e.target.style.borderColor = '#E5E9ED')} />
              <div style={{ height: 4, background: '#F1F2F4', borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((deductions as any)[f.key] / f.max) * 100)}%`, background: '#1A3C5E', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize: 10, color: '#95A5A6', marginTop: 3 }}>{f.hint}</div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2833', marginBottom: 10 }}>HRA Exemption</div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: '#5D6D7E', display: 'block', marginBottom: 4 }}>Monthly Rent Paid (₹)</label>
              <input type="number" value={rentPaid || ''} onChange={e => setRentPaid(Number(e.target.value) || 0)} placeholder="0"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = '#1A3C5E')}
                onBlur={e => (e.target.style.borderColor = '#E5E9ED')} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5D6D7E', cursor: 'pointer' }}>
              <input type="checkbox" checked={isMetro} onChange={e => setIsMetro(e.target.checked)} style={{ accentColor: '#1A3C5E' }} />
              Metro city (Delhi/Mumbai/Chennai/Kolkata)
            </label>
          </div>

          <button onClick={calculate} disabled={loading}
            style={{ width: '100%', padding: '13px', background: loading ? '#ccc' : '#1A3C5E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', transition: 'background 0.15s' }}>
            {loading ? '⟳ Calculating…' : '📊 Calculate Tax'}
          </button>

          {/* AIS Upload */}
          <div style={{ marginTop: 16, borderTop: '1px solid #F0F0F0', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2833', marginBottom: 4 }}>
              Form 26AS / AIS Upload
            </div>
            <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 10, lineHeight: 1.5 }}>
              Download from incometax.gov.in for accurate TDS data
            </div>

            {/* Password entry panel */}
            {showPasswordModal && pendingFile && (
              <div style={{ background: '#F8FAFB', border: '1px solid #E5E9ED', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>🔐 PDF Password Required</div>
                <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 8, lineHeight: 1.6 }}>
                  Password = PAN (lowercase) + DOB (DDMMYYYY)<br />
                  <span style={{ fontFamily: 'monospace', color: '#1A3C5E', fontSize: 10 }}>e.g. abcde1234f01011990</span>
                </div>
                <input
                  type="text"
                  value={pdfPassword}
                  onChange={e => { setPdfPassword(e.target.value); setPasswordError('') }}
                  placeholder="abcde1234f01011990"
                  onKeyDown={e => e.key === 'Enter' && processAISFile(pendingFile, pdfPassword)}
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${passwordError ? '#C0392B' : '#E5E9ED'}`, borderRadius: 8, fontSize: 12, color: '#1C2833', outline: 'none', fontFamily: 'monospace', marginBottom: 6, boxSizing: 'border-box' }}
                />
                {passwordError && <div style={{ fontSize: 11, color: '#C0392B', marginBottom: 6 }}>{passwordError}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setShowPasswordModal(false); setPendingFile(null); setPdfPassword('') }}
                    style={{ flex: 1, padding: '7px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#5D6D7E' }}>
                    Cancel
                  </button>
                  <button onClick={() => processAISFile(pendingFile, pdfPassword)}
                    disabled={!pdfPassword || aisLoading}
                    style={{ flex: 1, padding: '7px', background: pdfPassword ? '#1A3C5E' : '#ccc', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: pdfPassword ? 'pointer' : 'default' }}>
                    {aisLoading ? '⟳…' : 'Open →'}
                  </button>
                </div>
              </div>
            )}

            {aisData ? (
              <div style={{ background: '#E9F7EF', border: '1px solid #A9DFBF', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#1E5631', fontWeight: 600, marginBottom: 2 }}>✓ AIS Loaded — {aisData.taxpayerName || 'Taxpayer'}</div>
                <div style={{ fontSize: 12, color: '#1E8449', fontWeight: 600 }}>Total TDS: ₹{(aisData.totalTDSDeducted || 0).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: '#27AE60', marginTop: 2 }}>Tax Credit: ₹{(aisData.totalTaxCredit || 0).toLocaleString('en-IN')}</div>
                <button onClick={() => setAisData(null)} style={{ fontSize: 10, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>Remove ×</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => aisRef.current?.click()} disabled={aisLoading}
                  style={{ width: '100%', padding: '10px 12px', background: '#E9F7EF', border: '1px solid #A9DFBF', borderRadius: 9, fontSize: 12, color: '#1E5631', cursor: 'pointer', fontWeight: 600, textAlign: 'left' }}>
                  {aisLoading ? '⟳ Reading…' : '📄 Upload Form 26AS / AIS PDF'}
                </button>
                <div style={{ fontSize: 10, color: '#5D6D7E', paddingLeft: 4, lineHeight: 1.5 }}>
                  Download from incometax.gov.in → Form 26AS → Download PDF
                </div>
              </div>
            )}

            <input ref={aisRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && uploadAIS(e.target.files[0])} />
          </div>

          {taxComparison && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: taxComparison.recommendation === 'new' ? '#FEF3E2' : '#E8F1FA', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: taxComparison.recommendation === 'new' ? '#92400E' : '#1A3C5E' }}>
                ✓ Switch to {taxComparison.recommendation === 'new' ? 'New' : 'Old'} Regime
              </div>
              <div style={{ fontSize: 11, color: '#5D6D7E', marginTop: 3 }}>
                Save ₹{taxComparison.savings.toLocaleString('en-IN')}/yr ({taxComparison.savingsPercent}% less)
              </div>
            </div>
          )}
        </Card>

        {/* ─── Results Panel ──────────────────────────── */}
        <div>
          {!taxComparison && !loading && (
            <div style={{ textAlign: 'center', padding: '70px 20px', background: '#fff', borderRadius: 14, border: '1px solid #E5E9ED' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Fill your deductions and click Calculate</div>
              <div style={{ fontSize: 13, color: '#5D6D7E', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
                We'll compare both tax regimes side-by-side and show you the exact rupee amount you save by choosing the right one.
              </div>
            </div>
          )}

          {taxComparison && (
            <div className="fade-in">
              {/* Tabs */}
              <div style={{ marginBottom: 20 }}>
                <PillTabs tabs={['Comparison', 'Slab Breakdown', 'Save More', 'Advance Tax', 'AI Insights', 'TDS Data', 'AIS Analysis']} active={activeTab} onChange={setActiveTab} />
              </div>

              {activeTab === 'Comparison' && (
                <>
                  {/* AIS TDS Credit Banner — shown when AIS is uploaded */}
                  {aisData && aisData.totalTDSDeducted > 0 && (
                    <div style={{ background: '#E9F7EF', border: '1px solid #A9DFBF', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1E5631', marginBottom: 3 }}>
                          ✓ TDS Already Deducted (from Form 26AS)
                        </div>
                        <div style={{ fontSize: 12, color: '#27AE60' }}>
                          {aisData.taxpayerName} · AY {aisData.assessmentYear} · Employer: {aisData.tdsEntries?.[0]?.deductorName}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 2 }}>TOTAL TDS DEDUCTED</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#1E8449' }}>₹{(aisData.totalTDSDeducted || 0).toLocaleString('en-IN')}</div>
                        {taxComparison && (
                          <div style={{ fontSize: 12, color: '#1E8449', marginTop: 2 }}>
                            Balance tax due: ₹{Math.max(0, taxComparison[taxComparison.recommendation].totalTax - (aisData.totalTDSDeducted || 0)).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Savings banner */}
                  <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 14, padding: '18px 24px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                        Choose <span style={{ color: '#E67E22' }}>{taxComparison.recommendation === 'new' ? 'New Tax Regime' : 'Old Tax Regime'}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                        {taxComparison.savingsPercent}% lower tax · ₹{Math.round(taxComparison.savings / 12).toLocaleString('en-IN')} less per month
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>ANNUAL SAVINGS</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: '#4ADE80' }}>₹{taxComparison.savings.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
                    <RegimeCard result={taxComparison.old} recommended={taxComparison.recommendation === 'old'} />
                    <RegimeCard result={taxComparison.new} recommended={taxComparison.recommendation === 'new'} />
                  </div>

                  <Card>
                    <SectionHeader title="Which regime should I choose?" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      {[
                        { regime: 'Old Regime', color: '#1A3C5E', icon: '📋', points: ['Your 80C investments total ₹1.5L+', 'You pay rent and claim HRA', 'Home loan with high interest', "Parents' health insurance ₹25K+", 'NPS contribution via 80CCD(1B)'] },
                        { regime: 'New Regime', color: '#E67E22', icon: '✨', points: ['You invest little or have few deductions', 'Income up to ₹7L is zero tax (87A rebate)', 'Standard deduction ₹75,000 built-in', 'Simpler filing — fewer documents needed', 'Default regime for FY 2024-25 onwards'] },
                      ].map(r => (
                        <div key={r.regime}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: r.color, marginBottom: 10 }}>{r.icon} {r.regime} wins when…</div>
                          {r.points.map(p => (
                            <div key={p} style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 6, display: 'flex', gap: 6 }}>
                              <span style={{ color: r.color, flexShrink: 0 }}>✓</span> {p}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}

              {activeTab === 'Slab Breakdown' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {(['old', 'new'] as const).map(r => (
                    <Card key={r}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 2 }}>
                        {r === 'old' ? 'Old' : 'New'} Regime — Tax Per Slab
                      </div>
                      <div style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 12 }}>
                        Taxable income: ₹{taxComparison[r].taxableIncome?.toLocaleString('en-IN')}
                      </div>
                      <SlabChart taxableIncome={taxComparison[r].taxableIncome} regime={r} />
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: '#5D6D7E' }}>Total Tax</span>
                        <span style={{ fontWeight: 700, color: taxComparison.recommendation === r ? '#1E8449' : '#1C2833' }}>
                          ₹{taxComparison[r].totalTax?.toLocaleString('en-IN')}
                          {taxComparison.recommendation === r && <span style={{ marginLeft: 6, fontSize: 11, background: '#E9F7EF', color: '#1E8449', padding: '2px 6px', borderRadius: 10 }}>Best</span>}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === 'Save More' && (
                <div>
                  {suggestions.length > 0 ? (
                    <>
                      <InfoBox variant="success" icon="🎯">
                        You can save up to <strong>₹{suggestions.reduce((s: number, x: any) => s + x.potentialSaving, 0).toLocaleString('en-IN')}</strong> more in tax by fully utilising available deductions under the Old Regime.
                      </InfoBox>
                      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {suggestions.map((s, i) => <SuggestionCard key={i} s={s} />)}
                      </div>
                    </>
                  ) : (
                    <InfoBox variant="success" icon="✅">
                      <strong>You're fully optimised!</strong> Your declared deductions are near the maximum limits. No additional tax savings remain under the Old Regime — the calculator already used your best case.
                    </InfoBox>
                  )}

                  <Card style={{ marginTop: 16 }}>
                    <SectionHeader title="Form 12BB Reminder" sub="Submit to your employer to reduce monthly TDS" />
                    <div style={{ fontSize: 13, color: '#5D6D7E', lineHeight: 1.7 }}>
                      Submitting <strong>Form 12BB</strong> with your investment proofs reduces the TDS your employer deducts each month. This means more money in your pocket throughout the year instead of waiting for ITR refund.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 14 }}>
                      {[
                        { icon: '🏠', text: 'HRA — Rent receipts + landlord PAN (if >₹1L/yr)' },
                        { icon: '📋', text: '80C — Investment proofs: ELSS statements, PPF passbook' },
                        { icon: '🏥', text: '80D — Health insurance premium receipts' },
                        { icon: '🏦', text: '24(b) — Home loan interest certificate from bank' },
                      ].map(item => (
                        <div key={item.text} style={{ background: '#F8FAFB', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#5D6D7E', lineHeight: 1.5 }}>
                          <span style={{ marginRight: 6 }}>{item.icon}</span>{item.text}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
              {activeTab === 'Advance Tax' && (
                <div className="fade-in">
                  {(() => {
                    const totalTax = taxComparison[taxComparison.recommendation].totalTax

                    // Use AIS TDS if available, otherwise use salary slip TDS
                    const tdsFromAIS = aisData ? (aisData.totalTDSDeducted || 0) : 0
                    const tdsFromSlip = (salary?.tdsDeducted || 0) * 12
                    const tdsDeducted = tdsFromAIS > 0 ? tdsFromAIS : tdsFromSlip
                    const tdsSource = tdsFromAIS > 0 ? 'Form 26AS' : 'Salary Slip'

                    // Advance tax = total tax - TDS already deducted
                    const advanceTaxDue = Math.max(0, totalTax - tdsDeducted)

                    // Only liable if net tax after TDS > ₹10,000 (Section 208)
                    const isLiable = advanceTaxDue > 10000

                    const today = new Date()
                    const currentYear = today.getFullYear()

                    // Installments are % of ADVANCE TAX DUE (not total tax)
                    // 15% by June 15, 45% by Sept 15, 75% by Dec 15, 100% by March 15
                    const installments = [
                      { due: `15 June ${currentYear}`, pct: 15, amount: Math.round(advanceTaxDue * 0.15), label: '1st Installment', month: 5 },
                      { due: `15 September ${currentYear}`, pct: 45, amount: Math.round(advanceTaxDue * 0.30), label: '2nd Installment', month: 8 },
                      { due: `15 December ${currentYear}`, pct: 75, amount: Math.round(advanceTaxDue * 0.30), label: '3rd Installment', month: 11 },
                      { due: `15 March ${currentYear + 1}`, pct: 100, amount: Math.round(advanceTaxDue * 0.25), label: '4th Installment', month: 2 },
                    ]
                    const isPast = (month: number) => month < today.getMonth()
                    const isNext = (month: number, idx: number) => !isPast(month) && (idx === 0 || isPast(installments[idx-1].month))
                    return (
                      <>
                        {/* Summary */}
                        <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 14, padding: '20px 24px', marginBottom: 18, color: '#fff' }}>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>ADVANCE TAX LIABILITY (AFTER TDS)</div>
                          <div style={{ fontSize: 36, fontWeight: 800, color: isLiable ? '#FBBF24' : '#4ADE80', marginBottom: 8 }}>
                            ₹{advanceTaxDue.toLocaleString('en-IN')}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                            {[
                              { label: 'Total Tax', value: `₹${totalTax.toLocaleString('en-IN')}` },
                              { label: `TDS Deducted (${tdsSource})`, value: `−₹${tdsDeducted.toLocaleString('en-IN')}` },
                              { label: 'Advance Tax Due', value: `₹${advanceTaxDue.toLocaleString('en-IN')}` },
                            ].map(s => (
                              <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' }}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{s.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {!isLiable && (
                          <InfoBox variant="success" icon="✅">
                            <strong>No advance tax required.</strong> Your TDS of ₹{tdsDeducted.toLocaleString('en-IN')} (from {tdsSource}) already covers your full tax liability of ₹{totalTax.toLocaleString('en-IN')}. Net balance: ₹{advanceTaxDue.toLocaleString('en-IN')} — well below the ₹10,000 threshold for advance tax under Section 208.
                            {advanceTaxDue === 0 && tdsDeducted > totalTax && (
                              <div style={{ marginTop: 6 }}>
                                <strong>Refund expected:</strong> You have excess TDS of ₹{(tdsDeducted - totalTax).toLocaleString('en-IN')}. File your ITR to claim this refund.
                              </div>
                            )}
                          </InfoBox>
                        )}

                        {isLiable && (
                          <>
                            <Card style={{ marginBottom: 16 }}>
                              <SectionHeader title="Installment Schedule — FY 2024-25" sub="Each installment is % of your advance tax due (not total tax)" />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {installments.map((inst, i) => {
                                  const past = isPast(inst.month)
                                  const next = isNext(inst.month, i)
                                  return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: next ? '#FEF3E2' : past ? '#F8FAFB' : '#fff', border: `1px solid ${next ? '#F0C070' : '#E5E9ED'}` }}>
                                      <div style={{ width: 44, height: 44, borderRadius: 10, background: next ? '#E67E22' : past ? '#E5E9ED' : '#E8F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: next ? '#fff' : past ? '#95A5A6' : '#1A3C5E', flexShrink: 0 }}>
                                        {inst.pct}%
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: past ? '#95A5A6' : '#1C2833' }}>{inst.label}</div>
                                            <div style={{ fontSize: 11, color: '#5D6D7E', marginTop: 2 }}>Due: {inst.due} · Cumulative {inst.pct}% of advance tax</div>
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: past ? '#95A5A6' : next ? '#E67E22' : '#1A3C5E' }}>₹{inst.amount.toLocaleString('en-IN')}</div>
                                            {next && <div style={{ fontSize: 10, color: '#E67E22', fontWeight: 600, marginTop: 2 }}>PAY NEXT</div>}
                                            {past && <div style={{ fontSize: 10, color: '#95A5A6', marginTop: 2 }}>DUE PASSED</div>}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </Card>

                            <InfoBox variant="warning" icon="⚠️">
                              <strong>Late payment penalty:</strong> Missing advance tax installments attracts 1% interest per month under Section 234B and 234C. On ₹{advanceTaxDue.toLocaleString('en-IN')}, a 3-month delay costs approximately ₹{Math.round(advanceTaxDue * 0.03).toLocaleString('en-IN')} extra.
                            </InfoBox>
                          </>
                        )}

                        {!aisData && (
                          <div style={{ marginTop: 12 }}>
                            <InfoBox variant="info" icon="💡">
                              Upload your <strong>Form 26AS</strong> in the left panel for accurate TDS data. Currently using salary slip TDS of ₹{tdsFromSlip.toLocaleString('en-IN')}/yr.
                            </InfoBox>
                          </div>
                        )}

                        <Card style={{ marginTop: 16 }}>
                          <SectionHeader title="Who needs to pay advance tax?" />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                              { icon: '💼', text: 'Salaried employees — only if tax liability after TDS exceeds ₹10,000' },
                              { icon: '🧑‍💼', text: 'Self-employed / freelancers — if annual tax exceeds ₹10,000' },
                              { icon: '📈', text: 'Investors with capital gains — if gains cause tax liability above ₹10,000' },
                              { icon: '👴', text: 'Senior citizens (60+) with no business income — exempt from advance tax' },
                            ].map(item => (
                              <div key={item.text} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#5D6D7E', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                                <span style={{ flexShrink: 0 }}>{item.icon}</span> {item.text}
                              </div>
                            ))}
                          </div>
                        </Card>
                      </>
                    )
                  })()}
                </div>
              )}

              {activeTab === 'AI Insights' && (
                <div className="fade-in">
                  {(() => {
                    const rec = taxComparison.recommendation
                    const result = taxComparison[rec]
                    const annualGross = (salary?.grossSalary || 0) * 12
                    const insights = []

                    if (taxComparison.savings > 5000) {
                      insights.push({ type: 'urgent', icon: '🚨', title: 'Wrong tax regime costing you money', desc: `Aap abhi ${rec === 'new' ? 'Old' : 'New'} regime mein ho — switch karne se ₹${taxComparison.savings.toLocaleString('en-IN')}/year bachega. Yeh ${rec === 'new' ? 'Old' : 'New'} Regime better hai aapke liye.` })
                    }

                    const pfAnnual = (salary?.employeePF || 0) * 12
                    const gap80C = Math.max(0, 150000 - pfAnnual)
                    if (gap80C > 10000 && rec === 'old') {
                      insights.push({ type: 'save', icon: '💰', title: `80C mein ₹${gap80C.toLocaleString('en-IN')} bacha sakte ho`, desc: `Aapka PF ₹${pfAnnual.toLocaleString('en-IN')}/yr hai. 80C limit ₹1,50,000 hai. ₹${gap80C.toLocaleString('en-IN')} ELSS ya PPF mein lagao — approximately ₹${Math.round(gap80C * 0.3).toLocaleString('en-IN')} tax bachega.` })
                    }

                    if ((salary?.tdsDeducted || 0) > result.monthlyTDS + 2000) {
                      insights.push({ type: 'refund', icon: '💸', title: 'TDS zyada cut ho raha hai', desc: `Employer ₹${salary?.tdsDeducted?.toLocaleString('en-IN')}/mo TDS kaat raha hai, lekin actual liability sirf ₹${result.monthlyTDS.toLocaleString('en-IN')}/mo hai. Form 12BB submit karo — monthly ₹${((salary?.tdsDeducted || 0) - result.monthlyTDS).toLocaleString('en-IN')} zyada haath mein aayega.` })
                    }

                    if ((salary?.tdsDeducted || 0) < result.monthlyTDS - 2000) {
                      insights.push({ type: 'warning', icon: '⚠️', title: 'TDS kam cut ho raha hai — notice aa sakta hai', desc: `Employer sirf ₹${salary?.tdsDeducted?.toLocaleString('en-IN')}/mo TDS kaat raha hai, lekin aapki liability ₹${result.monthlyTDS.toLocaleString('en-IN')}/mo hai. March mein bada payment bachao — employer ko sahi declaration do.` })
                    }

                    if (annualGross > 700000 && annualGross < 775000 && rec === 'new') {
                      insights.push({ type: 'save', icon: '🎯', title: '₹7L ke paas ho — zero tax possible!', desc: `Aapki income ₹${(annualGross/100000).toFixed(1)}L hai. New Regime mein ₹7L tak zero tax hota hai (87A rebate). Thoda investment badhao ya NPS contribution karo — pure zero tax ho sakta hai.` })
                    }

                    if (insights.length === 0) {
                      insights.push({ type: 'good', icon: '✅', title: 'Sab theek lag raha hai!', desc: 'Aapki tax situation optimised hai. Sahi regime choose ki hai, TDS sahi hai. Bas investments timely karo aur Form 12BB submit karo.' })
                    }

                    const colors: Record<string, { bg: string; border: string; iconBg: string }> = {
                      urgent: { bg: '#FDEDEC', border: '#F5C6C2', iconBg: '#C0392B' },
                      save:   { bg: '#E9F7EF', border: '#A9DFBF', iconBg: '#1E8449' },
                      refund: { bg: '#E8F1FA', border: '#A8CCE8', iconBg: '#1A3C5E' },
                      warning:{ bg: '#FEF3E2', border: '#F0C070', iconBg: '#E67E22' },
                      good:   { bg: '#E9F7EF', border: '#A9DFBF', iconBg: '#1E8449' },
                    }

                    return (
                      <>
                        <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 16 }}>
                          Aapki salary aur tax data ke basis pe personalised insights — kya karna chahiye aur kya avoid karna chahiye.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {insights.map((ins, i) => {
                            const c = colors[ins.type]
                            return (
                              <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                                  {ins.icon}
                                </div>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>{ins.title}</div>
                                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{ins.desc}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <Card style={{ marginTop: 16 }}>
                          <SectionHeader title="Quick action checklist" sub="Ye karo is financial year mein" />
                          {[
                            { done: taxComparison.recommendation !== null, text: 'Sahi tax regime identify karo' },
                            { done: (salary?.employeePF || 0) > 0, text: 'Form 12BB employer ko submit karo' },
                            { done: false, text: '80C investments complete karo (ELSS/PPF/NPS)' },
                            { done: false, text: 'Health insurance le lo (80D benefit)' },
                            { done: false, text: 'Advance tax dates calendar mein set karo' },
                          ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F5F5F5', fontSize: 13, color: item.done ? '#1E8449' : '#5D6D7E' }}>
                              <span style={{ fontSize: 16 }}>{item.done ? '✅' : '⬜'}</span>
                              {item.text}
                            </div>
                          ))}
                        </Card>
                      </>
                    )
                  })()}
                </div>
              )}

              {activeTab === 'TDS Data' && (
                <div className="fade-in">
                  {!aisData ? (
                    <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', borderRadius: 14, border: '1px solid #E5E9ED' }}>
                      <div style={{ fontSize: 40, marginBottom: 14 }}>📄</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Upload Form 26AS or AIS</div>
                      <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 20, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 20px' }}>
                        Download your AIS from incometax.gov.in and upload here to see your complete TDS picture — employer wise, quarter wise.
                      </div>
                      <div style={{ background: '#F8FAFB', borderRadius: 12, padding: '16px 20px', marginBottom: 16, textAlign: 'left', maxWidth: 440, margin: '0 auto 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833', marginBottom: 10 }}>How to download AIS:</div>
                        {[
                          'Go to incometax.gov.in and login',
                          'Click "Annual Information Statement (AIS)"',
                          'Download as PDF',
                          'Upload here using the button in the left panel',
                        ].map((step, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: '#5D6D7E', marginBottom: 6 }}>
                            <span style={{ width: 20, height: 20, background: '#1A3C5E', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                            {step}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => aisRef.current?.click()}
                        style={{ padding: '11px 28px', background: '#1A3C5E', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        📄 Upload Form 26AS / AIS
                      </button>
                      <input ref={aisRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                        onChange={e => e.target.files?.[0] && uploadAIS(e.target.files[0])} />
                    </div>
                  ) : (
                    <>
                      {/* Summary cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                        {[
                          { label: 'Total TDS Deducted', value: `₹${aisData.totalTDSDeducted?.toLocaleString('en-IN')}`, color: '#1A3C5E' },
                          { label: 'Tax Payments Made', value: `₹${aisData.totalTaxPaid?.toLocaleString('en-IN')}`, color: '#1E8449' },
                          { label: 'Total Tax Credit', value: `₹${aisData.totalTaxCredit?.toLocaleString('en-IN')}`, color: '#E67E22' },
                        ].map(s => (
                          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 12, padding: '16px' }}>
                            <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 6 }}>{s.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* TDS entries */}
                      {aisData.tdsEntries?.length > 0 && (
                        <Card style={{ marginBottom: 16 }}>
                          <SectionHeader title="TDS Deducted — Deductor Wise" sub={`${aisData.assessmentYear} · ${aisData.taxpayerName}`} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {aisData.tdsEntries.map((entry: any, i: number) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#F8FAFB', borderRadius: 10, border: '1px solid #F0F0F0' }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833' }}>{entry.deductorName}</div>
                                  <div style={{ fontSize: 11, color: '#5D6D7E', marginTop: 2 }}>
                                    {entry.incomeType === 'salary' ? '💼 Salary' : entry.incomeType === 'interest' ? '🏦 Interest' : entry.incomeType === 'rent' ? '🏠 Rent' : '📋 Other'} · TAN: {entry.deductorTAN || 'N/A'} · {entry.quarter}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: '#C0392B' }}>TDS: ₹{entry.tdsDeducted?.toLocaleString('en-IN')}</div>
                                  <div style={{ fontSize: 11, color: '#5D6D7E' }}>Gross: ₹{entry.grossAmount?.toLocaleString('en-IN')}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Tax payments */}
                      {aisData.taxPayments?.length > 0 && (
                        <Card style={{ marginBottom: 16 }}>
                          <SectionHeader title="Tax Payments Made" sub="Advance tax and self-assessment tax" />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {aisData.taxPayments.map((pmt: any, i: number) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #A9DFBF' }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833' }}>{pmt.type === 'advance_tax' ? 'Advance Tax' : pmt.type === 'self_assessment' ? 'Self Assessment Tax' : 'TDS'}</div>
                                  <div style={{ fontSize: 11, color: '#5D6D7E', marginTop: 2 }}>Date: {pmt.date} · BSR: {pmt.bsrCode || 'N/A'}</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E8449' }}>₹{pmt.amount?.toLocaleString('en-IN')}</div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Mismatch check */}
                      {salary && (() => {
                        const aisTDS = aisData.tdsEntries?.find((e: any) => e.incomeType === 'salary')?.tdsDeducted || 0
                        const slipTDS = (salary.tdsDeducted || 0) * 12
                        const diff = Math.abs(aisTDS - slipTDS)
                        if (diff > 1000) {
                          return (
                            <InfoBox variant="warning" icon="⚠️">
                              <strong>TDS Mismatch Detected!</strong> Your salary slip shows ₹{slipTDS.toLocaleString('en-IN')}/yr TDS but AIS shows ₹{aisTDS.toLocaleString('en-IN')}. Difference of ₹{diff.toLocaleString('en-IN')}. Check with your employer and verify Form 16.
                            </InfoBox>
                          )
                        }
                        return (
                          <InfoBox variant="success" icon="✅">
                            <strong>TDS Match!</strong> Salary slip TDS (₹{slipTDS.toLocaleString('en-IN')}/yr) matches your AIS data. Your records are consistent.
                          </InfoBox>
                        )
                      })()}

                      <button onClick={() => setAisData(null)}
                        style={{ marginTop: 12, padding: '8px 16px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 12, color: '#C0392B', cursor: 'pointer', fontWeight: 500 }}>
                        ✕ Remove AIS Data
                      </button>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'AIS Analysis' && (
                <div className="fade-in">
                  {!aisData ? (
                    <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', borderRadius: 14, border: '1px solid #E5E9ED' }}>
                      <div style={{ fontSize: 40, marginBottom: 14 }}>📊</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Upload AIS for Complete Income Analysis</div>
                      <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 20, lineHeight: 1.7, maxWidth: 460, margin: '0 auto 20px' }}>
                        AIS contains ALL your income — salary, FD interest, mutual fund gains, dividends, rental income. Many people underpay tax because they only account for salary.
                      </div>
                      <div style={{ background: '#FEF3E2', border: '1px solid #F0C070', borderRadius: 12, padding: '16px 20px', maxWidth: 460, margin: '0 auto 20px', textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 10 }}>⚠️ Common mistake Indians make:</div>
                        {[
                          'FD interest is taxed at YOUR slab rate (30%), not just 10% TDS',
                          'Mutual fund gains add to taxable income — employer TDS doesn\'t cover this',
                          'Dividend income is fully taxable since FY 2020-21',
                          'AIS captures ALL income — IT Dept already knows everything',
                        ].map((t, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#78350F', marginBottom: 5, display: 'flex', gap: 6 }}>
                            <span>•</span> {t}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => aisRef.current?.click()}
                        style={{ padding: '11px 28px', background: '#1A3C5E', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        📄 Upload AIS PDF
                      </button>
                      <input ref={aisRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                        onChange={e => e.target.files?.[0] && uploadAIS(e.target.files[0])} />
                    </div>
                  ) : (() => {
                    const salaryTax = taxComparison ? taxComparison[taxComparison.recommendation].totalTax : 0
                    const slabRate = taxComparison ? taxComparison[taxComparison.recommendation].effectiveRate / 100 : 0.30
                    const marginalRate = taxComparison ? (taxComparison[taxComparison.recommendation].taxableIncome > 1000000 ? 0.30 : taxComparison[taxComparison.recommendation].taxableIncome > 700000 ? 0.10 : 0.05) : 0.30
                    const totalTaxCalc = calcTotalTaxWithAIS(salaryTax, aisData, marginalRate)

                    const incomeBreakdown = [
                      { label: 'Salary Income', amount: aisData.salaryIncome || 0, color: '#1A3C5E', icon: '💼' },
                      { label: 'FD / Interest Income', amount: aisData.totalInterestIncome || 0, color: '#E67E22', icon: '🏦' },
                      { label: 'Capital Gains (MF/Equity)', amount: aisData.totalCapitalGains || 0, color: '#8E44AD', icon: '📈' },
                      { label: 'Dividend Income', amount: aisData.dividendIncome || 0, color: '#2E86C1', icon: '💰' },
                      { label: 'Rental Income', amount: aisData.rentalIncome || 0, color: '#1E8449', icon: '🏠' },
                      { label: 'Other Income', amount: aisData.totalOtherIncome || 0, color: '#5D6D7E', icon: '📋' },
                    ].filter(i => i.amount > 0)

                    return (
                      <>
                        {/* Grand total income */}
                        <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 14, padding: '20px 24px', marginBottom: 18, color: '#fff' }}>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>TOTAL INCOME (ALL SOURCES CLUBBED)</div>
                          <div style={{ fontSize: 36, fontWeight: 800, color: '#FCD34D', marginBottom: 12 }}>
                            ₹{(aisData.grandTotalIncome || 0).toLocaleString('en-IN')}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            {[
                              { label: 'Total Tax Liability', value: `₹${totalTaxCalc.totalTaxLiability.toLocaleString('en-IN')}`, color: '#FC8181' },
                              { label: 'TDS Credit', value: `₹${totalTaxCalc.totalTDSCredit.toLocaleString('en-IN')}`, color: '#4ADE80' },
                              { label: totalTaxCalc.isRefund ? 'Refund Due' : 'Additional Tax Due', value: `₹${(totalTaxCalc.isRefund ? totalTaxCalc.refundAmount : totalTaxCalc.additionalTaxDue).toLocaleString('en-IN')}`, color: totalTaxCalc.isRefund ? '#4ADE80' : '#FBBF24' },
                            ].map(s => (
                              <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' }}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{s.label}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Refund or additional tax alert */}
                        {totalTaxCalc.isRefund ? (
                          <InfoBox variant="success" icon="💸">
                            <strong>Refund of ₹{totalTaxCalc.refundAmount.toLocaleString('en-IN')} expected!</strong> Your TDS credits exceed your total tax liability. File your ITR to claim this refund. Refunds are typically processed within 30-60 days of ITR filing.
                          </InfoBox>
                        ) : totalTaxCalc.additionalTaxDue > 10000 ? (
                          <InfoBox variant="warning" icon="⚠️">
                            <strong>Additional tax of ₹{totalTaxCalc.additionalTaxDue.toLocaleString('en-IN')} may be due.</strong> Your income from non-salary sources creates tax beyond what your employer TDS covers. Pay self-assessment tax before filing ITR to avoid interest under Section 234B.
                          </InfoBox>
                        ) : (
                          <InfoBox variant="success" icon="✅">
                            Your TDS covers your total tax liability across all income sources. No additional tax payment required.
                          </InfoBox>
                        )}

                        {/* Income breakdown */}
                        <Card style={{ marginTop: 16, marginBottom: 16 }}>
                          <SectionHeader title="Income Breakdown — All Sources" sub="This is your complete taxable income picture" />
                          {incomeBreakdown.map((inc, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${inc.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{inc.icon}</div>
                                <span style={{ fontSize: 13, color: '#374151' }}>{inc.label}</span>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: inc.color }}>₹{inc.amount.toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 6, borderTop: '2px solid #F0F0F0' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1C2833' }}>Grand Total Income</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#1A3C5E' }}>₹{(aisData.grandTotalIncome || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </Card>

                        {/* Tax breakdown */}
                        <Card style={{ marginBottom: 16 }}>
                          <SectionHeader title="Tax Liability Breakdown" sub="How your total tax is computed across income types" />
                          {[
                            { label: 'Tax on Salary Income', amount: totalTaxCalc.salaryTax, note: 'At slab rates after deductions' },
                            totalTaxCalc.capitalGainsTax > 0 && { label: 'Capital Gains Tax', amount: totalTaxCalc.capitalGainsTax, note: 'STCG 20%, LTCG 12.5% above ₹1.25L' },
                            totalTaxCalc.interestTaxAdditional > 0 && { label: 'Additional Tax on Interest', amount: totalTaxCalc.interestTaxAdditional, note: 'FD interest taxed at slab, less 10% TDS paid' },
                            totalTaxCalc.dividendTax > 0 && { label: 'Tax on Dividend', amount: totalTaxCalc.dividendTax, note: 'Dividend taxed at slab rate' },
                            totalTaxCalc.rentalTax > 0 && { label: 'Tax on Rental Income', amount: totalTaxCalc.rentalTax, note: 'After 30% standard deduction, at slab rate' },
                          ].filter(Boolean).map((row: any, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                              <div>
                                <div style={{ fontSize: 13, color: '#1C2833', fontWeight: 500 }}>{row.label}</div>
                                <div style={{ fontSize: 11, color: '#95A5A6', marginTop: 2 }}>{row.note}</div>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#C0392B' }}>₹{row.amount.toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 6, borderTop: '2px solid #F0F0F0' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1C2833' }}>Total Tax Liability</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#C0392B' }}>₹{totalTaxCalc.totalTaxLiability.toLocaleString('en-IN')}</span>
                          </div>
                        </Card>

                        {/* Alerts */}
                        {aisData.alerts && aisData.alerts.length > 0 && (
                          <Card style={{ marginBottom: 16 }}>
                            <SectionHeader title="⚠️ Important Alerts" sub="Income that people commonly miss — and the IT Dept already knows" />
                            {aisData.alerts.map((alert: string, i: number) => (
                              <div key={i} style={{ background: '#FEF3E2', border: '1px solid #F0C070', borderRadius: 10, padding: '12px 14px', marginBottom: 8, fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
                                ⚠️ {alert}
                              </div>
                            ))}
                          </Card>
                        )}

                        {/* Capital gains detail */}
                        {aisData.capitalGains && aisData.capitalGains.length > 0 && (
                          <Card style={{ marginBottom: 16 }}>
                            <SectionHeader title="Capital Gains Detail" sub="STCG and LTCG transactions from AIS" />
                            {aisData.capitalGains.map((cg: any, i: number) => (
                              <div key={i} style={{ padding: '10px 14px', background: '#F8FAFB', borderRadius: 10, marginBottom: 8, border: '1px solid #F0F0F0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833' }}>{cg.assetName || cg.assetType}</div>
                                  <div>
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: cg.gainType === 'STCG' ? '#FEF3E2' : '#E8F1FA', color: cg.gainType === 'STCG' ? '#E67E22' : '#1A3C5E', fontWeight: 600 }}>{cg.gainType}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#5D6D7E' }}>
                                  <span>Gain: <strong style={{ color: cg.gain > 0 ? '#1E8449' : '#C0392B' }}>₹{(cg.gain || 0).toLocaleString('en-IN')}</strong></span>
                                  <span>Tax rate: <strong>{cg.gainType === 'STCG' ? '20%' : '12.5%'}</strong></span>
                                  <span>Tax: <strong style={{ color: '#C0392B' }}>₹{(cg.taxPayable || 0).toLocaleString('en-IN')}</strong></span>
                                </div>
                              </div>
                            ))}
                          </Card>
                        )}

                        <InfoBox variant="info" icon="📋">
                          <strong>Next step:</strong> File your ITR including all income sources above. Use ITR-2 (if capital gains) or ITR-1 (salary + interest only). ArthVo's analysis is indicative — consult a CA for exact ITR computation.
                        </InfoBox>
                      </>
                    )
                  })()}
                </div>
              )}


            </div>
          )}
        </div>
      </div>
    </div>
  )
}
