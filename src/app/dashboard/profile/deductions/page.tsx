'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41', accent: '#E6CFA7' }

export default function DeductionsPage() {
  const router = useRouter()
  const [deductions, setDeductions] = useState({
    sec80C: 0,
    sec80D: 0,
    homeLoanInterest: 0,
    nps: 0,
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('av_deductions')
      if (stored) setDeductions(JSON.parse(stored))
    }
  }, [])

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('av_deductions', JSON.stringify(deductions))
    }
    router.push('/dashboard/tax')
  }

  const updateField = (key: string) => (value: number) => {
    setDeductions(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Deductions</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          Declare investments and expenses eligible for tax deductions under Old Regime.
        </p>
      </div>

      {/* 80C */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>
            Section 80C (PPF, ELSS, Life Insurance, etc.)
          </h3>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Max deduction: ₹1,50,000</p>
        </div>
        <input
          type="number"
          value={deductions.sec80C || ''}
          onChange={e => updateField('sec80C')(parseFloat(e.target.value) || 0)}
          placeholder="₹0"
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
            borderRadius: 6, fontFamily: 'inherit', background: C.bg,
          }}
        />
      </div>

      {/* 80D */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>
            Section 80D (Health Insurance)
          </h3>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Max: ₹25K (self) + ₹50K (parents, if senior)</p>
        </div>
        <input
          type="number"
          value={deductions.sec80D || ''}
          onChange={e => updateField('sec80D')(parseFloat(e.target.value) || 0)}
          placeholder="₹0"
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
            borderRadius: 6, fontFamily: 'inherit', background: C.bg,
          }}
        />
      </div>

      {/* Home Loan Interest */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>
            Home Loan Interest (Section 24b)
          </h3>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Max deduction: ₹2,00,000</p>
        </div>
        <input
          type="number"
          value={deductions.homeLoanInterest || ''}
          onChange={e => updateField('homeLoanInterest')(parseFloat(e.target.value) || 0)}
          placeholder="₹0"
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
            borderRadius: 6, fontFamily: 'inherit', background: C.bg,
          }}
        />
      </div>

      {/* NPS 80CCD(1B) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.fg, margin: '0 0 4px' }}>
            NPS - Section 80CCD(1B)
          </h3>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Additional ₹50K deduction (over and above 80C)</p>
        </div>
        <input
          type="number"
          value={deductions.nps || ''}
          onChange={e => updateField('nps')(parseFloat(e.target.value) || 0)}
          placeholder="₹0"
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
            borderRadius: 6, fontFamily: 'inherit', background: C.bg,
          }}
        />
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/dashboard/profile/exemptions')} style={{
          padding: '12px 24px', background: 'transparent', color: C.primary,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ← Back
        </button>
        <button onClick={handleSave} style={{
          padding: '12px 24px', background: C.primary, color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Next: Tax Optimizer →
        </button>
      </div>
    </div>
  )
}
