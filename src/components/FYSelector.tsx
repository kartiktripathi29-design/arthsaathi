'use client'
import { useState } from 'react'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41', accent: '#E6CFA7' }

interface FYSelectorProps {
  month: string
  year: string
  onSelect: (fy: string) => void
}

export default function FYSelector({ month, year, onSelect }: FYSelectorProps) {
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
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>
          This slip is for <strong>{month} {year}</strong>. Which FY should we use for tax calculations?
        </p>

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
