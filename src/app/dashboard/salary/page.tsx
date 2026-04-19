'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/AppStore'
import { InfoBox, Badge, Card } from '@/components/ui'
import type { ParsedSalaryData } from '@/types'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function TakeHomeVisual({ gross, deductions, net }: { gross: number; deductions: number; net: number }) {
  const netPct = gross > 0 ? (net / gross) * 100 : 0
  const dedPct = gross > 0 ? (deductions / gross) * 100 : 0
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 6, fontWeight: 500 }}>Monthly gross → take-home</div>
      <div style={{ height: 10, borderRadius: 99, background: '#F1F2F4', overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
        <div style={{ width: `${netPct}%`, background: '#1E8449', borderRadius: '99px 0 0 99px', transition: 'width 0.8s ease' }} />
        <div style={{ width: `${dedPct}%`, background: '#C0392B', transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5D6D7E' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1E8449' }} /> Take-Home ({netPct.toFixed(0)}%)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5D6D7E' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#C0392B' }} /> Deductions ({dedPct.toFixed(0)}%)
        </div>
      </div>
    </div>
  )
}

function ComponentRow({ label, amount, type }: { label: string; amount: number; type: string }) {
  if (!amount || amount === 0) return null
  const styles: Record<string, { bg: string; border: string; color: string; prefix: string }> = {
    earning:   { bg: '#F0FDF4', border: '#1E8449', color: '#1E8449', prefix: '' },
    deduction: { bg: '#FFF5F5', border: '#C0392B', color: '#C0392B', prefix: '−' },
    computed:  { bg: '#FFFBEB', border: '#E67E22', color: '#E67E22', prefix: '' },
  }
  const s = styles[type] || styles.computed
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderRadius: 8, marginBottom: 5, background: s.bg, borderLeft: `3px solid ${s.border}` }}>
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.prefix}₹{amount.toLocaleString('en-IN')}</span>
    </div>
  )
}

