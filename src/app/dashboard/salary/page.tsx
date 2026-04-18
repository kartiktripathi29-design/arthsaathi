'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import Link from 'next/link'
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
    { label: 'Dearness Allowance', amount: data.da, type: 'earning' },
    { label: 'Travel Allowance', amount: data.ta, type: 'earning' },
    { label: 'Leave Travel Allowance', amount: data.lta, type: 'earning' },
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
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{data.employerName || 'Employer'} · {data.month} {data.year}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>MONTHLY TAKE-HOME</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#4ADE80', lineHeight: 1 }}>₹{data.netSalary?.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 22 }}>
          {[
            { label: 'Gross Monthly', value: `₹${data.grossSalary?.toLocaleString('en-IN')}`, color: 'rgba(255,255,255,0.9)' },
            { label: 'Total Deductions', value: `₹${data.totalDeductions?.toLocaleString('en-IN')}`, color: '#FC8181' },
            { label: 'Annual CTC', value: `₹${((data.ctcAnnual || data.grossSalary * 12) / 100000).toFixed(2)}L`, color: '#FCD34D' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <TakeHomeVisual gross={data.grossSalary} deductions={data.totalDeductions} net={data.netSalary} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E8449' }}>↑ Earnings</div>
            <Badge color="green">{earningsItems.length} items</Badge>
          </div>
          {earningsItems.map((c, i) => <ComponentRow key={i} {...c} />)}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '2px solid #F0F0F0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1C2833' }}>Gross Salary</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#1E8449' }}>₹{data.grossSalary?.toLocaleString('en-IN')}</span>
          </div>
        </Card>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#C0392B' }}>↓ Deductions</div>
            <Badge color="red">{deductionItems.length} items</Badge>
          </div>
          {deductionItems.map((c, i) => <ComponentRow key={i} {...c} />)}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '2px solid #F0F0F0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1C2833' }}>Total Deductions</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#C0392B' }}>₹{data.totalDeductions?.toLocaleString('en-IN')}</span>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div style={{ background: '#F0FDF4', border: '1px solid #A9DFBF', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#1E5631', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Pay (Take-Home)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1E8449' }}>₹{data.netSalary?.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 12, color: '#27AE60', marginTop: 4 }}>per month · ₹{(data.netSalary * 12)?.toLocaleString('en-IN')}/year</div>
        </div>
        {data.employeePF > 0 && (
          <div style={{ background: '#E8F1FA', border: '1px solid #A8CCE8', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: '#1A3C5E', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>EPF Contribution</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1A3C5E' }}>₹{((data.employeePF + (data.employerPF || data.employeePF)) * 12)?.toLocaleString('en-IN')}/yr</div>
            <div style={{ fontSize: 12, color: '#2E5A88', marginTop: 4 }}>You ₹{data.employeePF?.toLocaleString('en-IN')} + Employer ₹{(data.employerPF || data.employeePF)?.toLocaleString('en-IN')} /mo</div>
          </div>
        )}
      </div>

      <InfoBox variant="info" icon="→">
        <strong>Next step:</strong> Use the{' '}
        <Link href="/dashboard/tax" style={{ color: '#1A3C5E', fontWeight: 700 }}>Tax Optimiser</Link>
        {' '}to compare Old vs New regime based on this salary — and see exactly how much tax you can save.
      </InfoBox>
    </div>
  )
}

