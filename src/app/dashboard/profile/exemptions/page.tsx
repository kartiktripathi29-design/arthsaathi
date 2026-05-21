'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

export default function ExemptionsPage() {
  const router = useRouter()
  const [salary, setSalary] = useState<any>(null)
  const [hraReceived, setHraReceived] = useState(0)
  const [rentPaid, setRentPaid] = useState(0)
  const [isMetro, setIsMetro] = useState(false)

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        const slipArray = Array.isArray(parsed) ? parsed : parsed.employments?.[0]?.slips || []
        if (slipArray.length > 0) {
          const latest = slipArray[slipArray.length - 1]
          setSalary(latest)
          setHraReceived(latest.hra || 0)
        }
      } catch (e) {
        console.error('Failed to load salary:', e)
      }
    }
    const exemptions = localStorage.getItem('av_exemptions')
    if (exemptions) {
      try {
        const parsed = JSON.parse(exemptions)
        setRentPaid(parsed.hra?.rentPaid || 0)
        setIsMetro(parsed.hra?.isMetro || false)
      } catch (e) {
        console.error('Failed to load exemptions:', e)
      }
    }
  }, [])

  const calculateHRA = () => {
    if (!hraReceived || !rentPaid || !salary) return 0
    const basic = salary.basicSalary || 0
    const actual = hraReceived
    const rentMinus10 = rentPaid - basic * 0.1
    const cityLimit = isMetro ? basic * 0.5 : basic * 0.4
    return Math.max(0, Math.min(actual, rentMinus10, cityLimit))
  }

  const hraExemption = calculateHRA()

  const handleSave = () => {
    localStorage.setItem('av_exemptions', JSON.stringify({ hra: { hraReceived, rentPaid, isMetro } }))
  }

  useEffect(() => {
    handleSave()
  }, [hraReceived, rentPaid, isMetro])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Exemptions</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>House Rent Allowance (HRA) — tax-free portion</p>

      {/* Context Banner */}
      {salary && salary.hra > 0 && (
        <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.6 }}>
            Your salary slip shows HRA of <strong>{fmt(salary.hra)}/month</strong>. If you pay rent, part of this HRA is tax-exempt. Fill in your rent details below to calculate the exemption.
          </p>
        </div>
      )}

      {/* Form */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 18px' }}>House Rent Allowance</h2>

        {/* HRA Received (auto-filled) */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>HRA received (monthly)</label>
          <div style={{ padding: '12px 14px', background: '#FAFAF8', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, fontWeight: 600 }}>
            {fmt(hraReceived)}/month <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>(auto-filled from salary slip)</span>
          </div>
        </div>

        {/* Rent Paid (user input) */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 500 }}>How much rent do you pay each month?</label>
          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <span style={{ padding: '10px 10px', background: C.wl, fontSize: 12, fontWeight: 600, color: C.fg }}>₹</span>
            <input
              type="text"
              inputMode="numeric"
              value={rentPaid > 0 ? rentPaid : ''}
              onChange={(e) => setRentPaid(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              placeholder="0"
              style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: C.text }}
            />
          </div>
          <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0' }}>Enter the actual monthly rent you pay</p>
        </div>

        {/* Metro Toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isMetro}
              onChange={(e) => setIsMetro(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>I live in a metro city</div>
              <div style={{ fontSize: 10.5, color: C.muted }}>Delhi, Mumbai, Kolkata, Bengaluru, Hyderabad, Chennai, Pune, Ahmedabad</div>
            </div>
          </label>
        </div>

        {/* HRA Exemption Calculation */}
        {rentPaid > 0 && (
          <div style={{ padding: '14px 16px', background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 6 }}>
            <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Tax-free HRA exemption</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(hraExemption)}/month</p>
            <p style={{ fontSize: 10.5, color: C.muted, margin: '8px 0 0' }}>₹{(hraExemption * 12).toLocaleString('en-IN')}/year is exempt from tax</p>
          </div>
        )}

        {rentPaid === 0 && hraReceived > 0 && (
          <div style={{ padding: '12px 14px', background: '#FFF3DD', border: `1px solid ${C.wm}`, borderRadius: 6 }}>
            <p style={{ fontSize: 11, color: '#856404', margin: 0 }}>💡 Without rent details, HRA exemption = ₹0. If you pay rent, fill it above to claim the exemption.</p>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div style={{ background: '#FAF7F2', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: C.text, margin: '0 0 10px', fontWeight: 600 }}>How HRA exemption works</p>
        <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.6 }}>
          The tax-free portion is the smallest of: (1) actual HRA you receive, (2) rent paid minus 10% of your basic salary, or (3) 40% of basic salary (50% in metro cities). Only the exempted portion is tax-free; the rest is taxable.
        </p>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/profile/deductions')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Deductions →</button>
      </div>
    </div>
  )
}
