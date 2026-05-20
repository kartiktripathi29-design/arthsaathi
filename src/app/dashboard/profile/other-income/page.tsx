'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { bg: '#FDFAF6', card: '#fff', border: '#E4DDD1', fg: '#1C2B22', muted: '#6B7770', primary: '#3A4B41', accent: '#E6CFA7' }

type OtherIncomeType = 'freelance' | 'equity' | 'crypto' | 'fno_intraday' | 'interest_div'

interface OtherIncomeEntry {
  id: string
  type: OtherIncomeType
  sourceName: string
  amount: number
  details: any
}

export default function OtherIncomePage() {
  const router = useRouter()
  const [entries, setEntries] = useState<OtherIncomeEntry[]>([])
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<OtherIncomeType>('freelance')
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('av_other_income')
      if (stored) setEntries(JSON.parse(stored))
    }
  }, [])

  const openModal = (type: OtherIncomeType) => {
    setModalType(type)
    setForm({})
    setShowModal(true)
  }

  const saveEntry = () => {
    const entry: OtherIncomeEntry = {
      id: Date.now().toString(),
      type: modalType,
      sourceName: form.sourceName || 'Unnamed',
      amount: form.amount || 0,
      details: form,
    }
    const updated = [...entries, entry]
    setEntries(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('av_other_income', JSON.stringify(updated))
    }
    setShowModal(false)
  }

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('av_other_income', JSON.stringify(updated))
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '0 0 6px' }}>Other Income</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
          Declare income from freelancing, investments, trading, or interest.
        </p>
      </div>

      {/* Income Type Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { type: 'freelance' as const, label: 'Freelance / Business', icon: '💼' },
          { type: 'equity' as const, label: 'Equity Trading', icon: '📈' },
          { type: 'crypto' as const, label: 'Cryptocurrency', icon: '₿' },
          { type: 'fno_intraday' as const, label: 'F&O / Intraday', icon: '📊' },
          { type: 'interest_div' as const, label: 'Interest & Dividends', icon: '🏦' },
        ].map(item => (
          <button key={item.type} onClick={() => openModal(item.type)} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 20, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>{item.label}</div>
          </button>
        ))}
      </div>

      {/* Existing Entries */}
      {entries.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>
            Declared Income ({entries.length})
          </h3>
          {entries.map(e => (
            <div key={e.id} style={{
              padding: '10px 0', borderBottom: '1px solid #F0F0F0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.fg }}>{e.sourceName}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{e.type}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>₹{e.amount.toLocaleString('en-IN')}</span>
                <button onClick={() => deleteEntry(e.id)} style={{
                  background: 'transparent', border: 'none', color: '#C33',
                  cursor: 'pointer', fontSize: 18, lineHeight: 1,
                }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{
          padding: '12px 24px', background: 'transparent', color: C.primary,
          border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ← Back
        </button>
        <button onClick={() => router.push('/dashboard/profile/exemptions')} style={{
          padding: '12px 24px', background: C.primary, color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Next: Exemptions →
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.card, borderRadius: 12, maxWidth: 500, width: '100%',
            maxHeight: '80vh', overflow: 'auto', padding: 24,
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.fg, marginBottom: 16 }}>
              Add {modalType === 'freelance' ? 'Freelance' : modalType === 'equity' ? 'Equity' : modalType === 'crypto' ? 'Crypto' : modalType === 'fno_intraday' ? 'F&O' : 'Interest'} Income
            </h3>

            {/* Common Fields */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: C.fg, display: 'block', marginBottom: 4 }}>Source Name</label>
              <input value={form.sourceName || ''} onChange={e => setForm({...form, sourceName: e.target.value})} placeholder="e.g. Upwork, Zerodha" style={{
                width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`,
                borderRadius: 5, fontFamily: 'inherit', background: C.bg,
              }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: C.fg, display: 'block', marginBottom: 4 }}>Amount (₹)</label>
              <input type="number" value={form.amount || ''} onChange={e => setForm({...form, amount: parseFloat(e.target.value)||0})} placeholder="0" style={{
                width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`,
                borderRadius: 5, fontFamily: 'inherit', background: C.bg,
              }} />
            </div>

            {/* Type-Specific Fields */}
            {modalType === 'freelance' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: C.fg, display: 'block', marginBottom: 6 }}>Declaration Method</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['presumptive_44ada', 'actual'].map(m => (
                    <button key={m} onClick={() => setForm({...form, method: m})} style={{
                      flex: 1, padding: '8px', background: form.method === m ? C.primary : C.bg,
                      color: form.method === m ? '#fff' : C.fg, border: `1px solid ${C.border}`,
                      borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {m === 'presumptive_44ada' ? '44ADA (50%)' : 'Actual'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save Button */}
            <button onClick={saveEntry} disabled={!form.sourceName || !form.amount} style={{
              width: '100%', padding: '10px', background: form.sourceName && form.amount ? C.primary : '#CCC',
              color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
              cursor: form.sourceName && form.amount ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>
              Add Entry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
