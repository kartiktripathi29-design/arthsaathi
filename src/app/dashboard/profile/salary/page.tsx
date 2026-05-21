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

const fyMonths = (fyStartYear: number) => {
  const months: string[] = []
  for (let m = 4; m <= 12; m++) months.push(`${fyStartYear}-${String(m).padStart(2, '0')}`)
  for (let m = 1; m <= 3; m++) months.push(`${fyStartYear + 1}-${String(m).padStart(2, '0')}`)
  return months
}

interface MonthRollup { earnings: number; deductions: number; net: number; isActual: boolean; isOverride: boolean }

const rollupMonth = (timeline: any, monthKey: string): MonthRollup => {
  if (!timeline || !monthKey) return { earnings: 0, deductions: 0, net: 0, isActual: false, isOverride: false }
  
  const override = timeline.overrides?.find((o: any) => o.monthKey === monthKey)
  if (override) {
    const earnings = override.components.filter((c: any) => c.type === 'earning').reduce((s: number, c: any) => s + c.amount, 0)
    const deductions = override.components.filter((c: any) => c.type === 'deduction').reduce((s: number, c: any) => s + c.amount, 0)
    return { earnings, deductions, net: earnings - deductions, isActual: false, isOverride: true }
  }

  const emp = timeline.employments?.find((e: any) => monthKey >= e.fromMonth && (!e.toMonth || monthKey <= e.toMonth))
  if (!emp) return { earnings: 0, deductions: 0, net: 0, isActual: false, isOverride: false }

  const slip = emp.slips?.find((s: any) => s.monthKey === monthKey)
  if (slip) {
    const earnings = slip.components.filter((c: any) => c.type === 'earning').reduce((s: number, c: any) => s + c.amount, 0)
    const deductions = slip.components.filter((c: any) => c.type === 'deduction').reduce((s: number, c: any) => s + c.amount, 0)
    return { earnings, deductions, net: earnings - deductions, isActual: true, isOverride: false }
  }

  const earnings = emp.slips?.[0]?.components?.filter((c: any) => c.type === 'earning' && c.flag === 'recurring').reduce((s: number, c: any) => s + c.amount, 0) || 0
  const deductions = emp.slips?.[0]?.components?.filter((c: any) => c.type === 'deduction' && c.flag === 'recurring').reduce((s: number, c: any) => s + c.amount, 0) || 0
  return { earnings, deductions, net: earnings - deductions, isActual: false, isOverride: false }
}

const computeAnnual = (timeline: any) => {
  if (!timeline) return null
  const months = fyMonths(timeline.fyStartYear)
  let annualGross = 0, annualNet = 0, actualsCount = 0
  months.forEach(mk => {
    const r = rollupMonth(timeline, mk)
    annualGross += r.earnings
    annualNet += r.net
    if (r.isActual) actualsCount++
  })
  return {
    annualGross, annualNet, actualsCount,
    projectedCount: months.length - actualsCount,
    monthlyAvgGross: Math.round(annualGross / months.length),
    monthlyAvgNet: Math.round(annualNet / months.length),
    annualDeductions: annualGross - annualNet
  }
}

export default function SalaryPage() {
  const router = useRouter()
  const [timeline, setTimeline] = useState<any>(null)
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        setTimeline(JSON.parse(data))
      } catch (e) {
        console.error('Failed to load salary timeline:', e)
      }
    }
    setLoading(false)
  }, [])

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

  const annual = computeAnnual(timeline)
  const months = fyMonths(timeline.fyStartYear)
  const previewRollup = previewMonth ? rollupMonth(timeline, previewMonth) : null
  const previewSlip = previewMonth ? timeline.employments?.flatMap((e: any) => e.slips || []).find((s: any) => s.monthKey === previewMonth) : null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Salary</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Your salary timeline · click any month</p>

      {/* Preview Modal */}
      {previewMonth && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 30, maxWidth: 700, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', position: 'relative' }}>
            <button onClick={() => setPreviewMonth(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 28, color: C.muted, cursor: 'pointer', padding: 0 }}>×</button>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{monthLabel(previewMonth)}</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>{previewSlip?.components ? previewSlip.components.find((c: any) => c.type === 'earning' && c.label.includes('Basic'))?.label || 'Salary Slip' : 'Projected'}</p>

            {previewSlip ? (
              <>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Earnings</h3>
                  <div style={{ background: C.wl, borderRadius: 6, overflow: 'hidden' }}>
                    {previewSlip.components.filter((c: any) => c.type === 'earning').map((c: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < previewSlip.components.filter((x: any) => x.type === 'earning').length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <span style={{ fontSize: 13, color: C.text }}>{c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{fmt(c.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.wl, fontWeight: 700 }}>
                      <span style={{ fontSize: 13, color: C.fg }}>Total Earnings</span>
                      <span style={{ fontSize: 13, color: C.fg }}>{fmt(previewRollup?.earnings || 0)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Deductions</h3>
                  <div style={{ background: '#FBF0F0', borderRadius: 6, overflow: 'hidden' }}>
                    {previewSlip.components.filter((c: any) => c.type === 'deduction').map((c: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < previewSlip.components.filter((x: any) => x.type === 'deduction').length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <span style={{ fontSize: 13, color: C.text }}>{c.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>−{fmt(c.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FBF0F0', fontWeight: 700 }}>
                      <span style={{ fontSize: 13, color: C.danger }}>Total Deductions</span>
                      <span style={{ fontSize: 13, color: C.danger }}>−{fmt(previewRollup?.deductions || 0)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, padding: '14px', background: C.wl, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Net Salary</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#2A7A4A' }}>{fmt(previewRollup?.net || 0)}</span>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: C.muted, padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>This month is auto-projected from recurring components. Upload a slip to see actual values.</p>
            )}

            <button onClick={() => setPreviewMonth(null)} style={{ width: '100%', marginTop: 20, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      )}

      {/* Annual Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Gross</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(annual?.annualGross || 0)}</p>
          <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>{fmt(annual?.monthlyAvgGross || 0)}/mo avg</p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Net</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#2A7A4A', margin: 0 }}>{fmt(annual?.annualNet || 0)}</p>
          <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>{fmt(annual?.monthlyAvgNet || 0)}/mo avg</p>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 14px' }}>Timeline · click a month to preview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, marginBottom: 14 }}>
          {months.map(mk => {
            const r = rollupMonth(timeline, mk)
            const status = r.isActual ? 'actual' : r.isOverride ? 'override' : 'projected'
            const bg = status === 'actual' ? C.fg : status === 'override' ? C.wm : C.border
            const fg = status === 'actual' ? '#fff' : status === 'override' ? '#fff' : C.muted
            const icon = status === 'actual' ? '●' : status === 'override' ? '✎' : '○'
            
            return (
              <button
                key={mk}
                onClick={() => setPreviewMonth(mk)}
                style={{ background: bg, color: fg, border: 'none', borderRadius: 4, padding: '10px 4px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
              >
                <div style={{ fontSize: 9, opacity: 0.85 }}>{monthLabel(mk).split(' ')[0]}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>{icon}</div>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: C.muted, padding: '10px 0', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.fg, marginRight: 4 }} />Slip uploaded</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.wm, marginRight: 4 }} />Edited projection</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.border, marginRight: 4 }} />Auto-projected</span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.back()} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Other Income →</button>
      </div>
    </div>
  )
}
