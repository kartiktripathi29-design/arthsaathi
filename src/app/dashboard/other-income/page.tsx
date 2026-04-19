'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// All possible income types
const INCOME_TYPES = [
  { key: 'dividend',    icon: '📈', label: 'Dividend Income',          desc: 'From shares or mutual funds', color: '#2E86C1' },
  { key: 'fd',          icon: '🏦', label: 'FD Interest',               desc: 'Fixed deposit interest income', color: '#1E8449' },
  { key: 'savings',     icon: '💰', label: 'Savings Bank Interest',      desc: 'Interest from savings account', color: '#1E8449' },
  { key: 'other_int',   icon: '📋', label: 'Other Interest',            desc: 'Bonds, debentures, etc.', color: '#1E8449' },
  { key: 'gift_rel',    icon: '🎁', label: 'Gift from Relatives',       desc: 'Tax exempt gifts', color: '#8E44AD' },
  { key: 'gift_other',  icon: '🎁', label: 'Gift from Non-Relatives',   desc: 'Taxable if > ₹50,000', color: '#8E44AD' },
  { key: 'ltcg_eq',     icon: '📊', label: 'LTCG — Equity / MF',        desc: 'Held > 12 months, 12.5% tax', color: '#C0392B' },
  { key: 'stcg_eq',     icon: '📊', label: 'STCG — Equity / MF',        desc: 'Held < 12 months, 20% tax', color: '#C0392B' },
  { key: 'ltcg_prop',   icon: '🏘️', label: 'LTCG — Property',          desc: '12.5% without indexation', color: '#C0392B' },
  { key: 'stcg_prop',   icon: '🏘️', label: 'STCG — Property',          desc: 'Taxed at slab rate', color: '#C0392B' },
  { key: 'ltcg_other',  icon: '📦', label: 'LTCG — Debt / Other',       desc: 'Taxed at slab rate', color: '#C0392B' },
  { key: 'stcg_other',  icon: '📦', label: 'STCG — Debt / Other',       desc: 'Taxed at slab rate', color: '#C0392B' },
  { key: 'house_prop',  icon: '🏠', label: 'Income from House Property', desc: 'Rental income or self-occupied', color: '#E67E22' },
  { key: 'business',    icon: '💼', label: 'Business Income',            desc: 'Net profit from business', color: '#1A3C5E' },
  { key: 'profession',  icon: '🩺', label: 'Professional Income',        desc: 'Doctors, CAs, lawyers, consultants', color: '#1A3C5E' },
  { key: 'presumptive', icon: '📝', label: 'Presumptive Income',         desc: '44AD / 44ADA scheme', color: '#1A3C5E' },
]

