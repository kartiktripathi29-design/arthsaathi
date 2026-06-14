'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { computeAnnualHraExemption, type HraMonth } from '@/lib/salary-analytics'
import { getSalaryFacts } from '@/lib/salary-facts'

import { tokens as T } from '@/lib/tokens'

const C = { fg:T.teal, wheat:T.taupe, wl:T.sand, wm:T.taupeLine, bg:T.paper, card:T.card, border:T.hairline, text:T.ink, muted:T.muted, faint:T.faint, green:T.green, marigold:T.marigold, danger:'#B94040' }
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
  open, value, q, sub, claimed, capLabel, onToggle, onChange, belowField, footnote,
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
  footnote?: React.ReactNode
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', padding: '14px 16px', background: open ? C.wl : T.card, border: 'none', borderBottom: open ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>{q}</p>
          <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>{sub}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, color: value > 0 ? C.green : C.marigold }}>
            {value > 0 ? `${fmt(value)} ✓` : '₹ —'}
          </span>
          <span style={{ fontSize: 14, color: C.fg }}>{open ? '−' : '+'}</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: '14px 16px', background: T.card }}>
          <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 500 }}>Amount for the full year</label>
          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <span style={{ padding: '8px 10px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
            <input type="text" inputMode="numeric"
              value={value > 0 ? value : ''}
              onChange={(e) => onChange(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              placeholder="0"
              style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', color: C.text, background: 'transparent' }}
            />
            <span style={{ padding: '8px 10px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.muted, whiteSpace: 'nowrap' }}>/ year</span>
          </div>
          {claimed > 0 && (
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Claimed</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(claimed)}{capLabel ? ` / ${capLabel}` : ''}</span>
            </div>
          )}
          {belowField}
          {footnote && (
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>{footnote}</p>
          )}
        </div>
      )}
    </div>
  )
}

// A slip-detected allowance shown as a CONFIRM-able hint (never auto-applied — eligibility for these
// depends on facts the slip can't show: actual travel, official car use, etc.). `monthly` is the
// amount seen on the slip; the optional "Use" button fills the annual field (monthly × 12).
function DetectedHint({ monthly, rule, onUse }: { monthly: number; rule: string; onUse?: () => void }) {
  if (!monthly || monthly <= 0) return null
  const annual = monthly * 12
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: T.tint, border: `1px solid ${T.hairline}`, borderRadius: 4 }}>
      <p style={{ fontSize: 11, color: C.text, margin: '0 0 4px' }}>
        🔎 Detected in your slip: <strong>{fmt(monthly)}/month</strong> <span style={{ color: C.muted }}>(~{fmt(annual)}/year)</span>
      </p>
      <p style={{ fontSize: 10.5, color: C.muted, margin: 0, lineHeight: 1.45 }}>{rule}</p>
      {onUse && (
        <button onClick={onUse} style={{ marginTop: 6, padding: '4px 10px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 4, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Use {fmt(annual)}/year
        </button>
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
  // Per-month Basic + HRA series from the Salary page (av_salary_summary). When
  // present, HRA is computed month-by-month (Rule 2A) so a mid-year raise is
  // handled correctly; when absent (legacy data), we fall back to single-slip × 12.
  const [hraBasis, setHraBasis] = useState<HraMonth[]>([])
  const [s, setS] = useState<ExemptionsState>(DEFAULT)
  // All Section-10 accordions expanded by default — users see every question
  // immediately and can collapse the ones that don't apply.
  // All sections collapsed by default — the page is a tidy list of one-line headers you tap to open.
  const [expanded, setExpanded] = useState<string[]>([])
  const [showHraCalc, setShowHraCalc] = useState(false)

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
    // Per-month HRA basis from the ONE shared salary reader (getSalaryFacts) — the Salary page's
    // authoritative timeline that already accounts for mid-year raises, bonuses and job switches.
    // Same source the Tax and Deductions pages read, so HRA is no longer figured a different way here.
    setHraBasis(getSalaryFacts().hraBasis)
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

  // HRA exemption (Rule 2A) is a PER-MONTH minimum, summed over the year — not a
  // single month's figure × 12. When the Salary page has handed us a per-month
  // Basic + HRA series we compute it month-by-month (so a mid-year raise is handled
  // correctly). Otherwise we fall back to the legacy single-slip estimate.
  const hasBasis = hraBasis.length > 0 && hraBasis.some(m => m.basic > 0) && hraBasis.some(m => m.hra > 0)
  const hraComp = (s.rentPaid > 0 && hasBasis)
    ? computeAnnualHraExemption(hraBasis, s.rentPaid, s.isMetro)
    : null

  // Fallback: legacy data with no timeline — best-effort single-slip basic × 12.
  const fallbackAnnual = (() => {
    if (!s.hraReceived || !s.rentPaid || !salary) return 0
    const basic = salary.basicSalary || 0
    const monthly = Math.max(0, Math.min(
      s.hraReceived,
      s.rentPaid - basic * 0.1,
      s.isMetro ? basic * 0.5 : basic * 0.4,
    ))
    return Math.round(monthly * 12)
  })()

  const hraAnnualExemption = hraComp ? hraComp.annualExemption : fallbackAnnual
  const hraMonthlyDisplay = Math.round(hraAnnualExemption / 12)
  const hraBasicVaried = !!hraComp?.basicVaried

  // HRA actually RECEIVED across the year (sum of each month's HRA from the timeline). When it
  // changes mid-year — e.g. a job switch — a single monthly figure is misleading, so we show the
  // annual total plus a per-period breakdown. hraSegments groups contiguous months of equal HRA.
  const fmtMonth = (mk: string) => {
    const [y, m] = mk.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[(parseInt(m) || 1) - 1]} ${y}`
  }
  const hraAnnualReceived = hraBasis.reduce((acc, m) => acc + (m.hra || 0), 0)
  const hraSegments = (() => {
    type HraSeg = { from: string; to: string; hra: number; months: number; proratedFrom?: string }
    const raw: HraSeg[] = []
    for (const m of hraBasis) {
      const last = raw[raw.length - 1]
      if (last && last.hra === m.hra) { last.to = m.monthKey; last.months += 1 }
      else raw.push({ from: m.monthKey, to: m.monthKey, hra: m.hra, months: 1 })
    }
    // Fold a single prorated-looking month (one month whose HRA dips below the next run's — e.g. a
    // mid-month joining) into that run, so we show the real monthly rate with a "prorated" note
    // rather than a phantom middle rate (e.g. June at ₹72,000 between ₹34,815 and ₹80,000).
    const merged: HraSeg[] = []
    for (let i = 0; i < raw.length; i++) {
      const seg = raw[i]
      const next = raw[i + 1]
      if (seg.months === 1 && next && seg.hra < next.hra) {
        next.from = seg.from
        next.months += 1
        next.proratedFrom = seg.from
        continue
      }
      merged.push(seg)
    }
    return merged
  })()
  const hraReceivedVaried = hraSegments.length > 1
  const hraProratedMonths = hraSegments.filter(s => s.proratedFrom).map(s => fmtMonth(s.proratedFrom!))

  // Allowances detected on the uploaded slip → surfaced as confirm-able hints, never auto-applied
  // (eligibility depends on facts the slip can't show: actual travel for LTA, official car use, etc.).
  // Amounts are monthly (slip values); the per-section "Use" button annualises them (× 12).
  const slipComponents: { label: string; amount: number }[] = (salary?.components || []).map((c: any) => ({ label: String(c?.label || ''), amount: Number(c?.amount) || 0 }))
  const sumComp = (re: RegExp) => slipComponents.filter(c => re.test(c.label)).reduce((acc, c) => acc + c.amount, 0)
  const detectedConveyance = Math.round(salary?.ta || sumComp(/convey|transport/i) || 0)
  const detectedLta = Math.round(salary?.lta || sumComp(/\blta\b|leave\s*travel/i) || 0)
  const detectedDriver = Math.round(sumComp(/driver/i))
  const detectedFuel = Math.round(sumComp(/fuel|petrol|diesel|car\b|vehicle/i))

  // Gratuity is capped at ₹10L for non-government employees.
  const gratuityCapped = Math.min(s.gratuity, 1000000)
  // Superannuation: theoretical cap = 15% of (basic+DA)*12. We don't have DA reliably,
  // so we just display the user's entered amount and warn in the description.
  const totalOtherExempts = s.lta + s.driverSalary + s.carMaintenance + s.dailyAllowance + s.superannuation + s.pfWithdrawal + gratuityCapped
  const totalAnnualExempt = hraAnnualExemption + totalOtherExempts
  // Aggregate state shown on each collapsed group bar (gratuity uses the capped figure for parity with its row).
  const grpCarSum = s.driverSalary + s.carMaintenance + s.dailyAllowance
  const grpRetireSum = s.superannuation + s.pfWithdrawal + gratuityCapped

  useEffect(() => {
    try {
      localStorage.setItem('av_exemptions', JSON.stringify({
        // Persist the COMPUTED HRA exemption alongside its raw inputs so the Tax Optimizer
        // consumes the exact figure shown here instead of recomputing (which diverged when basic
        // pay changed mid-year — the two pages used different slips). annualExemption is the
        // source of truth and is now computed month-by-month (Rule 2A) across the whole FY;
        // monthlyExemption is just annual/12 for display. basicUsed records the latest slip's
        // basic for the Optimizer's legacy fallback only.
        hra: {
          hraReceived: s.hraReceived,
          rentPaid: s.rentPaid,
          isMetro: s.isMetro,
          monthlyExemption: hraMonthlyDisplay,
          annualExemption: hraAnnualExemption,
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
  }, [s.hraReceived, s.rentPaid, s.isMetro, s.lta, s.driverSalary, s.carMaintenance, s.dailyAllowance, s.superannuation, s.pfWithdrawal, gratuityCapped, hraAnnualExemption, hraMonthlyDisplay, salary])

  const toggle = (key: string) => setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  const update = (k: keyof ExemptionsState, v: any) => setS(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Allowances</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Income that is completely tax-free — <span style={{ whiteSpace: 'nowrap' }}>Old Regime only · Section 10</span></p>

      {salary && (salary.hra > 0 || detectedConveyance > 0) && (
        <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>💡 What your tax consultant isn't telling you</p>
          {salary.hra > 0 && (
            <p style={{ fontSize: 11.5, color: C.text, margin: '0 0 6px', lineHeight: 1.55 }}>
              Your HRA isn't automatically tax-free — only the <strong>least of three</strong> amounts is, and only if you <strong>actually pay rent</strong>.
              {hraReceivedVaried
                ? <> Since your pay changed mid-year, we worked it out <strong>month-by-month</strong> ({fmt(hraAnnualReceived)} total) — the honest way, not "one slip × 12".</>
                : <> Enter your rent below to see exactly how much.</>}
            </p>
          )}
          {detectedConveyance > 0 && (
            <p style={{ fontSize: 11.5, color: C.text, margin: 0, lineHeight: 1.55 }}>
              That <strong>Conveyance {fmt(detectedConveyance)}/mo</strong> on your slip? Taxable now — it's baked into the standard deduction, so there's nothing extra to claim.
            </p>
          )}
          <p style={{ fontSize: 10.5, color: C.muted, margin: '8px 0 0' }}>Everything below is optional — fill only what applies to you.</p>
        </div>
      )}

      {/* HRA — kept as the rich existing flow */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('hra')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('hra') ? C.wl : T.card, border: 'none', borderBottom: expanded.includes('hra') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>House rent (HRA)</p>
            <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>Rent you pay — usually the biggest one</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, color: hraAnnualExemption > 0 ? C.green : C.marigold }}>
              {hraAnnualExemption > 0 ? `${fmt(hraAnnualExemption)} ✓` : '₹ —'}
            </span>
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('hra') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('hra') && (
          <div style={{ padding: '14px 16px', background: T.card }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                HRA received {hraAnnualReceived > 0 ? '(annual)' : '(monthly)'}
              </label>
              <div style={{ padding: '8px 10px', background: T.card, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, color: C.text, fontWeight: 600 }}>
                {hraAnnualReceived > 0
                  ? <>{fmt(hraAnnualReceived)}/year <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 400, marginLeft: 6 }}>(from your timeline)</span></>
                  : <>{fmt(s.hraReceived)}/month <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 400, marginLeft: 6 }}>{s.hraReceived > 0 ? '(auto-filled from slip)' : '(none found on your slip — add it if your slip shows HRA)'}</span></>}
              </div>
              {hraReceivedVaried && (
                <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                  Varies during the year:{' '}
                  {hraSegments.map((seg, i) => (
                    <span key={i}>
                      {i > 0 ? ' → ' : ''}
                      <strong style={{ color: C.text }}>{fmt(seg.hra)}/mo</strong>{' '}
                      ({fmtMonth(seg.from)}{seg.from !== seg.to ? `–${fmtMonth(seg.to)}` : ''})
                    </span>
                  ))}
                  . {hraProratedMonths.length > 0 && <>{hraProratedMonths.join(', ')} prorated for the joining date. </>}The exemption below is computed per month and summed.
                </p>
              )}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 500 }}>Monthly rent paid</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                <span style={{ padding: '8px 10px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                <input type="text" inputMode="numeric"
                  value={s.rentPaid > 0 ? s.rentPaid : ''}
                  onChange={(e) => update('rentPaid', parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                  placeholder="0"
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', color: C.text, background: 'transparent' }}
                />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={s.isMetro} onChange={(e) => update('isMetro', e.target.checked)} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>I live in a metro city (50% rate)</div>
                <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45 }}>
                  Metros (50%): <strong>Delhi, Mumbai, Kolkata, Chennai</strong>. Everywhere else (Bengaluru, Hyderabad, Pune, Gurugram…) is 40%.
                </div>
              </div>
            </label>
            <div style={{ padding: '8px 10px', background: T.caution.fill, border: `1px solid ${T.caution.border}`, borderRadius: 4, marginBottom: 12 }}>
              <p style={{ fontSize: 10.5, color: T.caution.text, margin: 0, lineHeight: 1.45 }}>
                ⚠️ HRA exemption is <strong>not available under the new tax regime</strong>. This claim only applies if you opt for the old regime.
              </p>
            </div>
            {s.rentPaid > 0 ? (
              <div style={{ padding: '12px 14px', background: T.tint, border: `1px solid ${T.hairline}`, borderRadius: 4 }}>
                <p style={{ fontSize: 10.5, color: C.muted, margin: '0 0 4px', fontWeight: 500, textTransform: 'uppercase' as const }}>Tax-free HRA exemption</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(hraAnnualExemption)}/year{hraAnnualExemption > 0 ? ` · ~${fmt(hraMonthlyDisplay)}/month avg` : ''}</p>
                {hraComp && (
                  <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0', lineHeight: 1.45 }}>
                    {hraBasicVaried
                      ? <>Computed month-by-month across {hraComp.monthsCounted} months — your basic pay changed during the year, so each month's exemption is the min of (HRA · rent − 10% basic · {s.isMetro ? '50%' : '40%'} basic) and they're summed.</>
                      : <>Computed across {hraComp.monthsCounted} months of salary data.</>}
                  </p>
                )}
                {hraComp && hraComp.breakdown.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => setShowHraCalc(v => !v)} style={{ background: 'transparent', border: 'none', color: C.fg, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                      {showHraCalc ? '− Hide the working' : '+ Show how this is calculated'}
                    </button>
                    {showHraCalc && (
                      <div style={{ marginTop: 8 }}>
                        {hraComp.breakdown.map((seg, i) => {
                          const least = Math.min(seg.hra, seg.rentMinus10, seg.cityPctBasic)
                          return (
                            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, marginBottom: 8, background: T.card }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
                                {fmtMonth(seg.fromMonth)}{seg.fromMonth !== seg.toMonth ? ` – ${fmtMonth(seg.toMonth)}` : ''} <span style={{ color: C.muted, fontWeight: 400 }}>· {seg.months} mo · basic {fmt(seg.basic)}/mo</span>
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 11, borderRadius: 4, background: seg.hra === least ? T.slip.fill : 'transparent', fontWeight: seg.hra === least ? 700 : 400, color: seg.hra === least ? C.fg : C.text }}>
                                <span>Actual HRA received</span><span>{fmt(seg.hra)}/mo</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 11, borderRadius: 4, background: seg.rentMinus10 === least ? T.slip.fill : 'transparent', fontWeight: seg.rentMinus10 === least ? 700 : 400, color: seg.rentMinus10 === least ? C.fg : C.text }}>
                                <span>Rent − 10% of basic <span style={{ color: C.muted, fontWeight: 400 }}>({fmt(s.rentPaid)} − {fmt(Math.round(seg.basic * 0.1))})</span></span><span>{fmt(seg.rentMinus10)}/mo</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 11, borderRadius: 4, background: seg.cityPctBasic === least ? T.slip.fill : 'transparent', fontWeight: seg.cityPctBasic === least ? 700 : 400, color: seg.cityPctBasic === least ? C.fg : C.text }}>
                                <span>{s.isMetro ? '50%' : '40%'} of basic</span><span>{fmt(seg.cityPctBasic)}/mo</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', marginTop: 4, borderTop: `1px dashed ${C.border}`, fontSize: 11, fontWeight: 700, color: C.green }}>
                                <span>→ Exempt (least) × {seg.months}</span><span>{fmt(seg.monthlyExempt)} × {seg.months} = {fmt(seg.periodExempt)}</span>
                              </div>
                            </div>
                          )
                        })}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: C.wl, borderRadius: 6, fontSize: 12, fontWeight: 700, color: C.fg }}>
                          <span>Total tax-free HRA</span><span>{fmt(hraAnnualExemption)}/year</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '10px 12px', background: T.caution.fill, border: `1px solid ${C.wm}`, borderRadius: 4 }}>
                <p style={{ fontSize: 11, color: T.caution.text, margin: 0 }}>💡 Enter monthly rent to claim HRA exemption.</p>
              </div>
            )}
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>HRA · u/s 10(13A) · Min of: actual HRA · rent − 10% basic · 50% (metro) / 40% basic · Old regime only</p>
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
            q="Travel allowance (LTA)"
            sub="Trips within India, via your employer."
            value={s.lta}
            onChange={(v) => update('lta', v)}
            claimed={s.lta}
            belowField={
              <>
              <DetectedHint monthly={detectedLta} rule="LTA is exempt only for actual travel (economy fare · 2 journeys per 4-yr block). Enter the fare you'll actually claim — not the full allowance shown on the slip." />
              <div style={{ marginTop: 10, padding: '10px 12px', background: T.slip.fill, border: `1px solid ${T.slip.border}`, borderRadius: 4 }}>
                <p style={{ fontSize: 10.5, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                  Current block <strong style={{ color: C.green }}>CY {blk.start}–{blk.end}</strong> · 2 journeys allowed.
                  {inCarryWindow && <> Carry-forward: one unused journey from CY {blk.prevStart}–{blk.prevEnd} can be your first journey this year.</>}
                </p>
              </div>
              </>
            }
            footnote="u/s 10(5) · actual economy fare only · 2 journeys per 4-yr block · old regime only"
          />
        )
      })()}

      {/* Group A — Company car & travel perks. The inner wrapper stays MOUNTED and is hidden
          with the `hidden` attribute (CSS display:none), so amounts typed in a closed group keep
          feeding the totals — never conditionally unmounted. */}
      <div style={{ background: C.card, border: `1px dashed ${C.wm}`, borderRadius: 11, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('grpCar')} style={{ width: '100%', padding: '14px 16px', background: T.card, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Company car & travel perks</p>
            <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>Driver · car running costs · daily allowance</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {grpCarSum > 0
              ? <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, color: C.green }}>{fmt(grpCarSum)} ✓</span>
              : <span style={{ fontSize: 11.5, color: C.faint }}>3 items</span>}
            <span style={{ fontSize: 13, color: C.fg }}>{expanded.includes('grpCar') ? '▾' : '▸'}</span>
          </div>
        </button>
        <div hidden={!expanded.includes('grpCar')} style={{ padding: '12px 12px 0' }}>
          {/* Section 10 — Driver salary */}
          <SimpleSection
            open={expanded.includes('driver')}
            onToggle={() => toggle('driver')}
            q="Driver's salary"
            sub="If your company car comes with a driver"
            value={s.driverSalary}
            onChange={(v) => update('driverSalary', v)}
            claimed={s.driverSalary}
            belowField={<DetectedHint monthly={detectedDriver} rule="Exempt only when reimbursed for a driver of an official-use car and actually paid to the driver. Confirm the eligible amount." onUse={() => update('driverSalary', detectedDriver * 12)} />}
            footnote="u/s 10(14)(i) · reimbursed driver of an official-use car · old regime"
          />

          {/* Section 10 — Car maintenance */}
          <SimpleSection
            open={expanded.includes('car')}
            onToggle={() => toggle('car')}
            q="Car running costs"
            sub="Fuel & maintenance your employer covers"
            value={s.carMaintenance}
            onChange={(v) => update('carMaintenance', v)}
            claimed={s.carMaintenance}
            belowField={<DetectedHint monthly={detectedFuel} rule="Exempt only for official-use car running/maintenance (fuel, repairs, insurance). Confirm the eligible amount." onUse={() => update('carMaintenance', detectedFuel * 12)} />}
            footnote="u/s 10(14)(i) · official-use car running costs — fuel, repairs · old regime"
          />

          {/* Section 10 — Daily allowance on tour */}
          <SimpleSection
            open={expanded.includes('da')}
            onToggle={() => toggle('da')}
            q="Daily allowance on tours"
            sub="For days you travel for work."
            value={s.dailyAllowance}
            onChange={(v) => update('dailyAllowance', v)}
            claimed={s.dailyAllowance}
            footnote="u/s 10(14)(ii) · per-day allowance on official tour · old regime"
          />
        </div>
      </div>

      {/* Group B — Retirement & exit payouts. Inner wrapper stays MOUNTED, hidden via CSS only. */}
      <div style={{ background: C.card, border: `1px dashed ${C.wm}`, borderRadius: 11, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('grpRetire')} style={{ width: '100%', padding: '14px 16px', background: T.card, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Retirement & exit payouts</p>
            <p style={{ fontSize: 10.5, color: C.muted, margin: 0 }}>Superannuation · PF withdrawal · gratuity</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {grpRetireSum > 0
              ? <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, color: C.green }}>{fmt(grpRetireSum)} ✓</span>
              : <span style={{ fontSize: 11.5, color: C.faint }}>3 items</span>}
            <span style={{ fontSize: 13, color: C.fg }}>{expanded.includes('grpRetire') ? '▾' : '▸'}</span>
          </div>
        </button>
        <div hidden={!expanded.includes('grpRetire')} style={{ padding: '12px 12px 0' }}>
          {/* Section 10 — Superannuation */}
          <SimpleSection
            open={expanded.includes('superann')}
            onToggle={() => toggle('superann')}
            q="Superannuation"
            sub="What your employer puts into a retirement fund"
            value={s.superannuation}
            onChange={(v) => update('superannuation', v)}
            claimed={s.superannuation}
            footnote="Employer contribution · exempt up to 15% of (basic + DA)"
          />

          {/* Section 10 — PF withdrawal */}
          <SimpleSection
            open={expanded.includes('pf')}
            onToggle={() => toggle('pf')}
            q="PF withdrawal"
            sub="Money you took out of your PF this year"
            value={s.pfWithdrawal}
            onChange={(v) => update('pfWithdrawal', v)}
            claimed={s.pfWithdrawal}
            footnote="Tax-free after 5 yrs' service or on retirement"
          />

          {/* Section 10 — Gratuity */}
          <SimpleSection
            open={expanded.includes('gratuity')}
            onToggle={() => toggle('gratuity')}
            q="Gratuity"
            sub="Exit payout — tax-free up to ₹10L"
            value={s.gratuity}
            onChange={(v) => update('gratuity', v)}
            claimed={gratuityCapped}
            capLabel="₹10,00,000 (non-govt)"
            footnote="u/s 10(10) · on retirement · ½-month basic × years · cap ₹10L (non-govt)"
          />
        </div>
      </div>

      {/* Total */}
      <div style={{ background: T.tint, border: `1px solid ${T.hairline}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Total allowances claimed (annual)</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(totalAnnualExempt)}</p>
        <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0' }}>
          {[
            `HRA ${fmt(hraAnnualExemption)}`,
            `LTA ${fmt(s.lta)}`,
            `Driver ${fmt(s.driverSalary)}`,
            `Car ${fmt(s.carMaintenance)}`,
            `DA ${fmt(s.dailyAllowance)}`,
            `Super-ann ${fmt(s.superannuation)}`,
            `PF ${fmt(s.pfWithdrawal)}`,
            `Gratuity ${fmt(gratuityCapped)}`,
          ].map((t, i) => (
            <span key={i}>{i > 0 ? ' · ' : ''}<span style={{ whiteSpace: 'nowrap' }}>{t}</span></span>
          ))}
        </p>
        <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0', fontStyle: 'italic' }}>These count only under Old Regime. New Regime disables Section 10 exemptions.</p>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/profile/deductions')} style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Deductions →</button>
      </div>
    </div>
  )
}
