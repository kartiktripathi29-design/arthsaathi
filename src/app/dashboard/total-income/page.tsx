'use client'
import Link from 'next/link'
import { useAppStore } from '@/store/AppStore'

function Row({ label, value, sub, color = '#1C2833', bold = false }: { label: string; value: number; sub?: string; color?: string; bold?: boolean }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
      <div>
        <div style={{ fontSize: 13, color: bold ? '#1C2833' : '#374151', fontWeight: bold ? 700 : 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#95A5A6', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 800 : 600, color }}>{value < 0 ? '−' : ''}₹{Math.abs(value).toLocaleString('en-IN')}</div>
    </div>
  )
}

export default function TotalIncomePage() {
  const { salary } = useAppStore()

  const annualSalary = salary ? salary.grossSalary * 12 : 0
  const stdDeduction = 75000 // New regime
  const netSalary = Math.max(0, annualSalary - stdDeduction)

  // Placeholder for other income (would come from store in V2)
  const totalIncome = netSalary

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1C2833', marginBottom: 6 }}>Total Income Summary</h2>
        <p style={{ fontSize: 14, color: '#5D6D7E' }}>Your complete income picture for FY 2024–25 before tax calculation.</p>
      </div>

      {!salary ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#F8FAFB', borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>No income data yet</div>
          <div style={{ fontSize: 14, color: '#5D6D7E', marginBottom: 20 }}>Start by adding your salary slip</div>
          <Link href="/dashboard/salary" style={{ padding: '10px 24px', background: '#1A3C5E', color: '#fff', borderRadius: 9, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
            Add Salary →
          </Link>
        </div>
      ) : (
        <>
          {/* Big total card */}
          <div style={{ background: 'linear-gradient(135deg, #0F2640, #1A3C5E)', borderRadius: 16, padding: '28px', marginBottom: 24, color: '#fff' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6, letterSpacing: '0.08em' }}>GROSS TOTAL INCOME — FY 2024-25</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#FCD34D', lineHeight: 1 }}>₹{totalIncome.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>{salary.employeeName} · {salary.employerName}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 20 }}>
              {[
                { label: 'Annual Gross Salary', value: `₹${annualSalary.toLocaleString('en-IN')}` },
                { label: 'Std. Deduction (New)', value: `−₹${stdDeduction.toLocaleString('en-IN')}` },
                { label: 'Monthly Take-Home', value: `₹${salary.netSalary.toLocaleString('en-IN')}` },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 16 }}>Income Breakdown</div>

            <div style={{ fontSize: 12, fontWeight: 600, color: '#5D6D7E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>A. Salary Income</div>
            <Row label="Gross Salary (Annual)" value={annualSalary} color="#1A3C5E" />
            <Row label="Standard Deduction" value={-stdDeduction} sub="New Regime" color="#C0392B" />
            <Row label="Net Salary Income" value={netSalary} color="#1E8449" bold />

            <div style={{ fontSize: 12, fontWeight: 600, color: '#5D6D7E', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>B. Other Income</div>
            <div style={{ padding: '16px', background: '#F8FAFB', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#5D6D7E', marginBottom: 8 }}>No other income added yet</div>
              <Link href="/dashboard/other-income" style={{ fontSize: 13, color: '#1A3C5E', fontWeight: 600, textDecoration: 'none' }}>
                + Add Other Income →
              </Link>
            </div>

            <div style={{ marginTop: 16, padding: '14px 0', borderTop: '2px solid #1A3C5E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1C2833' }}>Gross Total Income</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1A3C5E' }}>₹{totalIncome.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Next step */}
          <div style={{ background: '#E8F1FA', border: '1px solid #A8CCE8', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A3C5E' }}>Ready to calculate your tax?</div>
              <div style={{ fontSize: 12, color: '#2E5A88', marginTop: 3 }}>Compare Old vs New regime and see how much you can save</div>
            </div>
            <Link href="/dashboard/tax"
              style={{ padding: '10px 20px', background: '#1A3C5E', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Optimise Tax →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