function SalaryBreakdown({ data }: { data: ParsedSalaryData }) {
  const earnings = data.components?.filter(c => c.type === 'earning' && c.amount > 0) || []
  const deductions = data.components?.filter(c => c.type === 'deduction' && c.amount > 0) || []
  const hasComponents = earnings.length > 0 || deductions.length > 0
  const earningsItems = hasComponents ? earnings : [
    { label: 'Basic Salary', amount: data.basicSalary, type: 'earning' },
    { label: 'HRA', amount: data.hra, type: 'earning' },
    { label: 'DA', amount: data.da, type: 'earning' },
    { label: 'Travel Allowance', amount: data.ta, type: 'earning' },
    { label: 'LTA', amount: data.lta, type: 'earning' },
    { label: 'Medical Allowance', amount: data.medicalAllowance, type: 'earning' },
    { label: 'Special Allowance', amount: data.specialAllowance, type: 'earning' },
    { label: 'Other Allowances', amount: data.otherAllowances, type: 'earning' },
  ].filter(c => c.amount > 0)
  const deductionItems = hasComponents ? deductions : [
    { label: 'EPF (Employee 12%)', amount: data.employeePF, type: 'deduction' },
    { label: 'ESIC', amount: data.esic, type: 'deduction' },
    { label: 'Professional Tax', amount: data.professionalTax, type: 'deduction' },
    { label: 'TDS (Income Tax)', amount: data.tdsDeducted, type: 'deduction' },
    { label: 'Loan Recovery', amount: data.loanDeduction, type: 'deduction' },
    { label: 'Other Deductions', amount: data.otherDeductions, type: 'deduction' },
  ].filter(c => c.amount > 0)

  return (
    <div className="fade-in">
      <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 16, padding: '24px 28px', marginBottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4, fontWeight: 500 }}>SALARY ANALYSIS</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{data.employeeName || 'Employee'}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{data.employerName} · {data.month} {data.year}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>MONTHLY TAKE-HOME</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#4ADE80', lineHeight: 1 }}>₹{data.netSalary?.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 22 }}>
          {[
            { label: 'Gross Monthly', value: `₹${data.grossSalary?.toLocaleString('en-IN')}` },
            { label: 'Total Deductions', value: `₹${data.totalDeductions?.toLocaleString('en-IN')}`, color: '#FC8181' },
            { label: 'Annual CTC', value: `₹${((data.ctcAnnual || data.grossSalary * 12) / 100000).toFixed(2)}L`, color: '#FCD34D' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.color || 'rgba(255,255,255,0.9)' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <TakeHomeVisual gross={data.grossSalary} deductions={data.totalDeductions} net={data.netSalary} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E8449' }}>↑ Earnings</div>
            <Badge color="green">{earningsItems.length} items</Badge>
          </div>
          {earningsItems.map((c, i) => <ComponentRow key={i} {...c} />)}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '2px solid #F0F0F0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Gross Salary</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#1E8449' }}>₹{data.grossSalary?.toLocaleString('en-IN')}</span>
          </div>
        </Card>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#C0392B' }}>↓ Deductions</div>
            <Badge color="red">{deductionItems.length} items</Badge>
          </div>
          {deductionItems.map((c, i) => <ComponentRow key={i} {...c} />)}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '2px solid #F0F0F0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Total Deductions</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#C0392B' }}>₹{data.totalDeductions?.toLocaleString('en-IN')}</span>
          </div>
        </Card>
      </div>
      <div style={{ marginTop: 16, background: '#E9F7EF', border: '1px solid #A9DFBF', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E5631' }}>✅ Salary saved — ₹{data.netSalary?.toLocaleString('en-IN')}/mo</div>
          <div style={{ fontSize: 12, color: '#27AE60', marginTop: 2 }}>Next: Add any other income sources for accurate tax calculation</div>
        </div>
        <Link href="/dashboard/other-income"
          style={{ padding: '10px 20px', background: '#1A3C5E', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          Add Other Income →
        </Link>
      </div>
    </div>
  )
}

// ─── Manual Entry Form ────────────────────────────────────────────────────
function ManualEntryForm({ onSubmit }: { onSubmit: (data: ParsedSalaryData) => void }) {
  const n = (v: string) => parseFloat(v.replace(/,/g, '')) || 0
  const [form, setForm] = useState({
    employeeName: '', employerName: '', month: 'April', year: '2025',
    basicSalary: '', hra: '', da: '', ta: '', lta: '',
    medicalAllowance: '', specialAllowance: '', otherAllowances: '',
    employeePF: '', employerPF: '', esic: '', professionalTax: '',
    tdsDeducted: '', loanDeduction: '', otherDeductions: '',
    freelanceIncome: '', businessIncome: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const inp = (label: string, key: string, hint?: string) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#95A5A6', marginBottom: 4 }}>{hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E9ED', borderRadius: 8, overflow: 'hidden' }}>
        <span style={{ padding: '8px 10px', background: '#F8FAFB', fontSize: 13, color: '#5D6D7E', borderRight: '1px solid #E5E9ED' }}>₹</span>
        <input type="number" value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)}
          placeholder="0" style={{ flex: 1, padding: '8px 12px', border: 'none', fontSize: 13, outline: 'none', background: 'transparent' }} />
      </div>
    </div>
  )

  const handleSubmit = () => {
    const gross = n(form.basicSalary) + n(form.hra) + n(form.da) + n(form.ta) + n(form.lta) +
      n(form.medicalAllowance) + n(form.specialAllowance) + n(form.otherAllowances) +
      n(form.freelanceIncome) + n(form.businessIncome)
    if (gross === 0) { toast.error('Please enter at least your basic salary or income'); return }
    const totalDeductions = n(form.employeePF) + n(form.esic) + n(form.professionalTax) +
      n(form.tdsDeducted) + n(form.loanDeduction) + n(form.otherDeductions)
    const netSalary = Math.max(0, gross - totalDeductions)
    onSubmit({
      employeeName: form.employeeName || 'You', employerName: form.employerName || 'Self',
      month: form.month, year: form.year,
      basicSalary: n(form.basicSalary), hra: n(form.hra), da: n(form.da), ta: n(form.ta), lta: n(form.lta),
      medicalAllowance: n(form.medicalAllowance),
      specialAllowance: n(form.specialAllowance) + n(form.freelanceIncome) + n(form.businessIncome),
      otherAllowances: n(form.otherAllowances), grossSalary: gross,
      employeePF: n(form.employeePF), employerPF: n(form.employerPF) || n(form.employeePF),
      esic: n(form.esic), professionalTax: n(form.professionalTax),
      tdsDeducted: n(form.tdsDeducted), loanDeduction: n(form.loanDeduction),
      otherDeductions: n(form.otherDeductions), totalDeductions, netSalary,
      ctcMonthly: gross + (n(form.employerPF) || n(form.employeePF)),
      ctcAnnual: (gross + (n(form.employerPF) || n(form.employeePF))) * 12,
      components: [
        ...[
          { label: 'Basic Salary', amount: n(form.basicSalary), type: 'earning' as const },
          { label: 'HRA', amount: n(form.hra), type: 'earning' as const },
          { label: 'DA', amount: n(form.da), type: 'earning' as const },
          { label: 'Travel Allowance', amount: n(form.ta), type: 'earning' as const },
          { label: 'LTA', amount: n(form.lta), type: 'earning' as const },
          { label: 'Medical Allowance', amount: n(form.medicalAllowance), type: 'earning' as const },
          { label: 'Special Allowance', amount: n(form.specialAllowance), type: 'earning' as const },
          { label: 'Freelance Income', amount: n(form.freelanceIncome), type: 'earning' as const },
          { label: 'Business Income', amount: n(form.businessIncome), type: 'earning' as const },
          { label: 'Other Allowances', amount: n(form.otherAllowances), type: 'earning' as const },
        ].filter(c => c.amount > 0),
        ...[
          { label: 'EPF (Employee)', amount: n(form.employeePF), type: 'deduction' as const },
          { label: 'ESIC', amount: n(form.esic), type: 'deduction' as const },
          { label: 'Professional Tax', amount: n(form.professionalTax), type: 'deduction' as const },
          { label: 'TDS Deducted', amount: n(form.tdsDeducted), type: 'deduction' as const },
          { label: 'Loan Deduction', amount: n(form.loanDeduction), type: 'deduction' as const },
          { label: 'Other Deductions', amount: n(form.otherDeductions), type: 'deduction' as const },
        ].filter(c => c.amount > 0),
      ],
    })
    toast.success('Salary saved! Now add other income sources.')
  }

  const months = ['April','May','June','July','August','September','October','November','December','January','February','March']

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 14 }}>👤 Your Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Your Name (optional)</label>
              <input value={form.employeeName} onChange={e => set('employeeName', e.target.value)} placeholder="e.g. Rahul Sharma"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Employer / Company (optional)</label>
              <input value={form.employerName} onChange={e => set('employerName', e.target.value)} placeholder="e.g. Infosys Ltd"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Month</label>
                <select value={form.month} onChange={e => set('month', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
                  {months.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Year</label>
                <select value={form.year} onChange={e => set('year', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
                  {['2024','2025','2026'].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E8449', marginBottom: 14 }}>↑ Earnings (Monthly)</div>
            {inp('Basic Salary *', 'basicSalary', 'Usually 40-50% of CTC')}
            {inp('HRA (House Rent Allowance)', 'hra', 'Usually 40-50% of Basic')}
            {inp('DA (Dearness Allowance)', 'da', 'Mainly for Govt employees')}
            {inp('Travel Allowance (TA)', 'ta')}
            {inp('LTA (Leave Travel Allowance)', 'lta')}
            {inp('Medical Allowance', 'medicalAllowance')}
            {inp('Special Allowance', 'specialAllowance', 'Flexible/balance component')}
            {inp('Other Allowances', 'otherAllowances')}
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#8E44AD', marginBottom: 6 }}>💼 Freelance / Business (Monthly)</div>
            <div style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 14 }}>For self-employed, consultants, gig workers</div>
            {inp('Monthly Freelance Income', 'freelanceIncome')}
            {inp('Monthly Business Income', 'businessIncome')}
          </Card>
        </div>

        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#C0392B', marginBottom: 14 }}>↓ Deductions (Monthly)</div>
            {inp('EPF — Employee Contribution', 'employeePF', '12% of Basic typically')}
            {inp('EPF — Employer Contribution', 'employerPF', 'Same as employee')}
            {inp('ESIC', 'esic', 'Only if salary < ₹21,000/mo')}
            {inp('Professional Tax', 'professionalTax', 'Max ₹200/mo in most states')}
            {inp('TDS Deducted', 'tdsDeducted', 'Income tax deducted by employer')}
            {inp('Loan / Advance Recovery', 'loanDeduction')}
            {inp('Other Deductions', 'otherDeductions')}
          </Card>

          {/* Live preview */}
          {(() => {
            const gross = n(form.basicSalary) + n(form.hra) + n(form.da) + n(form.ta) + n(form.lta) +
              n(form.medicalAllowance) + n(form.specialAllowance) + n(form.otherAllowances) +
              n(form.freelanceIncome) + n(form.businessIncome)
            const totalDed = n(form.employeePF) + n(form.esic) + n(form.professionalTax) +
              n(form.tdsDeducted) + n(form.loanDeduction) + n(form.otherDeductions)
            const net = Math.max(0, gross - totalDed)
            if (gross === 0) return null
            return (
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2833', marginBottom: 12 }}>📊 Live Preview</div>
                {[
                  { label: 'Gross Income', value: gross, color: '#1A3C5E' },
                  { label: 'Total Deductions', value: totalDed, color: '#C0392B' },
                  { label: 'Take-Home', value: net, color: '#1E8449', bold: true },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
                    <span style={{ fontSize: 13, color: '#5D6D7E' }}>{r.label}</span>
                    <span style={{ fontSize: r.bold ? 16 : 13, fontWeight: r.bold ? 800 : 600, color: r.color }}>₹{r.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, padding: '10px', background: '#E9F7EF', borderRadius: 8, fontSize: 12, color: '#1E5631' }}>
                  Annual: <strong>₹{(net * 12).toLocaleString('en-IN')}</strong>
                </div>
              </Card>
            )
          })()}
        </div>
      </div>

      <button onClick={handleSubmit}
        style={{ width: '100%', padding: '14px', background: '#1A3C5E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 16 }}>
        ✓ Save Salary & Continue
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function SalaryPage() {
  const { salary, setSalary } = useAppStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'upload' | 'manual'>('upload')

  const processFile = useCallback(async (file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) { toast.error('Please upload a PDF or image'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return }
    setLoading(true)
    const toastId = toast.loading('Reading your salary slip with AI…')
    try {
      const base64Data = await fileToBase64(file)
      const res = await fetch('/api/parse-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType: file.type, fileName: file.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Parsing failed')
      setSalary(json.data)
      toast.success('Salary parsed! Now add other income sources.', { id: toastId })
    } catch (e: any) {
      toast.error(e.message || 'Failed to parse. Try a clearer image.', { id: toastId })
    } finally {
      setLoading(false)
    }
  }, [setSalary])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => files[0] && processFile(files[0]),
    accept: { 'application/pdf': [], 'image/*': [] },
    multiple: false,
    disabled: loading,
  })

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>Salary Slip</h2>
        <p style={{ fontSize: 14, color: '#5D6D7E', lineHeight: 1.65, maxWidth: 580 }}>
          Upload your salary slip or enter the details manually.
        </p>
      </div>

      {salary ? (
        <SalaryBreakdown data={salary} />
      ) : (
        <>
          {/* Upload / Manual toggle */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {[
              { key: 'upload', label: '📄 Upload Salary Slip', desc: 'AI reads any format automatically' },
              { key: 'manual', label: '✏️ Enter Manually', desc: 'Type in your salary components' },
            ].map(m => (
              <button key={m.key} onClick={() => setMode(m.key as any)}
                style={{ flex: 1, padding: '14px 20px', background: mode === m.key ? '#1A3C5E' : '#fff', color: mode === m.key ? '#fff' : '#1C2833', border: `2px solid ${mode === m.key ? '#1A3C5E' : '#E5E9ED'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{m.desc}</div>
              </button>
            ))}
          </div>

          {mode === 'upload' ? (
            <>
              <div {...getRootProps()} className={`upload-zone${isDragActive ? ' active' : ''}`}
                style={{ padding: '64px 40px', textAlign: 'center', marginBottom: 20, cursor: 'pointer' }}>
                <input {...getInputProps()} />
                {loading ? (
                  <>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Analysing with Claude Vision…</div>
                    <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 24 }}>Extracting every salary component</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {['Reading layout', 'Finding components', 'Calculating totals'].map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8F1FA', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#1A3C5E' }}>
                          <div className="skeleton" style={{ width: 7, height: 7, borderRadius: '50%' }} />{s}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 52, marginBottom: 14 }}>{isDragActive ? '📂' : '📄'}</div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>
                      {isDragActive ? 'Drop to parse' : 'Drop your salary slip here'}
                    </div>
                    <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 22 }}>PDF, JPG, PNG, WebP · Max 10MB · Any employer format</div>
                    <button type="button" style={{ padding: '11px 28px', background: '#C9A84C', color: '#0F2640', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      Browse Files
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: '🖨️', title: 'PDF Payslips', desc: 'Email PDFs, HR system exports' },
                  { icon: '📸', title: 'Photo / Image', desc: 'Phone camera photos of payslips' },
                  { icon: '🏢', title: 'Any Employer', desc: 'IT, PSU, SME, startup formats' },
                  { icon: '🔒', title: 'Stays Private', desc: 'Never stored on any server' },
                ].map(f => (
                  <div key={f.title} style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833', marginBottom: 4 }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: '#5D6D7E', lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
              <InfoBox variant="info" icon="🔒">
                <strong>Privacy:</strong> Processed by Claude AI, converted to numbers. Raw document never saved.
              </InfoBox>
            </>
          ) : (
            <ManualEntryForm onSubmit={data => { setSalary(data) }} />
          )}
        </>
      )}
    </div>
  )
}
