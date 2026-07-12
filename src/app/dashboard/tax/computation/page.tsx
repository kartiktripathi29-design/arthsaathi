'use client'
// CA-ready "Computation of Income" statement. Renders from the full snapshot the Your Tax page
// persists (av_tax_computation), so the numbers match Your Tax exactly without re-deriving anything.
// Print-friendly (matches the Form-12B pattern): a print button saves it as a clean PDF; chrome is
// hidden in print. Display only — no computation here.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { tokens as T } from '@/lib/tokens'
import { getStoredIdentity, maskPan } from '@/lib/identity'
import { useSelectedFY } from '@/lib/useSelectedFY'

const C = { fg: T.teal, bg: T.paper, card: T.card, border: T.hairline, ink: T.ink, muted: T.muted, green: T.green, sand: T.sand, wheat: T.taupe, danger: T.danger.text }
const fmt = (n: number) => `₹${Math.abs(Math.round(n || 0)).toLocaleString('en-IN')}`
const signed = (n: number) => `${n < 0 ? '−' : ''}${fmt(n)}`

const cellL: React.CSSProperties = { padding: '5px 8px', borderBottom: `1px solid ${C.border}`, color: C.ink }
const cellR: React.CSSProperties = { ...cellL, textAlign: 'right' }
const thL: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.fg, borderBottom: `2px solid ${C.fg}`, textTransform: 'uppercase', letterSpacing: '0.04em' }
const thR: React.CSSProperties = { ...thL, textAlign: 'right' }

// Itemised label/amount table with a total row — used in the Detailed form.
function DetailTable({ title, items, total }: { title: string; items: [string, number][]; total: number }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 16 }}>
      <thead><tr><th style={thL}>{title}</th><th style={thR}>Amount</th></tr></thead>
      <tbody>
        {items.map(([k, v]) => <tr key={k}><td style={cellL}>{k}</td><td style={cellR}>{fmt(v)}</td></tr>)}
        <tr><td style={{ ...cellL, fontWeight: 700 }}>Total</td><td style={{ ...cellR, fontWeight: 700 }}>{fmt(total)}</td></tr>
      </tbody>
    </table>
  )
}

// Slab-by-slab tax table for one regime — used in the Detailed form.
function SlabTable({ title, brk }: { title: string; brk: any }) {
  const rows: any[] = Array.isArray(brk?.rows) ? brk.rows : []
  if (rows.length === 0) return null
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
      <thead><tr><th style={thL}>{title}</th><th style={thR}>Rate</th><th style={thR}>Amount in slab</th><th style={thR}>Tax</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ ...cellL, color: r.tax > 0 ? C.ink : C.muted }}>{r.label}</td>
            <td style={{ ...cellR, color: r.tax > 0 ? C.ink : C.muted }}>{Math.round((r.rate || 0) * 100)}%</td>
            <td style={{ ...cellR, color: r.tax > 0 ? C.ink : C.muted }}>{fmt(r.inSlab)}</td>
            <td style={{ ...cellR, fontWeight: r.tax > 0 ? 600 : 400, color: r.tax > 0 ? C.ink : C.muted }}>{fmt(r.tax)}</td>
          </tr>
        ))}
        <tr><td colSpan={3} style={{ ...cellR, fontWeight: 600 }}>Basic tax</td><td style={{ ...cellR, fontWeight: 600 }}>{fmt(brk.basicTax)}</td></tr>
        {brk.rebate > 0 && <tr><td colSpan={3} style={cellR}>Less: 87A rebate</td><td style={cellR}>{signed(-brk.rebate)}</td></tr>}
        {brk.surcharge > 0 && <tr><td colSpan={3} style={cellR}>Add: Surcharge</td><td style={cellR}>{fmt(brk.surcharge)}</td></tr>}
        <tr><td colSpan={3} style={cellR}>Add: Health &amp; education cess (4%)</td><td style={cellR}>{fmt(brk.cess)}</td></tr>
        <tr><td colSpan={3} style={{ ...cellR, fontWeight: 700 }}>Tax on slab income</td><td style={{ ...cellR, fontWeight: 700 }}>{fmt(brk.total)}</td></tr>
      </tbody>
    </table>
  )
}

