'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { tokens as T } from '@/lib/tokens'
import { GuideStrip } from '@/components/GuideStrip'

const C = { fg:T.teal, wheat:T.taupe, wl:T.sand, wm:T.taupeLine, bg:T.paper, card:T.card, border:T.hairline, text:T.ink, muted:T.muted, green:T.green, ivory:T.ivory, slip:T.slip, danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

// Mobile-only layout overrides (≤767px). Desktop gets no rules here, so inline styles rule untouched.
const OI_MOBILE_CSS = `
@media (max-width: 767px) {
  .oi-types { grid-template-columns: 1fr !important; }
  .oi-row { flex-direction: column !important; align-items: stretch !important; }
  .oi-row-actions { margin-top: 8px; }
  .oi-modal { padding: 16px !important; }
}
`

interface OtherIncomeEntry {
  id: string
  type: 'freelance' | 'equity' | 'crypto' | 'fno' | 'interest' | 'other'
  sourceName: string
  amount: number
  declarationMethod?: string
  [key: string]: any
}

// One capital-gains line for a single asset type, inside an equity entry. An equity entry can hold
// several of these so all the user's assets live in ONE source (instead of one source per asset).
interface EquityRow { asset: string; ltcg: number; stcg: number }

const EQUITY_ASSETS = [
  { v: 'listed_equity', label: 'Listed equity shares' },
  { v: 'equity_mf', label: 'Equity mutual fund' },
  { v: 'debt_mf', label: 'Debt mutual fund' },
  { v: 'unlisted', label: 'Unlisted shares' },
]
const isEquityAsset = (a: string) => a === 'listed_equity' || a === 'equity_mf'
const ltAssetHint = (a: string) => a === 'debt_mf' ? 'Debt funds (post Apr 2023): slab rate.'
  : a === 'unlisted' ? '12.5% — no ₹1.25L exemption.'
  : 'Listed equity / equity MF share one ₹1.25L LT exemption; balance 12.5%.'
const stAssetHint = (a: string) => (a === 'debt_mf' || a === 'unlisted') ? 'Slab rate.' : '20% flat.'

// Rebuild rows from the legacy single-asset fields (ltcgGains/ltcgAsset/stcgGains/stcgAsset) so
// entries saved before the rows layout still edit and compute correctly.
function equityRowsFromLegacy(e: any): EquityRow[] {
  const map: Record<string, EquityRow> = {}
  const add = (asset: string, lt: number, st: number) => {
    const a = asset || 'listed_equity'
    map[a] = map[a] || { asset: a, ltcg: 0, stcg: 0 }
    map[a].ltcg += lt; map[a].stcg += st
  }
  if ((e.ltcgGains || 0) > 0) add(e.ltcgAsset || 'listed_equity', e.ltcgGains || 0, 0)
  if ((e.stcgGains || 0) > 0) add(e.stcgAsset || 'listed_equity', 0, e.stcgGains || 0)
  const rows = Object.values(map)
  return rows.length ? rows : [{ asset: 'listed_equity', ltcg: 0, stcg: 0 }]
}

// Ensure an equity entry has rows, and keep the legacy aggregate fields in sync with them so the
// optimizer's fallback path and the profile-page reader stay correct without a tax-logic change.
function syncEquityLegacy(e: any): any {
  if (e.type !== 'equity') return e
  const rows: EquityRow[] = Array.isArray(e.rows) && e.rows.length ? e.rows : equityRowsFromLegacy(e)
  const ltcgGains = rows.reduce((s, r) => s + (Math.max(0, r.ltcg) || 0), 0)
  const stcgGains = rows.reduce((s, r) => s + (Math.max(0, r.stcg) || 0), 0)
  const ltcgAsset = rows.find(r => (r.ltcg || 0) > 0)?.asset || rows[0].asset
  const stcgAsset = rows.find(r => (r.stcg || 0) > 0)?.asset || rows[0].asset
  return { ...e, rows, ltcgGains, stcgGains, ltcgAsset, stcgAsset }
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
  // All AIS capital gains go into ONE equity source, one row per asset type.
  const rows: EquityRow[] = Object.entries(byAsset).map(([asset, g]) => ({ asset, ltcg: g.lt, stcg: g.st }))
  if (rows.length > 0) {
    out.push(syncEquityLegacy({ ...base, id: 'ais-cg', type: 'equity', sourceName: 'From AIS', rows, amount: 0 }))
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
        // Migrate equity entries saved before the rows layout so they edit/compute correctly.
        setEntries(Array.isArray(parsed) ? parsed.map(e => e?.type === 'equity' ? syncEquityLegacy(e) : e) : [])
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
    { key: 'freelance', icon: '💼', label: 'Freelance / Consulting', desc: 'Consulting or side work — declare 50% as profit (simpler) or actual income minus expenses.' },
    { key: 'equity', icon: '📈', label: 'Stocks & mutual funds', desc: 'Shares or funds you bought and later sold. Taxed as capital gains.' },
    { key: 'crypto', icon: '₿', label: 'Crypto', desc: 'Crypto, NFTs and other virtual digital assets. Flat 30% — losses can\'t be offset.' },
    { key: 'fno', icon: '📊', label: 'Trading (intraday & F&O)', desc: 'Intraday or F&O. Taxed as business income, not capital gains.' },
    { key: 'interest', icon: '🏦', label: 'Interest & dividends', desc: 'FD interest, savings interest and dividends. Taxed at your slab rate.' },
    { key: 'other', icon: '➕', label: 'Anything else', desc: 'Rent, royalties, gifts — taxed at your slab rate.' },
  ]

  const getTaxablePreview = (entry: OtherIncomeEntry) => {
    if (entry.type === 'freelance') return entry.declarationMethod === 'presumptive_44ada' ? Math.round(entry.grossReceipts * 0.5) : Math.max(0, entry.grossReceipts - entry.expenses)
    if (entry.type === 'equity') {
      // Sum across asset rows. LTCG taxable depends on the asset: listed equity / equity MF share
      // one ₹1.25L exemption; debt MF and unlisted don't. STCG is fully taxable regardless.
      const rows: EquityRow[] = Array.isArray(entry.rows) && entry.rows.length ? entry.rows : equityRowsFromLegacy(entry)
      let equityLt = 0, otherLt = 0, st = 0
      for (const r of rows) {
        const lt = Math.max(0, r.ltcg || 0)
        if (isEquityAsset(r.asset)) equityLt += lt; else otherLt += lt
        st += Math.max(0, r.stcg || 0)
      }
      return Math.max(0, equityLt - 125000) + otherLt + st
    }
    if (entry.type === 'crypto') return entry.cryptoGains
    if (entry.type === 'fno') return entry.fnoNetProfit
    if (entry.type === 'interest') return entry.fdInterest + entry.savingsInterest + entry.dividends
    if (entry.type === 'other') return entry.otherAmount || 0
    return 0
  }

  const handleSave = () => {
    if (openForm) {
      // For equity, sync the legacy aggregate fields from the rows before saving.
      const normalized = syncEquityLegacy(openForm)
      const saved = { ...normalized, amount: getTaxablePreview(normalized) }
      const updated = entries.filter(e => e.id !== openForm.id)
      const next = [...updated, saved]
      setEntries(next)
      localStorage.setItem('av_other_income', JSON.stringify(next))
      setOpenForm(null)
    }
  }

  const handleAdd = (type: string) => {
    const newEntry: OtherIncomeEntry = { id: Date.now().toString(), type: type as any, sourceName: '', amount: 0, grossReceipts: 0, expenses: 0, ltcgGains: 0, stcgGains: 0, ltcgAsset: 'listed_equity', stcgAsset: 'listed_equity', rows: type === 'equity' ? [{ asset: 'listed_equity', ltcg: 0, stcg: 0 }] : undefined, cryptoGains: 0, cryptoTDS: 0, fnoNetProfit: 0, fdInterest: 0, savingsInterest: 0, dividends: 0, otherAmount: 0, declarationMethod: 'presumptive_44ada' }
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

  // ─── Guide strip ──────────────────────────────────────────────────────────
  // Proactive, data-aware narration (not advice): reads the real figures already on this page and
  // tells the user what we found, what needs attention, and where it goes. No LLM, no fabricated
  // numbers — every figure is real and every sentence is pre-written, so it stays inside the
  // "clarity-not-advice / no fabricated numbers" principle. The reactive "Ask ArthVo" chat can't do
  // this: it's deliberately number-blind (sends only yes/no flags) and forbidden from judging amounts.
  const enteredIntDiv = entries.filter(e => e.type === 'interest')
    .reduce((s, e) => s + (e.fdInterest || 0) + (e.savingsInterest || 0) + (e.dividends || 0), 0)
  const enteredCGraw = entries.filter(e => e.type === 'equity').reduce((s, e) => {
    const rows: EquityRow[] = Array.isArray(e.rows) && e.rows.length ? e.rows : equityRowsFromLegacy(e)
    return s + rows.reduce((a, r) => a + Math.max(0, r.ltcg || 0) + Math.max(0, r.stcg || 0), 0)
  }, 0)
  const totalTaxable = entries.reduce((s, e) => s + getTaxablePreview(e), 0)

  const guide: { tone: 'calm' | 'attention' | 'good'; lines: string[] } = (() => {
    const human = (xs: string[]) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] || '')
    if (aisData && aisHasIncome) {
      const parts: string[] = []
      if (aisInterest > 0) parts.push(`interest ${fmt(aisInterest)}`)
      if (aisDividends > 0) parts.push(`dividends ${fmt(aisDividends)}`)
      if (aisCG > 0) parts.push(`capital gains ${fmt(aisCG)}`)
      if (!hasAisImported) {
        return { tone: 'attention', lines: [
          `Your AIS lists ${human(parts)}. None of it is in your return yet.`,
          `Use “Import from AIS” just below to bring it in — then add anything AIS can’t see (freelance, crypto, F&O, rent) by hand.`,
        ] }
      }
      const flags: string[] = []
      if ((aisInterest + aisDividends) - enteredIntDiv > 1000) flags.push(`interest & dividends (AIS ${fmt(aisInterest + aisDividends)}, you’ve entered ${fmt(enteredIntDiv)})`)
      if (aisCG - enteredCGraw > 1000) flags.push(`capital gains (AIS ${fmt(aisCG)}, you’ve entered ${fmt(enteredCGraw)})`)
      if (flags.length) {
        return { tone: 'attention', lines: [
          `Imported — but your entries are lower than AIS for ${human(flags)}.`,
          `Worth a look: AIS can lag your own records, or a source may be missing. Edit any “From AIS” row below to reconcile.`,
        ] }
      }
      return { tone: 'good', lines: [
        `Your AIS income is in and lines up with what’s entered.`,
        `Add anything AIS can’t see — freelance, crypto, F&O or rent — below.`,
      ] }
    }
    if (entries.length > 0) {
      return { tone: 'calm', lines: [
        `You’ve added ${fmt(totalTaxable)} taxable across ${entries.length} source${entries.length > 1 ? 's' : ''}.`,
        `Upload your AIS or 26AS on Documents and we’ll cross-check it against what the tax department already has on file.`,
      ] }
    }
    return { tone: 'calm', lines: [
      `This page is optional — if salary is your only income, you can move straight on.`,
      `Otherwise add interest, investments, trading or freelance below. Each has its own tax rule, and ArthVo applies the right one for you.`,
    ] }
  })()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <style>{OI_MOBILE_CSS}</style>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Other earnings</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Income beyond salary: freelance, investments, trading, interest. <span style={{ whiteSpace: 'nowrap' }}>(Optional — skip if salary-only)</span></p>

      {/* Guide strip — data-aware narration of this page's state (replaces the old static banner) */}
      <GuideStrip tone={guide.tone} lines={guide.lines} />

      {/* AIS prefill / reconciliation — shown when an AIS/26AS was parsed on the Documents page */}
      {aisData && aisHasIncome && (
        <div style={{ background: C.slip.fill, border: `1px solid ${C.slip.border}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: '0 0 6px' }}>Found in your AIS — interest, dividends and capital gains.</p>
          <p style={{ fontSize: 12, color: C.text, margin: '0 0 10px', lineHeight: 1.6 }}>
            <span style={{ whiteSpace: 'nowrap' }}>Interest <strong>{fmt(aisInterest)}</strong></span> · <span style={{ whiteSpace: 'nowrap' }}>Dividends <strong>{fmt(aisDividends)}</strong></span> · <span style={{ whiteSpace: 'nowrap' }}>Capital gains <strong>{fmt(aisCG)}</strong></span>
          </p>
          {hasAisImported && (
            <p style={{ fontSize: 11, color: C.green, margin: '0 0 10px', lineHeight: 1.5 }}>
              ✓ Imported into the entries below (rows marked “From AIS”). Edit any of them to adjust, or re-import to refresh from the latest AIS.
            </p>
          )}
          <button
            onClick={handleImportFromAis}
            style={{ padding: '9px 16px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {hasAisImported ? 'Re-import from AIS' : 'Import from AIS'}
          </button>
          <p style={{ fontSize: 10.5, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
            We map AIS capital gains to the right asset type (equity / debt MF / unlisted) and apply the correct rate. Review the imported rows — AIS figures can lag or differ from your records. Add freelance, crypto, F&O and rent manually below.
          </p>
        </div>
      )}

      {entries.length === 0 && !menuOpen ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 16px' }}>No other income added yet. <span style={{ whiteSpace: 'nowrap' }}>(This is optional.)</span></p>
          <button onClick={() => setMenuOpen(true)} style={{ padding: '10px 20px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add income
          </button>
        </div>
      ) : (
        <>
          {entries.map(entry => (
            <div key={entry.id} className="oi-row" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                {/* Equity has no source name (all assets in one source) — title it by type instead. */}
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.sourceName?.trim() || types.find(t => t.key === entry.type)?.label}</p>
                {entry.sourceName?.trim() && <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{types.find(t => t.key === entry.type)?.label}</p>}
              </div>
              <div className="oi-row-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px' }}>Taxable</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(getTaxablePreview(entry))}</p>
                </div>
                <button onClick={() => setOpenForm(entry)} style={{ padding: '6px 12px', background: C.wl, color: C.fg, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                <button onClick={() => handleDelete(entry.id)} style={{ padding: '6px 12px', background: T.card, color: C.danger, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
              </div>
            </div>
          ))}
          <button onClick={() => setMenuOpen(true)} style={{ width: '100%', padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 24 }}>
            + Add another
          </button>
        </>
      )}

      {menuOpen && !openForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: '0 0 14px' }}>What kind of income?</p>
          <div className="oi-types" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {types.map(t => (
              <button key={t.key} onClick={() => handleAdd(t.key)} style={{ padding: '14px', background: T.card, border: `1px solid ${C.border}`, borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.fg; (e.currentTarget as HTMLElement).style.background = C.wl }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.background = T.card }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>{t.label}</p>
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
          <div className="oi-modal" style={{ background: C.card, borderRadius: 10, padding: 24, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>{types.find(t => t.key === openForm.type)?.label}</h2>
            <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 16px', lineHeight: 1.6 }}>{types.find(t => t.key === openForm.type)?.desc}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Equity holds all assets in one consolidated source, so it needs no source name. */}
              {openForm.type !== 'equity' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Source name</label>
                  <input type="text" value={openForm.sourceName} onChange={(e) => setOpenForm({ ...openForm, sourceName: e.target.value })} placeholder="e.g. Freelance clients" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} />
                </div>
              )}

              {openForm.type === 'freelance' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Gross receipts</label>
                    <input type="text" inputMode="numeric" value={openForm.grossReceipts} onChange={(e) => setOpenForm({ ...openForm, grossReceipts: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 6, display: 'block' }}>How do you want to declare?</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                      <input type="radio" checked={openForm.declarationMethod === 'presumptive_44ada'} onChange={() => setOpenForm({ ...openForm, declarationMethod: 'presumptive_44ada' })} />
                      <div><div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Declare 50% as profit (simpler)</div><div style={{ fontSize: 10.5, color: C.muted }}>Section 44ADA · if eligible · no expense tracking</div></div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" checked={openForm.declarationMethod === 'actual'} onChange={() => setOpenForm({ ...openForm, declarationMethod: 'actual' })} />
                      <div><div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>Report actual income (minus expenses)</div><div style={{ fontSize: 10.5, color: C.muted }}>Need to track expenses</div></div>
                    </label>
                  </div>
                  {openForm.declarationMethod === 'actual' && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Expenses</label>
                      <input type="text" inputMode="numeric" value={openForm.expenses} onChange={(e) => setOpenForm({ ...openForm, expenses: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} />
                    </div>
                  )}
                </>
              )}

              {openForm.type === 'equity' && (() => {
                const rows: EquityRow[] = Array.isArray(openForm.rows) ? openForm.rows : []
                const selStyle: React.CSSProperties = { flex: 1, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }
                const numStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }
                const setRow = (i: number, patch: Partial<EquityRow>) => setOpenForm(f => f && ({ ...f, rows: (f.rows || []).map((r: EquityRow, j: number) => j === i ? { ...r, ...patch } : r) }))
                const addRow = () => setOpenForm(f => f && ({ ...f, rows: [...(f.rows || []), { asset: 'listed_equity', ltcg: 0, stcg: 0 }] }))
                const removeRow = (i: number) => setOpenForm(f => f && ({ ...f, rows: (f.rows || []).filter((_: EquityRow, j: number) => j !== i) }))
                const numVal = (n: number) => (n > 0 ? String(n) : '')
                return (
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>Capital gains by asset</label>
                    {rows.map((r, i) => (
                      <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, marginBottom: 10, background: C.bg }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <select value={r.asset} onChange={(e) => setRow(i, { asset: e.target.value })} style={selStyle}>
                            {EQUITY_ASSETS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                          </select>
                          {rows.length > 1 && (
                            <button onClick={() => removeRow(i)} title="Remove asset" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 10.5, color: C.muted, marginBottom: 3 }}>Long-term (&gt; 1 yr)</label>
                            <input type="text" inputMode="numeric" value={numVal(r.ltcg)} onChange={(e) => setRow(i, { ltcg: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={numStyle} />
                            <p style={{ fontSize: 9.5, color: C.muted, margin: '3px 0 0' }}>{ltAssetHint(r.asset)}</p>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 10.5, color: C.muted, marginBottom: 3 }}>Short-term (≤ 1 yr)</label>
                            <input type="text" inputMode="numeric" value={numVal(r.stcg)} onChange={(e) => setRow(i, { stcg: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={numStyle} />
                            <p style={{ fontSize: 9.5, color: C.muted, margin: '3px 0 0' }}>{stAssetHint(r.asset)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={addRow} style={{ width: '100%', padding: '9px', background: T.card, color: C.fg, border: `1px dashed ${C.wm}`, borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add asset</button>
                  </div>
                )
              })()}

              {openForm.type === 'crypto' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Net gains from crypto trading</label>
                    <input type="text" inputMode="numeric" value={openForm.cryptoGains} onChange={(e) => setOpenForm({ ...openForm, cryptoGains: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} />
                    <p style={{ fontSize: 10, color: C.danger, margin: '4px 0 0' }}>Taxed at 30% flat. No loss set-off allowed.</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>TDS already deducted (1% u/s 194S) — optional</label>
                    <input type="text" inputMode="numeric" value={openForm.cryptoTDS > 0 ? openForm.cryptoTDS : ''} onChange={(e) => setOpenForm({ ...openForm, cryptoTDS: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} />
                    <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>Exchanges deduct 1% of the <strong>transfer value</strong> (not gains). Copy the figure from your exchange statement — it&apos;s credited against your tax. Leave blank if unsure or if you upload your AIS/26AS.</p>
                  </div>
                </>
              )}

              {openForm.type === 'fno' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Net profit from F&O / Intraday</label>
                  <input type="text" inputMode="numeric" value={openForm.fnoNetProfit} onChange={(e) => setOpenForm({ ...openForm, fnoNetProfit: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} />
                </div>
              )}

              {openForm.type === 'interest' && (
                <>
                  <div><label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>FD interest</label><input type="text" inputMode="numeric" value={openForm.fdInterest} onChange={(e) => setOpenForm({ ...openForm, fdInterest: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} /></div>
                  <div><label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Savings account interest</label><input type="text" inputMode="numeric" value={openForm.savingsInterest} onChange={(e) => setOpenForm({ ...openForm, savingsInterest: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} /><p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>First ₹10,000 is tax-free (80TTA)</p></div>
                  <div><label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Dividends</label><input type="text" inputMode="numeric" value={openForm.dividends} onChange={(e) => setOpenForm({ ...openForm, dividends: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="₹0" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }} /></div>
                </>
              )}

              {openForm.type === 'other' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 500 }}>Amount (annual)</label>
                  <input type="text" inputMode="numeric"
                    value={openForm.otherAmount > 0 ? openForm.otherAmount : ''}
                    onChange={(e) => setOpenForm({ ...openForm, otherAmount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                    placeholder="₹0"
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: T.card, color: C.text }}
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
              <button onClick={handleSave} style={{ flex: 1, padding: '10px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/profile/exemptions')} style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Allowances →</button>
      </div>
    </div>
  )
}
