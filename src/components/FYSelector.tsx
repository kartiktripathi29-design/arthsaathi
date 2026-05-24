'use client'
import { useState } from 'react'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41', accent: '#E6CFA7' }

interface ParsedComponent {
  label: string
  amount: number
  type: 'earning' | 'deduction' | 'computed' | string
}

interface ParsedSlipForPreview {
  employeeName?: string
  employerName?: string
  grossSalary?: number
  netSalary?: number
  totalDeductions?: number
  components?: ParsedComponent[]
}

interface FYSelectorProps {
  month: string
  year: string
  onSelect: (fy: string) => void
  parsed?: ParsedSlipForPreview | null
}

const fmt = (n: number) =>
  n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

export default function FYSelector({ month, year, onSelect, parsed }: FYSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null)

  // Parse month number from month name
  const monthNum = new Date(`${month} 1, ${year}`).getMonth() + 1
  
  // Determine FY options based on month
  // Jan-Mar → could be FY (year-1)-(year) OR FY (year)-(year+1) if treating as base
  // Apr-Dec → FY (year)-(year+1)
  const currentFY = monthNum <= 3 
    ? `FY ${parseInt(year) - 1}–${year.slice(2)}` 
    : `FY ${year}–${(parseInt(year) + 1).toString().slice(2)}`
  
  const nextFY = monthNum <= 3
    ? `FY ${year}–${(parseInt(year) + 1).toString().slice(2)}`
    : `FY ${parseInt(year) + 1}–${(parseInt(year) + 2).toString().slice(2)}`

  const options = [
    {
      fy: currentFY,
      label: `${currentFY}`,
      description: monthNum <= 3 
        ? `${month} ${year} is the final month` 
        : `${month} ${year} is month ${monthNum - 3}`,
    },
    {
      fy: nextFY,
      label: `${nextFY}`,
      description: monthNum <= 3
        ? `${month} ${year} is month ${monthNum + 9} (carry forward)`
        : `${month} ${year} is a base for next FY`,
    },
  ]

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, padding: 20,
    }}>
      <div style={{
        background: C.card, borderRadius: 12, maxWidth: 520, width: '100%',
        boxShadow: '0 25px 80px rgba(0,0,0,0.4)', padding: 32,
      }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>
          Select Financial Year
        </h3>
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>
          This slip is for <strong>{month} {year}</strong>. Which FY should we use for tax calculations?
        </p>

        {parsed && ((parsed.grossSalary || 0) > 0 || (parsed.netSalary || 0) > 0) && (() => {
          const earnings = (parsed.components || []).filter(c => c.type === 'earning')
          const deductions = (parsed.components || []).filter(c => c.type === 'deduction')
          const gross = parsed.grossSalary || earnings.reduce((s, c) => s + (c.amount || 0), 0)
          const totalDed = parsed.totalDeductions ?? deductions.reduce((s, c) => s + (c.amount || 0), 0)
          const net = parsed.netSalary || (gross - totalDed)
          return (
            <div style={{ marginBottom: 20, padding: 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parsed slip · breakdown</p>
                {parsed.employerName ? <span style={{ fontSize: 11, color: C.muted }}>{parsed.employerName}</span> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Earnings</p>
                  <div style={{ background: '#FFFCF6', borderRadius: 4, border: `1px solid ${C.border}` }}>
                    {(earnings.length > 0 ? earnings : [{ label: 'Gross', amount: gross } as ParsedComponent]).map((e, i, arr) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 10.5 }}>
                        <span style={{ color: C.fg }}>{e.label}</span>
                        <span style={{ fontWeight: 600, color: C.fg }}>{fmt(e.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 10.5, fontWeight: 700, background: '#FFF8EC', borderTop: `1px solid ${C.border}` }}>
                      <span style={{ color: C.fg }}>Gross</span>
                      <span style={{ color: C.fg }}>{fmt(gross)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Deductions</p>
                  <div style={{ background: '#FBF0F0', borderRadius: 4, border: `1px solid ${C.border}` }}>
                    {(deductions.length > 0 ? deductions : [{ label: 'Deductions', amount: totalDed } as ParsedComponent]).map((d, i, arr) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 10.5 }}>
                        <span style={{ color: C.fg }}>{d.label}</span>
                        <span style={{ fontWeight: 600, color: '#B94040' }}>−{fmt(d.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 10.5, fontWeight: 700, background: '#F7E0E0', borderTop: `1px solid ${C.border}` }}>
                      <span style={{ color: '#B94040' }}>Total</span>
                      <span style={{ color: '#B94040' }}>−{fmt(totalDed)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#E8F2EC', borderRadius: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>Net Salary</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2A7A4A' }}>{fmt(net)}</span>
              </div>
            </div>
          )
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {options.map(opt => (
            <button
              key={opt.fy}
              onClick={() => setSelected(opt.fy)}
              style={{
                padding: 16, background: selected === opt.fy ? 'rgba(58,75,65,0.08)' : C.bg,
                border: `2px solid ${selected === opt.fy ? C.primary : C.border}`,
                borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${selected === opt.fy ? C.primary : '#CCC'}`,
                  background: selected === opt.fy ? C.primary : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {selected === opt.fy && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                  )}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>{opt.label}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginLeft: 30 }}>
                {opt.description}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          style={{
            width: '100%', padding: '12px', background: selected ? C.primary : '#CCC',
            color: '#fff', border: 'none', borderRadius: 6, fontSize: 14,
            fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
