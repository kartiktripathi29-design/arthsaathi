'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

export default function DeductionsPage() {
  const router = useRouter()
  const [ded, setDed] = useState({ ppf: 0, elss: 0, lic: 0, tuition: 0, nsc: 0, selfFamily: 0, parents: 0, selfSenior: false, parentsSenior: false, homeLoanInterest: 0, nps: 0 })
  const [expanded, setExpanded] = useState<string[]>(['80c', '80d'])

  useEffect(() => {
    const data = localStorage.getItem('av_deductions')
    if (data) {
      try {
        setDed(JSON.parse(data))
      } catch (e) {
        console.error('Failed to load deductions:', e)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('av_deductions', JSON.stringify(ded))
  }, [ded])

  const toggle = (key: string) => {
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const sec80C = Math.min(ded.ppf + ded.elss + ded.lic + ded.tuition + ded.nsc, 150000)
  const sec80D = Math.min(ded.selfFamily + ded.parents, 100000)
  const taxSavingsOld = (sec80C + sec80D + Math.min(ded.homeLoanInterest, 200000) + Math.min(ded.nps, 50000)) * 0.2 // rough estimate at 20% slab

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Deductions</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Tax-saving investments and expenses. (These only reduce tax in Old Regime)</p>

      {/* Context Banner */}
      <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.6 }}>
          You've claimed <strong>{fmt(sec80C + ded.homeLoanInterest + ded.nps)}</strong> total. Only invest what makes financial sense — tax saving is a bonus, not the goal.
        </p>
      </div>

      {/* Section 80C */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80c')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('80c') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('80c') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Did you invest in PPF, ELSS, LIC, or tuition?</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Section 80C (max ₹1,50,000)</p>
          </div>
          <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('80c') ? '−' : '+'}</span>
        </button>
        {expanded.includes('80c') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[{ key: 'ppf', label: 'PPF' }, { key: 'elss', label: 'ELSS (Mutual Fund)' }, { key: 'lic', label: 'Life Insurance Premium' }, { key: 'tuition', label: 'Tuition Fees' }, { key: 'nsc', label: 'NSC / Tax Saver FD' }].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 10.5, color: C.muted, marginBottom: 3, fontWeight: 500 }}>{label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                    <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                    <input type="text" inputMode="numeric" value={(ded as any)[key] > 0 ? (ded as any)[key] : ''} onChange={(e) => setDed({ ...ded, [key]: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Total claimed</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(sec80C)} / ₹1,50,000</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 80D */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80d')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('80d') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('80d') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Do you pay health insurance premiums?</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Section 80D (max ₹1,00,000)</p>
          </div>
          <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('80d') ? '−' : '+'}</span>
        </button>
        {expanded.includes('80d') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.text, marginBottom: 8, fontWeight: 600 }}>Self + Family</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                <input type="text" inputMode="numeric" value={ded.selfFamily > 0 ? ded.selfFamily : ''} onChange={(e) => setDed({ ...ded, selfFamily: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={ded.selfSenior} onChange={(e) => setDed({ ...ded, selfSenior: e.target.checked })} /> <span>You/spouse is 60+? (₹50k limit instead of ₹25k)</span>
              </label>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.text, marginBottom: 8, fontWeight: 600 }}>Parents</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                <input type="text" inputMode="numeric" value={ded.parents > 0 ? ded.parents : ''} onChange={(e) => setDed({ ...ded, parents: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={ded.parentsSenior} onChange={(e) => setDed({ ...ded, parentsSenior: e.target.checked })} /> <span>Parents are 60+? (₹50k limit instead of ₹25k)</span>
              </label>
            </div>
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Total claimed</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(sec80D)} / ₹1,00,000</span>
            </div>
          </div>
        )}
      </div>

      {/* Home Loan */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('24b')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('24b') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('24b') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Are you paying a home loan?</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Section 24(b) (max ₹2,00,000)</p>
          </div>
          <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('24b') ? '−' : '+'}</span>
        </button>
        {expanded.includes('24b') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>Interest paid this year</label>
            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ padding: '8px 8px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
              <input type="text" inputMode="numeric" value={ded.homeLoanInterest > 0 ? ded.homeLoanInterest : ''} onChange={(e) => setDed({ ...ded, homeLoanInterest: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 8px', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Claimed (capped at ₹2L)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(Math.min(ded.homeLoanInterest, 200000))}</span>
            </div>
          </div>
        )}
      </div>

      {/* NPS */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 24, overflow: 'hidden' }}>
        <button onClick={() => toggle('nps')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('nps') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('nps') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Did you contribute to NPS?</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Section 80CCD(1B) (max ₹50,000 — separate from 80C)</p>
          </div>
          <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('nps') ? '−' : '+'}</span>
        </button>
        {expanded.includes('nps') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>NPS contribution this year</label>
            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ padding: '8px 8px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
              <input type="text" inputMode="numeric" value={ded.nps > 0 ? ded.nps : ''} onChange={(e) => setDed({ ...ded, nps: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 8px', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Claimed (capped at ₹50k)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(Math.min(ded.nps, 50000))}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tax Savings Preview */}
      {taxSavingsOld > 0 && (
        <div style={{ background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Rough tax savings (Old Regime)</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>~{fmt(taxSavingsOld)}</p>
          <p style={{ fontSize: 10, color: C.muted, margin: '6px 0 0' }}>These deductions don't count in New Regime. Your actual saving depends on your total income and which regime you choose.</p>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/exemptions')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/tax/optimizer')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Tax Optimizer →</button>
      </div>
    </div>
  )
}
