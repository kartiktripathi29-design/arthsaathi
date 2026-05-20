'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41', accent: '#E6CFA7' }

export default function ExemptionsPage() {
  const router = useRouter()
  const [hraData, setHRAData] = useState({
    hraReceived: 0,
    rentPaid: 0,
    isMetro: false,
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('av_exemptions')
      if (stored) {
        const data = JSON.parse(stored)
        setHRAData(data.hra || hraData)
      }
    }
  }, [])

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('av_exemptions', JSON.stringify({ hra: hraData }))
    }
    router.push('/dashboard/profile/deductions')
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Exemptions</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          Claim HRA exemption if you're paying rent.
        </p>
      </div>

      {/* HRA Section */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.fg, margin: '0 0 16px' }}>
          House Rent Allowance (HRA)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* HRA Received */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: C.fg, display: 'block', marginBottom: 6 }}>
              HRA Received (Annual)
            </label>
            <input
              type="number"
              value={hraData.hraReceived || ''}
              onChange={e => setHRAData({ ...hraData, hraReceived: parseFloat(e.target.value) || 0 })}
              placeholder="₹0"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
                borderRadius: 6, fontFamily: 'inherit', background: C.bg,
              }}
            />
          </div>

          {/* Rent Paid */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: C.fg, display: 'block', marginBottom: 6 }}>
              Annual Rent Paid
            </label>
            <input
              type="number"
              value={hraData.rentPaid || ''}
              onChange={e => setHRAData({ ...hraData, rentPaid: parseFloat(e.target.value) || 0 })}
              placeholder="₹0"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
                borderRadius: 6, fontFamily: 'inherit', background: C.bg,
              }}
            />
          </div>

          {/* Metro / Non-Metro */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: C.fg, display: 'block', marginBottom: 8 }}>
              City Type
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Metro (Delhi/Mumbai/Chennai/Kolkata/Bengaluru/Hyderabad/Pune/Ahmedabad)', value: true },
                { label: 'Non-Metro', value: false },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setHRAData({ ...hraData, isMetro: opt.value })}
                  style={{
                    flex: 1, padding: '10px 14px', background: hraData.isMetro === opt.value ? C.primary : C.bg,
                    color: hraData.isMetro === opt.value ? '#fff' : C.fg,
                    border: `1px solid ${hraData.isMetro === opt.value ? C.primary : C.border}`,
                    borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0', lineHeight: 1.4 }}>
              Metro cities get 50% of basic as HRA exemption cap. Non-metro get 40%.
            </p>
          </div>
        </div>
      </div>

      {/* Section 10(14) Placeholder */}
      <div style={{ background: '#FFF9E6', border: '1px solid #FFE066', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#856404', marginBottom: 4 }}>
          🚧 Coming Soon: Section 10(14) Allowances
        </div>
        <p style={{ fontSize: 12, color: '#856404', margin: 0 }}>
          Children Education, Helper, Books & Periodicals, and other tax-exempt allowances will be added here.
        </p>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{
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
          Next: Deductions →
        </button>
      </div>
    </div>
  )
}
