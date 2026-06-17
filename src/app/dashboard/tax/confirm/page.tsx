'use client'
// PROTOTYPE (Phase 2) — "Here's what we read". The trust step that sits between parsing a slip and
// the provisional verdict: show the figures we extracted, let the user fix any of them inline, and
// flag anything we couldn't read — so people aren't handing the most sensitive document they own to
// OCR with no chance to check it. On confirm it writes the agreed numbers and continues to /start.
//
// In production the upload handler routes here right after parse-salary returns. For the prototype it
// reads the latest slip from av_salary_timeline; editing writes the confirmed figures back to the
// timeline + summary so the downstream verdict uses exactly what the user signed off on.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { tokens as T } from '@/lib/tokens'

const fmt = (v: number) => `₹${Math.abs(Math.round(v || 0)).toLocaleString('en-IN')}`
const num = (s: string) => Math.max(0, parseFloat((s || '').replace(/,/g, '')) || 0)

function latestSlip(): any | null {
  try {
    const parsed = JSON.parse(localStorage.getItem('av_salary_timeline') || 'null')
    const slips = Array.isArray(parsed) ? parsed : parsed?.employments?.[0]?.slips || []
    return slips.length ? slips[slips.length - 1] : null
  } catch { return null }
}

// The fields we surface for confirmation. `critical` ones, if missing, block trust (we say so);
// the rest can legitimately be ₹0 (no HRA, no TDS this month), so a 0 isn't flagged as an error.
const FIELDS: { key: string; label: string; group: 'earn' | 'ded'; critical?: boolean }[] = [
  { key: 'basicSalary', label: 'Basic', group: 'earn', critical: true },
  { key: 'hra', label: 'House rent allowance', group: 'earn' },
  { key: 'specialAllowance', label: 'Special allowance', group: 'earn' },
  { key: 'otherAllowances', label: 'Other allowances', group: 'earn' },
  { key: 'grossSalary', label: 'Gross (monthly)', group: 'earn', critical: true },
  { key: 'employeePF', label: 'Employee PF', group: 'ded' },
  { key: 'professionalTax', label: 'Professional tax', group: 'ded' },
  { key: 'tdsDeducted', label: 'TDS this month', group: 'ded' },
  { key: 'netSalary', label: 'Net (take-home)', group: 'ded', critical: true },
]

