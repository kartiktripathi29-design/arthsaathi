'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

interface OtherIncomeEntry {
  id: string
  type: 'freelance' | 'equity' | 'crypto' | 'fno' | 'interest' | 'other'
  sourceName: string
  amount: number
  declarationMethod?: string
  [key: string]: any
}

// Map an AIS capital-gains assetType to the Other-Income asset-type dropdown values.
// property → unlisted is tax-equivalent here (12.5% LTCG without indexation, slab STCG).
function aisAssetToType(a: string): string {
  const x = (a || '').toLowerCase()
  if (x.includes('mutual') || x === 'mf') return 'equity_mf'
  if (x.includes('debt')) return 'debt_mf'
  if (x.includes('property') || x.includes('unlisted')) return 'unlisted'
  return 'listed_equity' // equity / default
}

// Build Other-Income entries from a parsed AIS object (interest + dividends → one interest entry;
// capital gains grouped by asset type into equity entries). Entries are tagged _fromAis so a
// re-import can replace them cleanly without touching the user's manually-added rows.
function buildAisEntries(ais: any): OtherIncomeEntry[] {
  const base: any = { grossReceipts: 0, expenses: 0, ltcgGains: 0, stcgGains: 0, ltcgAsset: 'listed_equity', stcgAsset: 'listed_equity', cryptoGains: 0, cryptoTDS: 0, fnoNetProfit: 0, fdInterest: 0, savingsInterest: 0, dividends: 0, otherAmount: 0, declarationMethod: 'presumptive_44ada', _fromAis: true }
  const out: OtherIncomeEntry[] = []
  const interest = Math.max(0, Number(ais?.totalInterestIncome) || 0)
  const dividends = Math.max(0, Number(ais?.dividendIncome) || 0)
  if (interest > 0 || dividends > 0) {
    out.push({ ...base, id: 'ais-int', type: 'interest', sourceName: 'From AIS', amount: interest + dividends, fdInterest: interest, dividends })
  }
  const cg = Array.isArray(ais?.capitalGains) ? ais.capitalGains : []
  const byAsset: Record<string, { lt: number; st: number }> = {}
  for (const c of cg) {
    const gain = Math.max(0, Number(c?.gain) || 0)
    if (gain <= 0) continue
    const t = aisAssetToType(c?.assetType)
    byAsset[t] = byAsset[t] || { lt: 0, st: 0 }
    if (String(c?.gainType || '').toUpperCase() === 'STCG') byAsset[t].st += gain
    else byAsset[t].lt += gain
  }
  for (const [asset, g] of Object.entries(byAsset)) {
    out.push({ ...base, id: 'ais-cg-' + asset, type: 'equity', sourceName: 'From AIS', ltcgGains: g.lt, ltcgAsset: asset, stcgGains: g.st, stcgAsset: asset, amount: 0 })
  }
  return out
}

