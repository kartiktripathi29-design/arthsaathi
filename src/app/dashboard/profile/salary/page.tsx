'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41' }

interface ParsedSlip {
  month: string
  year: string
  employerName: string
  employeeName: string
  grossSalary: number
  netSalary: number
  basicSalary: number
  hra: number
  employeePF: number
  tdsDeducted: number
  components: Array<{ label: string; amount: number; type: string }>
}

export default function SalaryPage() {
  const router = useRouter()
  const [slips, setSlips] = useState<ParsedSlip[]>([])
  const [selectedSlip, setSelectedSlip] = useState<ParsedSlip | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('av_salary_timeline')
      if (stored) {
        const parsed = JSON.parse(stored)
        setSlips(parsed)
      }
    }
  }, [])

  const earnings = selectedSlip?.components?.filter(c => c.type === 'earning') || []
  const deductions = selectedSlip?.components?.filter(c => c.type === 'deduction') || []

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Salary Breakdown</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          Click any month to see detailed breakdown.
        </p>
      </div>

      {slips.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.fg, margin: '0 0 8px' }}>No salary slips uploaded yet</h3>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Upload your first slip to get started</p>
          <button onClick={() => router.push('/dashboard/profile/documents')} style={{
            padding: '10px 20px', background: C.primary, color: '#fff', border: 'none',
            borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Upload Salary Slip
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Total Slips</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.fg }}>{slips.length}</div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Latest Gross</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.fg }}>₹{(slips[slips.length - 1]?.grossSalary || 0).toLocaleString('en-IN')}</div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Latest Net</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.fg }}>₹{(slips[slips.length - 1]?.netSalary || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Month</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Employer</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Gross</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Net</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: C.fg, fontWeight: 500 }}>
                      {slip.month} {slip.year}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: C.fg }}>
                      {slip.employerName}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: C.fg, textAlign: 'right', fontWeight: 600 }}>
                      ₹{slip.grossSalary.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: C.fg, textAlign: 'right', fontWeight: 600 }}>
                      ₹{slip.netSalary.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button onClick={() => setSelectedSlip(slip)} style={{
                        padding: '6px 14px', background: C.bg, border: `1px solid ${C.border}`,
                        borderRadius: 5, fontSize: 12, fontWeight: 500, color: C.fg,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => router.push('/dashboard/profile/other-income')} style={{
              padding: '12px 24px', background: C.primary, color: '#fff', border: 'none',
              borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Next: Other Income →
            </button>
          </div>
        </>
      )}

      {selectedSlip && (
        <div onClick={() => setSelectedSlip(null)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.card, borderRadius: 12, maxWidth: 700, width: '100%',
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: '0 0 4px' }}>
                  {selectedSlip.month} {selectedSlip.year}
                </h3>
                <div style={{ fontSize: 13, color: C.muted }}>{selectedSlip.employerName}</div>
              </div>
              <button onClick={() => setSelectedSlip(null)} style={{
                background: 'transparent', border: 'none', fontSize: 24, color: C.muted,
                cursor: 'pointer', lineHeight: 1,
              }}>×</button>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 12px', paddingBottom: 8, borderBottom: `2px solid ${C.primary}` }}>
                    Earnings
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {earnings.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: C.muted }}>{item.label}</span>
                        <span style={{ fontWeight: 600, color: C.fg }}>₹{item.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: C.fg }}>Gross Salary</span>
                      <span style={{ color: C.primary }}>₹{selectedSlip.grossSalary.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 12px', paddingBottom: 8, borderBottom: `2px solid #C33` }}>
                    Deductions
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {deductions.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: C.muted }}>{item.label}</span>
                        <span style={{ fontWeight: 600, color: C.fg }}>₹{item.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: C.fg }}>Total Deductions</span>
                      <span style={{ color: '#C33' }}>₹{(selectedSlip.grossSalary - selectedSlip.netSalary).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: 24, padding: 16, background: C.bg,
                borderRadius: 8, border: `1px solid ${C.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>Net Payable</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>₹{selectedSlip.netSalary.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