export default function ConfirmSlipPage() {
  const router = useRouter()
  const [slip, setSlip] = useState<any | null | undefined>(undefined)
  const [vals, setVals] = useState<Record<string, string>>({})

  useEffect(() => {
    const s = latestSlip()
    setSlip(s)
    if (s) {
      const init: Record<string, string> = {}
      for (const f of FIELDS) init[f.key] = s[f.key] ? String(Math.round(s[f.key])) : ''
      setVals(init)
    }
  }, [])

  // A field is "unread" when it's a critical field that came back empty — the only thing we honestly
  // flag (no fabricated confidence %). Non-critical blanks are just left for the user to fill if they apply.
  const unread = useMemo(() => FIELDS.filter(f => f.critical && num(vals[f.key]) === 0).map(f => f.label), [vals])
  const readCount = FIELDS.filter(f => num(vals[f.key]) > 0).length

  if (slip === undefined) return null
  if (slip === null) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: 40, fontFamily: '"Sora",sans-serif' }}>
        <p style={{ fontSize: 14, color: T.muted }}>No slip to confirm yet — upload one first.</p>
        <Link href="/dashboard/profile/documents" style={{ display: 'inline-block', marginTop: 16, padding: '10px 20px', background: T.teal, color: T.onTeal, borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Add your slip →</Link>
      </div>
    )
  }

  const confirm = () => {
    const get = (k: string) => num(vals[k])
    const gross = get('grossSalary'), net = get('netSalary'), basic = get('basicSalary'), hra = get('hra'), pf = get('employeePF'), tds = get('tdsDeducted')
    const confirmed = { ...slip }
    for (const f of FIELDS) confirmed[f.key] = get(f.key)
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    try {
      localStorage.setItem('av_salary_timeline', JSON.stringify([confirmed]))
      // ×12 projection from the one confirmed slip — same model the app uses for a single upload.
      localStorage.setItem('av_salary_summary', JSON.stringify({
        annualGross: gross * 12, annualNet: net * 12, annualTDS: tds * 12, fyStartYear,
        hraBasis: Array.from({ length: 12 }, () => ({ basic, hra })),
      }))
    } catch {}
    router.push('/dashboard/tax/start')
  }

  const fieldRow = (f: typeof FIELDS[number]) => {
    const isUnread = !!f.critical && num(vals[f.key]) === 0
    const strong = f.key === 'grossSalary' || f.key === 'netSalary'
    return (
      <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${T.hairline}` }}>
        <span style={{ fontSize: strong ? 13.5 : 12.5, fontWeight: strong ? 700 : 500, color: T.ink }}>
          {f.label}
          {isUnread && <span style={{ fontSize: 10, color: T.marigold, fontWeight: 700, marginLeft: 8 }}>couldn’t read — add</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${isUnread ? T.marigold : T.hairline}`, borderRadius: 8, overflow: 'hidden', background: T.card, width: 150 }}>
          <span style={{ padding: '7px 8px', fontSize: 12, color: T.teal, fontWeight: 700, borderRight: `1px solid ${T.hairline}` }}>₹</span>
          <input type="tel" inputMode="numeric" value={vals[f.key] || ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
            placeholder="—" style={{ flex: 1, width: '100%', padding: '7px 8px', border: 'none', outline: 'none', fontSize: strong ? 14 : 13, fontWeight: strong ? 700 : 500, fontFamily: '"Sora",sans-serif', background: 'transparent', color: T.ink, textAlign: 'right' }} />
        </div>
      </div>
    )
  }

  const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 12, padding: 18, marginBottom: 16 }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Here’s what we read</h1>
      <p style={{ fontSize: 13, color: T.muted, margin: '0 0 16px' }}>
        From your {slip.month ? `${slip.month} ${slip.year || ''}` : 'salary'} slip{slip.employerName ? ` · ${slip.employerName}` : ''}. Fix anything that’s off — these numbers drive your answer.
      </p>

      {/* Honest read signal — no fabricated % */}
      <div style={{ ...card, padding: '12px 16px', marginBottom: 16, background: unread.length ? T.caution.fill : T.tint, borderColor: unread.length ? T.marigold : T.hairline }}>
        <p style={{ fontSize: 12.5, color: unread.length ? T.caution.text : T.teal, fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
          {unread.length
            ? `We read ${readCount} figures, but couldn’t make out ${unread.join(' and ')}. Add ${unread.length > 1 ? 'them' : 'it'} below so your answer is right.`
            : `We read ${readCount} figures off your slip. Give them a quick glance and fix anything that looks wrong.`}
        </p>
      </div>

      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Earnings</div>
        {FIELDS.filter(f => f.group === 'earn').map(fieldRow)}
      </div>
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Deductions &amp; take-home</div>
        {FIELDS.filter(f => f.group === 'ded').map(fieldRow)}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
        <Link href="/dashboard/profile/documents" style={{ padding: '12px 18px', background: 'transparent', color: T.teal, border: `1px solid ${T.hairline}`, borderRadius: 9, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Re-upload slip</Link>
        <button onClick={confirm} style={{ padding: '12px 24px', background: T.teal, color: T.onTeal, border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Looks right → see my tax</button>
      </div>
      <p style={{ fontSize: 11, color: T.muted, fontStyle: 'italic', margin: '12px 0 0', textAlign: 'center' }}>🔒 Your slip stays on your device. We only keep the figures you confirm here.</p>
    </div>
  )
}
