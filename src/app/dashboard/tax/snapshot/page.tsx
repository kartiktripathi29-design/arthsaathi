'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41', danger: '#B94040', text: '#1C2B22' }
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

interface TaxResult {
  newTax: number
  oldTax: number
  savings: number
  recommended: 'new' | 'old'
  newTaxable: number
  oldTaxable: number
  salaryAnnual: number
  slabOther: number
  totalGross: number
}

interface ITRForm {
  form: string
  title: string
  reason: string
  details: string
}

export default function TaxSnapshotPage() {
  const router = useRouter()
  const [result, setResult] = useState<TaxResult | null>(null)
  const [itrForm, setItrForm] = useState<ITRForm | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch all data from localStorage
    const salaryData = localStorage.getItem('av_salary_timeline')
    const otherIncomeData = localStorage.getItem('av_other_income')
    const exemptionsData = localStorage.getItem('av_exemptions')
    const deductionsData = localStorage.getItem('av_deductions')

    if (!salaryData) {
      setLoading(false)
      return
    }

    const salary = JSON.parse(salaryData)
    const otherIncome = otherIncomeData ? JSON.parse(otherIncomeData) : []
    const exemptions = exemptionsData ? JSON.parse(exemptionsData) : { hra: { hraReceived: 0, rentPaid: 0, isMetro: false } }
    const deductions = deductionsData ? JSON.parse(deductionsData) : {}

    // Calculate annual salary
    const salaryAnnual = salary.reduce((sum: number, slip: any) => sum + (slip.grossSalary || 0), 0)

    // Calculate HRA exemption
    const hra = exemptions.hra || { hraReceived: 0, rentPaid: 0, isMetro: false }
    let hraExemption = 0
    if (hra.hraReceived && hra.rentPaid) {
      const actual = hra.hraReceived
      const rentMinus10Percent = hra.rentPaid - hra.hraReceived * 0.1
      const cityLimit = hra.isMetro ? hra.hraReceived * 0.5 : hra.hraReceived * 0.4
      hraExemption = Math.max(0, Math.min(actual, rentMinus10Percent, cityLimit))
    }

    // Calculate 80C deductions (capped at 1.5L)
    const sec80C = Math.min(
      (deductions.ppf || 0) +
        (deductions.elss || 0) +
        (deductions.lic || 0) +
        (deductions.tuition || 0) +
        (deductions.nsc || 0),
      150000
    )

    // Calculate 80D deductions
    const sec80DSelfLimit = deductions.selfSenior ? 50000 : 25000
    const sec80DSelf = Math.min(deductions.selfFamily || 0, sec80DSelfLimit)
    const sec80DParentsLimit = deductions.parentsSenior ? 50000 : 25000
    const sec80DParents = Math.min(deductions.parents || 0, sec80DParentsLimit)
    const sec80D = sec80DSelf + sec80DParents

    // Other deductions
    const sec24B = Math.min(deductions.homeLoanInterest || 0, 200000)
    const sec80CCD1B = Math.min(deductions.nps || 0, 50000)

    // Standard deduction
    const stdDed = 75000

    // Income after HRA exemption and standard deduction
    const incomeAfterHRA = salaryAnnual - hraExemption
    const incomeAfterStdDed = incomeAfterHRA - stdDed

    // Taxable income for both regimes
    const oldDedTotal = sec80C + sec80D + sec24B + sec80CCD1B
    const oldTaxable = Math.max(0, incomeAfterHRA - stdDed - oldDedTotal)
    const newTaxable = incomeAfterStdDed

    // Tax calculation (simplified new regime slabs)
    function calcNewRegimeTax(income: number): number {
      let tax = 0
      const slabs = [
        { min: 0, max: 400000, rate: 0 },
        { min: 400000, max: 800000, rate: 0.05 },
        { min: 800000, max: 1200000, rate: 0.1 },
        { min: 1200000, max: 1600000, rate: 0.15 },
        { min: 1600000, max: 2000000, rate: 0.2 },
        { min: 2000000, max: 2400000, rate: 0.25 },
        { min: 2400000, max: Infinity, rate: 0.3 },
      ]

      let rem = income
      for (const slab of slabs) {
        if (rem <= 0) break
        const taxableInSlab = Math.min(rem, slab.max - slab.min)
        tax += taxableInSlab * slab.rate
        rem -= taxableInSlab
      }

      // Rebate 87A: if taxable ≤ 7L, tax = 0
      if (income <= 700000) {
        tax = 0
      }

      // Cess 4%
      return Math.round(tax * 1.04)
    }

    function calcOldRegimeTax(income: number): number {
      let tax = 0
      const slabs = [
        { min: 0, max: 250000, rate: 0 },
        { min: 250000, max: 500000, rate: 0.05 },
        { min: 500000, max: 1000000, rate: 0.2 },
        { min: 1000000, max: Infinity, rate: 0.3 },
      ]

      let rem = income
      for (const slab of slabs) {
        if (rem <= 0) break
        const taxableInSlab = Math.min(rem, slab.max - slab.min)
        tax += taxableInSlab * slab.rate
        rem -= taxableInSlab
      }

      // Rebate 87A: if taxable ≤ 5L, tax = 0
      if (income <= 500000) {
        tax = 0
      }

      // Cess 4%
      return Math.round(tax * 1.04)
    }

    const newTax = calcNewRegimeTax(newTaxable)
    const oldTax = calcOldRegimeTax(oldTaxable)

    // Determine ITR form
    const hasFreelance = otherIncome.some((inc: any) => inc.type === 'freelance')
    const hasEquity = otherIncome.some((inc: any) => inc.type === 'equity')
    const hasCrypto = otherIncome.some((inc: any) => inc.type === 'crypto')
    const hasFNO = otherIncome.some((inc: any) => inc.type === 'fno')

    let itr: ITRForm
    if (hasFNO) {
      itr = {
        form: 'ITR-3',
        title: 'ITR-3 (Business/Professional)',
        reason: 'F&O trading income',
        details: 'ITR-3 covers salary + business/professional income. Required for F&O trading.',
      }
    } else if (hasEquity || hasCrypto) {
      itr = {
        form: 'ITR-2',
        title: 'ITR-2 (Capital Gains)',
        reason: 'Equity or crypto gains',
        details: 'ITR-2 is for salary + capital gains (equity, crypto, mutual funds, etc.).',
      }
    } else if (hasFreelance) {
      itr = {
        form: 'ITR-4',
        title: 'ITR-4 (Sugam)',
        reason: 'Presumptive freelance income (44ADA)',
        details: 'ITR-4 (simplified form) for salaried + freelance income under ₹50L. No capital gains.',
      }
    } else {
      itr = {
        form: 'ITR-1',
        title: 'ITR-1 (Sahaj)',
        reason: 'Salary only',
        details: 'ITR-1 (simplest form) for salaried users with salary, interest, no capital gains or business income.',
      }
    }

    setResult({
      newTax,
      oldTax,
      savings: Math.abs(newTax - oldTax),
      recommended: newTax <= oldTax ? 'new' : 'old',
      newTaxable,
      oldTaxable,
      salaryAnnual,
      slabOther: otherIncome.reduce((sum: number, inc: any) => sum + (inc.amount || 0), 0),
      totalGross: salaryAnnual + otherIncome.reduce((sum: number, inc: any) => sum + (inc.amount || 0), 0),
    })

    setItrForm(itr)
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: C.muted }}>Loading tax calculation...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ background: '#FEE8E8', border: `1px solid ${C.danger}`, borderRadius: 8, padding: 20 }}>
          <p style={{ fontSize: 14, color: C.danger, margin: 0 }}>
            ⚠ No salary data found. Please upload a salary slip first.
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/profile/documents')}
          style={{
            marginTop: 16,
            padding: '12px 20px',
            background: C.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Upload Salary Slip
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Tax Summary</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>FY 2025-26</p>
      </div>

      {/* Income Breakdown */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 16px' }}>Income Breakdown</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: C.text }}>Gross Salary</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{fmt(result.salaryAnnual)}</span>
        </div>

        {result.slabOther > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: C.text }}>Other Income</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{fmt(result.slabOther)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Gross Total Income</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{fmt(result.totalGross)}</span>
        </div>
      </div>

      {/* Regime Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* New Regime */}
        <div
          style={{
            background: result.recommended === 'new' ? '#F0F9F7' : C.card,
            border: `2px solid ${result.recommended === 'new' ? C.primary : C.border}`,
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>New Regime</h3>
            {result.recommended === 'new' && <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, background: '#E8F5F2', padding: '4px 8px', borderRadius: 4 }}>✓ RECOMMENDED</span>}
          </div>

          <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 6px' }}>Taxable Income</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(result.newTaxable)}</p>
          </div>

          <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 6px' }}>Tax Payable</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: result.recommended === 'new' ? C.primary : C.fg, margin: 0 }}>{fmt(result.newTax)}</p>
          </div>

          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>Standard deduction: ₹75,000</p>
        </div>

        {/* Old Regime */}
        <div
          style={{
            background: result.recommended === 'old' ? '#FEF4E8' : C.card,
            border: `2px solid ${result.recommended === 'old' ? '#D4B98A' : C.border}`,
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Old Regime</h3>
            {result.recommended === 'old' && <span style={{ fontSize: 11, fontWeight: 700, color: '#C4863E', background: '#FEF4E8', padding: '4px 8px', borderRadius: 4 }}>✓ RECOMMENDED</span>}
          </div>

          <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 6px' }}>Taxable Income</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(result.oldTaxable)}</p>
          </div>

          <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 6px' }}>Tax Payable</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: result.recommended === 'old' ? '#C4863E' : C.fg, margin: 0 }}>{fmt(result.oldTax)}</p>
          </div>

          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>With 80C/80D/24b deductions</p>
        </div>
      </div>

      {/* Savings */}
      <div style={{ background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 8, padding: 20, marginBottom: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px' }}>Tax Savings</p>
        <p style={{ fontSize: 28, fontWeight: 700, color: C.primary, margin: 0 }}>{fmt(result.savings)}</p>
        <p style={{ fontSize: 12, color: C.muted, margin: '8px 0 0' }}>by choosing {result.recommended === 'new' ? 'New' : 'Old'} Regime</p>
      </div>

      {/* ITR Form Recommendation */}
      {itrForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>ITR Form to File</h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.primary, margin: '0 0 4px' }}>{itrForm.form}</p>
              <p style={{ fontSize: 12, color: C.fg, margin: '0 0 6px' }}>{itrForm.title}</p>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{itrForm.reason}</p>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>{itrForm.form}</div>
          </div>

          <div style={{ background: '#F9F7F4', border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, marginTop: 12 }}>
            <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.6 }}>{itrForm.details}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => router.push('/dashboard/profile/deductions')}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            color: C.primary,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Edit Deductions
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            flex: 1,
            padding: '12px',
            background: C.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
