'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/AppStore'
import { formatINRFull } from '@/lib/tax-engine'
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

  useEffect(() => {
    if (salary?.employeePF) {
      setDeductions(d => ({ ...d, section80C: Math.min(salary.employeePF * 12, 150000) }))
    }
  }, [salary])

  const uploadAIS = useCallback(async (file: File) => {
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a PDF or image of your Form 26AS / AIS'); return
    }
    setAisLoading(true)
    const tid = toast.loading('Reading your AIS / Form 26AS…')
    try {
      const base64Data = await fileToBase64(file)
      const res = await fetch('/api/parse-ais', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType: file.type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAisData(json.data)
      toast.success(`AIS parsed! Total TDS credit: ₹${json.data.totalTaxCredit?.toLocaleString('en-IN')}`, { id: tid })
    } catch (e: any) {
      toast.error(e.message || 'Failed to parse. Try a clearer image.', { id: tid })
    } finally {
      setAisLoading(false)
    }
  }, [])

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
              Download from incometax.gov.in and upload for accurate TDS data
            </div>
            {aisData ? (
              <div style={{ background: '#E9F7EF', border: '1px solid #A9DFBF', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#1E5631', fontWeight: 600, marginBottom: 2 }}>✓ AIS Loaded — {aisData.taxpayerName || 'Taxpayer'}</div>
                <div style={{ fontSize: 12, color: '#1E8449', fontWeight: 600 }}>Total TDS: ₹{(aisData.totalTDSDeducted || 0).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: '#27AE60', marginTop: 2 }}>Total Tax Credit: ₹{(aisData.totalTaxCredit || 0).toLocaleString('en-IN')}</div>
                <button onClick={() => setAisData(null)} style={{ fontSize: 10, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>Remove ×</button>
              </div>
            ) : (
              <button onClick={() => aisRef.current?.click()} disabled={aisLoading}
                style={{ width: '100%', padding: '10px', background: '#F8FAFB', border: '1px dashed #CBD5E0', borderRadius: 9, fontSize: 12, color: '#5D6D7E', cursor: 'pointer', fontWeight: 500 }}>
                {aisLoading ? '⟳ Reading document…' : '📄 Upload Form 26AS / AIS'}
              </button>
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
                <PillTabs tabs={['Comparison', 'Slab Breakdown', 'Save More', 'Advance Tax', 'AI Insights', 'TDS Data']} active={activeTab} onChange={setActiveTab} />
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
                    const tdsDeducted = (salary?.tdsDeducted || 0) * 12
                    const advanceTaxDue = Math.max(0, totalTax - tdsDeducted)
                    const isLiable = advanceTaxDue > 10000
                    const today = new Date()
                    const currentYear = today.getFullYear()
                    const installments = [
                      { due: `15 June ${currentYear}`, pct: 15, amount: Math.round(totalTax * 0.15), label: '1st Installment', month: 5 },
                      { due: `15 September ${currentYear}`, pct: 45, amount: Math.round(totalTax * 0.45 - totalTax * 0.15), label: '2nd Installment', month: 8 },
                      { due: `15 December ${currentYear}`, pct: 75, amount: Math.round(totalTax * 0.75 - totalTax * 0.45), label: '3rd Installment', month: 11 },
                      { due: `15 March ${currentYear + 1}`, pct: 100, amount: Math.round(totalTax * 0.25), label: '4th Installment', month: 2 },
                    ]
                    const isPast = (month: number) => month < today.getMonth()
                    const isNext = (month: number, idx: number) => !isPast(month) && (idx === 0 || isPast(installments[idx-1].month))
                    return (
                      <>
                        {/* Summary */}
                        <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 14, padding: '20px 24px', marginBottom: 18, color: '#fff' }}>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>ESTIMATED ADVANCE TAX LIABILITY</div>
                          <div style={{ fontSize: 36, fontWeight: 800, color: isLiable ? '#FBBF24' : '#4ADE80', marginBottom: 8 }}>
                            ₹{advanceTaxDue.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                            {isLiable
                              ? `Total tax ₹${totalTax.toLocaleString('en-IN')} − TDS already deducted ₹${tdsDeducted.toLocaleString('en-IN')} = ₹${advanceTaxDue.toLocaleString('en-IN')} advance tax due`
                              : 'Your employer TDS covers your full tax liability. No advance tax required.'}
                          </div>
                        </div>

                        {!isLiable && (
                          <InfoBox variant="success" icon="✅">
                            <strong>No advance tax required.</strong> Your TDS deductions already cover your estimated tax liability. You only need to pay advance tax if your net liability exceeds ₹10,000 after TDS.
                          </InfoBox>
                        )}

                        {isLiable && (
                          <>
                            <Card style={{ marginBottom: 16 }}>
                              <SectionHeader title="Installment Schedule — FY 2024-25" sub="Pay on time to avoid 1% monthly interest under Section 234B & 234C" />
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
                                            <div style={{ fontSize: 11, color: '#5D6D7E', marginTop: 2 }}>Due: {inst.due} · Cumulative {inst.pct}% of annual tax</div>
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
                              <strong>Late payment penalty:</strong> Missing advance tax installments attracts 1% interest per month under Section 234B and 234C of the Income Tax Act. On ₹{advanceTaxDue.toLocaleString('en-IN')}, a 3-month delay costs approximately ₹{Math.round(advanceTaxDue * 0.03).toLocaleString('en-IN')} extra.
                            </InfoBox>
                          </>
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

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
