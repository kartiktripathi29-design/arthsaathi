'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

interface ExemptionsState {
  hraReceived: number
  rentPaid: number
  isMetro: boolean
  // Section 10 — other exemptions (annual amounts in ₹)
  lta: number               // 10(5)  — ₹50k per 4-yr block, once in 2 years
  driverSalary: number      // 10(14)(i) — paid to driver by employee; no cap
  carMaintenance: number    // 10(14)(i) — employer-provided car for business use; no cap
  dailyAllowance: number    // 10(14)(ii) — ₹100–500/day on tour/transfer
  superannuation: number    // 15% of basic+DA
  pfWithdrawal: number      // 100% exempt on retirement / separation
  gratuity: number          // ₹10L cap (₹20L for govt)
}

const DEFAULT: ExemptionsState = {
  hraReceived: 0, rentPaid: 0, isMetro: false,
  lta: 0, driverSalary: 0, carMaintenance: 0, dailyAllowance: 0,
  superannuation: 0, pfWithdrawal: 0, gratuity: 0,
}

// Hoisted outside ExemptionsPage so its component identity is stable across renders.
// Defining it inside the parent caused React to unmount/remount the <input> on every
// keystroke, which made each keystroke lose focus.
function SimpleSection({
  open, value, q, sub, claimed, capLabel, onToggle, onChange, belowField,
}: {
  open: boolean
  value: number
  q: string
  sub: string
  claimed: number
  capLabel?: string
  onToggle: () => void
  onChange: (v: number) => void
  belowField?: React.ReactNode
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', padding: '14px 16px', background: open ? C.wl : '#fff', border: 'none', borderBottom: open ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>{q}</p>
          <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>{sub}</p>
        </div>
        <span style={{ fontSize: 14, color: C.fg }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ padding: '14px 16px', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <span style={{ padding: '8px 10px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
            <input type="text" inputMode="numeric"
              value={value > 0 ? value : ''}
              onChange={(e) => onChange(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              placeholder="0"
              style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', color: C.text }}
            />
          </div>
          <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: C.muted }}>Claimed</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(claimed)}{capLabel ? ` / ${capLabel}` : ''}</span>
          </div>
          {belowField}
        </div>
      )}
    </div>
  )
}

// LTA blocks are statutory 4-calendar-year windows starting CY 1986 (Rule 2B).
// Returns the current block + prior block + carry-forward window for the year `y`.
function ltaBlockFor(y: number) {
  const idx = Math.floor((y - 1986) / 4)
  const start = 1986 + idx * 4
  const end = start + 3
  const prevStart = start - 4
  const prevEnd = start - 1
  // The unutilized journey from the prior block can be claimed only as the
  // first journey in the first calendar year of the new block.
  const carryWindowYear = start
  return { start, end, prevStart, prevEnd, carryWindowYear, blockNumber: idx + 1 }
}

