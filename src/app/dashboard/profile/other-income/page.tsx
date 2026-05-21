'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

interface OtherIncomeEntry {
  id: string
  type: 'freelance' | 'equity' | 'crypto' | 'fno' | 'interest'
  sourceName: string
  amount: number
  declarationMethod?: string
  [key: string]: any
}

export default function OtherIncomePage() {
  const router = useRouter()
  const [entries, setEntries] = useState<OtherIncomeEntry[]>([])
  const [openForm, setOpenForm] = useState<OtherIncomeEntry | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const data = localStorage.getItem('av_other_income')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        setEntries(Array.isArray(parsed) ? parsed : [])
      } catch (e) {
        console.error('Failed to load other income:', e)
      }
    }
  }, [])

  const types = [
    { key: 'freelance', icon: '💼', label: 'Freelance / Consulting', desc: 'Professional services. You can claim 50% as presumptive (44ADA) or actual expenses.' },
    { key: 'equity', icon: '📈', label: 'Stocks & Mutual Funds', desc: 'Capital gains. Long-term (>1 yr): 12.5% above ₹1.25L. Short-term: 20%.' },
    { key: 'crypto', icon: '₿', label: 'Crypto / VDA', desc: 'Digital assets. Taxed at flat 30% — no deductions allowed.' },
    { key: 'fno', icon: '📊', label: 'F&O / Intraday', desc: 'Derivatives trading. Taxed at your slab rate.' },
    { key: 'interest', icon: '🏦', label: 'Interest & Dividends', desc: 'FD interest, savings interest, dividends. Taxed at slab rate.' },
  ]

  const getTaxablePreview = (entry: OtherIncomeEntry) => {
    if (entry.type === 'freelance') return entry.declarationMethod === 'presumptive_44ada' ? Math.round(entry.grossReceipts * 0.5) : Math.max(0, entry.grossReceipts - entry.expenses)
    if (entry.type === 'equity') return Math.max(0, entry.ltcgGains - 125000) + entry.stcgGains
    if (entry.type === 'crypto') return entry.cryptoGains
    if (entry.type === 'fno') return entry.fnoNetProfit
    if (entry.type === 'interest') return entry.fdInterest + entry.savingsInterest + entry.dividends
    return 0
  }

  const handleSave = () => {
    if (openForm) {
      const updated = entries.filter(e => e.id !== openForm.id)
      setEntries([...updated, { ...openForm, amount: getTaxablePreview(openForm) }])
      localStorage.setItem('av_other_income', JSON.stringify([...updated, { ...openForm, amount: getTaxablePreview(openForm) }]))
      setOpenForm(null)
    }
  }

  const handleAdd = (type: string) => {
    const newEntry: OtherIncomeEntry = { id: Date.now().toString(), type: type as any, sourceName: '', amount: 0, grossReceipts: 0, expenses: 0, ltcgGains: 0, stcgGains: 0, cryptoGains: 0, fnoNetProfit: 0, fdInterest: 0, savingsInterest: 0, dividends: 0, declarationMethod: 'presumptive_44ada' }
    setOpenForm(newEntry)
    setMenuOpen(false)
  }

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    localStorage.setItem('av_other_income', JSON.stringify(updated))
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Other Income</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Income beyond salary: freelance, investments, trading, interest. (Optional — skip if salary-only)</p>

      {/* Banner */}
      <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.6 }}>
          All income here is added to your salary for tax calculation. Each type has different tax rules — fill in what applies to you.
        </p>
      </div>

      {entries.length === 0 && !menuOpen ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 16px' }}>No other income added yet. (This is optional.)</p>
          <button onClick={() => setMenuOpen(true)} style={{ padding: '10px 20px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Income Source
          </button>
        </div>
      ) : (
        <>
          {entries.map(entry => (
            <div key={entry.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>{entry.sourceName || 'Unnamed'}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{types.find(t => t.key === entry.type)?.label}</p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px' }}>Taxable</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(getTaxablePreview(entry))}</p>
                </div>
                <button onClick={() => setOpenForm(entry)} style={{ padding: '6px 12px', background: C.wl, color: C.fg, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                <button onClick={() => handleDelete(entry.id)} style={{ padding: '6px 12px', background: '#fff', color: C.danger, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
              </div>
            </div>
          ))}
          <button onClick={() => setMenuOpen(true)} style={{ width: '100%', padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 24 }}>
            + Add Another Source
          </button>
        </>
      )}

      {menuOpen && !openForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: '0 0 14px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Select income type</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {types.map(t => (
              <button key={t.key} onClick={() => handleAdd(t.key)} style={{ padding: '14px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.fg; (e.currentTarget as HTMLElement).style.background = C.wl }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.background = '#fff' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}><span style={{ fontSize: 16, marginRight: 8 }}>{t.icon}</span>{t.label}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.4 }}>{t.desc}</p>
              </button>
            ))}
          </div>
          <button onClick={() => setMenuOpen(false)} style={{ padding: '10px 16px', background: 'transparent', color: C.muted, border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}

      {/* Form Modal */}
      {openForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>{types.find(t => t.key === openForm.type)?.label}</h2>
            <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 16px', lineHeight: 1.6 }}>{types.find(t => t.key === openForm.type)?.desc}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Source name</label>
                <input type="text" value={openForm.sourceName} onChange={(e) => setOpenForm({ ...openForm, sourceName: e.target.value })} placeholder="e.g. Freelance clients" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
              </div>

              {openForm.type === 'freelance' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Gross receipts</label>
                    <input type="text" inputMode="numeric" value={openForm.grossReceipts} onChange={(e) => setOpenForm({ ...openForm, grossReceipts: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 6, display: 'block' }}>How do you want to declare?</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                      <input type="radio" checked={openForm.declarationMethod === 'presumptive_44ada'} onChange={() => setOpenForm({ ...openForm, declarationMethod: 'presumptive_44ada' })} />
                      <div><div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Section 44ADA (50% presumptive)</div><div style={{ fontSize: 10.5, color: C.muted }}>Simpler, no expense tracking needed</div></div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" checked={openForm.declarationMethod === 'actual'} onChange={() => setOpenForm({ ...openForm, declarationMethod: 'actual' })} />
                      <div><div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Actual income (gross minus expenses)</div><div style={{ fontSize: 10.5, color: C.muted }}>Need to track expenses</div></div>
                    </label>
                  </div>
                  {openForm.declarationMethod === 'actual' && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Expenses</label>
                      <input type="text" inputMode="numeric" value={openForm.expenses} onChange={(e) => setOpenForm({ ...openForm, expenses: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                    </div>
                  )}
                </>
              )}

              {openForm.type === 'equity' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Long-term gains (held > 1 year)</label>
                    <input type="text" inputMode="numeric" value={openForm.ltcgGains} onChange={(e) => setOpenForm({ ...openForm, ltcgGains: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                    <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>First ₹1,25,000 is tax-free</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Short-term gains (held ≤ 1 year)</label>
                    <input type="text" inputMode="numeric" value={openForm.stcgGains} onChange={(e) => setOpenForm({ ...openForm, stcgGains: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                    <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>Taxed at 20% flat</p>
                  </div>
                </>
              )}

              {openForm.type === 'crypto' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Net gains from crypto trading</label>
                  <input type="text" inputMode="numeric" value={openForm.cryptoGains} onChange={(e) => setOpenForm({ ...openForm, cryptoGains: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                  <p style={{ fontSize: 10, color: C.danger, margin: '4px 0 0' }}>Taxed at 30% flat. No loss set-off allowed.</p>
                </div>
              )}

              {openForm.type === 'fno' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Net profit from F&O / Intraday</label>
                  <input type="text" inputMode="numeric" value={openForm.fnoNetProfit} onChange={(e) => setOpenForm({ ...openForm, fnoNetProfit: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                </div>
              )}

              {openForm.type === 'interest' && (
                <>
                  <div><label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>FD interest</label><input type="text" inputMode="numeric" value={openForm.fdInterest} onChange={(e) => setOpenForm({ ...openForm, fdInterest: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} /></div>
                  <div><label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Savings account interest</label><input type="text" inputMode="numeric" value={openForm.savingsInterest} onChange={(e) => setOpenForm({ ...openForm, savingsInterest: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} /><p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>First ₹10,000 is tax-free (80TTA)</p></div>
                  <div><label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Dividends</label><input type="text" inputMode="numeric" value={openForm.dividends} onChange={(e) => setOpenForm({ ...openForm, dividends: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} /></div>
                </>
              )}

              <div style={{ padding: '12px 14px', background: C.wl, borderRadius: 5 }}>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px' }}>Taxable amount from this source</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(getTaxablePreview(openForm))}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setOpenForm(null)} style={{ flex: 1, padding: '10px', background: C.card, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '10px', background: C.fg, color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/profile/exemptions')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Exemptions →</button>
      </div>
    </div>
  )
}