export default function ComputationPage() {
  const router = useRouter()
  const [c, setC] = useState<any>(null)
  const [who, setWho] = useState<{ name: string; pan: string } | null>(null)
  const [view, setView] = useState<'loading' | 'no-data' | 'ready'>('loading')
  const [mode, setMode] = useState<'summary' | 'detailed'>('summary')
  const selFY = useSelectedFY()
  // FY/AY come from the snapshot the optimizer computed on (fallback: the live resolver) — never a
  // hardcoded year.
  const fyText = c?.fyLabel || selFY?.label || ''
  const ayText = c?.ayLabel || selFY?.ayLabel || ''

  useEffect(() => {
    let snap: any = null
    try { snap = JSON.parse(localStorage.getItem('av_tax_computation') || 'null') } catch {}
    if (!snap || typeof snap.newTotal !== 'number') { setView('no-data'); return }
    setC(snap)
    const id = getStoredIdentity()
    if (id) setWho({ name: id.employeeName || '', pan: maskPan(id.pan) || '' })
    setView('ready')
  }, [])

  if (view === 'loading') return null
  if (view === 'no-data') {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: C.ink, fontWeight: 600, margin: '0 0 6px' }}>No computation yet.</p>
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Open <strong>Your Tax</strong> once to compute your numbers — then come back to download the statement.</p>
        <button onClick={() => router.push('/dashboard/tax/optimizer')} style={{ padding: '12px 24px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Go to Your Tax →</button>
      </div>
    )
  }

  const rec = c.recommendation === 'new'
  const refund = c.tdsPaid > 0 && (rec ? c.newBalance : c.oldBalance) < 0
  const date = c.computedAt ? new Date(c.computedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  // Two-column (New | Old) money row.
  const Row2 = ({ label, nv, ov, strong, indent }: { label: string; nv: string; ov: string; strong?: boolean; indent?: boolean }) => (
    <tr>
      <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, color: C.ink, fontWeight: strong ? 700 : 400, paddingLeft: indent ? 22 : 8 }}>{label}</td>
      <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: C.ink, fontWeight: strong ? 700 : 500, background: rec ? '#F0F7F4' : undefined }}>{nv}</td>
      <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: C.ink, fontWeight: strong ? 700 : 500, background: !rec ? '#F0F7F4' : undefined }}>{ov}</td>
    </tr>
  )
  const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: C.fg, borderBottom: `2px solid ${C.fg}`, textTransform: 'uppercase', letterSpacing: '0.04em' }

  const sp = c.specialIncome || {}
  const cgRows = [
    { label: 'Equity LTCG (>1yr, after ₹1.25L exemption)', gains: sp.ltcg, taxable: sp.ltcgTaxable, rate: '12.5%', tax: Math.round((sp.ltcgTaxable || 0) * 0.125) },
    { label: 'Unlisted-share LTCG', gains: sp.ltcgUnlisted, taxable: sp.ltcgUnlisted, rate: '12.5%', tax: Math.round((sp.ltcgUnlisted || 0) * 0.125) },
    { label: 'Equity STCG (≤1yr)', gains: sp.stcg, taxable: sp.stcg, rate: '20%', tax: Math.round((sp.stcg || 0) * 0.20) },
    { label: 'Crypto / VDA', gains: sp.crypto, taxable: sp.crypto, rate: '30%', tax: Math.round((sp.crypto || 0) * 0.30) },
  ].filter(r => (r.gains || 0) > 0)

  const exemptItems = [
    ['HRA', c.exemptBreakdown?.hra], ['LTA', c.exemptBreakdown?.lta], ['Driver salary', c.exemptBreakdown?.driver],
    ['Car maintenance', c.exemptBreakdown?.car], ['Daily allowance', c.exemptBreakdown?.daily], ['Superannuation', c.exemptBreakdown?.superannuation],
    ['PF withdrawal', c.exemptBreakdown?.pfWithdrawal], ['Gratuity', c.exemptBreakdown?.gratuity], ['Medical', c.exemptBreakdown?.medical], ['Other', c.exemptBreakdown?.other],
  ].filter(([, v]) => (v as number) > 0) as [string, number][]
  const dedItems = [
    ['80C', c.sec80C], ['80D', c.sec80D], ['24(b) home-loan interest', c.sec24b], ['80CCD(1B) NPS', c.nps],
    ['80TTA', c.sec80TTA], ['80TTB', c.sec80TTB], ['80E', c.sec80E], ['80G', c.sec80G],
  ].filter(([, v]) => (v as number) > 0) as [string, number][]
  const sb = c.slabBreakdown || {}
  const otherItems = [
    ['Freelance / consulting', sb.freelance], ['F&O / intraday', sb.fno], ['Interest & dividends', sb.interest],
    ['Debt funds / unlisted STCG', sb.cgSlab], ['Other income', sb.other],
  ].filter(([, v]) => (v as number) > 0) as [string, number][]

  const copyText = () => {
    const L: string[] = []
    L.push(`COMPUTATION OF INCOME — ${fyText} (${ayText})`)
    if (who?.name) L.push(`Assessee: ${who.name}${who.pan ? ` · PAN ${who.pan}` : ''}`)
    L.push(`Recommended regime: ${rec ? 'New' : 'Old'} (saves ${fmt(c.savings)})`)
    L.push('')
    L.push(`Gross salary: ${fmt(c.grossSalary)}`)
    L.push(`Other income (slab): ${fmt(c.slabOtherIncome)}`)
    L.push(`Standard deduction: ${fmt(rec ? c.stdDedNew : c.stdDedOld)}`)
    if (!rec) { L.push(`Exemptions u/s 10: ${fmt(c.totalExemptions)}`); L.push(`Chapter VI-A deductions: ${fmt(c.totalDeductions)}`) }
    L.push(`Taxable income: ${fmt(rec ? c.taxableNew : c.taxableOld)}`)
    if (sp.total > 0) L.push(`Capital gains / crypto (special rate): ${fmt(sp.total)} → tax ${fmt(c.specialTaxTotal)}`)
    L.push(`Total tax: ${fmt(rec ? c.newTotal : c.oldTotal)} (New ${fmt(c.newTotal)} · Old ${fmt(c.oldTotal)})`)
    L.push(`TDS already deducted: ${fmt(c.tdsPaid)}`)
    L.push(`${refund ? 'Refund due' : 'Balance payable'}: ${fmt(Math.abs(rec ? c.newBalance : c.oldBalance))}`)
    L.push(`Suggested ITR form: ${c.itrForm}`)
    L.push('')
    L.push('Computed by ArthVo — please verify before filing.')
    navigator.clipboard?.writeText(L.join('\n')).then(() => toast.success('Computation copied — paste it into an email to your CA.')).catch(() => toast.error('Couldn’t copy'))
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '12px 0' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } .comp-doc { box-shadow: none !important; border: none !important; } }`}</style>

      {/* Toolbar — hidden in print */}
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => router.back()} style={{ padding: '8px 14px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <div style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          {(['summary', 'detailed'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ padding: '8px 14px', background: mode === m ? C.fg : 'transparent', color: mode === m ? T.onTeal : C.fg, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{m === 'summary' ? 'Summary' : 'Detailed form'}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={copyText} style={{ padding: '8px 14px', background: 'transparent', color: C.fg, border: `1px solid ${C.fg}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Copy as text</button>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Print / Save PDF</button>
      </div>

      {/* Document */}
      <div className="comp-doc" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ textAlign: 'center', borderBottom: `2px solid ${C.fg}`, paddingBottom: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.fg, margin: '0 0 2px' }}>Computation of Total Income &amp; Tax</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{fyText} · {ayText} · {mode === 'summary' ? 'Summary' : 'Detailed form'}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12, color: C.ink, marginBottom: 16 }}>
          <div><strong>Assessee:</strong> {who?.name || '____________________'}{who?.pan ? <> · <strong>PAN:</strong> {who.pan}</> : null}</div>
          <div style={{ color: C.muted }}>Recommended: <strong style={{ color: C.green }}>{rec ? 'New' : 'Old'} regime</strong> (saves {fmt(c.savings)})</div>
        </div>

        {/* Statement of income */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 6 }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Statement of income</th><th style={th}>New regime</th><th style={th}>Old regime</th></tr></thead>
          <tbody>
            <Row2 label="Gross salary" nv={fmt(c.grossSalary)} ov={fmt(c.grossSalary)} />
            <Row2 label="Add: Other income (slab-taxed)" nv={fmt(c.slabOtherIncome)} ov={fmt(c.slabOtherIncome)} />
            <Row2 label="Less: Standard deduction" nv={signed(-c.stdDedNew)} ov={signed(-c.stdDedOld)} />
            <Row2 label="Less: Exemptions u/s 10 (HRA, LTA, etc.)" nv="— (not allowed)" ov={signed(-c.totalExemptions)} />
            <Row2 label="Less: Chapter VI-A deductions" nv="— (not allowed)" ov={signed(-c.totalDeductions)} />
            <Row2 label="Taxable income" nv={fmt(c.taxableNew)} ov={fmt(c.taxableOld)} strong />
          </tbody>
        </table>
        {/* Summary: compact one-line itemisation. Detailed: full tables. */}
        {mode === 'summary' && (exemptItems.length > 0 || dedItems.length > 0) && (
          <p style={{ fontSize: 10.5, color: C.muted, margin: '0 0 16px', lineHeight: 1.6 }}>
            {exemptItems.length > 0 && <><strong>Exemptions u/s 10 (old regime):</strong> {exemptItems.map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}. </>}
            {dedItems.length > 0 && <><strong>Chapter VI-A (old regime):</strong> {dedItems.map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}.</>}
          </p>
        )}
        {mode === 'detailed' && <div style={{ marginBottom: 4 }} />}
        {mode === 'detailed' && otherItems.length > 0 && <DetailTable title="Other income — by source (slab)" items={otherItems} total={c.slabOtherIncome} />}
        {mode === 'detailed' && exemptItems.length > 0 && <DetailTable title="Exemptions u/s 10 (old regime)" items={exemptItems} total={c.totalExemptions} />}
        {mode === 'detailed' && dedItems.length > 0 && <DetailTable title="Chapter VI-A deductions (old regime)" items={dedItems} total={c.totalDeductions} />}

        {/* Capital gains / crypto — detailed only (summary shows the single tax line below) */}
        {mode === 'detailed' && cgRows.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 16 }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Capital gains &amp; crypto (special rate · both regimes)</th><th style={th}>Gains</th><th style={th}>Rate</th><th style={th}>Tax</th></tr></thead>
              <tbody>
                {cgRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, color: C.ink }}>{r.label}</td>
                    <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right' }}>{fmt(r.gains)}</td>
                    <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right' }}>{r.rate}</td>
                    <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', fontWeight: 600 }}>{fmt(r.tax)}</td>
                  </tr>
                ))}
                <tr><td colSpan={3} style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: C.ink }}>Special-rate tax + 4% cess</td><td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(c.specialTaxTotal)}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {/* Tax computation */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 16 }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Tax computation</th><th style={th}>New regime</th><th style={th}>Old regime</th></tr></thead>
          <tbody>
            <Row2 label="Tax on slab income (incl. surcharge, after 87A rebate)" nv={fmt(c.newBreak.basicTax - (c.newBreak.rebate || 0) + (c.newBreak.surcharge || 0))} ov={fmt(c.oldBreak.basicTax - (c.oldBreak.rebate || 0) + (c.oldBreak.surcharge || 0))} />
            <Row2 label="Add: Health & education cess (4%)" nv={fmt(c.newBreak.cess)} ov={fmt(c.oldBreak.cess)} />
            {c.specialTaxTotal > 0 && <Row2 label="Add: Capital-gains / crypto tax (incl. cess)" nv={fmt(c.specialTaxTotal)} ov={fmt(c.specialTaxTotal)} />}
            <Row2 label="Total tax" nv={fmt(c.newTotal)} ov={fmt(c.oldTotal)} strong />
            <Row2 label="Less: TDS already deducted" nv={signed(-c.tdsPaid)} ov={signed(-c.tdsPaid)} />
            <Row2 label="Balance payable / (refund)" strong
              nv={c.newBalance < 0 ? `${fmt(c.newBalance)} (refund)` : fmt(c.newBalance)}
              ov={c.oldBalance < 0 ? `${fmt(c.oldBalance)} (refund)` : fmt(c.oldBalance)} />
          </tbody>
        </table>

        {/* Slab-by-slab tax — detailed form only */}
        {mode === 'detailed' && (
          <>
            <SlabTable title="Slab-wise tax — New regime" brk={c.newBreak} />
            <SlabTable title="Slab-wise tax — Old regime" brk={c.oldBreak} />
          </>
        )}

        <div style={{ padding: '10px 12px', background: C.sand, borderRadius: 6, marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: C.ink, margin: 0 }}>
            <strong>Suggested ITR form: {c.itrForm}.</strong> {(c.itrReasons || []).slice(0, 2).join(' ')}
          </p>
        </div>

        <p style={{ fontSize: 10, color: C.muted, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
          Prepared from the data you entered in ArthVo{date ? ` on ${date}` : ''}. This is an estimate to ease your CA's work — please verify all figures and supporting proofs before filing. ArthVo is not a substitute for professional advice.
        </p>
      </div>
    </div>
  )
}