export default function ExemptionsPage() {
  const router = useRouter()
  const [salary, setSalary] = useState<any>(null)
  const [s, setS] = useState<ExemptionsState>(DEFAULT)
  // All Section-10 accordions expanded by default — users see every question
  // immediately and can collapse the ones that don't apply.
  const [expanded, setExpanded] = useState<string[]>(['hra', 'lta', 'driver', 'car', 'da', 'superann', 'pf', 'gratuity'])

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        const slipArray = Array.isArray(parsed) ? parsed : parsed.employments?.[0]?.slips || []
        if (slipArray.length > 0) {
          const latest = slipArray[slipArray.length - 1]
          setSalary(latest)
          setS(prev => ({ ...prev, hraReceived: latest.hra || 0 }))
        }
      } catch (e) {
        console.error('Failed to load salary:', e)
      }
    }
    const ex = localStorage.getItem('av_exemptions')
    if (ex) {
      try {
        const parsed = JSON.parse(ex)
        setS(prev => ({
          ...prev,
          ...(parsed.hra ? { rentPaid: parsed.hra.rentPaid || 0, isMetro: !!parsed.hra.isMetro, hraReceived: parsed.hra.hraReceived || prev.hraReceived } : {}),
          lta: parsed.lta || 0,
          driverSalary: parsed.driverSalary || 0,
          carMaintenance: parsed.carMaintenance || 0,
          dailyAllowance: parsed.dailyAllowance || 0,
          superannuation: parsed.superannuation || 0,
          pfWithdrawal: parsed.pfWithdrawal || 0,
          gratuity: parsed.gratuity || 0,
        }))
      } catch (e) {
        console.error('Failed to load exemptions:', e)
      }
    }
  }, [])

  const calculateHRA = () => {
    if (!s.hraReceived || !s.rentPaid || !salary) return 0
    const basic = salary.basicSalary || 0
    const actual = s.hraReceived
    const rentMinus10 = s.rentPaid - basic * 0.1
    const cityLimit = s.isMetro ? basic * 0.5 : basic * 0.4
    return Math.max(0, Math.min(actual, rentMinus10, cityLimit))
  }
  const hraExemption = calculateHRA()

  // Gratuity is capped at ₹10L for non-government employees.
  const gratuityCapped = Math.min(s.gratuity, 1000000)
  // Superannuation: theoretical cap = 15% of (basic+DA)*12. We don't have DA reliably,
  // so we just display the user's entered amount and warn in the description.
  const totalOtherExempts = s.lta + s.driverSalary + s.carMaintenance + s.dailyAllowance + s.superannuation + s.pfWithdrawal + gratuityCapped
  const totalAnnualExempt = (hraExemption * 12) + totalOtherExempts

  useEffect(() => {
    try {
      localStorage.setItem('av_exemptions', JSON.stringify({
        // Persist the COMPUTED HRA exemption alongside its raw inputs so the Tax Optimizer
        // consumes the exact figure shown here instead of recomputing (which diverged when basic
        // pay changed mid-year — the two pages used different slips). monthlyExemption/annualExemption
        // are the source of truth; basicUsed records which basic this was computed against.
        hra: {
          hraReceived: s.hraReceived,
          rentPaid: s.rentPaid,
          isMetro: s.isMetro,
          monthlyExemption: hraExemption,
          annualExemption: hraExemption * 12,
          basicUsed: salary?.basicSalary || 0,
        },
        lta: s.lta,
        driverSalary: s.driverSalary,
        carMaintenance: s.carMaintenance,
        dailyAllowance: s.dailyAllowance,
        superannuation: s.superannuation,
        pfWithdrawal: s.pfWithdrawal,
        gratuity: gratuityCapped,
      }))
    } catch {}
  }, [s.hraReceived, s.rentPaid, s.isMetro, s.lta, s.driverSalary, s.carMaintenance, s.dailyAllowance, s.superannuation, s.pfWithdrawal, gratuityCapped, hraExemption, salary])

  const toggle = (key: string) => setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  const update = (k: keyof ExemptionsState, v: any) => setS(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Exemptions</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Section 10 — income that is completely tax-free (Old Regime only)</p>

      {salary && salary.hra > 0 && (
        <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.6 }}>
            Your salary slip shows HRA of <strong>{fmt(salary.hra)}/month</strong>. The other exemptions below are optional — fill what applies to you.
          </p>
        </div>
      )}

      {/* HRA — kept as the rich existing flow */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('hra')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('hra') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('hra') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>House Rent Allowance (HRA) u/s 10(13A)</p>
            <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>Min of: actual HRA · rent − 10% basic · 50% (metro) / 40% basic · Old regime only</p>
          </div>
          <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('hra') ? '−' : '+'}</span>
        </button>
        {expanded.includes('hra') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>HRA received (monthly)</label>
              <div style={{ padding: '8px 10px', background: '#FAFAF8', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, color: C.text, fontWeight: 600 }}>
                {fmt(s.hraReceived)}/month <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 400, marginLeft: 6 }}>(auto-filled from slip)</span>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 500 }}>Monthly rent paid</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                <span style={{ padding: '8px 10px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                <input type="text" inputMode="numeric"
                  value={s.rentPaid > 0 ? s.rentPaid : ''}
                  onChange={(e) => update('rentPaid', parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                  placeholder="0"
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', color: C.text }}
                />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={s.isMetro} onChange={(e) => update('isMetro', e.target.checked)} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>I live in a metro city (50% rate)</div>
                <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45 }}>
                  Per <strong>Rule 2A, Income Tax Rules, 1962</strong> (FY 2025-26 / Budget 2025 — unchanged), only <strong>Delhi, Mumbai, Kolkata, Chennai</strong> qualify as metros for HRA. All other cities — including Bengaluru, Hyderabad, Pune, Ahmedabad, Gurugram, Noida — use the 40% rate.
                </div>
              </div>
            </label>
            <div style={{ padding: '8px 10px', background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 4, marginBottom: 12 }}>
              <p style={{ fontSize: 10.5, color: '#7A5C00', margin: 0, lineHeight: 1.45 }}>
                ⚠️ HRA exemption is <strong>not available under the new tax regime</strong>. This claim only applies if you opt for the old regime.
              </p>
            </div>
            {s.rentPaid > 0 ? (
              <div style={{ padding: '12px 14px', background: '#F0F9F7', border: '1px solid #D1E8E4', borderRadius: 4 }}>
                <p style={{ fontSize: 10.5, color: C.muted, margin: '0 0 4px', fontWeight: 500, textTransform: 'uppercase' as const }}>Tax-free HRA exemption</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(hraExemption)}/month · {fmt(hraExemption * 12)}/year</p>
              </div>
            ) : (
              <div style={{ padding: '10px 12px', background: '#FFF3DD', border: `1px solid ${C.wm}`, borderRadius: 4 }}>
                <p style={{ fontSize: 11, color: '#856404', margin: 0 }}>💡 Enter monthly rent to claim HRA exemption.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 10 — LTA. Show the user which statutory 4-yr block they're currently in,
          the prior block (for carry-forward), and how many journeys remain. */}
      {(() => {
        const today = new Date()
        const cy = today.getFullYear()
        const blk = ltaBlockFor(cy)
        // Carry-forward window from the prior block is only the first CY of the new block.
        const inCarryWindow = cy === blk.carryWindowYear
        return (
          <SimpleSection
            open={expanded.includes('lta')}
            onToggle={() => toggle('lta')}
            q="Leave Travel Allowance (LTA) u/s 10(5)"
            sub="Travel within India for self+family. 2 journeys per 4-yr block (calendar years) · only actual economy fare exempt (not lodging/food). Enter amount claimed this FY."
            value={s.lta}
            onChange={(v) => update('lta', v)}
            claimed={s.lta}
            belowField={
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#F0F9F4', border: '1px solid #CFE6D8', borderRadius: 4 }}>
                <p style={{ fontSize: 11, color: C.text, margin: '0 0 4px', fontWeight: 600 }}>
                  Current LTA block · <span style={{ color: '#2A7A4A' }}>CY {blk.start}–{blk.end}</span> <span style={{ color: C.muted, fontWeight: 400 }}>(today is CY {cy})</span>
                </p>
                <ul style={{ fontSize: 10.5, color: C.muted, margin: 0, paddingLeft: 16, lineHeight: 1.55 }}>
                  <li>You may claim exemption for <strong>2 journeys</strong> within this 4-year block.</li>
                  <li>Each journey: only the <strong>actual fare</strong> (rail / air / bus) for self + family within India. No lodging, food, or sightseeing.</li>
                  <li>Prior block: <strong>CY {blk.prevStart}–{blk.prevEnd}</strong>. {inCarryWindow
                      ? <>You are within the carry-forward window — <strong>one unutilized journey</strong> from the prior block can still be claimed, but only as your <strong>first journey of CY {blk.carryWindowYear}</strong>.</>
                      : <>The carry-forward window from the prior block was CY {blk.carryWindowYear} — that opportunity has closed.</>}
                  </li>
                  <li>LTA is unavailable under the <strong>new tax regime</strong>.</li>
                </ul>
              </div>
            }
          />
        )
      })()}

      {/* Section 10 — Driver salary */}
      <SimpleSection
        open={expanded.includes('driver')}
        onToggle={() => toggle('driver')}
        q="Driver salary u/s 10(14)(i)"
        sub="Reimbursement of driver's salary by employer (when you use a company-provided car). No statutory cap. Must be paid to the driver, not retained by you."
        value={s.driverSalary}
        onChange={(v) => update('driverSalary', v)}
        claimed={s.driverSalary}
      />

      {/* Section 10 — Car maintenance */}
      <SimpleSection
        open={expanded.includes('car')}
        onToggle={() => toggle('car')}
        q="Car maintenance u/s 10(14)(i)"
        sub="Reimbursement when employer provides a car for business use. Includes fuel, repairs, insurance. No statutory cap — actual expense incurred."
        value={s.carMaintenance}
        onChange={(v) => update('carMaintenance', v)}
        claimed={s.carMaintenance}
      />

      {/* Section 10 — Daily allowance on tour */}
      <SimpleSection
        open={expanded.includes('da')}
        onToggle={() => toggle('da')}
        q="Daily allowance on tour/transfer u/s 10(14)(ii)"
        sub="Per-day allowance during official travel. CBDT rates: ₹100–500/day depending on city. Enter total claimed this FY."
        value={s.dailyAllowance}
        onChange={(v) => update('dailyAllowance', v)}
        claimed={s.dailyAllowance}
      />

      {/* Section 10 — Superannuation */}
      <SimpleSection
        open={expanded.includes('superann')}
        onToggle={() => toggle('superann')}
        q="Superannuation fund contribution"
        sub="Employer's contribution to an approved superannuation fund. Exempt up to 15% of (basic + DA). Anything above is taxable as salary."
        value={s.superannuation}
        onChange={(v) => update('superannuation', v)}
        claimed={s.superannuation}
      />

      {/* Section 10 — PF withdrawal */}
      <SimpleSection
        open={expanded.includes('pf')}
        onToggle={() => toggle('pf')}
        q="PF withdrawal on retirement / separation"
        sub="Recognized PF withdrawal after 5 years of service (or on retirement) is 100% tax-free. Lump sum amount received."
        value={s.pfWithdrawal}
        onChange={(v) => update('pfWithdrawal', v)}
        claimed={s.pfWithdrawal}
      />

      {/* Section 10 — Gratuity */}
      <SimpleSection
        open={expanded.includes('gratuity')}
        onToggle={() => toggle('gratuity')}
        q="Gratuity u/s 10(10)"
        sub="Received on retirement / separation. Half-month basic × years of service. Cap ₹10L for non-govt; ₹20L for govt employees."
        value={s.gratuity}
        onChange={(v) => update('gratuity', v)}
        claimed={gratuityCapped}
        capLabel="₹10,00,000 (non-govt)"
      />

      {/* Total */}
      <div style={{ background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Total exemptions claimed (annual)</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(totalAnnualExempt)}</p>
        <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0' }}>HRA {fmt(hraExemption * 12)} · LTA {fmt(s.lta)} · Driver {fmt(s.driverSalary)} · Car {fmt(s.carMaintenance)} · DA {fmt(s.dailyAllowance)} · Super-ann {fmt(s.superannuation)} · PF {fmt(s.pfWithdrawal)} · Gratuity {fmt(gratuityCapped)}</p>
        <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0', fontStyle: 'italic' }}>These count only under Old Regime. New Regime disables Section 10 exemptions.</p>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/profile/deductions')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Deductions →</button>
      </div>
    </div>
  )
}
