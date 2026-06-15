'use client'
import { useEffect, useRef, useState } from 'react'
import { passwordDialog } from '@/components/Dialog'
import { tokens as T } from '@/lib/tokens'
import type { SavingsResult, SeniorStatus } from '@/lib/tax-history'

const C = { fg: T.teal, bg: T.paper, card: T.card, border: T.hairline, text: T.ink, muted: T.muted, faint: T.faint, green: T.green, ivory: T.ivory, onTeal: T.onTeal, tint: T.tint, marigold: T.marigold, caution: T.caution, danger: '#B94040' }
const fmt = (n: number) => (n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`)
const regimeLabel = (r: 'old' | 'new') => (r === 'old' ? 'Old regime' : 'New regime')

// One parsed return as returned by /api/parse-itr (the shape the route's `data` carries).
interface ParsedReturn {
  fy: string
  ay: string
  fySupported: boolean
  documentType: string
  itrForm: string
  filedRegime: 'old' | 'new'
  regimeSource?: 'document' | 'reported_tax'
  components: { grossSalary: number; exemptAllowances?: number; otherSlabIncome?: number; chapterVIA?: number; isSalaried?: boolean }
  reported: { grossTotalIncome: number; totalIncome: number; totalTax: number; refundOrPayable: number }
  missing: string[]
  canComputeSavings: boolean
  savings: SavingsResult | null
  notes: string
}

const STORAGE_KEY = 'av_past_years'

const MOBILE_CSS = `
@media (max-width: 767px) {
  .py-twocol { grid-template-columns: 1fr !important; }
}
`

export default function PastYearsPage() {
  const [results, setResults] = useState<ParsedReturn[]>([])
  const [seniorStatus, setSeniorStatus] = useState<SeniorStatus>('normal')
  const [status, setStatus] = useState<{ state: 'idle' | 'reading' | 'error'; msg?: string }>({ state: 'idle' })
  const fileRef = useRef<HTMLInputElement>(null)

  // Restore previously-read years (deduped by FY) so a session's worth of uploads persists.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const arr = JSON.parse(stored)
        if (Array.isArray(arr)) setResults(arr)
      }
      const senior = localStorage.getItem('av_user_senior') as SeniorStatus | null
      if (senior === 'senior' || senior === 'super_senior' || senior === 'normal') setSeniorStatus(senior)
    } catch {}
  }, [])

  const persist = (next: ParsedReturn[]) => {
    setResults(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(((reader.result as string) || '').split(',')[1])
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
      reader.readAsDataURL(file)
    })

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string) || '')
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
      reader.readAsText(file)
    })

  // Upsert by FY so re-reading the same year replaces (rather than duplicates) its card. Newest first.
  const upsert = (r: ParsedReturn) => {
    const key = r.fy || r.ay || r.documentType
    const without = results.filter(x => (x.fy || x.ay || x.documentType) !== key)
    persist([r, ...without])
  }

  const handleFile = async (file: File) => {
    setStatus({ state: 'reading' })
    try {
      const isJson = file.type === 'application/json' || /\.json$/i.test(file.name)
      const body: Record<string, unknown> = { seniorStatus }
      if (isJson) {
        body.jsonText = await readFileAsText(file)
      } else {
        body.base64Data = await readFileAsBase64(file)
        body.mediaType = file.type || 'application/pdf'
      }

      const call = (password?: string) =>
        fetch('/api/parse-itr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(password ? { ...body, password } : body),
        })

      let res = await call()
      if (res.status === 422) {
        const j = await res.json().catch(() => ({} as { error?: string }))
        if (j?.error === 'incorrect_password') {
          const pwd = await passwordDialog({
            title: 'Password-protected return',
            message: `"${file.name}" is password-protected. ITR-V acknowledgements usually open with your PAN in lowercase + date of birth as DDMMYYYY (e.g. abcde1234f01011990). Enter it to read the return, or cancel to skip.`,
            confirmLabel: 'Unlock',
            placeholder: 'Document password',
          })
          if (!pwd) { setStatus({ state: 'idle' }); return }
          res = await call(pwd)
        }
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }))
        const msg = j?.error === 'pdf_unreadable'
          ? 'This looks like a scanned PDF we couldn’t open to read. Try the filed ITR JSON, or a clearer scan.'
          : 'Couldn’t read this return. Try the filed ITR JSON or the full ITR PDF instead of the acknowledgement.'
        setStatus({ state: 'error', msg })
        return
      }
      const j = await res.json().catch(() => null)
      if (!j?.data) { setStatus({ state: 'error', msg: 'Couldn’t read this return.' }); return }
      upsert(j.data as ParsedReturn)
      setStatus({ state: 'idle' })
    } catch (e) {
      setStatus({ state: 'error', msg: e instanceof Error ? e.message : 'Couldn’t read this return.' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <style>{MOBILE_CSS}</style>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Past years</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px', lineHeight: 1.55 }}>
        Upload a return you’ve already filed and see how the other tax regime would have landed that year —
        worked out on that year’s actual rules. We support FY 2020-21 onward.
      </p>

      {/* Upload zone */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 320px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Add a filed return</p>
            <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
              Best: the <strong>filed ITR JSON</strong> or the <strong>full ITR PDF</strong> — both carry your gross salary,
              so the saving is exact. An <strong>ITR-V acknowledgement</strong> works too, but it only holds totals
              (see the note that appears with it).
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={status.state === 'reading'}
              style={{
                padding: '10px 18px', background: status.state === 'reading' ? C.border : C.fg,
                color: C.onTeal, border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: status.state === 'reading' ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {status.state === 'reading' ? 'Reading…' : 'Choose ITR file'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.json,application/pdf,application/json"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {/* Senior status — old-regime slabs depend on it; defaults to the value the optimizer stores. */}
          <div style={{ flex: '0 1 220px' }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Your age band</label>
            <select
              value={seniorStatus}
              onChange={e => setSeniorStatus(e.target.value as SeniorStatus)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: 'inherit' }}
            >
              <option value="normal">Under 60</option>
              <option value="senior">Senior (60–79)</option>
              <option value="super_senior">Super senior (80+)</option>
            </select>
          </div>
        </div>
        {status.state === 'error' && (
          <p style={{ fontSize: 12, color: C.danger, margin: '12px 0 0', lineHeight: 1.5 }}>{status.msg}</p>
        )}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: C.muted, fontSize: 12.5 }}>
          No returns read yet. Add one above to see the regime comparison for that year.
        </div>
      ) : (
        results.map((r, i) => <ResultCard key={(r.fy || r.ay || '') + i} r={r} onRemove={() => persist(results.filter((_, j) => j !== i))} />)
      )}

      <p style={{ fontSize: 10.5, color: C.faint, margin: '20px 0 0', lineHeight: 1.6 }}>
        This is a clarity tool, not advice. It shows what a different regime choice would have cost or saved that year,
        on that year’s rules — a return you’ve already filed usually can’t be changed now. Figures are recomputed from
        the income your return reports; special-rate capital gains are taxed the same in either regime and are left out
        of the comparison.
      </p>
    </div>
  )
}

function ResultCard({ r, onRemove }: { r: ParsedReturn; onRemove: () => void }) {
  const docLabel = r.documentType === 'itr_v_acknowledgement' ? 'ITR-V acknowledgement'
    : r.documentType === 'full_itr' ? 'Full ITR'
    : r.documentType === 'itr_json' ? 'Filed ITR JSON'
    : 'Return'

  // A real assessment/financial year carries a 4-digit year; the model's "unknown" (or any junk)
  // must NOT render as a literal title or get folded into the "pre-2020 regime" copy below.
  const hasYear = (s?: string) => !!s && /\d{4}/.test(s)
  const yearLabel = hasYear(r.ay) ? r.ay : hasYear(r.fy) ? r.fy : 'Return'
  const yearKnown = /FY \d{4}-\d{2}/.test(r.fy || '')

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: 0 }}>{yearLabel}</h3>
          <p style={{ fontSize: 11, color: C.muted, margin: '3px 0 0' }}>
            {docLabel}{r.itrForm && r.itrForm !== 'unknown' ? ` · ${r.itrForm}` : ''} · filed under {regimeLabel(r.filedRegime).toLowerCase()}
          </p>
        </div>
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', flexShrink: 0 }}>Remove</button>
      </div>

      {/* Case 0 — we couldn't read which year this return is for. Distinct from a genuine pre-2020
           year: don't claim anything about the regime, just ask for a clearer source. */}
      {!yearKnown ? (
        <div style={{ padding: 14, background: C.caution.fill, border: `1px solid ${C.caution.border}`, borderRadius: 6 }}>
          <p style={{ fontSize: 12.5, color: C.caution.text, margin: 0, lineHeight: 1.55 }}>
            We couldn’t read which year this {docLabel.toLowerCase()} is for. Upload the <strong>filed ITR JSON</strong> or
            the <strong>full ITR PDF</strong> — the assessment year is sometimes missing from a scanned or partial acknowledgement.
          </p>
        </div>
      ) : !r.fySupported ? (
        /* Case 1 — a known year, but before the new regime existed (nothing to compare against). */
        <div style={{ padding: 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <p style={{ fontSize: 12.5, color: C.text, margin: 0, lineHeight: 1.55 }}>
            {yearLabel} is before the new tax regime existed (it began FY 2020-21), so there’s no second regime to compare against.
          </p>
        </div>
      ) : !r.canComputeSavings ? (
        /* Case 2 — approach (a): totals-only source, no gross salary. Show what we read, nudge to a richer upload. NEVER fabricate the saving. */
        <div>
          <div style={{ padding: 14, background: C.caution.fill, border: `1px solid ${C.caution.border}`, borderRadius: 6, marginBottom: 12 }}>
            <p style={{ fontSize: 12.5, color: C.caution.text, margin: 0, lineHeight: 1.55 }}>
              This {docLabel.toLowerCase()} carries only totals — not your gross salary — so we can’t recompute the other
              regime exactly without guessing. Upload your <strong>full ITR PDF</strong> or the <strong>filed ITR JSON</strong>
              for the precise “could have saved” figure.
            </p>
          </div>
          <ReportedRows reported={r.reported} />
        </div>
      ) : r.savings ? (
        /* Case 3 — full comparison */
        <SavingsView r={r} s={r.savings} />
      ) : null}
    </div>
  )
}

function SavingsView({ r, s }: { r: ParsedReturn; s: SavingsResult }) {
  const optimal = s.filedOptimalRegime
  const otherRegime = s.filedRegime === 'old' ? 'new' : 'old'

  return (
    <>
      {/* Headline */}
      <div style={{ padding: '16px 18px', background: optimal ? C.tint : C.bg, border: `2px solid ${optimal ? C.green : C.fg}`, borderRadius: 8, marginBottom: 14 }}>
        {optimal ? (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.green, margin: 0 }}>You filed under the cheaper regime.</p>
            <p style={{ fontSize: 12, color: C.muted, margin: '5px 0 0', lineHeight: 1.5 }}>
              The {regimeLabel(otherRegime).toLowerCase()} would have cost {fmt(s.alternate.totalTax - s.asFiled.totalTax)} more that year — nothing was left on the table.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Could have saved</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: C.fg, margin: 0, lineHeight: 1.1 }}>{fmt(s.regimeSwitchSaving)}</p>
            <p style={{ fontSize: 12.5, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
              by filing under the <strong>{regimeLabel(s.cheaperRegime).toLowerCase()}</strong> instead of the {regimeLabel(s.filedRegime).toLowerCase()} you used.
            </p>
          </>
        )}
      </div>

      {/* Side-by-side regimes */}
      <div className="py-twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <RegimeCard title="As you filed" regime={s.filedRegime} taxable={s.asFiled.taxableIncome} tax={s.asFiled.totalTax} cheaper={s.cheaperRegime === s.filedRegime} />
        <RegimeCard title="The other regime" regime={otherRegime} taxable={s.alternate.taxableIncome} tax={s.alternate.totalTax} cheaper={s.cheaperRegime === otherRegime} />
      </div>

      {/* Reconciliation against what the return actually reports */}
      {r.reported.totalTax > 0 && (() => {
        const diff = Math.abs(r.reported.totalTax - s.asFiled.totalTax)
        const off = diff > Math.max(2000, r.reported.totalTax * 0.02)
        return (
          <p style={{ fontSize: 11, color: C.faint, margin: '0 0 2px', lineHeight: 1.55 }}>
            We recompute your filed tax as {fmt(s.asFiled.totalTax)}; the return reports {fmt(r.reported.totalTax)}.
            {off ? ' The gap is usually special-rate capital gains or reliefs we don’t model — treat the saving as indicative.' : ' These line up.'}
            {r.regimeSource === 'reported_tax' && ` We read the filed regime as ${regimeLabel(s.filedRegime).toLowerCase()} from the tax on your return.`}
          </p>
        )
      })()}
    </>
  )
}

function RegimeCard({ title, regime, taxable, tax, cheaper }: { title: string; regime: 'old' | 'new'; taxable: number; tax: number; cheaper: boolean }) {
  return (
    <div style={{ border: `2px solid ${cheaper ? C.fg : C.border}`, borderRadius: 8, padding: 14, position: 'relative', background: C.bg }}>
      {cheaper && (
        <span style={{ position: 'absolute', top: -10, left: 12, fontSize: 9.5, fontWeight: 700, background: C.fg, color: C.onTeal, padding: '3px 9px', borderRadius: 20, letterSpacing: '0.04em' }}>Cheaper</span>
      )}
      <p style={{ fontSize: 10, color: C.muted, margin: '2px 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>{regimeLabel(regime)}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}>
        <span style={{ color: C.muted }}>Total income</span><span style={{ color: C.text, fontWeight: 500 }}>{fmt(taxable)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0 0', borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
        <span style={{ color: C.text, fontWeight: 600 }}>Tax</span><span style={{ color: C.fg, fontWeight: 700 }}>{fmt(tax)}</span>
      </div>
    </div>
  )
}

function ReportedRows({ reported }: { reported: ParsedReturn['reported'] }) {
  const rows = [
    { label: 'Gross total income', amount: reported.grossTotalIncome },
    { label: 'Total income (taxable)', amount: reported.totalIncome },
    { label: 'Total tax on the return', amount: reported.totalTax },
  ].filter(x => x.amount > 0)
  if (rows.length === 0) return null
  return (
    <div>
      <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>What we read</p>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.text }}>{row.label}</span><span style={{ color: C.fg, fontWeight: 600 }}>{fmt(row.amount)}</span>
        </div>
      ))}
    </div>
  )
}
