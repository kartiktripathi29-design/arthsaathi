'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

export default function TaxOptimizerPage() {
  const router = useRouter()
  const [calc, setCalc] = useState<any>(null)

  useEffect(() => {
    const salary = localStorage.getItem('av_salary_timeline')
    const other = localStorage.getItem('av_other_income')
    const exemptions = localStorage.getItem('av_exemptions')
    const deductions = localStorage.getItem('av_deductions')

    if (!salary) {
      setCalc(null)
      return
    }

    try {
      const salaryData = JSON.parse(salary)
      const otherData = other ? JSON.parse(other) : []
      const exemptionsData = exemptions ? JSON.parse(exemptions) : {}
      const deductionsData = deductions ? JSON.parse(deductions) : {}

      const salaryAnnual = (Array.isArray(salaryData) ? salaryData : salaryData.employments?.[0]?.slips || []).reduce((s: number, slip: any) => s + slip.grossSalary, 0) || 0
      const otherIncome = Array.isArray(otherData) ? otherData.reduce((s: number, inc: any) => s + inc.amount, 0) : 0
      const totalIncome = salaryAnnual + otherIncome

      const hra = exemptionsData.hra || {}
      const basicSalary = (Array.isArray(salaryData) ? salaryData[0]?.basicSalary : salaryData.employments?.[0]?.slips?.[0]?.basicSalary) || 0
      const hraExempt = hra.rentPaid ? Math.max(0, Math.min(hra.hraReceived, hra.rentPaid - basicSalary * 0.1, hra.isMetro ? basicSalary * 0.5 : basicSalary * 0.4)) : 0

      const stdDed = 75000
      const sec80C = Math.min((deductionsData.ppf || 0) + (deductionsData.elss || 0) + (deductionsData.lic || 0) + (deductionsData.tuition || 0) + (deductionsData.nsc || 0), 150000)
      const sec80D = Math.min((deductionsData.selfFamily || 0) + (deductionsData.parents || 0), 100000)
      const sec24b = Math.min(deductionsData.homeLoanInterest || 0, 200000)
      const nps = Math.min(deductionsData.nps || 0, 50000)

      const taxableNew = Math.max(0, totalIncome - stdDed - hraExempt * 12)
      const taxableOld = Math.max(0, totalIncome - stdDed - hraExempt * 12 - sec80C - sec80D - sec24b - nps)

      const calcTax = (taxable: number, isNew: boolean) => {
        if (isNew) {
          const slabs = [[0, 400000, 0], [400000, 800000, 0.05], [800000, 1200000, 0.1], [1200000, 1600000, 0.15], [1600000, 2000000, 0.2], [2000000, 2400000, 0.25], [2400000, Infinity, 0.3]]
          let tax = 0, rem = taxable
          for (const [min, max, rate] of slabs) {
            if (rem <= 0) break
            const inSlab = Math.min(rem, max - min)
            tax += inSlab * rate
            rem -= inSlab
          }
          if (taxable <= 700000) tax = 0
          return Math.round(tax * 1.04)
        } else {
          const slabs = [[0, 250000, 0], [250000, 500000, 0.05], [500000, 1000000, 0.2], [1000000, Infinity, 0.3]]
          let tax = 0, rem = taxable
          for (const [min, max, rate] of slabs) {
            if (rem <= 0) break
            const inSlab = Math.min(rem, max - min)
            tax += inSlab * rate
            rem -= inSlab
          }
          if (taxable <= 500000) tax = 0
          return Math.round(tax * 1.04)
        }
      }

      const taxNew = calcTax(taxableNew, true)
      const taxOld = calcTax(taxableOld, false)

      setCalc({
        salaryAnnual, otherIncome, totalIncome, stdDed, hraExempt: hraExempt * 12,
        sec80C, sec80D, sec24b, nps,
        taxableNew, taxableOld, taxNew, taxOld,
        recommendation: taxNew <= taxOld ? 'new' : 'old',
        savings: Math.abs(taxNew - taxOld),
        hraFilled: hra.rentPaid > 0,
      })
    } catch (e) {
      console.error('Calc failed:', e)
    }
  }, [])

  if (!calc) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: C.danger, margin: 0 }}>Upload a salary slip first to see your tax calculation.</p>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ marginTop: 20, padding: '10px 20px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Go to Salary</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Tax Optimization</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Your tax picture for FY 2025-26</p>

      {/* Income Summary */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Income</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: C.text }}>Salary</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(calc.salaryAnnual)}</span>
        </div>
        {calc.otherIncome > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.text }}>Other Income</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(calc.otherIncome)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
          <span>Total Income</span>
          <span style={{ color: C.fg }}>{fmt(calc.totalIncome)}</span>
        </div>
      </div>

      {/* Regime Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: calc.recommendation === 'new' ? '#F0F9F7' : C.card, border: `2px solid ${calc.recommendation === 'new' ? C.fg : C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: 0 }}>New Regime</h3>
            {calc.recommendation === 'new' && <span style={{ fontSize: 9, fontWeight: 700, background: '#E8F5F2', color: C.fg, padding: '3px 8px', borderRadius: 3 }}>✓ RECOMMENDED</span>}
          </div>
          <div style={{ paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px' }}>Taxable</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(calc.taxableNew)}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px' }}>Tax</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: calc.recommendation === 'new' ? C.fg : C.text, margin: 0 }}>{fmt(calc.taxNew)}</p>
          </div>
        </div>

        <div style={{ background: calc.recommendation === 'old' ? '#FEF4E8' : C.card, border: `2px solid ${calc.recommendation === 'old' ? C.wm : C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: 0 }}>Old Regime</h3>
            {calc.recommendation === 'old' && <span style={{ fontSize: 9, fontWeight: 700, background: '#FEF4E8', color: C.wm, padding: '3px 8px', borderRadius: 3 }}>✓ RECOMMENDED</span>}
          </div>
          <div style={{ paddingBottom: 10, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px' }}>Taxable</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(calc.taxableOld)}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px' }}>Tax</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: calc.recommendation === 'old' ? C.wm : C.text, margin: 0 }}>{fmt(calc.taxOld)}</p>
          </div>
        </div>
      </div>

      {/* Savings */}
      <div style={{ background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 8, padding: 20, marginBottom: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase' as const }}>Tax Savings</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(calc.savings)}</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0' }}>by choosing {calc.recommendation === 'new' ? 'New' : 'Old'} Regime</p>
      </div>

      {/* WHERE YOU CAN SAVE MORE - USP */}
      <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 16px' }}>Where You Can Save More</h3>
        
        {!calc.hraFilled && calc.salaryAnnual > 0 && (
          <div style={{ padding: '12px', background: '#FFF3DD', border: `1px solid ${C.wm}`, borderRadius: 6, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#856404', margin: 0, fontWeight: 500 }}>💡 You haven't entered rent details. If you pay rent, fill Exemptions tab to claim HRA exemption and save more.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: '10px', background: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>Home Loan Interest</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>₹{(200000 - (calc.sec24b || 0)).toLocaleString('en-IN')} unused</p>
            <p style={{ fontSize: 9, color: C.muted, margin: '4px 0 0' }}>You'd save ~₹{fmt((200000 - (calc.sec24b || 0)) * 0.2)}</p>
          </div>
          <div style={{ padding: '10px', background: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>80C Investments</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>₹{(150000 - (calc.sec80C || 0)).toLocaleString('en-IN')} unused</p>
            <p style={{ fontSize: 9, color: C.muted, margin: '4px 0 0' }}>You'd save ~₹{fmt((150000 - (calc.sec80C || 0)) * 0.2)}</p>
          </div>
          <div style={{ padding: '10px', background: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>Health Insurance</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>₹{(100000 - (calc.sec80D || 0)).toLocaleString('en-IN')} unused</p>
            <p style={{ fontSize: 9, color: C.muted, margin: '4px 0 0' }}>You'd save ~₹{fmt((100000 - (calc.sec80D || 0)) * 0.2)}</p>
          </div>
          <div style={{ padding: '10px', background: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>NPS</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>₹{(50000 - (calc.nps || 0)).toLocaleString('en-IN')} unused</p>
            <p style={{ fontSize: 9, color: C.muted, margin: '4px 0 0' }}>You'd save ~₹{fmt((50000 - (calc.nps || 0)) * 0.2)}</p>
          </div>
        </div>
        <p style={{ fontSize: 10, color: C.muted, margin: '12px 0 0', fontStyle: 'italic' }}>Only invest if it makes financial sense. Tax saving is a bonus, not the goal.</p>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/deductions')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Edit Deductions</button>
        <button onClick={() => router.push('/dashboard')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
      </div>
    </div>
  )
}
