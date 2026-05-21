'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41' }

interface Tooltip {
  key: string | null
  text: string
}

export default function ExemptionsPage() {
  const router = useRouter()
  const [tooltip, setTooltip] = useState<Tooltip>({ key: null, text: '' })
  const [hra, setHra] = useState({ hraReceived: 0, rentPaid: 0, isMetro: false })
  const [calculatedExemption, setCalculatedExemption] = useState(0)

  const tooltips: Record<string, string> = {
    hra: 'House Rent Allowance received from your employer. Enter the annual amount.',
    rent: 'Total rent paid annually for your residence. Include all rent payments.',
    metro: 'Metro cities: Delhi, Mumbai, Chennai, Kolkata, Bangalore, Hyderabad. Non-metro gets lower exemption limit.',
  }

  useEffect(() => {
    const saved = localStorage.getItem('av_exemptions')
    if (saved) {
      const data = JSON.parse(saved)
      setHra(data.hra || { hraReceived: 0, rentPaid: 0, isMetro: false })
    }

    // Auto-fill HRA from salary slip
    const salary = localStorage.getItem('av_salary_timeline')
    if (salary) {
      const slips = JSON.parse(salary)
      if (slips.length > 0 && slips[0].hra) {
        setHra(prev => ({ ...prev, hraReceived: slips[0].hra * 12 }))
      }
    }
  }, [])

  useEffect(() => {
    // Calculate HRA exemption
    if (!hra.hraReceived || !hra.rentPaid) {
      setCalculatedExemption(0)
      return
    }

    const actual = hra.hraReceived
    const rentMinus10Percent = hra.rentPaid - hra.hraReceived * 0.1
    const cityLimit = hra.isMetro ? hra.hraReceived * 0.5 : hra.hraReceived * 0.4

    const exemption = Math.min(actual, rentMinus10Percent, cityLimit)
    setCalculatedExemption(Math.max(exemption, 0))
  }, [hra])

  const saveExemptions = (updated: typeof hra) => {
    setHra(updated)
    localStorage.setItem('av_exemptions', JSON.stringify({ hra: updated }))
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 0' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Exemptions</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Claim HRA exemption if you're paying rent.</p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.fg, margin: '0 0 20px' }}>House Rent Allowance (HRA)</h3>

        {/* HRA Received */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 8,
            }}
          >
            Do you receive HRA
            <span
              style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
              onMouseEnter={() => setTooltip({ key: 'hra', text: tooltips.hra })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
            from your employer?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>₹</span>
            <input
              type="number"
              value={hra.hraReceived || ''}
              onChange={e => saveExemptions({ ...hra, hraReceived: parseFloat(e.target.value) || 0 })}
              placeholder="Annual HRA amount"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>Auto-filled from salary slip if available</p>
        </div>

        {/* Rent Paid */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 8,
            }}
          >
            How much rent do you pay annually
            <span
              style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
              onMouseEnter={() => setTooltip({ key: 'rent', text: tooltips.rent })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
            ?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.muted }}>₹</span>
            <input
              type="number"
              value={hra.rentPaid || ''}
              onChange={e => saveExemptions({ ...hra, rentPaid: parseFloat(e.target.value) || 0 })}
              placeholder="Total annual rent"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* City Type */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.fg,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 12,
            }}
          >
            Which city do you live in
            <span
              style={{ fontSize: 11, cursor: 'pointer', color: C.primary }}
              onMouseEnter={() => setTooltip({ key: 'metro', text: tooltips.metro })}
              onMouseLeave={() => setTooltip({ key: null, text: '' })}
            >
              ⁱ
            </span>
            ?
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => saveExemptions({ ...hra, isMetro: true })}
              style={{
                flex: 1,
                padding: '10px',
                background: hra.isMetro ? C.primary : C.bg,
                color: hra.isMetro ? '#fff' : C.fg,
                border: `1px solid ${hra.isMetro ? C.primary : C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Metro (50%)
            </button>
            <button
              onClick={() => saveExemptions({ ...hra, isMetro: false })}
              style={{
                flex: 1,
                padding: '10px',
                background: !hra.isMetro ? C.primary : C.bg,
                color: !hra.isMetro ? '#fff' : C.fg,
                border: `1px solid ${!hra.isMetro ? C.primary : C.border}`,
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Non-Metro (40%)
            </button>
          </div>
        </div>

        {/* Calculated Exemption */}
        <div
          style={{
            background: '#F0F9F7',
            border: `1px solid #D1E8E4`,
            borderRadius: 6,
            padding: 12,
            marginTop: 20,
          }}
        >
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 4px' }}>Calculated HRA Exemption</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.primary, margin: 0 }}>
            ₹{calculatedExemption.toLocaleString('en-IN')}
          </p>
        </div>

        <p style={{ fontSize: 11, color: C.muted, margin: '12px 0 0', lineHeight: 1.6 }}>
          HRA exemption = minimum of: (1) Actual HRA received, (2) Rent paid minus 10% of basic salary, (3) 50% of basic (metro) or 40% (non-metro)
        </p>
      </div>

      {/* Tooltip */}
      {tooltip.key && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            background: C.fg,
            color: '#fff',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            zIndex: 50,
          }}
        >
          {tooltip.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '12px 20px',
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
          ← Back
        </button>
        <button
          onClick={() => router.push('/dashboard/profile/deductions')}
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
          Next: Deductions →
        </button>
      </div>
    </div>
  )
}
