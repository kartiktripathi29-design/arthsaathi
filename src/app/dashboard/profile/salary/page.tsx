'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

const monthLabel = (mk: string) => {
  const [y, m] = mk.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${y}`
}

const fyMonths = (fyStartYear: number) => {
  const months: string[] = []
  for (let m = 4; m <= 12; m++) months.push(`${fyStartYear}-${String(m).padStart(2, '0')}`)
  for (let m = 1; m <= 3; m++) months.push(`${fyStartYear + 1}-${String(m).padStart(2, '0')}`)
  return months
}

interface Employment {
  id: string
  employerName: string
  fromMonth: string
  toMonth: string | null
  slips: any[]
}

interface EmploymentPeriod {
  id: string
  employer: string
  fromMonth: string
  toMonth: string
  hasSlip: boolean
  baseSlipMonth: string
  increment?: { month: string; percent: number; retroactive: boolean }
  monthData: Record<string, any>
}

interface SalaryTimeline {
  fy: string
  fyStartYear: number
  employments: Employment[]
  overrides: any[]
}

export default function SalaryPageComplete() {
  const router = useRouter()
  const [timeline, setTimeline] = useState<SalaryTimeline | null>(null)
  const [periods, setPeriods] = useState<EmploymentPeriod[]>([])
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)
  const [previewPeriodId, setPreviewPeriodId] = useState<string | null>(null)
  const [employmentCount, setEmploymentCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        const parsed = JSON.parse(data) as SalaryTimeline
        setTimeline(parsed)
        buildPeriods(parsed)
      } catch (e) {
        console.error('Failed to load salary timeline:', e)
        toast.error('Failed to load salary data')
      }
    }
    setLoading(false)
  }, [])

  const buildPeriods = (tl: SalaryTimeline) => {
    if (!tl.employments || tl.employments.length === 0) return
    
    const newPeriods: EmploymentPeriod[] = tl.employments.map((emp, idx) => {
      const fromMonth = emp.fromMonth
      const toMonth = emp.toMonth || fyMonths(tl.fyStartYear)[11] // Default to last month of FY
      const hasSlip = emp.slips.length > 0
      const baseSlipMonth = emp.slips.length > 0 ? emp.slips[emp.slips.length - 1].monthKey : ''

      const monthData: Record<string, any> = {}
      const months = getFYMonthsRange(fromMonth, toMonth)
      
      months.forEach(mk => {
        const slip = emp.slips.find(s => s.monthKey === mk)
        monthData[mk] = slip ? { ...slip, source: 'actual' } : { source: 'projected' }
      })

      return {
        id: emp.id,
        employer: emp.employerName,
        fromMonth,
        toMonth,
        hasSlip,
        baseSlipMonth,
        monthData,
      }
    })

    setPeriods(newPeriods)
  }

  const getFYMonthsRange = (from: string, to: string) => {
    const months: string[] = []
    const [fy, fm] = from.split('-').map(Number)
    const [ty, tm] = to.split('-').map(Number)
    
    for (let y = fy; y <= ty; y++) {
      const startM = y === fy ? fm : 1
      const endM = y === ty ? tm : 12
      for (let m = startM; m <= endM; m++) {
        months.push(`${y}-${String(m).padStart(2, '0')}`)
      }
    }
    return months
  }

  const getMonthStatus = (periodId: string, monthKey: string) => {
    const period = periods.find(p => p.id === periodId)
    if (!period) return 'projected'
    
    const data = period.monthData[monthKey]
    if (!data) return 'projected'
    if (data.source === 'actual') return 'actual'
    return 'projected'
  }

  const annualGross = periods.reduce((total, period) => {
    return total + Object.values(period.monthData).reduce((sum: number, data: any) => {
      return sum + (data.grossSalary || 0)
    }, 0)
  }, 0)

  const annualNet = periods.reduce((total, period) => {
    return total + Object.values(period.monthData).reduce((sum: number, data: any) => {
      return sum + ((data.grossSalary || 0) - (data.deductions || 0))
    }, 0)
  }, 0)

  const actualMonths = periods.reduce((count, period) => {
    return count + Object.values(period.monthData).filter((d: any) => d.source === 'actual').length
  }, 0)

  const totalMonths = periods.reduce((count, period) => {
    return count + Object.keys(period.monthData).length
  }, 0)

  const confidence = totalMonths > 0 ? Math.round((actualMonths / totalMonths) * 100) : 0

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading...</div>

  if (!timeline) {
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
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>{timeline.fy} (Apr {timeline.fyStartYear} - Mar {timeline.fyStartYear + 1})</p>

      {/* Preview Modal */}
      {previewMonth && previewPeriodId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 30, maxWidth: 700, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', position: 'relative' }}>
            <button onClick={() => setPreviewMonth(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 28, color: C.muted, cursor: 'pointer', padding: 0 }}>×</button>
            
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{monthLabel(previewMonth)}</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>{getMonthStatus(previewPeriodId, previewMonth) === 'actual' ? 'Actual Slip' : 'Projected'}</p>

            {/* Earnings */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Earnings</h3>
              <div style={{ background: C.wl, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.text }}>Basic Salary</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{fmt(60000)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.text }}>HRA</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{fmt(18000)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.wl, fontWeight: 700 }}>
                  <span style={{ fontSize: 13, color: C.fg }}>Total Earnings</span>
                  <span style={{ fontSize: 13, color: C.fg }}>{fmt(78000)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Deductions</h3>
              <div style={{ background: '#FBF0F0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.text }}>EPF</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>−{fmt(7200)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FBF0F0', fontWeight: 700 }}>
                  <span style={{ fontSize: 13, color: C.danger }}>Total Deductions</span>
                  <span style={{ fontSize: 13, color: C.danger }}>−{fmt(7200)}</span>
                </div>
              </div>
            </div>

            {/* Net */}
            <div style={{ marginTop: 20, padding: '14px', background: C.wl, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Net Salary</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#2A7A4A' }}>{fmt(70800)}</span>
            </div>

            <button onClick={() => setPreviewMonth(null)} style={{ width: '100%', marginTop: 20, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
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
                <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{monthLabel(period.fromMonth)} → {monthLabel(period.toMonth)} {period.hasSlip ? '✓' : '(no slip)'}</p>
              </div>
              <span style={{ fontSize: 14, color: C.fg }}>{expandedPeriod === period.id ? '−' : '+'}</span>
            </button>

            {expandedPeriod === period.id && (
              <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                {/* Month Timeline for this period */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 10px', textTransform: 'uppercase' }}>Months in this period</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.keys(period.monthData).map(mk => {
                      const status = getMonthStatus(period.id, mk)
                      const bg = status === 'actual' ? C.fg : C.border
                      const fg = status === 'actual' ? '#fff' : C.muted
                      
                      return (
                        <button
                          key={mk}
                          onClick={() => { setPreviewMonth(mk); setPreviewPeriodId(period.id) }}
                          style={{ background: bg, color: fg, border: 'none', borderRadius: 4, padding: '8px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {monthLabel(mk).split(' ')[0]} {status === 'actual' ? '●' : '○'}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Period Summary */}
                <div style={{ padding: '12px', background: C.wl, borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Period Gross:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(Object.values(period.monthData).reduce((s: number, d: any) => s + (d.grossSalary || 0), 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Source:</span>
                    <span style={{ fontSize: 11, color: C.text }}>{period.hasSlip ? 'Actual slip' : `Projected from ${monthLabel(period.baseSlipMonth)}`}</span>
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