export default function OtherIncomePage() {
  const router = useRouter()
  const [entries, setEntries] = useState<OtherIncomeEntry[]>([])
  const [openForm, setOpenForm] = useState<OtherIncomeEntry | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aisData, setAisData] = useState<any>(null)

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
    // AIS (parsed on the Documents page) lets us prefill / cross-check this income.
    try {
      const ais = JSON.parse(localStorage.getItem('as_ais') || 'null')
      if (ais) setAisData(ais)
    } catch { /* ignore */ }
  }, [])

  const types = [
    { key: 'freelance', icon: '💼', label: 'Freelance / Consulting', desc: 'Professional services. You can claim 50% as presumptive (44ADA) or actual expenses.' },
    { key: 'equity', icon: '📈', label: 'Stocks & Mutual Funds', desc: 'Capital gains. Long-term (>1 yr): 12.5% above ₹1.25L. Short-term: 20%.' },
    { key: 'crypto', icon: '₿', label: 'Crypto / VDA', desc: 'Digital assets. Taxed at flat 30% — no deductions allowed.' },
    { key: 'fno', icon: '📊', label: 'F&O / Intraday', desc: 'Derivatives trading. Taxed at your slab rate.' },
    { key: 'interest', icon: '🏦', label: 'Interest & Dividends', desc: 'FD interest, savings interest, dividends. Taxed at slab rate.' },
    { key: 'other', icon: '➕', label: 'Other Income', desc: 'Anything that doesn\'t fit above (royalties, casual income, gifts beyond limit, etc.) Single amount, taxed at slab.' },
  ]

  const getTaxablePreview = (entry: OtherIncomeEntry) => {
    if (entry.type === 'freelance') return entry.declarationMethod === 'presumptive_44ada' ? Math.round(entry.grossReceipts * 0.5) : Math.max(0, entry.grossReceipts - entry.expenses)
    if (entry.type === 'equity') {
      // LTCG taxable depends on the asset: listed equity / equity MF get the ₹1.25L exemption;
      // debt MF and unlisted shares don't. STCG is fully taxable regardless of asset.
      const ltAsset = entry.ltcgAsset || 'listed_equity'
      const ltTaxable = (ltAsset === 'listed_equity' || ltAsset === 'equity_mf')
        ? Math.max(0, entry.ltcgGains - 125000)
        : entry.ltcgGains
      return ltTaxable + entry.stcgGains
    }
    if (entry.type === 'crypto') return entry.cryptoGains
    if (entry.type === 'fno') return entry.fnoNetProfit
    if (entry.type === 'interest') return entry.fdInterest + entry.savingsInterest + entry.dividends
    if (entry.type === 'other') return entry.otherAmount || 0
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
    const newEntry: OtherIncomeEntry = { id: Date.now().toString(), type: type as any, sourceName: '', amount: 0, grossReceipts: 0, expenses: 0, ltcgGains: 0, stcgGains: 0, ltcgAsset: 'listed_equity', stcgAsset: 'listed_equity', cryptoGains: 0, cryptoTDS: 0, fnoNetProfit: 0, fdInterest: 0, savingsInterest: 0, dividends: 0, otherAmount: 0, declarationMethod: 'presumptive_44ada' }
    setOpenForm(newEntry)
    setMenuOpen(false)
  }

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    localStorage.setItem('av_other_income', JSON.stringify(updated))
  }

  // Import income from the parsed AIS: replace any prior AIS-sourced rows, keep the user's manual
  // ones. `amount` (taxable) is computed the same way as a manually-saved entry.
  const handleImportFromAis = () => {
    if (!aisData) return
    const built = buildAisEntries(aisData).map(e => ({ ...e, amount: getTaxablePreview(e) }))
    const manual = entries.filter(e => !(e as any)._fromAis)
    const next = [...manual, ...built]
    setEntries(next)
    localStorage.setItem('av_other_income', JSON.stringify(next))
    setMenuOpen(false)
  }

  // AIS-reported totals (for the prefill banner + a light reconciliation against what's entered).
  const aisInterest = Math.max(0, Number(aisData?.totalInterestIncome) || 0)
  const aisDividends = Math.max(0, Number(aisData?.dividendIncome) || 0)
  const aisCG = Math.max(0, Number(aisData?.totalCapitalGains) || 0)
  const aisHasIncome = aisInterest > 0 || aisDividends > 0 || aisCG > 0
  const hasAisImported = entries.some(e => (e as any)._fromAis)

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

      {/* AIS prefill / reconciliation — shown when an AIS/26AS was parsed on the Documents page */}
      {aisData && aisHasIncome && (
        <div style={{ background: '#EAF4EF', border: '1px solid #BCDCCB', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: '0 0 6px' }}>📄 Income found in your AIS / 26AS</p>
          <p style={{ fontSize: 12, color: C.text, margin: '0 0 10px', lineHeight: 1.6 }}>
            Interest <strong>{fmt(aisInterest)}</strong> · Dividends <strong>{fmt(aisDividends)}</strong> · Capital gains <strong>{fmt(aisCG)}</strong>
          </p>
          {hasAisImported && (
            <p style={{ fontSize: 11, color: '#2A7A4A', margin: '0 0 10px', lineHeight: 1.5 }}>
              ✓ Imported into the entries below (rows marked “From AIS”). Edit any of them to adjust, or re-import to refresh from the latest AIS.
            </p>
          )}
          <button
            onClick={handleImportFromAis}
            style={{ padding: '9px 16px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {hasAisImported ? 'Re-import from AIS' : 'Import from AIS'}
          </button>
          <p style={{ fontSize: 10.5, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
            We map AIS capital gains to the right asset type (equity / debt MF / unlisted) and apply the correct rate. Review the imported rows — AIS figures can lag or differ from your records.
          </p>
        </div>
      )}

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

              {openForm.type === 'equity' && (() => {
                const ASSETS = [
                  { v: 'listed_equity', label: 'Listed equity shares' },
                  { v: 'equity_mf', label: 'Equity mutual fund' },
                  { v: 'debt_mf', label: 'Debt mutual fund' },
                  { v: 'unlisted', label: 'Unlisted shares' },
                ]
                const ltHint = (a: string) => a === 'debt_mf' ? 'Debt funds (bought after Apr 2023): taxed at your slab rate.'
                  : a === 'unlisted' ? '12.5% — the ₹1.25L exemption does NOT apply to unlisted shares.'
                  : 'First ₹1,25,000 across listed equity / equity MF is tax-free; balance at 12.5%.'
                const stHint = (a: string) => (a === 'debt_mf' || a === 'unlisted') ? 'Taxed at your slab rate.' : 'Taxed at 20% flat.'
                const selStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: C.text, marginBottom: 8 }
                return (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Long-term gains (held &gt; 1 year)</label>
                      <select value={openForm.ltcgAsset || 'listed_equity'} onChange={(e) => setOpenForm({ ...openForm, ltcgAsset: e.target.value })} style={selStyle}>
                        {ASSETS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                      </select>
                      <input type="text" inputMode="numeric" value={openForm.ltcgGains} onChange={(e) => setOpenForm({ ...openForm, ltcgGains: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                      <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>{ltHint(openForm.ltcgAsset || 'listed_equity')}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Short-term gains (held ≤ 1 year)</label>
                      <select value={openForm.stcgAsset || 'listed_equity'} onChange={(e) => setOpenForm({ ...openForm, stcgAsset: e.target.value })} style={selStyle}>
                        {ASSETS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                      </select>
                      <input type="text" inputMode="numeric" value={openForm.stcgGains} onChange={(e) => setOpenForm({ ...openForm, stcgGains: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                      <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>{stHint(openForm.stcgAsset || 'listed_equity')}</p>
                    </div>
                  </>
                )
              })()}

              {openForm.type === 'crypto' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Net gains from crypto trading</label>
                    <input type="text" inputMode="numeric" value={openForm.cryptoGains} onChange={(e) => setOpenForm({ ...openForm, cryptoGains: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                    <p style={{ fontSize: 10, color: C.danger, margin: '4px 0 0' }}>Taxed at 30% flat. No loss set-off allowed.</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>TDS already deducted (1% u/s 194S) — optional</label>
                    <input type="text" inputMode="numeric" value={openForm.cryptoTDS > 0 ? openForm.cryptoTDS : ''} onChange={(e) => setOpenForm({ ...openForm, cryptoTDS: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }} />
                    <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>Exchanges deduct 1% of the <strong>transfer value</strong> (not gains). Copy the figure from your exchange statement — it&apos;s credited against your tax. Leave blank if unsure or if you upload your AIS/26AS.</p>
                  </div>
                </>
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

              {openForm.type === 'other' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Amount (annual)</label>
                  <input type="text" inputMode="numeric"
                    value={openForm.otherAmount > 0 ? openForm.otherAmount : ''}
                    onChange={(e) => setOpenForm({ ...openForm, otherAmount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                    placeholder="₹0"
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit' }}
                  />
                  <p style={{ fontSize: 10.5, color: C.muted, margin: '4px 0 0' }}>Single number — gets added to your total income at slab rate. Use this for royalties, casual income, gifts beyond the ₹50k limit, or anything that doesn't fit the other categories.</p>
                </div>
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
