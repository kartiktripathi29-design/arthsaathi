'use client'
// Shared verdict-hero — the "File under · Refund/Balance · File form" result strip.
//
// Extracted VERBATIM from the optimizer page (/dashboard/tax/optimizer) so the landing's animated
// hero-journey final frame is the SAME component the user sees post-signup — "byte-for-byte the real
// result component" (landing brief, acceptance #1), not a mock. The optimizer renders it from the
// real computed `calc`; the landing renders it in `example` mode from the visitor's own typed salary
// (regime + saving are their real figures; the refund/TDS is a clearly-labelled worked EXAMPLE,
// because a no-data visitor genuinely has no TDS on record yet — locked "no fabricated numbers").

import { tokens as T } from '@/lib/tokens'

const fmt = (n: number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

export interface VerdictHeroProps {
  recommendation: 'new' | 'old'
  savings: number
  /** Recommended regime's tax − TDS. > 0 → still payable, < 0 → refund. */
  balance: number
  /** Recommended regime's total tax. */
  total: number
  /** Tax already paid. When 0 the refund/balance column is hidden (no TDS on record). */
  tdsPaid: number
  tdsSource: 'ais' | 'estimated' | 'slip' | 'none'
  itrForm: string
  itrReason?: string
  /** The optimizer's collapsible "what about other ITR forms?" toggle; omitted on the landing. */
  itrReference?: React.ReactNode
  /** Landing use: badge the frame + the refund column as an illustrative example. */
  example?: boolean
}

export default function VerdictHero({
  recommendation, savings, balance, total, tdsPaid, tdsSource, itrForm, itrReason, itrReference, example = false,
}: VerdictHeroProps) {
  const refund = balance < 0
  return (
    <div style={{ background: T.card, border: `2px solid ${T.teal}`, borderRadius: 10, padding: '22px 20px', marginBottom: 16, position: 'relative' as const }}>
      <span style={{ position: 'absolute' as const, top: -10, left: 16, fontSize: 10, fontWeight: 700, background: T.teal, color: T.onTeal, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.04em' }}>Recommended</span>
      {example && (
        <span style={{ position: 'absolute' as const, top: -10, right: 16, fontSize: 10, fontWeight: 700, background: T.marigold, color: T.ivory, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.04em' }}>Example</span>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 24, alignItems: 'flex-start', marginTop: 2 }}>

        {/* Recommended regime + saving vs the other regime */}
        <div style={{ flex: '1 1 200px' }}>
          <p style={{ fontSize: 11, color: T.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>File under</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: T.teal, margin: 0, lineHeight: 1.1 }}>{recommendation === 'new' ? 'New regime' : 'Old regime'}</p>
          <p style={{ fontSize: 12.5, color: T.muted, margin: '6px 0 0' }}>Saves <strong style={{ color: T.green }}>{fmt(savings)}</strong> vs the {recommendation === 'new' ? 'old' : 'new'} regime</p>
        </div>

        {/* Refund due / balance payable for the recommended regime */}
        {tdsPaid > 0 && (
          <div style={{ flex: '1 1 200px' }}>
            <p style={{ fontSize: 11, color: T.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{refund ? 'Refund due' : 'Balance payable'}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: refund ? T.green : T.teal, margin: 0, lineHeight: 1.1 }}>{fmt(Math.abs(balance))}</p>
            <p style={{ fontSize: 10, color: T.faint, margin: '3px 0 0', lineHeight: 1.4 }}>{example ? 'Example — your real figure appears once you add your slip' : tdsSource === 'ais' ? 'TDS from your AIS / 26AS' : tdsSource === 'estimated' ? 'TDS estimated' : 'TDS from your salary slips'}</p>
            <p style={{ fontSize: 11, color: T.muted, margin: '6px 0 0', lineHeight: 1.45 }}>Tax {fmt(total)} − TDS {fmt(tdsPaid)}{refund ? ' = refund due' : ' = still to pay'}</p>
          </div>
        )}

        {/* Which ITR to file */}
        <div style={{ flex: '1 1 160px' }}>
          <p style={{ fontSize: 11, color: T.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>File form</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: T.teal, margin: 0, lineHeight: 1.1 }}>{itrForm}</p>
          {itrReason && <p style={{ fontSize: 11, color: T.muted, margin: '6px 0 0', lineHeight: 1.45 }}>{itrReason}</p>}
          {itrReference && <div style={{ marginTop: 4 }}>{itrReference}</div>}
        </div>
      </div>
    </div>
  )
}
