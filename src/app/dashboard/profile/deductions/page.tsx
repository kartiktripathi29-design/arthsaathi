'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { computeSec80G, type DonationCat } from '@/lib/deductions'
import { getSalaryFacts } from '@/lib/salary-facts'

import { tokens as T } from '@/lib/tokens'

const C = { fg:T.teal, wheat:T.taupe, wl:T.sand, wm:T.taupeLine, bg:T.paper, card:T.card, border:T.hairline, text:T.ink, muted:T.muted, faint:T.faint, green:T.green, marigold:T.marigold, danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

// Right-aligned ₹-state shown in each collapsed card header — same grammar as the exemptions page:
// claimed total > 0 → green "₹… ✓", else marigold "₹ —".
function StatePill({ value }: { value: number }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, color: value > 0 ? C.green : C.marigold }}>
      {value > 0 ? `${fmt(value)} ✓` : '₹ —'}
    </span>
  )
}

export default function DeductionsPage() {
  const router = useRouter()
  const [ded, setDed] = useState({
    // 80C investments (max ₹1.5L combined)
    ppf: 0, elss: 0, lic: 0, tuition: 0, nsc: 0,
    employeePF: 0,            // auto-prefilled from salary slip (employee's EPF contribution, annual)
    homeLoanPrincipal: 0, termInsurance: 0, other80C: 0,
    // 80D health insurance + senior toggles.
    // selfSeniorStatus is the lossless three-way age band ('normal' | 'senior' | 'super_senior')
    // shared with the Tax Optimizer. selfSenior is a derived mirror kept for backward compatibility
    // (this page's caps only care about senior-or-not; the 80+ distinction matters to old-regime slabs
    // on the optimizer). Keeping the full status here means the 80+ band survives the round trip.
    selfFamily: 0, parents: 0, parentsMedicalExp: 0, selfSenior: false, selfSeniorStatus: 'normal', parentsSenior: false,
    // Home loan interest 24(b)
    homeLoanInterest: 0,
    // NPS 80CCD(1B)
    nps: 0,
    // Other Chapter VI-A
    savingsInterest80TTA: 0,  // non-seniors only, cap ₹10k
    interest80TTB: 0,         // seniors only, cap ₹50k
    eduLoanInterest80E: 0,    // no cap, 8-year window
    // Legacy single-amount field preserved for migration only. New 80G entries live in `donationRows`.
    donations80G: 0,
  })
  // Section 80G donation rows. Each row = one donation, one of four statutory buckets:
  //   100NoLimit:    100% deduction, no qualifying ceiling   — e.g. PM CARES, PMNRF, National Defence Fund, Swachh Bharat Kosh, Clean Ganga Fund
  //   50NoLimit:     50%  deduction, no qualifying ceiling   — e.g. Jawaharlal Nehru Memorial Fund, Indira Gandhi Memorial Trust, Rajiv Gandhi Foundation, PM's Drought Relief Fund
  //   100WithLimit:  100% deduction, subject to 10% of Adjusted GTI — e.g. Indian Olympic Association, Govt./local authority for promoting family planning
  //   50WithLimit:   50%  deduction, subject to 10% of Adjusted GTI — most other approved trusts / NGOs
  // (DonationCat lives in @/lib/deductions so the Deductions page and the Tax Optimizer share one type.)
  const [donationRows, setDonationRows] = useState<Array<{ id: string; category: DonationCat; amount: number }>>([])
  const [pfAutoApplied, setPfAutoApplied] = useState<{ annual: number } | null>(null)
  // Collapsed by default — the page reads as a short list of plain-language questions
  // ("Did you invest in PPF…?") that the user taps to open only what applies to them.
  const [expanded, setExpanded] = useState<string[]>([])
  // Annual gross from saved salary slips — used as the base for the 10%-of-Adjusted-GTI 80G cap.
  const [annualGrossForAGTI, setAnnualGrossForAGTI] = useState(0)

  useEffect(() => {
    const data = localStorage.getItem('av_deductions')
    let loadedDed: any = null
    if (data) {
      try {
        loadedDed = JSON.parse(data)
        // Migrate records saved before selfSeniorStatus existed: recover the 80+ band from the
        // optimizer-only overlay key, else fall back to the binary flag. Keep selfSenior in sync.
        if (!loadedDed.selfSeniorStatus) {
          const overlay = localStorage.getItem('av_user_senior')
          loadedDed.selfSeniorStatus = overlay === 'super_senior' ? 'super_senior'
            : (loadedDed.selfSenior || overlay === 'senior') ? 'senior' : 'normal'
        }
        loadedDed.selfSenior = loadedDed.selfSeniorStatus !== 'normal'
        setDed(prev => ({ ...prev, ...loadedDed }))
      } catch (e) {
        console.error('Failed to load deductions:', e)
      }
    }
    // Donation rows live alongside `av_deductions` under their own key.
    // Migrate any legacy single `donations80G` amount into a 100%-no-limit row.
    try {
      const drData = localStorage.getItem('av_donations80G')
      if (drData) {
        const rows = JSON.parse(drData)
        if (Array.isArray(rows)) setDonationRows(rows)
      } else if (loadedDed && Number(loadedDed.donations80G || 0) > 0) {
        setDonationRows([{ id: 'mig-' + Date.now(), category: '100NoLimit', amount: Number(loadedDed.donations80G) }])
      }
    } catch (e) {
      console.error('Failed to load 80G rows:', e)
    }

    // D17: auto-prefill employee PF from the most recent salary slip × 12.
    // Only prefill if the user hasn't already entered their own PF value.
    try {
      const slipData = localStorage.getItem('av_salary_timeline')
      if (slipData) {
        const slips = JSON.parse(slipData)
        const arr = Array.isArray(slips) ? slips : []
        if (arr.length > 0) {
          const monthlyPF = arr.reduce((s, slip) => s + (slip.employeePF || 0), 0) / arr.length
          const annualPF = Math.round(monthlyPF * 12)
          const existingPF = Number(loadedDed?.employeePF || 0)
          if (annualPF > 0 && existingPF === 0) {
            setDed(prev => ({ ...prev, employeePF: annualPF }))
            setPfAutoApplied({ annual: annualPF })
          }
        }
      }
    } catch (e) {
      console.error('Failed to auto-prefill PF:', e)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('av_deductions', JSON.stringify(ded))
    // Keep the optimizer-only overlay aligned with the lossless status so the two tabs never disagree.
    try { localStorage.setItem('av_user_senior', ded.selfSeniorStatus || (ded.selfSenior ? 'senior' : 'normal')) } catch {}
  }, [ded])

  useEffect(() => {
    localStorage.setItem('av_donations80G', JSON.stringify(donationRows))
  }, [donationRows])

  useEffect(() => {
    // Adjusted-GTI base for the 80G 10%-of-AGTI cap. Read the ONE shared annual-income figure
    // (getSalaryFacts) so this matches the Tax page exactly — the Salary page's careful month-by-month
    // summary when present, else avg(slip) × 12. A 0 base would make cap10pctAGTI 0, which silently
    // wipes every "with-limit" 80G donation, so getting this from the same source as everyone else
    // is what keeps the three pages in agreement.
    setAnnualGrossForAGTI(getSalaryFacts().annualGross)
  }, [])

  const toggle = (key: string) => {
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const sec80C = Math.min(
    ded.ppf + ded.elss + ded.lic + ded.tuition + ded.nsc + ded.employeePF + ded.homeLoanPrincipal + ded.termInsurance + ded.other80C,
    150000,
  )
  const selfCap = ded.selfSenior ? 50000 : 25000
  const parentsCap = ded.parentsSenior ? 50000 : 25000
  const sec80DSelf = Math.min(ded.selfFamily, selfCap)
  // Parents medical expenditure can be claimed under 80D only for uninsured seniors (60+).
  // For simplicity, allow it when parents are senior. Combined cap is ₹50k for the parents bucket.
  const sec80DParents = Math.min(ded.parents + (ded.parentsSenior ? ded.parentsMedicalExp : 0), parentsCap)
  const sec80D = sec80DSelf + sec80DParents
  const sec80TTA = !ded.selfSenior ? Math.min(ded.savingsInterest80TTA, 10000) : 0
  const sec80TTB = ded.selfSenior ? Math.min(ded.interest80TTB, 50000) : 0
  const sec80E = Math.max(0, ded.eduLoanInterest80E)
  const sec24b = Math.min(ded.homeLoanInterest, 200000)
  const secNps = Math.min(ded.nps, 50000)

  // Section 80G — apply the 50%/100% rate, then a 10%-of-Adjusted-GTI ceiling across the two
  // "with limit" buckets combined (per the Income Tax Act). Adjusted GTI is approximated as annual
  // salary gross − other Chapter VI-A deductions (excluding 80G itself) — a fair proxy for a salaried
  // filer. The math lives in computeSec80G so this page and the Tax Optimizer can't diverge.
  const otherChapterVIA = sec80C + sec80D + sec24b + secNps + sec80TTA + sec80TTB + sec80E
  const adjustedGTI = Math.max(0, annualGrossForAGTI - otherChapterVIA)
  const {
    g100NoLimit, g50NoLimit, g100WithLimit, g50WithLimit,
    eligibleWithLimitUncapped, cap10pctAGTI, eligibleWithLimit,
    deduction: sec80G,
  } = computeSec80G(donationRows, adjustedGTI)
  const totalDeductions = sec80C + sec80D + sec24b + secNps + sec80TTA + sec80TTB + sec80E + sec80G
  const taxSavingsOld = totalDeductions * 0.2 // rough estimate at 20% slab

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Deductions</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Tax-saving investments and expenses. (These only reduce tax in Old Regime)</p>

      {/* Context Banner */}
      <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.6 }}>
          You've claimed <strong>{fmt(sec80C + ded.homeLoanInterest + ded.nps)}</strong> total. Only invest what makes financial sense — tax saving is a bonus, not the goal.
        </p>
      </div>

      {/* Section 80C */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80c')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('80c') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('80c') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Tax-saving investments</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>PF, PPF, ELSS, LIC and the rest — one shared limit</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatePill value={sec80C} />
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('80c') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('80c') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            {pfAutoApplied && (
              <div style={{ marginBottom: 12, padding: '8px 10px', background: '#E8F2EC', border: '1px solid #B8D9C4', borderRadius: 4 }}>
                <p style={{ fontSize: 11, color: '#1A5634', margin: 0, lineHeight: 1.5 }}>
                  💡 Auto-filled <strong>Employee PF</strong> = {fmt(pfAutoApplied.annual)} (from your salary slip × 12). Adjust below if needed.
                </p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                { key: 'employeePF', label: 'Employee PF (from slip)', hint: 'auto' },
                { key: 'ppf', label: 'PPF' },
                { key: 'elss', label: 'ELSS (Mutual Fund)' },
                { key: 'lic', label: 'Life Insurance Premium' },
                { key: 'tuition', label: 'Tuition Fees (children)' },
                { key: 'nsc', label: 'NSC / Tax Saver FD' },
                { key: 'homeLoanPrincipal', label: 'Home Loan Principal' },
                { key: 'termInsurance', label: 'Term Insurance Premium' },
                { key: 'other80C', label: 'Other 80C (Sukanya, etc.)' },
              ].map(({ key, label, hint }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 10.5, color: C.muted, marginBottom: 3, fontWeight: 500 }}>
                    {label}{hint === 'auto' && <span style={{ marginLeft: 4, fontSize: 9.5, color: '#2A7A4A', fontWeight: 700 }}>· prefilled</span>}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                    <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                    <input type="text" inputMode="numeric" value={(ded as any)[key] > 0 ? (ded as any)[key] : ''} onChange={(e) => setDed({ ...ded, [key]: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', background: C.bg, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Counted toward the cap</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(Math.min(sec80C, 150000))} / ₹1,50,000</span>
            </div>
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>Section 80C · everything above shares one ₹1.5L limit</p>
          </div>
        )}
      </div>

      {/* Section 80D */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80d')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('80d') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('80d') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Health insurance</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Premiums for you, your family, your parents</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatePill value={sec80D} />
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('80d') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('80d') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.text, marginBottom: 8, fontWeight: 600 }}>Self + Family</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                <input type="text" inputMode="numeric" value={ded.selfFamily > 0 ? ded.selfFamily : ''} onChange={(e) => setDed({ ...ded, selfFamily: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={ded.selfSenior} onChange={(e) => {
                  const checked = e.target.checked
                  // Preserve an existing 80+ band while the box stays checked; unchecking means under 60.
                  const status = checked ? (ded.selfSeniorStatus === 'super_senior' ? 'super_senior' : 'senior') : 'normal'
                  setDed({ ...ded, selfSenior: checked, selfSeniorStatus: status })
                }} /> <span>You/spouse is 60+? (₹50k limit instead of ₹25k)</span>
              </label>
              {ded.selfSeniorStatus === 'super_senior' && (
                <p style={{ fontSize: 10.5, color: C.muted, margin: '4px 0 0 22px' }}>Marked 80+ (super senior) on the Tax page — the same ₹50k limit applies here.</p>
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.text, marginBottom: 8, fontWeight: 600 }}>Parents</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                <input type="text" inputMode="numeric" value={ded.parents > 0 ? ded.parents : ''} onChange={(e) => setDed({ ...ded, parents: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={ded.parentsSenior} onChange={(e) => setDed({ ...ded, parentsSenior: e.target.checked })} /> <span>Parents are 60+? (₹50k limit instead of ₹25k)</span>
              </label>
            </div>
            {ded.parentsSenior && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: C.text, marginBottom: 6, fontWeight: 600 }}>Medical expenditure for parents (uninsured seniors only)</label>
                <p style={{ fontSize: 10.5, color: C.muted, margin: '0 0 6px' }}>Out-of-pocket medical bills for senior parents who DON'T have health insurance. Combined with parents-premium under the ₹50k cap.</p>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                  <input type="text" inputMode="numeric" value={ded.parentsMedicalExp > 0 ? ded.parentsMedicalExp : ''} onChange={(e) => setDed({ ...ded, parentsMedicalExp: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
              </div>
            )}
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Total claimed</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(sec80D)} / {fmt(selfCap + parentsCap)}</span>
            </div>
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>Section 80D · self + family capped at ₹25k (₹50k if 60+) · parents another ₹25k (₹50k if 60+)</p>
          </div>
        )}
      </div>

      {/* Home Loan */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('24b')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('24b') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('24b') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Home loan interest</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>The interest part of your EMIs</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatePill value={sec24b} />
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('24b') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('24b') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>Interest paid this year</label>
            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ padding: '8px 8px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
              <input type="text" inputMode="numeric" value={ded.homeLoanInterest > 0 ? ded.homeLoanInterest : ''} onChange={(e) => setDed({ ...ded, homeLoanInterest: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 8px', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Claimed (capped at ₹2L)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(Math.min(ded.homeLoanInterest, 200000))}</span>
            </div>
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>Section 24(b) · cap ₹2L</p>
          </div>
        )}
      </div>

      {/* NPS */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 24, overflow: 'hidden' }}>
        <button onClick={() => toggle('nps')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('nps') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('nps') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Pension savings (NPS)</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Your own NPS contributions</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatePill value={secNps} />
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('nps') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('nps') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>NPS contribution this year</label>
            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ padding: '8px 8px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
              <input type="text" inputMode="numeric" value={ded.nps > 0 ? ded.nps : ''} onChange={(e) => setDed({ ...ded, nps: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 8px', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Claimed (capped at ₹50k)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(Math.min(ded.nps, 50000))}</span>
            </div>
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>Section 80CCD(1B) · ₹50k over and above 80C</p>
          </div>
        )}
      </div>

      {/* Section 80TTA / 80TTB — savings & FD interest */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80tta')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('80tta') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('80tta') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Savings & FD interest</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Interest your bank paid you</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatePill value={sec80TTA + sec80TTB} />
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('80tta') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('80tta') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            {!ded.selfSenior ? (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: C.text, marginBottom: 4, fontWeight: 600 }}>80TTA — Interest on savings accounts (cap ₹10k)</label>
                <p style={{ fontSize: 10.5, color: C.muted, margin: '0 0 6px' }}>FD interest is NOT eligible under 80TTA — that's taxable. Only savings-account interest.</p>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                  <input type="text" inputMode="numeric" value={ded.savingsInterest80TTA > 0 ? ded.savingsInterest80TTA : ''} onChange={(e) => setDed({ ...ded, savingsInterest80TTA: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
                <p style={{ fontSize: 10.5, color: C.muted, marginTop: 8 }}>Tick "You/spouse is 60+" in the 80D section to switch to 80TTB (covers FD too).</p>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: C.text, marginBottom: 4, fontWeight: 600 }}>80TTB — Interest on savings + FDs + RDs (cap ₹50k)</label>
                <p style={{ fontSize: 10.5, color: C.muted, margin: '0 0 6px' }}>Available because you ticked "You/spouse is 60+" above. Combined cap ₹50k across all deposit interest.</p>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ padding: '6px 6px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                  <input type="text" inputMode="numeric" value={ded.interest80TTB > 0 ? ded.interest80TTB : ''} onChange={(e) => setDed({ ...ded, interest80TTB: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '6px 6px', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
              </div>
            )}
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Claimed</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(sec80TTA + sec80TTB)} / {ded.selfSenior ? '₹50k (80TTB)' : '₹10k (80TTA)'}</span>
            </div>
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>Section 80TTA · savings interest, cap ₹10k (under 60) · 80TTB · savings + FD + RD, cap ₹50k (60+)</p>
          </div>
        )}
      </div>

      {/* Section 80E — education loan interest */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => toggle('80e')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('80e') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('80e') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Education loan interest</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>No upper limit on this one</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatePill value={sec80E} />
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('80e') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('80e') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>Interest paid this FY on a higher-education loan (for self / spouse / children / ward you legally guardian)</label>
            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ padding: '8px 8px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
              <input type="text" inputMode="numeric" value={ded.eduLoanInterest80E > 0 ? ded.eduLoanInterest80E : ''} onChange={(e) => setDed({ ...ded, eduLoanInterest80E: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder="0" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 8px', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Claimed (no cap)</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(sec80E)}</span>
            </div>
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>Section 80E · only interest, not principal · 8-year window from loan start</p>
          </div>
        )}
      </div>

      {/* Section 80G — donations, broken out by the four statutory qualifying-limit buckets */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 24, overflow: 'hidden' }}>
        <button onClick={() => toggle('80g')} style={{ width: '100%', padding: '14px 16px', background: expanded.includes('80g') ? C.wl : '#fff', border: 'none', borderBottom: expanded.includes('80g') ? `1px solid ${C.border}` : 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Donations</p>
            <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>To registered charities</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatePill value={sec80G} />
            <span style={{ fontSize: 14, color: C.fg }}>{expanded.includes('80g') ? '−' : '+'}</span>
          </div>
        </button>
        {expanded.includes('80g') && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
              <div><strong style={{ color: C.text }}>100% · No qualifying limit</strong><br/>PM CARES, PMNRF, National Defence Fund, Swachh Bharat Kosh, Clean Ganga Fund</div>
              <div><strong style={{ color: C.text }}>50% · No qualifying limit</strong><br/>JN Memorial Fund, Indira Gandhi Memorial Trust, Rajiv Gandhi Foundation, PM's Drought Relief Fund</div>
              <div><strong style={{ color: C.text }}>100% · Subject to 10% AGTI</strong><br/>Indian Olympic Association, Govt./local authority for promoting family planning</div>
              <div><strong style={{ color: C.text }}>50% · Subject to 10% AGTI</strong><br/>Most other CBDT-approved charitable trusts, registered NGOs, religious institutions</div>
            </div>

            {donationRows.length === 0 && (
              <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 10px', fontStyle: 'italic' }}>No donations added. Click "+ Add donation" to enter one.</p>
            )}

            {donationRows.map((row, idx) => (
              <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 8 }}>
                <select
                  value={row.category}
                  onChange={(e) => setDonationRows(prev => prev.map(r => r.id === row.id ? { ...r, category: e.target.value as DonationCat } : r))}
                  style={{
                    flex: '0 0 220px', height: 36, padding: '0 28px 0 10px',
                    border: `1px solid ${C.border}`, borderRadius: 4,
                    fontSize: 12, fontFamily: 'inherit', background: '#fff', color: C.text,
                    boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' as any,
                    lineHeight: '34px', cursor: 'pointer',
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M0 0l5 6 5-6z' fill='%237A8A7E'/></svg>")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                  }}
                >
                  <option value="100NoLimit">100% — no limit</option>
                  <option value="50NoLimit">50% — no limit</option>
                  <option value="100WithLimit">100% — capped at 10% of income</option>
                  <option value="50WithLimit">50% — capped at 10% of income</option>
                </select>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', height: 36, boxSizing: 'border-box' }}>
                  <span style={{ padding: '0 10px', height: '100%', display: 'flex', alignItems: 'center', background: C.wl, fontSize: 11, fontWeight: 600, color: C.fg }}>₹</span>
                  <input
                    type="text" inputMode="numeric"
                    value={row.amount > 0 ? row.amount : ''}
                    onChange={(e) => setDonationRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 } : r))}
                    placeholder="Gross donation amount"
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', height: '100%' }}
                  />
                </div>
                <button
                  onClick={() => setDonationRows(prev => prev.filter(r => r.id !== row.id))}
                  aria-label={`Remove donation ${idx + 1}`}
                  style={{ width: 36, height: 36, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 16, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}
                >×</button>
              </div>
            ))}

            <button
              onClick={() => setDonationRows(prev => [...prev, { id: 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), category: '100NoLimit', amount: 0 }])}
              style={{ marginTop: 4, padding: '8px 12px', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4, color: C.fg, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >+ Add donation</button>

            <div style={{ padding: '8px 10px', background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 4, marginTop: 12 }}>
              <p style={{ fontSize: 10.5, color: '#7A5C00', margin: 0, lineHeight: 1.45 }}>
                ⚠️ Cash donations above <strong>₹2,000</strong> are not eligible (must be via cheque/UPI/bank). 80G is <strong>not available under the new tax regime</strong>.
              </p>
            </div>

            {donationRows.length > 0 && (
              <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: C.wl, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Calculation</div>
                <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 11.5, color: C.text }}>
                  <span>100% (no limit) eligible</span><span style={{ fontWeight: 600 }}>{fmt(g100NoLimit)}</span>
                  <span>50% (no limit) eligible <span style={{ color: C.muted }}>({fmt(g50NoLimit)} × 50%)</span></span><span style={{ fontWeight: 600 }}>{fmt(0.5 * g50NoLimit)}</span>
                  <span>100% (with limit) eligible</span><span style={{ fontWeight: 600 }}>{fmt(g100WithLimit)}</span>
                  <span>50% (with limit) eligible <span style={{ color: C.muted }}>({fmt(g50WithLimit)} × 50%)</span></span><span style={{ fontWeight: 600 }}>{fmt(0.5 * g50WithLimit)}</span>
                  <span style={{ color: C.muted }}>↳ Combined "with limit" before cap</span><span style={{ color: C.muted }}>{fmt(eligibleWithLimitUncapped)}</span>
                  <span style={{ color: C.muted }}>↳ 10% of Adjusted GTI cap <span style={{ fontSize: 10 }}>(AGTI ≈ {fmt(adjustedGTI)})</span></span><span style={{ color: C.muted }}>{fmt(cap10pctAGTI)}</span>
                  <span style={{ color: C.muted }}>↳ "With limit" after cap</span><span style={{ color: C.muted }}>{fmt(eligibleWithLimit)}</span>
                </div>
              </div>
            )}

            <div style={{ padding: '10px 12px', background: C.wl, borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Total 80G claimed</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{fmt(sec80G)}</span>
            </div>
            <p style={{ fontSize: 10, color: C.faint, margin: '10px 0 0', lineHeight: 1.45 }}>Section 80G · some categories capped at 10% of income</p>
          </div>
        )}
      </div>

      {/* Tax Savings Preview */}
      {taxSavingsOld > 0 && (
        <div style={{ background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Rough savings — old regime, before your real rate</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>~{fmt(taxSavingsOld)}</p>
          <p style={{ fontSize: 10, color: C.muted, margin: '6px 0 0' }}>These deductions don't count in New Regime. Your actual saving depends on your total income and which regime you choose.</p>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/exemptions')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
        <button onClick={() => router.push('/dashboard/tax/optimizer')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Your Tax →</button>
      </div>
    </div>
  )
}
