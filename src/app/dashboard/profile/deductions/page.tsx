'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41' }

export default function DeductionsPage() {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string[]>([])
  const [ded, setDed] = useState({
    ppf: 0, elss: 0, lic: 0, tuition: 0, nsc: 0,
    selfFamily: 0, parents: 0, selfSenior: false, parentsSenior: false,
    homeLoanInterest: 0,
    nps: 0,
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('av_deductions')
      if (stored) setDed(JSON.parse(stored))
    }
  }, [])

  const toggle = (key: string) => {
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('av_deductions', JSON.stringify(ded))
    }
    router.push('/dashboard/tax')
  }

  const sec80C = ded.ppf + ded.elss + ded.lic + ded.tuition + ded.nsc
  const sec80D = ded.selfFamily + ded.parents

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, marginBottom: 24 }}>Deductions</h2>

      {/* 80C */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80c')} style={{
          width: '100%', padding: '16px 20px', background: 'transparent', border: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>Section 80C (Max ₹1.5L)</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Total: ₹{sec80C.toLocaleString('en-IN')}</div>
          </div>
          <span style={{ fontSize: 18, color: C.fg }}>{expanded.includes('80c') ? '−' : '+'}</span>
        </button>
        {expanded.includes('80c') && (
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'ppf', label: 'PPF' },
              { key: 'elss', label: 'ELSS Mutual Funds' },
              { key: 'lic', label: 'Life Insurance Premium' },
              { key: 'tuition', label: 'Tuition Fees' },
              { key: 'nsc', label: 'NSC / Tax Saver FD' },
            ].map(item => (
              <div key={item.key}>
                <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>{item.label}</label>
                <input type="number" value={(ded[item.key as 'ppf'|'elss'|'lic'|'tuition'|'nsc'] as number) || ''} onChange={e => setDed({...ded, [item.key]: parseFloat(e.target.value)||0})} placeholder="₹0" style={{
                  width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`,
                  borderRadius: 5, fontFamily: 'inherit', background: C.bg,
                }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 80D */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80d')} style={{
          width: '100%', padding: '16px 20px', background: 'transparent', border: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.fg }}>Section 80D (Health Insurance)</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Total: ₹{sec80D.toLocaleString('en-IN')}</div>
          </div>
          <span style={{ fontSize: 18, color: C.fg }}>{expanded.includes('80d') ? '−' : '+'}</span>
        </button>
        {expanded.includes('80d') && (
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Self + Family Premium</label>
              <input type="number" value={ded.selfFamily || ''} onChange={e => setDed({...ded, selfFamily: parseFloat(e.target.value)||0})} placeholder="₹0" style={{
                width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`,
                borderRadius: 5, fontFamily: 'inherit', background: C.bg,
              }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <input type="checkbox" checked={ded.selfSenior} onChange={e => setDed({...ded, selfSenior: e.target.checked})} />
                Self or spouse is senior citizen (60+)
              </label>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 4 }}>Parents Premium</label>
              <input type="number" value={ded.parents || ''} onChange={e => setDed({...ded, parents: parseFloat(e.target.value)||0})} placeholder="₹0" style={{
                width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`,
                borderRadius: 5, fontFamily: 'inherit', background: C.bg,
              }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={ded.parentsSenior} onChange={e => setDed({...ded, parentsSenior: e.target.checked})} />
                Parents are senior citizens (60+)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Home Loan */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <label style={{ fontSize: 15, fontWeight: 600, color: C.fg, display: 'block', marginBottom: 12 }}>Home Loan Interest (24b)</label>
        <input type="number" value={ded.homeLoanInterest || ''} onChange={e => setDed({...ded, homeLoanInterest: parseFloat(e.target.value)||0})} placeholder="₹0" style={{
          width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
          borderRadius: 6, fontFamily: 'inherit', background: C.bg,
        }} />
        <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>Max ₹2L deduction</p>
      </div>

      {/* NPS */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <label style={{ fontSize: 15, fontWeight: 600, color: C.fg, display: 'block', marginBottom: 12 }}>NPS - Section 80CCD(1B)</label>
        <input type="number" value={ded.nps || ''} onChange={e => setDed({...ded, nps: parseFloat(e.target.value)||0})} placeholder="₹0" style={{
          width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C.border}`,
          borderRadius: 6, fontFamily: 'inherit', background: C.bg,
        }} />
        <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>Additional ₹50K (over 80C)</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/dashboard/profile/exemptions')} style={{
          padding: '12px 24px', background: 'transparent', color: C.primary,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>← Back</button>
        <button onClick={handleSave} style={{
          padding: '12px 24px', background: C.primary, color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>Next: Tax Optimizer →</button>
      </div>
    </div>
  )
}
