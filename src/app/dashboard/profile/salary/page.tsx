'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

interface SalarySlip {
  monthKey: string
  month: string
  year: string
  employerName: string
  grossSalary: number
  netSalary: number
  basicSalary: number
  hra: number
  employeePF: number
  tdsDeducted: number
  components?: { label: string; amount: number; type: 'earning' | 'deduction' }[]
}

export default function SalaryPage() {
  const router = useRouter()
  const [salaries, setSalaries] = useState<SalarySlip[]>([])
  const [previewSlip, setPreviewSlip] = useState<SalarySlip | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        const slipArray = Array.isArray(parsed) ? parsed : parsed.employments?.[0]?.slips || []
        setSalaries(slipArray)
        if (slipArray.length > 0) {
          setPreviewSlip(slipArray[slipArray.length - 1])
        }
      } catch (e) {
        console.error('Failed to load salary data:', e)
      }
    }
    setLoading(false)
  }, [])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading...</div>
  }

  if (!salaries.length) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 16px' }}>No salary slips uploaded yet</p>
          <button
            onClick={() => router.push('/dashboard/profile/documents')}
            style={{
              padding: '10px 20px',
              background: C.fg,
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
      </div>
    )
  }

  const earnings = previewSlip?.components?.filter(c => c.type === 'earning') || []
  const deductions = previewSlip?.components?.filter(c => c.type === 'deduction') || []
  const totalEarnings = earnings.reduce((s, c) => s + c.amount, 0)
  const totalDeductions = deductions.reduce((s, c) => s + c.amount, 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Salary</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Your salary slip details and timeline</p>

      {/* Preview Modal */}
      {previewSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 30, maxWidth: 700, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
            {/* Close Button */}
            <button
              onClick={() => setPreviewSlip(null)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 24,
                color: C.muted,
                cursor: 'pointer',
              }}
            >
              ×
            </button>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
              {previewSlip.month} {previewSlip.year}
            </h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>{previewSlip.employerName}</p>

            {/* Earnings */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Earnings</h3>
              <div style={{ background: C.wl, borderRadius: 6, overflow: 'hidden' }}>
                {earnings.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < earnings.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 13, color: C.text }}>{c.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{fmt(c.amount)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.wl, fontWeight: 700 }}>
                  <span style={{ fontSize: 13, color: C.fg }}>Total Earnings</span>
                  <span style={{ fontSize: 13, color: C.fg }}>{fmt(totalEarnings)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Deductions</h3>
              <div style={{ background: '#FBF0F0', borderRadius: 6, overflow: 'hidden' }}>
                {deductions.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < deductions.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 13, color: C.text }}>{c.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>−{fmt(c.amount)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FBF0F0', fontWeight: 700 }}>
                  <span style={{ fontSize: 13, color: C.danger }}>Total Deductions</span>
                  <span style={{ fontSize: 13, color: C.danger }}>−{fmt(totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* Net */}
            <div style={{ marginTop: 20, padding: '14px', background: C.wl, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Net Salary</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#2A7A4A' }}>{fmt(previewSlip.netSalary)}</span>
            </div>

            {/* Close Button at Bottom */}
            <button
              onClick={() => setPreviewSlip(null)}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '12px',
                background: C.fg,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Gross Salary (Annual)</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0 }}>
            {fmt((salaries.reduce((s, slip) => s + slip.grossSalary, 0) || 0) * 12)}
          </p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Net Salary (Annual)</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#2A7A4A', margin: 0 }}>
            {fmt((salaries.reduce((s, slip) => s + slip.netSalary, 0) || 0) * 12)}
          </p>
        </div>
      </div>

      {/* Slips List */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', background: C.wl, fontWeight: 600, fontSize: 12, color: C.fg, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
          Uploaded Slips
        </div>
        {salaries.map((slip, i) => (
          <div
            key={i}
            onClick={() => setPreviewSlip(slip)}
            style={{
              padding: '14px 16px',
              borderBottom: i < salaries.length - 1 ? `1px solid ${C.border}` : 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'background 0.2s',
              background: previewSlip?.monthKey === slip.monthKey ? C.wl : 'transparent',
            }}
            onMouseEnter={(e) => { if (previewSlip?.monthKey !== slip.monthKey) (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
            onMouseLeave={(e) => { if (previewSlip?.monthKey !== slip.monthKey) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>
                {slip.month} {slip.year}
              </p>
              <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{slip.employerName}</p>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 4px' }}>Gross</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(slip.grossSalary)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={() => router.back()}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            color: C.fg,
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
          onClick={() => router.push('/dashboard/profile/other-income')}
          style={{
            flex: 1,
            padding: '12px',
            background: C.fg,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Next: Other Income →
        </button>
      </div>
    </div>
  )
}