export default function OtherIncomePage() {
  const n = (v: string) => parseFloat(v.replace(/,/g, '')) || 0
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [values, setValues] = useState<Record<string, string>>({})
  const [isLetOut, setIsLetOut] = useState('yes')
  const [saved, setSaved] = useState(false)

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const setVal = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }))

  const total = Array.from(selected).reduce((sum, key) => {
    if (key === 'gift_rel') return sum // exempt
    if (key === 'house_prop') {
      const rent = n(values['annualRentReceived'] || '0')
      const muni = n(values['municipalTaxPaid'] || '0')
      const netAnnual = (rent - muni) * 0.7 // 30% standard deduction
      return sum + Math.max(0, netAnnual)
    }
    return sum + n(values[key] || '0')
  }, 0)

  const handleSave = () => {
    setSaved(true)
    toast.success(total > 0 ? `Other income saved: ₹${total.toLocaleString('en-IN')}/yr` : 'Saved — no other income added')
  }

  const inp = (key: string, label: string, hint?: string) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#95A5A6', marginBottom: 4 }}>{hint}</div>}
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #D1D5DB', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <span style={{ padding: '8px 10px', background: '#F8FAFB', fontSize: 13, color: '#5D6D7E', borderRight: '1px solid #E5E9ED' }}>₹</span>
        <input type="number" value={values[key] || ''} onChange={e => setVal(key, e.target.value)}
          placeholder="0" style={{ flex: 1, padding: '8px 12px', border: 'none', fontSize: 13, outline: 'none' }} />
      </div>
    </div>
  )

  // Expanded fields per type
  const expandedFields: Record<string, React.ReactNode> = {
    dividend:    inp('dividend',    'Annual Dividend Amount', 'Fully taxable at your slab rate'),
    fd:          inp('fd',          'Annual FD Interest',     'Bank deducts 10% TDS if > ₹40,000'),
    savings:     inp('savings',     'Annual Savings Interest','First ₹10,000 exempt under 80TTA'),
    other_int:   inp('other_int',   'Other Interest Income',  'Bonds, debentures, NCDs'),
    gift_rel:    inp('gift_rel',    'Gift Amount',            '100% tax exempt — spouse, parents, siblings'),
    gift_other:  inp('gift_other',  'Gift Amount',            'Taxable if total exceeds ₹50,000/yr'),
    ltcg_eq:     inp('ltcg_eq',     'LTCG Amount',            '12.5% tax above ₹1.25L exemption'),
    stcg_eq:     inp('stcg_eq',     'STCG Amount',            '20% flat tax'),
    ltcg_prop:   inp('ltcg_prop',   'LTCG Amount',            '12.5% without indexation'),
    stcg_prop:   inp('stcg_prop',   'STCG Amount',            'Added to income, taxed at slab'),
    ltcg_other:  inp('ltcg_other',  'LTCG Amount',            'Added to income, taxed at slab'),
    stcg_other:  inp('stcg_other',  'STCG Amount',            'Added to income, taxed at slab'),
    business:    inp('business',    'Net Business Profit (Annual)', 'After all business expenses'),
    profession:  inp('profession',  'Net Professional Income (Annual)', 'After expenses'),
    presumptive: inp('presumptive', 'Presumptive Income (Annual)', '44AD: 6-8% of turnover · 44ADA: 50% of receipts'),
    house_prop: (
      <div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Property Status</label>
          <select value={isLetOut} onChange={e => setIsLetOut(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
            <option value="yes">Let Out (Rented)</option>
            <option value="no">Self Occupied</option>
          </select>
        </div>
        {isLetOut === 'yes' && inp('annualRentReceived', 'Annual Rent Received', '30% standard deduction applied automatically')}
        {inp('municipalTaxPaid', 'Municipal Tax Paid (Annual)', 'Deductible from rental income')}
        {inp('homeLoanInterestHP', 'Home Loan Interest (Annual)', isLetOut === 'yes' ? 'Fully deductible for let-out property' : 'Max ₹2L for self-occupied (Sec 24b)')}
      </div>
    ),
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>Other Income Sources</h2>
        <p style={{ fontSize: 14, color: '#5D6D7E', lineHeight: 1.65 }}>
          Select only the income types that apply to you. Leave the rest — they won't appear.
        </p>
      </div>

      {/* Warning */}
      <div style={{ background: '#FEF3E2', border: '1px solid #F0C070', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#78350F' }}>
        ⚠️ IT Department has this data via AIS. Not declaring leads to notices.
      </div>

      {/* Income type selector grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 24 }}>
        {INCOME_TYPES.map(type => {
          const isSelected = selected.has(type.key)
          return (
            <div key={type.key}
              style={{ border: `2px solid ${isSelected ? type.color : '#E5E9ED'}`, borderRadius: 12, overflow: 'hidden', background: '#fff', transition: 'all 0.15s' }}>
              {/* Header — always visible, clickable */}
              <button onClick={() => toggle(type.key)}
                style={{ width: '100%', padding: '12px 14px', background: isSelected ? `${type.color}10` : '#FAFAFA', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{type.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? type.color : '#1C2833' }}>{type.label}</div>
                  <div style={{ fontSize: 11, color: '#95A5A6', marginTop: 1 }}>{type.desc}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? type.color : '#D1D5DB'}`, background: isSelected ? type.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isSelected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
              </button>

              {/* Expanded input — only when selected */}
              {isSelected && (
                <div style={{ padding: '12px 14px', borderTop: `1px solid ${type.color}30`, background: '#fff' }}>
                  {expandedFields[type.key]}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Total */}
      {selected.size > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 12, padding: '16px 24px', marginBottom: 20, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>TOTAL OTHER INCOME (ANNUAL)</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#FCD34D' }}>₹{total.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{selected.size} income source{selected.size > 1 ? 's' : ''} selected</div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', maxWidth: 200, textAlign: 'right', lineHeight: 1.6 }}>
            Will be added to salary for complete tax picture
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/dashboard/salary"
          style={{ padding: '12px 20px', background: '#fff', border: '1px solid #E5E9ED', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#5D6D7E', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          ← Back
        </Link>
        <button onClick={handleSave}
          style={{ flex: 1, padding: '14px', background: saved ? '#1E8449' : '#1A3C5E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          {saved ? '✓ Saved!' : selected.size > 0 ? `Save ${selected.size} Income Source${selected.size > 1 ? 's' : ''}` : 'No Other Income — Continue →'}
        </button>
        <Link href="/dashboard/total-income"
          style={{ padding: '12px 20px', background: '#C9A84C', color: '#0F2640', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          View Total Income →
        </Link>
      </div>
    </div>
  )
}
