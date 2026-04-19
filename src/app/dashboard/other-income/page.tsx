'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Card, InfoBox } from '@/components/ui'

export default function OtherIncomePage() {
  const n = (v: string) => parseFloat(v.replace(/,/g, '')) || 0
  const [saved, setSaved] = useState(false)
  const [income, setIncome] = useState({
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

  const set = (k: string, v: string) => setIncome(f => ({ ...f, [k]: v }))

  const inp = (label: string, key: string, hint?: string) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#95A5A6', marginBottom: 4 }}>{hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E9ED', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <span style={{ padding: '8px 10px', background: '#F8FAFB', fontSize: 13, color: '#5D6D7E', borderRight: '1px solid #E5E9ED' }}>₹</span>
        <input type="number" value={income[key as keyof typeof income] as string}
          onChange={e => set(key, e.target.value)} placeholder="0"
          style={{ flex: 1, padding: '8px 12px', border: 'none', fontSize: 13, outline: 'none', background: 'transparent' }} />
      </div>
    </div>
  )

  const total = n(income.dividendIncome) + n(income.fdInterest) + n(income.savingsInterest) +
    n(income.otherInterest) + n(income.giftFromOthers) + n(income.ltcgEquity) + n(income.stcgEquity) +
    n(income.ltcgProperty) + n(income.stcgProperty) + n(income.ltcgOther) + n(income.stcgOther) +
    n(income.annualRentReceived) + n(income.businessIncomeAnnual) +
    n(income.professionalIncomeAnnual) + n(income.presumptiveIncome)

  const handleSave = () => {
    setSaved(true)
    toast.success(`Other income saved: ₹${total.toLocaleString('en-IN')}/yr`)
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>Other Income Sources</h2>
        <p style={{ fontSize: 14, color: '#5D6D7E', lineHeight: 1.65, maxWidth: 620 }}>
          Add all annual income beyond salary. Leave blank if not applicable — only fill what applies to you.
        </p>
      </div>

      <div style={{ background: '#FEF3E2', border: '1px solid #F0C070', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#78350F' }}>
        ⚠️ <strong>Important:</strong> The IT Department already has this data via AIS. Not declaring leads to notices and penalties.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

        {/* (i) Dividend */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2E86C1', marginBottom: 12 }}>📈 (i) Dividend Income</div>
          {inp('Dividend from Shares / MF (Annual)', 'dividendIncome', 'Fully taxable at slab rate since FY 2020-21')}
        </Card>

        {/* (ii) Interest */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E8449', marginBottom: 12 }}>🏦 (ii) Interest Income (Annual)</div>
          {inp('(a) FD Interest', 'fdInterest', 'Taxable at slab. Bank deducts 10% TDS if >₹40K')}
          {inp('(b) Savings Bank Interest', 'savingsInterest', '₹10K exempt under 80TTA (₹50K for seniors)')}
          {inp('(c) Other Interest (Bonds etc.)', 'otherInterest', 'Fully taxable at slab rate')}
        </Card>

        {/* (iii) Gifts */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#8E44AD', marginBottom: 12 }}>🎁 (iii) Gifts Received (Annual)</div>
          {inp('From Relatives', 'giftFromRelatives', '100% exempt — spouse, parents, siblings, children')}
          {inp('From Non-Relatives', 'giftFromOthers', 'Taxable if total > ₹50,000 in a year')}
        </Card>

        {/* (iv) Capital Gains */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C0392B', marginBottom: 6 }}>📊 (iv) Capital Gains (Annual)</div>
          <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 14, background: '#FFF5F5', padding: '8px 12px', borderRadius: 6 }}>
            Equity STCG = 20% flat &nbsp;·&nbsp; Equity LTCG = 12.5% above ₹1.25L &nbsp;·&nbsp; Property LTCG = 12.5% &nbsp;·&nbsp; Debt/Other = slab rate
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {inp('LTCG — Equity / Mutual Funds', 'ltcgEquity', 'Held > 12 months. 12.5% above ₹1.25L')}
            {inp('STCG — Equity / Mutual Funds', 'stcgEquity', 'Held < 12 months. 20% flat')}
            {inp('LTCG — Property', 'ltcgProperty', '12.5% without indexation (post Jul 2024)')}
            {inp('STCG — Property', 'stcgProperty', 'Added to income, taxed at slab rate')}
            {inp('LTCG — Debt / Other Assets', 'ltcgOther', 'Added to income, taxed at slab rate')}
            {inp('STCG — Debt / Other Assets', 'stcgOther', 'Added to income, taxed at slab rate')}
          </div>
        </Card>

        {/* (v) House Property */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#E67E22', marginBottom: 6 }}>🏠 (v) House Property (Annual)</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Property Status</label>
            <select value={income.isLetOut} onChange={e => set('isLetOut', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E9ED', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
              <option value="yes">Let Out (Rented)</option>
              <option value="no">Self Occupied</option>
            </select>
          </div>
          {income.isLetOut === 'yes' && inp('Annual Rent Received', 'annualRentReceived', 'Gross rent before deductions')}
          {inp('Municipal Tax Paid (Annual)', 'municipalTaxPaid', 'Deductible from rental income')}
          {inp('Home Loan Interest (Annual)', 'homeLoanInterestHP', income.isLetOut === 'yes' ? 'Fully deductible for let-out property' : 'Max ₹2L deduction for self-occupied (Sec 24b)')}
        </Card>

        {/* (vi) Business & Profession */}
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A3C5E', marginBottom: 6 }}>💼 (vi) Business & Profession (Annual)</div>
          <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 12 }}>Net profit after all expenses</div>
          {inp('Business Income (Net Profit)', 'businessIncomeAnnual', 'After all allowable business expenses')}
          {inp('Professional Income (Net)', 'professionalIncomeAnnual', 'Doctors, CAs, lawyers, consultants')}
          {inp('Presumptive Income (44AD/44ADA)', 'presumptiveIncome', '44AD: 6-8% of turnover · 44ADA: 50% of receipts')}
        </Card>

      </div>

      {/* Total banner */}
      {total > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 12, padding: '16px 24px', margin: '20px 0', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>TOTAL OTHER INCOME (ANNUAL)</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#FCD34D' }}>₹{total.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', maxWidth: 220, textAlign: 'right', lineHeight: 1.6 }}>
            This will be added to your salary for complete tax calculation
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Link href="/dashboard/salary"
          style={{ padding: '12px 24px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#5D6D7E', textDecoration: 'none' }}>
          ← Back to Salary
        </Link>
        <button onClick={handleSave}
          style={{ flex: 1, padding: '14px', background: saved ? '#1E8449' : '#1A3C5E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {saved ? '✓ Saved — Go to Tax Optimiser →' : total > 0 ? 'Save Other Income' : 'Skip — Go to Tax Optimiser →'}
        </button>
        {saved && (
          <Link href="/dashboard/tax"
            style={{ padding: '14px 24px', background: '#C9A84C', color: '#0F2640', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            Optimise Tax →
          </Link>
        )}
      </div>
    </div>
  )
}
