'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

const monthLabel = (mk: string) => {
  const [y, m] = mk.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${y}`
}

interface Slip {
  employeeName: string
  employerName: string
  month: string
  year: string
  basicSalary: number
  grossSalary?: number
  netSalary?: number
  components?: Array<{ label: string; amount: number; type: 'earning' | 'deduction' }>
  [key: string]: any
}

interface EmploymentPeriod {
  id: string
  employer: string
  fromMonth: string
  toMonth: string
  slips: Slip[]
  hasSlip: boolean
}

export default function SalaryPageFixed() {
  const router = useRouter()
  const [slips, setSlips] = useState<Slip[]>([])
  const [periods, setPeriods] = useState<EmploymentPeriod[]>([])
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)
  const [previewSlip, setPreviewSlip] = useState<Slip | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        const slipsArray = Array.isArray(parsed) ? parsed : []
        setSlips(slipsArray)
        buildPeriods(slipsArray)
      } catch (e) {
        console.error('Failed to load salary timeline:', e)
      }
    }
    setLoading(false)
  }, [])

  const buildPeriods = (slipsArray: Slip[]) => {
    if (!slipsArray || slipsArray.length === 0) {
      setPeriods([])
      return
    }

    // Group slips by employer
    const employerMap = new Map<string, Slip[]>()
    slipsArray.forEach(slip => {
      const employer = slip.employerName || 'Unknown Employer'
      if (!employerMap.has(employer)) {
        employerMap.set(employer, [])
      }
      employerMap.get(employer)!.push(slip)
    })

    // Convert to employment periods
    const newPeriods: EmploymentPeriod[] = Array.from(employerMap.entries()).map(([employer, employerSlips], idx) => {
      const sorted = employerSlips.sort((a, b) => {
        const aYear = parseInt(a.year)
        const aMonth = monthToNum(a.month)
        const bYear = parseInt(b.year)
        const bMonth = monthToNum(b.month)
        return aYear * 12 + aMonth - (bYear * 12 + bMonth)
      })

      const firstSlip = sorted[0]
      const lastSlip = sorted[sorted.length - 1]

      const fromMonth = `${firstSlip.year}-${String(monthToNum(firstSlip.month)).padStart(2, '0')}`
      const toMonth = `${lastSlip.year}-${String(monthToNum(lastSlip.month)).padStart(2, '0')}`

      return {
        id: `emp-${idx}`,
        employer,
        fromMonth,
        toMonth,
        slips: sorted,
        hasSlip: true,
      }
    })

    setPeriods(newPeriods)
  }

  const monthToNum = (month: string): number => {
    const months: Record<string, number> = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
      Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
      Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
    }
    return months[month] || 1
  }

  const annualGross = slips.reduce((sum, slip) => sum + (slip.grossSalary || slip.basicSalary || 0), 0)
  const annualNet = slips.reduce((sum, slip) => sum + (slip.netSalary || slip.basicSalary || 0), 0)
  const confidence = slips.length > 0 ? 100 : 0

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading...</div>

  if (!slips || slips.length === 0) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 16px' }}>No salary data uploaded yet</p>
          <button onClick={() => router.push('/dashboard/profile/documents')} style={{ padding: '10px 20px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Upload Salary Slip</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Salary</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Your salary timeline · {slips.length} slip(s) uploaded</p>

      {/* Preview Modal */}
      {previewSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 30, maxWidth: 700, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', position: 'relative' }}>
            <button onClick={() => setPreviewSlip(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 28, color: C.muted, cursor: 'pointer', padding: 0 }}>×</button>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{previewSlip.month} {previewSlip.year}</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>{previewSlip.employerName}</p>

            {previewSlip.components ? (
              <>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Earnings</h3>
                  <div style={{ background: C.wl, borderRadius: 6, overflow: 'hidden' }}>
                    {previewSlip.components.filter(c => c.type === 'earning').map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < previewSlip.components!.filter(x => x.type === 'earning').length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <span style={{ fontSize: 13, color: C.text }}>{c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{fmt(c.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.wl, fontWeight: 700 }}>
                      <span style={{ fontSize: 13, color: C.fg }}>Total Earnings</span>
                      <span style={{ fontSize: 13, color: C.fg }}>{fmt(previewSlip.components.filter(c => c.type === 'earning').reduce((s, c) => s + c.amount, 0))}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Deductions</h3>
                  <div style={{ background: '#FBF0F0', borderRadius: 6, overflow: 'hidden' }}>
                    {previewSlip.components.filter(c => c.type === 'deduction').map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < previewSlip.components!.filter(x => x.type === 'deduction').length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <span style={{ fontSize: 13, color: C.text }}>{c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>−{fmt(c.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FBF0F0', fontWeight: 700 }}>
                      <span style={{ fontSize: 13, color: C.danger }}>Total Deductions</span>
                      <span style={{ fontSize: 13, color: C.danger }}>−{fmt(previewSlip.components.filter(c => c.type === 'deduction').reduce((s, c) => s + c.amount, 0))}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, padding: '14px', background: C.wl, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Net Salary</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#2A7A4A' }}>{fmt(previewSlip.netSalary || previewSlip.basicSalary || 0)}</span>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: C.muted, padding: '20px', textAlign: 'center' }}>Salary slip details</p>
            )}

            <button onClick={() => setPreviewSlip(null)} style={{ width: '100%', marginTop: 20, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      )}

      {/* Annual Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Gross</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(annualGross)}</p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Net</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#2A7A4A', margin: 0 }}>{fmt(annualNet)}</p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Confidence</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: confidence > 75 ? C.fg : C.wm, margin: 0 }}>{confidence}%</p>
        </div>
      </div>

      {/* Employment Periods */}
      <div style={{ marginBottom: 24 }}>
        {periods.map((period, idx) => (
          <div key={period.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedPeriod(expandedPeriod === period.id ? null : period.id)}
              style={{ width: '100%', padding: '16px', background: expandedPeriod === period.id ? C.wl : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Employment #{idx + 1}: {period.employer}</h3>
                <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{monthLabel(period.fromMonth)} → {monthLabel(period.toMonth)} · {period.slips.length} slip(s)</p>
              </div>
              <span style={{ fontSize: 14, color: C.fg }}>{expandedPeriod === period.id ? '−' : '+'}</span>
            </button>

            {expandedPeriod === period.id && (
              <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 10px', textTransform: 'uppercase' }}>Slips in this period</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {period.slips.map((slip, i) => (
                      <button
                        key={i}
                        onClick={() => setPreviewSlip(slip)}
                        style={{ background: C.fg, color: '#fff', border: 'none', borderRadius: 4, padding: '8px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {slip.month} {slip.year} ●
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '12px', background: C.wl, borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Period Gross:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(period.slips.reduce((s, slip) => s + (slip.grossSalary || slip.basicSalary || 0), 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Slips:</span>
                    <span style={{ fontSize: 11, color: C.text }}>{period.slips.length} uploaded</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.back()} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Other Income →</button>
      </div>
    </div>
  )
}