// ─── Manual Entry Form ────────────────────────────────────────────────────
function ManualEntryForm({ onSubmit }: { onSubmit: (data: ParsedSalaryData) => void }) {
  const n = (v: string) => parseFloat(v.replace(/,/g, '')) || 0

  const [form, setForm] = useState({
    employeeName: '', employerName: '', month: 'April', year: '2025',
    // Earnings
    basicSalary: '', hra: '', da: '', ta: '', lta: '',
    medicalAllowance: '', specialAllowance: '', otherAllowances: '',
    // Deductions
    employeePF: '', employerPF: '', esic: '', professionalTax: '',
    tdsDeducted: '', loanDeduction: '', otherDeductions: '',
    // Freelance/Business (monthly)
    freelanceIncome: '', businessIncome: '',
    // Other Income (ANNUAL amounts)
    dividendIncome: '',
    fdInterest: '', savingsInterest: '', otherInterest: '',
    giftFromRelatives: '', giftFromOthers: '',
    ltcgEquity: '', stcgEquity: '',
    ltcgProperty: '', stcgProperty: '',
    ltcgOther: '', stcgOther: '',
    annualRentReceived: '', municipalTaxPaid: '', homeLoanInterestHP: '',
    isLetOut: 'yes',
    businessIncomeAnnual: '', professionalIncomeAnnual: '', presumptiveIncome: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const inp = (label: string, key: string, placeholder = '0', hint?: string) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#95A5A6', marginBottom: 4 }}>{hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E9ED', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <span style={{ padding: '8px 10px', background: '#F8FAFB', fontSize: 13, color: '#5D6D7E', borderRight: '1px solid #E5E9ED' }}>₹</span>
        <input
          type="number"
          value={form[key as keyof typeof form]}
          onChange={e => set(key, e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, padding: '8px 12px', border: 'none', fontSize: 13, outline: 'none', background: 'transparent' }}
        />
      </div>
    </div>
  )

  const handleSubmit = () => {
    const gross = n(form.basicSalary) + n(form.hra) + n(form.da) + n(form.ta) + n(form.lta) +
      n(form.medicalAllowance) + n(form.specialAllowance) + n(form.otherAllowances) +
      n(form.freelanceIncome) + n(form.businessIncome)

    const hasOtherIncome = n(form.dividendIncome) + n(form.fdInterest) + n(form.savingsInterest) +
      n(form.ltcgEquity) + n(form.stcgEquity) + n(form.ltcgProperty) + n(form.annualRentReceived) +
      n(form.businessIncomeAnnual) + n(form.professionalIncomeAnnual) + n(form.presumptiveIncome) > 0

    if (gross === 0 && !hasOtherIncome) {
      toast.error('Please enter at least your salary or one income source'); return
    }

    const totalDeductions = n(form.employeePF) + n(form.esic) + n(form.professionalTax) +
      n(form.tdsDeducted) + n(form.loanDeduction) + n(form.otherDeductions)

    const netSalary = Math.max(0, gross - totalDeductions)

    const data: ParsedSalaryData = {
      employeeName: form.employeeName || 'You',
      employerName: form.employerName || 'Self',
      month: form.month, year: form.year,
      basicSalary: n(form.basicSalary),
      hra: n(form.hra), da: n(form.da), ta: n(form.ta), lta: n(form.lta),
      medicalAllowance: n(form.medicalAllowance),
      specialAllowance: n(form.specialAllowance) + n(form.freelanceIncome) + n(form.businessIncome),
      otherAllowances: n(form.otherAllowances),
      grossSalary: gross,
      employeePF: n(form.employeePF),
      employerPF: n(form.employerPF) || n(form.employeePF),
      esic: n(form.esic),
      professionalTax: n(form.professionalTax),
      tdsDeducted: n(form.tdsDeducted),
      loanDeduction: n(form.loanDeduction),
      otherDeductions: n(form.otherDeductions),
      totalDeductions,
      netSalary,
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
    }
    onSubmit(data)
    toast.success(`Saved! Take-home: ₹${netSalary.toLocaleString('en-IN')}/mo`)
  }

  const months = ['April','May','June','July','August','September','October','November','December','January','February','March']

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Left panel */}
        <div>
          {/* Personal info */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 14 }}>👤 Your Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Your Name (optional)</label>
              <input value={form.employeeName} onChange={e => set('employeeName', e.target.value)} placeholder="e.g. Rahul Sharma"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Employer / Company (optional)</label>
              <input value={form.employerName} onChange={e => set('employerName', e.target.value)} placeholder="e.g. Infosys Ltd"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none' }} />
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

          {/* Earnings */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E8449', marginBottom: 14 }}>↑ Earnings (Monthly)</div>
            {inp('Basic Salary *', 'basicSalary', '25000', 'Usually 40-50% of CTC')}
            {inp('HRA (House Rent Allowance)', 'hra', '0', 'Usually 40-50% of Basic')}
            {inp('DA (Dearness Allowance)', 'da', '0', 'Mainly for Govt employees')}
            {inp('Travel Allowance (TA)', 'ta', '0')}
            {inp('LTA (Leave Travel Allowance)', 'lta', '0')}
            {inp('Medical Allowance', 'medicalAllowance', '0')}
            {inp('Special Allowance', 'specialAllowance', '0', 'Flexible component / balance allowance')}
            {inp('Other Allowances', 'otherAllowances', '0')}
          </Card>

          {/* Freelance/Business */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#8E44AD', marginBottom: 6 }}>💼 Freelance / Business Income</div>
            <div style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 14 }}>For self-employed, consultants, and gig workers</div>
            {inp('Monthly Freelance Income', 'freelanceIncome', '0')}
            {inp('Monthly Business Income', 'businessIncome', '0')}
          </Card>
        </div>

        {/* Right panel */}
        <div>
          {/* Deductions */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#C0392B', marginBottom: 14 }}>↓ Deductions (Monthly)</div>
            {inp('EPF — Employee Contribution', 'employeePF', '0', '12% of Basic Salary typically')}
            {inp('EPF — Employer Contribution', 'employerPF', '0', 'Same as employee contribution')}
            {inp('ESIC', 'esic', '0', 'Only if salary < ₹21,000/mo')}
            {inp('Professional Tax', 'professionalTax', '0', 'Max ₹200/mo in most states')}
            {inp('TDS Deducted', 'tdsDeducted', '0', 'Income tax deducted by employer')}
            {inp('Loan / Advance Recovery', 'loanDeduction', '0')}
            {inp('Other Deductions', 'otherDeductions', '0')}
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
                  Annual take-home: <strong>₹{(net * 12).toLocaleString('en-IN')}</strong>
                </div>
              </Card>
            )
          })()}
        </div>
      </div>

      {/* ─── Other Income Sources (Annual) ─────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2833', marginBottom: 4, marginTop: 8 }}>
          🏦 Other Income Sources <span style={{ fontSize: 12, fontWeight: 400, color: '#5D6D7E' }}>(Annual amounts — leave blank if not applicable)</span>
        </div>
        <div style={{ fontSize: 12, color: '#E67E22', marginBottom: 16, background: '#FEF3E2', padding: '8px 12px', borderRadius: 8, border: '1px solid #F0C070' }}>
          ⚠️ These are added to your taxable income. Most people forget these — IT Dept already has this data via AIS.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

          {/* (i) Dividend */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2E86C1', marginBottom: 12 }}>📈 Dividend Income</div>
            {inp('Dividend from Shares/MF (Annual)', 'dividendIncome', '0', 'Fully taxable at slab rate since FY 2020-21')}
          </Card>

          {/* (ii) Interest Income */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E8449', marginBottom: 12 }}>🏦 Interest Income (Annual)</div>
            {inp('FD Interest', 'fdInterest', '0', 'Taxable at slab rate. Bank deducts 10% TDS if >₹40K')}
            {inp('Savings Bank Interest', 'savingsInterest', '0', '₹10,000 exempt under 80TTA (₹50K for seniors)')}
            {inp('Other Interest (Bonds, etc.)', 'otherInterest', '0')}
          </Card>

          {/* (iii) Gifts */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8E44AD', marginBottom: 12 }}>🎁 Gifts Received (Annual)</div>
            {inp('Gift from Relatives', 'giftFromRelatives', '0', '100% tax exempt — from spouse, parents, siblings')}
            {inp('Gift from Non-Relatives', 'giftFromOthers', '0', 'Taxable if total > ₹50,000 in a year')}
          </Card>

          {/* (iv) Capital Gains */}
          <Card style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C0392B', marginBottom: 6 }}>📊 Capital Gains (Annual)</div>
            <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 14 }}>
              STCG Equity = 20% flat · LTCG Equity = 12.5% above ₹1.25L · Property LTCG = 12.5% · Debt at slab rate
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {inp('LTCG — Equity / Mutual Funds', 'ltcgEquity', '0', 'Held > 12 months. 12.5% above ₹1.25L exemption')}
              {inp('STCG — Equity / Mutual Funds', 'stcgEquity', '0', 'Held < 12 months. 20% flat')}
              {inp('LTCG — Property', 'ltcgProperty', '0', '12.5% without indexation')}
              {inp('STCG — Property', 'stcgProperty', '0', 'Added to income, taxed at slab rate')}
              {inp('LTCG — Debt / Other', 'ltcgOther', '0', 'Added to income, taxed at slab rate')}
              {inp('STCG — Debt / Other', 'stcgOther', '0', 'Added to income, taxed at slab rate')}
            </div>
          </Card>

          {/* (v) House Property */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E67E22', marginBottom: 6 }}>🏠 Income from House Property</div>
            <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 12 }}>Annual amounts</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Property Status</label>
              <select value={form.isLetOut} onChange={e => set('isLetOut', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
                <option value="yes">Let Out (Rented)</option>
                <option value="no">Self Occupied</option>
              </select>
            </div>
            {form.isLetOut === 'yes' && inp('Annual Rent Received', 'annualRentReceived', '0', 'Gross annual rent before deductions')}
            {inp('Municipal Tax Paid (Annual)', 'municipalTaxPaid', '0', 'Deductible from rental income')}
            {inp('Home Loan Interest (Annual)', 'homeLoanInterestHP', '0', form.isLetOut === 'yes' ? 'Fully deductible for let-out property' : 'Max ₹2L for self-occupied (Sec 24b)')}
          </Card>

          {/* (vi) Business & Profession */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A3C5E', marginBottom: 6 }}>💼 Business & Profession (Annual)</div>
            <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 12 }}>Net profit/income after expenses</div>
            {inp('Business Income (Net Profit)', 'businessIncomeAnnual', '0', 'After all business expenses')}
            {inp('Professional Income (Net)', 'professionalIncomeAnnual', '0', 'Doctors, CAs, consultants, architects')}
            {inp('Presumptive Income (44AD/44ADA)', 'presumptiveIncome', '0', '44AD: 6-8% of turnover · 44ADA: 50% of receipts')}
          </Card>

        </div>
      </div>

      <button onClick={handleSubmit}
        style={{ width: '100%', padding: '14px', background: '#1A3C5E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        ✓ Save & Analyse My Income
      </button>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────
export default function SalaryPage() {
  const { salary, setSalary } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [consent, setConsent] = useState(true)
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
      toast.success(`Parsed! Take-home: ₹${json.data.netSalary?.toLocaleString('en-IN')}/mo`, { id: toastId })
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

  if (salary && !loading) {
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C2833', margin: 0 }}>Salary Analysis</h2>
            <div style={{ fontSize: 13, color: '#5D6D7E', marginTop: 3 }}>
              All components extracted · <Badge color="green">{salary.employeeName === 'You' ? 'Manual Entry' : 'Parsed by AI'}</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setSalary(null)}
              style={{ padding: '8px 18px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#1C2833' }}>
              ↑ New Upload
            </button>
            <Link href="/dashboard/tax" style={{ padding: '8px 18px', background: '#1A3C5E', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Optimise Tax →
            </Link>
          </div>
        </div>
        <SalaryBreakdown data={salary} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>Salary Slip</h2>
        <p style={{ fontSize: 14, color: '#5D6D7E', lineHeight: 1.65, maxWidth: 580 }}>
          Upload your salary slip or enter the details manually. Your data stays private and is never stored.
        </p>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {[
          { key: 'upload', label: '📄 Upload Salary Slip', desc: 'AI reads any format' },
          { key: 'manual', label: '✏️ Enter Manually', desc: 'Type in your numbers' },
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
                      <div className="skeleton" style={{ width: 7, height: 7, borderRadius: '50%' }} />
                      {s}
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
              { icon: '📸', title: 'Photo / Image', desc: 'Phone camera photos of printed payslips' },
              { icon: '🏢', title: 'Any Employer', desc: 'IT, PSU, SME, startup — all formats' },
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
            <strong>Privacy:</strong> Your salary slip is processed by Claude AI and converted to structured data. The raw document is never saved to any database.
          </InfoBox>
        </>
      ) : (
        <ManualEntryForm onSubmit={setSalary} />
      )}
    </div>
  )
}
