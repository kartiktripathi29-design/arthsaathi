'use client'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { computeSec80G } from '@/lib/deductions'
import { getSalaryFacts } from '@/lib/salary-facts'
import { slabBreakdown, type SeniorStatus } from '@/lib/tax-slabs'

import { tokens as T } from '@/lib/tokens'

const C = { fg:T.teal, wheat:T.taupe, wl:T.sand, wm:T.taupeLine, bg:T.paper, card:T.card, border:T.hairline, text:T.ink, muted:T.muted, green:T.green, ivory:T.ivory, tint:T.tint, slip:T.slip, caution:T.caution, danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

// Mobile-only layout overrides (≤767px). Desktop gets no rules here, so inline styles rule untouched.
const OPT_MOBILE_CSS = `
@media (max-width: 767px) {
  .opt-slabs { grid-template-columns: 1fr !important; }
  .opt-save { grid-template-columns: 1fr !important; }
  .opt-row-sub { display: block !important; margin-left: 0 !important; }
}
`

// Pick the most appropriate ITR form based on income mix + total income.
// Rules of thumb for AY 2025-26:
//  ITR-1: resident, salary + 1 house property + interest, total ≤ ₹50L, no capital gains
//         (LTCG u/s 112A up to ₹1.25L is allowed here)
//  ITR-4: presumptive freelance/business u/s 44ADA / 44AD, total ≤ ₹50L
//  ITR-3: freelance/business with actual expenses, F&O treated as business income
//  ITR-2: capital gains beyond ITR-1 threshold, total > ₹50L, multiple houses, foreign assets
function recommendITR(otherEntries: any[], totalIncome: number): { form: 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'; reasons: string[] } {
  const reasons: string[] = []
  const hasFreelance = otherEntries.some((e: any) => e.type === 'freelance')
  const presumptiveFreelance = otherEntries.some((e: any) => e.type === 'freelance' && e.declarationMethod === 'presumptive_44ada')
  const actualFreelance = otherEntries.some((e: any) => e.type === 'freelance' && e.declarationMethod !== 'presumptive_44ada')
  const hasFno = otherEntries.some((e: any) => e.type === 'fno' && Number(e.fnoNetProfit) !== 0)
  const hasEquity = otherEntries.some((e: any) => e.type === 'equity' && (Number(e.ltcgGains) > 0 || Number(e.stcgGains) > 0))
  const hasCrypto = otherEntries.some((e: any) => e.type === 'crypto' && Number(e.cryptoGains) > 0)
  const ltcgEquityTotal = otherEntries
    .filter((e: any) => e.type === 'equity')
    .reduce((s: number, e: any) => s + Number(e.ltcgGains || 0), 0)
  const above50L = totalIncome > 5000000

  // F&O is treated as business income — forces ITR-3
  if (hasFno) {
    reasons.push('F&O trading is treated as non-speculative business income.')
    return { form: 'ITR-3', reasons }
  }
  // Freelance with actual expenses → business income → ITR-3
  if (actualFreelance) {
    reasons.push('Freelance income declared with actual expenses (not presumptive) is business income.')
    return { form: 'ITR-3', reasons }
  }
  // Presumptive freelance under ITR-4, only if total ≤ ₹50L
  if (presumptiveFreelance && !above50L && !hasEquity && !hasCrypto) {
    reasons.push('Presumptive freelance under section 44ADA + salary fits ITR-4.')
    return { form: 'ITR-4', reasons }
  }
  // Capital gains / crypto / equity → ITR-2 (unless ITR-1 LTCG threshold is met)
  if (hasCrypto) {
    reasons.push('Crypto gains (VDA income) require ITR-2.')
    return { form: 'ITR-2', reasons }
  }
  if (hasEquity) {
    const stcgEquity = otherEntries.filter((e: any) => e.type === 'equity').reduce((s: number, e: any) => s + Number(e.stcgGains || 0), 0)
    if (stcgEquity > 0 || ltcgEquityTotal > 125000) {
      reasons.push(stcgEquity > 0
        ? 'STCG on equity needs ITR-2.'
        : 'LTCG on equity above the ₹1.25L exemption needs ITR-2.')
      return { form: 'ITR-2', reasons }
    }
    reasons.push('LTCG on equity within the ₹1.25L exemption — ITR-1 still valid.')
    // fall through to total-income check
  }
  // Income > ₹50L → ITR-2
  if (above50L) {
    reasons.push('Total income exceeds ₹50L — ITR-1 / ITR-4 not allowed.')
    return { form: 'ITR-2', reasons }
  }
  // Default: salary + interest only → ITR-1
  if (presumptiveFreelance) {
    // edge case: presumptive freelance > 50L falls through to ITR-3
    reasons.push('Presumptive freelance income but cross-checks placed in ITR-3 — verify with CA.')
    return { form: 'ITR-3', reasons }
  }
  reasons.push('Salary + interest income only, within ₹50L. Standard salaried filer.')
  return { form: 'ITR-1', reasons }
}

// Slab-wise calculator that returns a breakdown for display.
// Slab math now lives in @/lib/tax-slabs (shared with the Salary forecast's TDS estimate).

// The four-form ITR cheat-sheet — kept verbatim but tucked behind a tap so the verdict above stays
// the clean, prominent thing. Collapsed by default.
function ITRFormsReference() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: C.fg }}>
        <span style={{ display: 'inline-block', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
        What about other ITR forms?
      </button>
      {open && (
        <div style={{ padding: 10, background: C.bg, borderRadius: 4, fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { code: 'ITR-1', desc: 'salary + 1 house + interest, ≤ ₹50L, no capital gains beyond ₹1.25L LTCG' },
            { code: 'ITR-2', desc: 'capital gains, crypto, ESOPs, multiple houses, foreign assets, or income > ₹50L' },
            { code: 'ITR-3', desc: 'freelance with actual expenses, business income, F&O' },
            { code: 'ITR-4', desc: 'presumptive freelance / small business u/s 44ADA / 44AD, ≤ ₹50L' },
          ].map(f => (
            <div key={f.code}><strong style={{ color: C.fg }}>{f.code}</strong> = {f.desc}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TaxOptimizerPage() {
  const router = useRouter()
  const [calc, setCalc] = useState<any>(null)
  const [calcError, setCalcError] = useState<string | null>(null)
  // Senior-citizen status — affects old-regime slabs + 80D + 80TTB. Persisted locally.
  const [seniorStatus, setSeniorStatus] = useState<SeniorStatus>('normal')
  const [parentsSenior, setParentsSenior] = useState(false)
  // Presentation-only: the detailed calculation tables collapse by default so the verdict + headline
  // numbers lead. None of these affect any computed figure.
  const [showTaxableCalc, setShowTaxableCalc] = useState(false)
  const [showCapGains, setShowCapGains] = useState(false)
  const [showSlabwise, setShowSlabwise] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  // Senior status sync — the Deductions tab now stores the lossless three-way band in
  // av_deductions.selfSeniorStatus, shared with this page. Read that first as the source of truth;
  // fall back to the legacy overlay key + binary flag for records saved before it existed.
  useEffect(() => {
    try {
      const ded = JSON.parse(localStorage.getItem('av_deductions') || '{}')
      const overlaySenior = localStorage.getItem('av_user_senior') as SeniorStatus | null
      const stored = ded?.selfSeniorStatus as SeniorStatus | undefined
      const status: SeniorStatus =
        stored === 'super_senior' || stored === 'senior' || stored === 'normal' ? stored
        : overlaySenior === 'super_senior' ? 'super_senior'
        : (ded?.selfSenior || overlaySenior === 'senior') ? 'senior'
        : 'normal'
      setSeniorStatus(status)
      if (ded?.parentsSenior) setParentsSenior(true)
    } catch {}
  }, [])
  // Writes propagate the full status to the shared deductions record (plus the legacy overlay +
  // binary mirror) so the 80+ band survives the round trip between the two tabs.
  const persistSenior = (s: SeniorStatus) => {
    setSeniorStatus(s)
    try {
      localStorage.setItem('av_user_senior', s)
      const ded = JSON.parse(localStorage.getItem('av_deductions') || '{}')
      localStorage.setItem('av_deductions', JSON.stringify({ ...ded, selfSeniorStatus: s, selfSenior: s !== 'normal' }))
    } catch {}
  }
  const persistParentsSenior = (v: boolean) => {
    setParentsSenior(v)
    try {
      localStorage.setItem('av_user_parents_senior', String(v))
      const ded = JSON.parse(localStorage.getItem('av_deductions') || '{}')
      localStorage.setItem('av_deductions', JSON.stringify({ ...ded, parentsSenior: v }))
    } catch {}
  }

  useEffect(() => {
    const salary = localStorage.getItem('av_salary_timeline')
    const other = localStorage.getItem('av_other_income')
    const exemptions = localStorage.getItem('av_exemptions')
    const deductions = localStorage.getItem('av_deductions')

    if (!salary) { setCalc(null); return }

    try {
      const salaryData = JSON.parse(salary)
      const otherData = other ? JSON.parse(other) : []
      const exemptionsData = exemptions ? JSON.parse(exemptions) : {}
      const deductionsData = deductions ? JSON.parse(deductions) : {}

      const slipsArr = Array.isArray(salaryData) ? salaryData : (salaryData.employments?.[0]?.slips || [])
      // Annual income comes from the single shared reader (getSalaryFacts): the Salary page's
      // careful month-by-month summary when available (raises, bonuses, corrections — the number
      // the user reviewed), else avg(slip) × 12. Same figure the Deductions/Exemptions pages read.
      const facts = getSalaryFacts()
      const grossSalary = facts.annualGross
      const netSalary = facts.annualNet

      // ─── Other income: split slab-taxed from special-rate (capital gains / crypto) ───────
      // Capital-gains tax depends on the ASSET behind each gain (chosen on the Other-Income form):
      //   Listed equity / equity MF → LTCG 12.5% above the ₹1.25L aggregate exemption · STCG 20%
      //   Unlisted shares           → LTCG 12.5% (NO ₹1.25L exemption) · STCG at slab
      //   Debt mutual funds         → both LTCG & STCG at slab
      // Crypto/VDA → 30% flat. Special-rate buckets are taxed in BOTH regimes and never enter the
      // slab base; the slab-taxed portions (debt MF, unlisted STCG) are folded into slabOtherIncome.
      // Legacy equity entries with no asset field default to listed_equity (prior behaviour).
      const isEquityAsset = (a: string) => a === 'listed_equity' || a === 'equity_mf'
      const otherEntries: any[] = Array.isArray(otherData) ? otherData : []
      let slabOtherIncome = 0
      let ltcgEquityTotal = 0, stcgEquityTotal = 0, ltcgUnlistedTotal = 0, cgSlabIncome = 0, cryptoTotal = 0
      for (const e of otherEntries) {
        if (e?.type === 'equity') {
          // An equity entry now holds one row per asset (rows: [{asset, ltcg, stcg}]). Older entries
          // had single ltcgAsset/stcgAsset fields — fall back to a one-row-per-leg shape for those.
          const rows: any[] = Array.isArray(e.rows) && e.rows.length
            ? e.rows
            : [
                { asset: e.ltcgAsset || 'listed_equity', ltcg: Number(e.ltcgGains) || 0, stcg: 0 },
                { asset: e.stcgAsset || 'listed_equity', ltcg: 0, stcg: Number(e.stcgGains) || 0 },
              ]
          for (const r of rows) {
            const asset = r.asset || 'listed_equity'
            const lt = Math.max(0, Number(r.ltcg) || 0)
            const st = Math.max(0, Number(r.stcg) || 0)
            if (isEquityAsset(asset)) ltcgEquityTotal += lt
            else if (asset === 'unlisted') ltcgUnlistedTotal += lt
            else cgSlabIncome += lt                                 // debt_mf LTCG → slab
            if (isEquityAsset(asset)) stcgEquityTotal += st
            else cgSlabIncome += st                                 // debt_mf / unlisted STCG → slab
          }
        } else if (e?.type === 'crypto') {
          cryptoTotal += Math.max(0, Number(e.cryptoGains) || 0)
        } else {
          slabOtherIncome += Math.max(0, Number(e?.amount) || 0)
        }
      }
      slabOtherIncome += cgSlabIncome   // debt-MF gains + unlisted STCG are taxed at slab
      const ltcgEquityTaxable = Math.max(0, ltcgEquityTotal - 125000)   // ₹1.25L exemption on aggregate equity LTCG
      const specialIncomeTotal = ltcgEquityTotal + ltcgUnlistedTotal + stcgEquityTotal + cryptoTotal
      // Special-rate tax + its own 4% cess. No 87A rebate applies to STCG 111A / LTCG 112A / 112 / VDA.
      const specialRateTax = Math.round(
        ltcgEquityTaxable * 0.125 + ltcgUnlistedTotal * 0.125 + stcgEquityTotal * 0.20 + cryptoTotal * 0.30
      )
      const specialCess = Math.round(specialRateTax * 0.04)
      const specialTaxTotal = specialRateTax + specialCess

      const hra = exemptionsData.hra || {}
      // HRA: consume the Exemptions page's computed annual figure (source of truth). Fall back to a
      // recompute using the LATEST slip's basic — the same slip the Exemptions page uses — so the two
      // agree even for legacy data saved before the computed value was persisted.
      const lastBasic = (slipsArr[slipsArr.length - 1]?.basicSalary || 0)
      const hraExempt = (typeof hra.annualExemption === 'number' && (hra.rentPaid || 0) > 0)
        ? Math.round(hra.annualExemption)
        : Math.round((hra.rentPaid ? Math.max(0, Math.min(
            hra.hraReceived || 0,
            (hra.rentPaid || 0) - lastBasic * 0.1,
            hra.isMetro ? lastBasic * 0.5 : lastBasic * 0.4
          )) : 0) * 12)
      // Section 10 exemptions beyond HRA — wizard fields from the Exemptions tab.
      // Caps enforced HERE (defence in depth) so a user entering an unrealistic figure
      // in the form doesn't silently drop taxable income to zero in old regime.
      //   LTA u/s 10(5):      effectively capped at ₹50,000 per 4-yr block (approx yearly cap ₹50k)
      //   Superannuation:     exempt up to 15% of (basic + DA); approximated as 15% of monthly basic × 12
      //   Gratuity u/s 10(10): cap ₹10,00,000 for non-govt (₹20L for govt) — using non-govt
      //   Driver salary / Car maintenance / Daily allowance / PF withdrawal:
      //     no statutory ₹ cap, but only valid under specific conditions (employer-provided car,
      //     retirement, etc.). Trust user input but flag if total exemptions look excessive.
      const ltaCap = 50000
      const superannuationCap = Math.round((lastBasic * 12) * 0.15) || 0
      const gratuityCap = 1000000
      const ltaCapped = Math.min(Number(exemptionsData.lta || 0), ltaCap)
      const superannuationCapped = superannuationCap > 0
        ? Math.min(Number(exemptionsData.superannuation || 0), superannuationCap)
        : Number(exemptionsData.superannuation || 0)
      const gratuityCapped = Math.min(Number(exemptionsData.gratuity || 0), gratuityCap)
      const otherExempts =
        ltaCapped +
        Number(exemptionsData.driverSalary || 0) +
        Number(exemptionsData.carMaintenance || 0) +
        Number(exemptionsData.dailyAllowance || 0) +
        superannuationCapped +
        Number(exemptionsData.pfWithdrawal || 0) +
        gratuityCapped +
        Number(exemptionsData.medical || 0) +
        Number(exemptionsData.other || 0)
      const totalExemptions = hraExempt + otherExempts

      // 80C — must sum the SAME nine components the Deductions page counts, else the tax calc
      // silently drops the user's largest items. employeePF (auto-prefilled from the salary slip),
      // homeLoanPrincipal, termInsurance and other80C are all valid 80C and were previously omitted.
      const sec80C = Math.min(
        (deductionsData.ppf || 0) + (deductionsData.elss || 0) + (deductionsData.lic || 0) +
        (deductionsData.tuition || 0) + (deductionsData.nsc || 0) + (deductionsData.employeePF || 0) +
        (deductionsData.homeLoanPrincipal || 0) + (deductionsData.termInsurance || 0) + (deductionsData.other80C || 0),
        150000,
      )
      // 80D — caps depend on senior-citizen status of self and parents.
      const selfCap = (seniorStatus !== 'normal') ? 50000 : 25000
      const parentsCap = parentsSenior ? 50000 : 25000
      const sec80DSelf = Math.min((deductionsData.selfFamily || 0), selfCap)
      // Parents bucket includes medical expenditure for uninsured senior parents — same as the
      // Deductions page. Previously omitted here, so that expenditure gave no tax benefit.
      const sec80DParents = Math.min(
        (deductionsData.parents || 0) + (parentsSenior ? (deductionsData.parentsMedicalExp || 0) : 0),
        parentsCap,
      )
      const sec80D = sec80DSelf + sec80DParents
      const sec24b = Math.min(deductionsData.homeLoanInterest || 0, 200000)
      const nps = Math.min(deductionsData.nps || 0, 50000)
      // 80TTA (savings interest) — only available for non-seniors, capped at ₹10k
      // 80TTB (savings + FD interest) — only available for seniors, capped at ₹50k
      const sec80TTA = seniorStatus === 'normal' ? Math.min(deductionsData.savingsInterest80TTA || 0, 10000) : 0
      const sec80TTB = seniorStatus !== 'normal' ? Math.min(deductionsData.interest80TTB || 0, 50000) : 0
      // 80E (education loan interest) — no cap, full interest paid is deductible up to 8 yrs.
      const sec80E = Math.max(0, deductionsData.eduLoanInterest80E || 0)
      // 80G (donations) — donation rows live under their own key (`av_donations80G`), written by
      // the Deductions page. The legacy single `donations80G` field on av_deductions is no longer
      // populated by the UI, so reading it gave every filer ₹0 regardless of what they donated.
      // Read the rows here and apply the statutory 50%/100% rates, capping the two "with limit"
      // buckets at 10% of Adjusted GTI — mirroring the Deductions page so both screens agree.
      let sec80G = 0
      try {
        const drData = localStorage.getItem('av_donations80G')
        const rows = drData ? JSON.parse(drData) : []
        if (Array.isArray(rows) && rows.length > 0) {
          // Adjusted GTI ≈ annual gross − other Chapter VI-A deductions (excluding 80G itself).
          const otherChapterVIA = sec80C + sec80D + sec24b + nps + sec80TTA + sec80TTB + sec80E
          const adjustedGTI = Math.max(0, grossSalary - otherChapterVIA)
          // Shared with the Deductions page via computeSec80G so the two screens agree.
          sec80G = computeSec80G(rows, adjustedGTI).deduction
        } else {
          // Back-compat: honour a legacy single-amount entry if rows were never created.
          sec80G = Math.max(0, deductionsData.donations80G || 0)
        }
      } catch {
        sec80G = Math.max(0, deductionsData.donations80G || 0)
      }
      const totalDeductions = sec80C + sec80D + sec24b + nps + sec80TTA + sec80TTB + sec80E + sec80G

      const stdDedNew = 75000
      const stdDedOld = 50000

      // Only slab-taxed other income enters the slab base. Special-rate income (CG/crypto) is taxed
      // separately below and added to the final bill in both regimes.
      const subTotalNew = grossSalary + slabOtherIncome
      // New regime DISABLES Section 10 exemptions (HRA, LTA, etc.) and Chapter VI-A deductions.
      // Only standard deduction (₹75k) and employer NPS 80CCD(2) survive. So no HRA subtraction here.
      const taxableNew = Math.max(0, subTotalNew - stdDedNew)
      const subTotalOld = grossSalary + slabOtherIncome
      const taxableOld = Math.max(0, subTotalOld - stdDedOld - totalExemptions - totalDeductions)

      const newBreak = slabBreakdown(taxableNew, 'new', 'normal') // new regime slabs are flat regardless
      const oldBreak = slabBreakdown(taxableOld, 'old', seniorStatus)
      // Grand totals add the (regime-independent) special-rate tax on capital gains / crypto.
      const newTotal = newBreak.total + specialTaxTotal
      const oldTotal = oldBreak.total + specialTaxTotal
      // ── Tax already deducted (TDS), resolved by source priority ──────────────────────────
      // 1) AIS / 26AS is authoritative — its totalTaxCredit aggregates every head (salary,
      //    crypto 194S, interest, dividends) plus advance / self-assessment tax. If present, it
      //    overrides everything else.
      // 2) Otherwise: salary-slip TDS (from the summary) + TDS on other income. Interest/dividend
      //    and freelance are estimated at 10% (194A/194/194J); crypto uses the user-entered 194S
      //    figure (1% of turnover, which can't be derived from gains). Equity capital gains carry
      //    no TDS for resident individuals, so nothing is added there.
      let aisCredit = 0
      try {
        const ais = JSON.parse(localStorage.getItem('as_ais') || 'null')
        if (ais && Number(ais.totalTaxCredit) > 0) aisCredit = Math.round(Number(ais.totalTaxCredit))
      } catch { /* ignore */ }
      // Only trust the summary's annual TDS — the slip-average fallback doesn't carry a reliable
      // TDS figure, so keep it at 0 there (unchanged from the prior behaviour).
      const salaryTDS = facts.source === 'summary' ? facts.annualTDS : 0
      let otherIncomeTDS = 0
      let otherTDSEstimated = false
      for (const e of otherEntries) {
        if (e?.type === 'interest') {
          const base = (Number(e.fdInterest) || 0) + (Number(e.dividends) || 0) // savings interest: no TDS
          if (base > 0) { otherIncomeTDS += Math.round(base * 0.10); otherTDSEstimated = true }
        } else if (e?.type === 'freelance') {
          const gross = Number(e.grossReceipts) || Number(e.amount) || 0
          if (gross > 0) { otherIncomeTDS += Math.round(gross * 0.10); otherTDSEstimated = true }
        } else if (e?.type === 'crypto') {
          otherIncomeTDS += Math.max(0, Number(e.cryptoTDS) || 0) // exact, user-entered from exchange
        }
      }
      let tdsPaid: number
      let tdsSource: 'ais' | 'estimated' | 'slip' | 'none'
      if (aisCredit > 0) {
        tdsPaid = aisCredit; tdsSource = 'ais'
      } else {
        tdsPaid = salaryTDS + otherIncomeTDS
        tdsSource = tdsPaid > 0 ? (otherTDSEstimated ? 'estimated' : 'slip') : 'none'
      }
      const newBalance = newTotal - tdsPaid   // > 0 → still payable, < 0 → refund
      const oldBalance = oldTotal - tdsPaid
      // ITR recommendation uses the full economic income (slab + special-rate) for the ₹50L threshold.
      const itr = recommendITR(otherEntries, grossSalary + slabOtherIncome + specialIncomeTotal)

      setCalc({
        grossSalary, netSalary, slabOtherIncome,
        // How the salary figure was derived — drives the "how this is computed" summary on the
        // Gross/Net rows. 'summary' = month-by-month from the reviewed timeline; 'slip-average' =
        // avg(slip) × 12. salaryMonths = months of data behind the timeline summary.
        salarySource: facts.source, salaryMonths: facts.hraBasis.length,
        // Special-rate (capital gains / crypto) income + tax
        specialIncome: { ltcg: ltcgEquityTotal, ltcgTaxable: ltcgEquityTaxable, ltcgUnlisted: ltcgUnlistedTotal, stcg: stcgEquityTotal, crypto: cryptoTotal, cgSlab: cgSlabIncome, total: specialIncomeTotal },
        specialRateTax, specialCess, specialTaxTotal,
        hraExempt, otherExempts, totalExemptions,
        sec80C, sec80D, sec24b, nps, sec80TTA, sec80TTB, sec80E, sec80G, totalDeductions,
        stdDedNew, stdDedOld,
        subTotalNew, subTotalOld,
        taxableNew, taxableOld,
        newBreak, oldBreak,
        newTotal, oldTotal,
        tdsPaid, tdsSource, newBalance, oldBalance,
        // Recommendation/savings are based on grand totals. (Special-rate tax is equal in both
        // regimes, so the difference is driven by the slab portion — but the headline now reflects
        // the full bill the user actually owes.)
        recommendation: newTotal <= oldTotal ? 'new' : 'old',
        savings: Math.abs(newTotal - oldTotal),
        hraFilled: hra.rentPaid > 0,
        itrForm: itr.form,
        itrReasons: itr.reasons,
      })
    } catch (e: any) {
      console.error('Calc failed:', e)
      setCalcError(e?.message || 'Could not compute your tax picture.')
    }
  }, [seniorStatus, parentsSenior])

  if (calcError) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: C.danger, margin: '0 0 8px' }}>Your Tax hit an error: {calcError}</p>
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Your salary data is safe. Try clearing this page's stale state and recomputing.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => { setCalcError(null); router.push('/dashboard/profile/salary') }} style={{ padding: '10px 20px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Back to salary</button>
          <button onClick={() => location.reload()} style={{ padding: '10px 20px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      </div>
    )
  }

  if (!calc) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: C.danger, margin: 0 }}>Upload a salary slip first to see your tax calculation.</p>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ marginTop: 20, padding: '10px 20px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Go to salary</button>
      </div>
    )
  }

  // Re-usable row renderer with optional link to source tab.
  const Row = ({ label, value, href, strong = false, color, indent = 0, sub }: { label: string; value: string; href?: string; strong?: boolean; color?: string; indent?: number; sub?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${C.border}`, paddingLeft: indent }}>
      <div>
        {href ? (
          <Link href={href} style={{ fontSize: strong ? 13 : 12, color: color || (strong ? C.fg : C.text), textDecoration: 'underline', fontWeight: strong ? 700 : 500 }}>{label} →</Link>
        ) : (
          <span style={{ fontSize: strong ? 13 : 12, color: color || (strong ? C.fg : C.text), fontWeight: strong ? 700 : 400 }}>{label}</span>
        )}
        {sub && <span className="opt-row-sub" style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>{sub}</span>}
      </div>
      <span style={{ fontSize: strong ? 13 : 12, color: color || C.fg, fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  )

  // Income & components row that EXPANDS in place to explain how the figure is computed, instead of
  // navigating away. An explicit "Edit at source" link inside the panel keeps navigation available.
  const ExpRow = ({ id, label, value, sub, detail, editHref, editLabel }: { id: string; label: string; value: string; sub?: string; detail: React.ReactNode; editHref?: string; editLabel?: string }) => {
    const open = !!expandedRows[id]
    return (
      <div style={{ borderBottom: `1px solid ${C.border}` }}>
        <button onClick={() => setExpandedRows(p => ({ ...p, [id]: !p[id] }))} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
            <span style={{ color: C.muted, marginRight: 6, fontSize: 10 }}>{open ? '▾' : '▸'}</span>{label}
            {sub && <span className="opt-row-sub" style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>{sub}</span>}
          </span>
          <span style={{ fontSize: 12, color: C.fg, fontWeight: 600 }}>{value}</span>
        </button>
        {open && (
          <div style={{ padding: '0 0 10px 22px' }}>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, margin: '0 0 6px' }}>{detail}</div>
            {editHref && <Link href={editHref} style={{ fontSize: 11, color: C.fg, fontWeight: 600, textDecoration: 'underline' }}>{editLabel || 'Edit at source'} →</Link>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <style>{OPT_MOBILE_CSS}</style>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Your Tax</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>Your tax picture for FY 2025-26</p>

      {/* ── Verdict hero — leads with the recommendation: regime · saving · refund/payable · ITR.
           Pure presentation of values already computed in `calc` (no math here). ── */}
      <div style={{ background: C.card, border: `2px solid ${T.teal}`, borderRadius: 10, padding: '22px 20px', marginBottom: 16, position: 'relative' as const }}>
        <span style={{ position: 'absolute' as const, top: -10, left: 16, fontSize: 10, fontWeight: 700, background: T.teal, color: T.onTeal, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.04em' }}>Recommended</span>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 24, alignItems: 'flex-start', marginTop: 2 }}>

          {/* Recommended regime + saving vs the other regime */}
          <div style={{ flex: '1 1 200px' }}>
            <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>File under</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: C.fg, margin: 0, lineHeight: 1.1 }}>{calc.recommendation === 'new' ? 'New regime' : 'Old regime'}</p>
            <p style={{ fontSize: 12.5, color: C.muted, margin: '6px 0 0' }}>Saves <strong style={{ color: T.green }}>{fmt(calc.savings)}</strong> vs the {calc.recommendation === 'new' ? 'old' : 'new'} regime</p>
          </div>

          {/* Refund due / balance payable for the recommended regime */}
          {calc.tdsPaid > 0 && (() => {
            const bal = calc.recommendation === 'new' ? calc.newBalance : calc.oldBalance
            const total = calc.recommendation === 'new' ? calc.newTotal : calc.oldTotal
            const refund = bal < 0
            return (
              <div style={{ flex: '1 1 200px' }}>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{refund ? 'Refund due' : 'Balance payable'}</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: refund ? T.green : C.fg, margin: 0, lineHeight: 1.1 }}>{fmt(Math.abs(bal))}</p>
                <p style={{ fontSize: 10, color: T.faint, margin: '3px 0 0', lineHeight: 1.4 }}>{calc.tdsSource === 'ais' ? 'TDS from your AIS / 26AS' : calc.tdsSource === 'estimated' ? 'TDS estimated' : 'TDS from your salary slips'}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0', lineHeight: 1.45 }}>Tax {fmt(total)} − TDS {fmt(calc.tdsPaid)}{refund ? ' = refund due' : ' = still to pay'}</p>
              </div>
            )
          })()}

          {/* Which ITR to file */}
          <div style={{ flex: '1 1 160px' }}>
            <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>File form</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: C.fg, margin: 0, lineHeight: 1.1 }}>{calc.itrForm}</p>
            {calc.itrReasons[0] && <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0', lineHeight: 1.45 }}>{calc.itrReasons[0]}</p>}
            <div style={{ marginTop: 4 }}><ITRFormsReference /></div>
          </div>
        </div>
      </div>

      {/* Senior-citizen + parents-senior toggles — affect old-regime slabs, 80D limits, 80TTA/80TTB eligibility */}
      <div style={{ marginBottom: 16, padding: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>You</span>
        {(['normal', 'senior', 'super_senior'] as const).map(s => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.text, cursor: 'pointer' }}>
            <input type="radio" name="senior" checked={seniorStatus === s} onChange={() => persistSenior(s)} />
            {s === 'normal' ? 'Under 60' : s === 'senior' ? 'Senior (60-79)' : 'Super senior (80+)'}
          </label>
        ))}
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: 12 }}>Parents</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.text, cursor: 'pointer' }}>
          <input type="checkbox" checked={parentsSenior} onChange={e => persistParentsSenior(e.target.checked)} />
          Parents are 60+ (lifts 80D cap to ₹50k for them)
        </label>
      </div>

      {/* ── Income (linked to their respective heads) ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income & components</h3>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px' }}>Tap any line to see how it’s worked out.</p>
        <ExpRow id="gross" label="Gross salary" value={fmt(calc.grossSalary)} editHref="/dashboard/profile/salary" editLabel="View in Salary"
          detail={(() => {
            const monthly = Math.round(calc.grossSalary / 12)
            const wrow = (l: React.ReactNode, v: string, opts?: { strong?: boolean; top?: boolean }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', borderTop: opts?.top ? `1px solid ${C.border}` : undefined }}>
                <span style={{ color: C.text }}>{l}</span><span style={{ color: C.fg, fontWeight: opts?.strong ? 700 : 500 }}>{v}</span>
              </div>
            )
            return (
              <>
                {wrow('Average monthly gross', `≈ ${fmt(monthly)}`)}
                {wrow('× 12 months', fmt(calc.grossSalary), { strong: true, top: true })}
                <p style={{ margin: '6px 0 0', lineHeight: 1.55 }}>
                  {calc.salarySource === 'summary'
                    ? <>Summed month-by-month from your salary timeline{calc.salaryMonths ? ` (${calc.salaryMonths} month${calc.salaryMonths > 1 ? 's' : ''} of data)` : ''} — it already includes any mid-year raises, bonuses and job switches, so the monthly figure above is the average.</>
                    : calc.salarySource === 'slip-average'
                    ? <>Estimated as your average monthly gross × 12. Upload more months on the Salary page for a precise, month-by-month figure.</>
                    : <>From the salary data on the Salary page.</>}
                </p>
              </>
            )
          })()} />
        <ExpRow id="net" label="Net salary" value={fmt(calc.netSalary)} editHref="/dashboard/profile/salary" editLabel="View in Salary"
          detail={(() => {
            const ded = Math.max(0, calc.grossSalary - calc.netSalary)
            const wrow = (l: React.ReactNode, v: string, opts?: { strong?: boolean; top?: boolean; danger?: boolean }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', borderTop: opts?.top ? `1px solid ${C.border}` : undefined }}>
                <span style={{ color: C.text }}>{l}</span><span style={{ color: opts?.danger ? C.danger : C.fg, fontWeight: opts?.strong ? 700 : 500 }}>{v}</span>
              </div>
            )
            return (
              <>
                {wrow('Gross salary', fmt(calc.grossSalary))}
                {wrow('− Statutory deductions (PF · PT · TDS)', `−${fmt(ded)}`, { danger: true })}
                {wrow('= Net (take-home)', fmt(calc.netSalary), { strong: true, top: true })}
                <p style={{ margin: '6px 0 0', lineHeight: 1.55 }}>Deductions your employer withholds before pay-out. The TDS portion is tax already paid — it’s credited against your final bill in the verdict above.</p>
              </>
            )
          })()} />
        <ExpRow id="otherslab" label="Other income (slab-taxed)" value={fmt(calc.slabOtherIncome)} sub="freelance · F&O · interest · other" editHref="/dashboard/profile/other-income" editLabel="Edit in Other earnings"
          detail={<>Income taxed at your normal slab rate — freelance / consulting, F&amp;O / intraday, interest &amp; dividends, and any “other” income, plus debt-fund and unlisted-STCG gains that fall to slab. Open Other earnings to see each source.</>} />
        {calc.specialIncome.total > 0 && (
          <ExpRow id="special" label="Capital gains / crypto (special rate)" value={fmt(calc.specialIncome.total)} sub="taxed separately — not at slab" editHref="/dashboard/profile/other-income" editLabel="Edit in Other earnings"
            detail={<>Equity LTCG/STCG, unlisted-share LTCG and crypto are taxed at flat statutory rates — <strong>not</strong> your slab rate — so they’re kept out of the slab income below. See the “Capital gains &amp; crypto” breakdown for the rate on each.</>} />
        )}
        <ExpRow id="exemptions" label="Total exemptions" value={fmt(calc.totalExemptions)} sub={`HRA ${fmt(calc.hraExempt)} · Other ${fmt(calc.otherExempts)}`} editHref="/dashboard/profile/exemptions" editLabel="Edit in Allowances"
          detail={<>HRA exemption <strong>{fmt(calc.hraExempt)}</strong> + other Section 10 exemptions (LTA, gratuity, etc.) <strong>{fmt(calc.otherExempts)}</strong>. These reduce taxable income under the <strong>old regime only</strong>.</>} />
        {/* Sanity warning — exemptions north of 40% of gross are almost always a data-entry error
            (e.g., PF withdrawal or gratuity entered while still employed). Flag it and link to fix. */}
        {calc.grossSalary > 0 && calc.totalExemptions > calc.grossSalary * 0.4 && (
          <div style={{ marginTop: 8, padding: '10px 12px', background: C.caution.fill, border: `1px solid ${C.wm}`, borderRadius: 4 }}>
            <p style={{ fontSize: 11, color: C.caution.text, margin: 0, lineHeight: 1.5 }}>
              ⚠️ <strong>Exemptions {fmt(calc.totalExemptions)} are {Math.round(calc.totalExemptions / calc.grossSalary * 100)}% of gross salary</strong> — unusually high. Common causes: <strong>PF withdrawal</strong> or <strong>Gratuity</strong> entered while still employed (these only apply on retirement / separation), or <strong>Driver/Car/Daily-allowance</strong> entered without the employer actually providing those perks. <Link href="/dashboard/profile/exemptions" style={{ color: C.caution.text, textDecoration: 'underline' }}>Review exemptions →</Link>
            </p>
          </div>
        )}
        <ExpRow
          id="deductions"
          label="Total deductions"
          value={fmt(calc.totalDeductions)}
          editHref="/dashboard/profile/deductions"
          editLabel="Edit in Deductions"
          detail={<>Chapter VI-A deductions (old regime only): {[
            `80C ${fmt(calc.sec80C)}`,
            `80D ${fmt(calc.sec80D)}`,
            `24(b) ${fmt(calc.sec24b)}`,
            `NPS ${fmt(calc.nps)}`,
            calc.sec80TTA > 0 ? `80TTA ${fmt(calc.sec80TTA)}` : null,
            calc.sec80TTB > 0 ? `80TTB ${fmt(calc.sec80TTB)}` : null,
            calc.sec80E > 0 ? `80E ${fmt(calc.sec80E)}` : null,
            calc.sec80G > 0 ? `80G ${fmt(calc.sec80G)}` : null,
          ].filter(Boolean).join(' · ')}.</>}
        />

      </div>

      {/* ── How taxable income was computed (collapsed by default) ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <button onClick={() => setShowTaxableCalc(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>How taxable income is computed</h3>
          <span style={{ fontSize: 12, color: C.muted }}>{showTaxableCalc ? '− Hide' : '+ Show'}</span>
        </button>
        {showTaxableCalc && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0, fontSize: 12, marginTop: 12 }}>
          <div style={{ padding: '6px 8px', background: C.wl, fontWeight: 700, color: C.fg, borderBottom: `1px solid ${C.border}` }}></div>
          <div style={{ padding: '6px 8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>New regime</div>
          <div style={{ padding: '6px 8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Old regime</div>

          {[
            ['Gross salary', calc.grossSalary, calc.grossSalary],
            ['+ Other income (slab)', calc.slabOtherIncome, calc.slabOtherIncome],
            ['= Sub-total', calc.subTotalNew, calc.subTotalOld],
            ['− Standard deduction', -calc.stdDedNew, -calc.stdDedOld],
            // New regime does NOT allow Section 10 exemptions (HRA / LTA / etc.) — show "—".
            ['− Exemptions (HRA, LTA, etc.)', 0, -calc.totalExemptions],
            // New regime also disables Chapter VI-A deductions (80C / 80D / 24(b) / NPS 80CCD(1B)).
            ['− Chapter VI-A deductions', 0, -calc.totalDeductions],
          ].map((row, i) => {
            const label = row[0] as string
            const newVal = row[1] as number
            const oldVal = row[2] as number
            const newIsBlocked = newVal === 0 && (label.startsWith('− Chapter') || label.startsWith('− Exemptions'))
            return (
              <Fragment key={i}>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.text }}>{label}</div>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: newIsBlocked ? C.muted : (newVal < 0 ? C.danger : C.fg) }}>
                  {newIsBlocked ? '— (not allowed)' : fmt(Math.abs(newVal))}
                </div>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: oldVal < 0 ? C.danger : C.fg }}>
                  {fmt(Math.abs(oldVal))}
                </div>
              </Fragment>
            )
          })}

          <div style={{ padding: '8px', background: C.wl, fontWeight: 700, color: C.fg }}>Taxable income</div>
          <div style={{ padding: '8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right' }}>{fmt(calc.taxableNew)}</div>
          <div style={{ padding: '8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right' }}>{fmt(calc.taxableOld)}</div>
        </div>
        <p style={{ fontSize: 10.5, color: C.muted, margin: '10px 0 0', lineHeight: 1.5 }}>
          Capital gains and crypto are <strong>excluded</strong> from the slab income above — they are taxed at their own statutory rates (shown below) and added to the final bill in both regimes.
        </p>
        </>)}
      </div>

      {/* ── Capital gains & crypto — special-rate breakdown (collapsed by default) ── */}
      {calc.specialIncome.total > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <button onClick={() => setShowCapGains(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capital gains &amp; crypto · special rates</h3>
            <span style={{ fontSize: 12, color: C.muted }}>{showCapGains ? '− Hide' : '+ Show'} · {fmt(calc.specialTaxTotal)} tax</span>
          </button>
          {showCapGains && (<>
          <p style={{ fontSize: 11, color: C.muted, margin: '10px 0 10px' }}>Taxed at flat statutory rates, not slab. Same in both regimes.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11.5 }}>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Type</div>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Gains</div>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Rate</div>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Tax</div>
            {[
              { label: 'Equity LTCG (>1yr)', gains: calc.specialIncome.ltcg, taxable: calc.specialIncome.ltcgTaxable, rate: 0.125, tax: Math.round(calc.specialIncome.ltcgTaxable * 0.125), note: 'after ₹1.25L exemption' },
              { label: 'Unlisted shares LTCG', gains: calc.specialIncome.ltcgUnlisted, taxable: calc.specialIncome.ltcgUnlisted, rate: 0.125, tax: Math.round(calc.specialIncome.ltcgUnlisted * 0.125), note: 'no ₹1.25L exemption' },
              { label: 'Equity STCG (≤1yr)', gains: calc.specialIncome.stcg, taxable: calc.specialIncome.stcg, rate: 0.20, tax: Math.round(calc.specialIncome.stcg * 0.20), note: '' },
              { label: 'Crypto / VDA', gains: calc.specialIncome.crypto, taxable: calc.specialIncome.crypto, rate: 0.30, tax: Math.round(calc.specialIncome.crypto * 0.30), note: 'no deductions' },
            ].filter(r => r.gains > 0).map((r, i) => (
              <Fragment key={i}>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.text }}>{r.label}{r.note ? <span style={{ color: C.muted, fontSize: 10 }}> · {r.note}</span> : null}</div>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: C.text }}>{fmt(r.gains)}</div>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: C.text }}>{r.rate * 100}%</div>
                <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', fontWeight: 600, color: C.fg }}>{fmt(r.tax)}</div>
              </Fragment>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 4 }}>
            <Row label="Special-rate tax" value={fmt(calc.specialRateTax)} />
            <Row label="Health & Edu cess (4%)" value={fmt(calc.specialCess)} />
            <Row label="Total (added to both regimes)" value={fmt(calc.specialTaxTotal)} strong />
          </div>
          </>)}
        </div>
      )}

      {/* ── Slab-wise breakup — side-by-side comparison (collapsed by default) ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <button onClick={() => setShowSlabwise(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slab-wise breakup · both regimes</h3>
          <span style={{ fontSize: 12, color: C.muted }}>{showSlabwise ? '− Hide' : '+ Show'} · New {fmt(calc.newTotal)} · Old {fmt(calc.oldTotal)}</span>
        </button>
        {showSlabwise && (
        <div className="opt-slabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
      <div style={{ background: calc.recommendation === 'new' ? C.tint : C.card, border: `2px solid ${calc.recommendation === 'new' ? C.fg : C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New regime · slab-wise</h3>
          {calc.recommendation === 'new' && <span style={{ fontSize: 9, fontWeight: 700, background: C.fg, color: T.onTeal, padding: '3px 8px', borderRadius: 3 }}>Recommended</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11.5 }}>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Rate</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Amount in slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Tax</div>
          {calc.newBreak.rows.map((r: any, i: number) => (
            <Fragment key={i}>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: r.tax > 0 ? C.text : C.muted }}>{r.label}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{Math.round(r.rate * 100)}%</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{fmt(r.inSlab)}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', fontWeight: r.tax > 0 ? 600 : 400, color: r.tax > 0 ? C.fg : C.muted }}>{fmt(r.tax)}</div>
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 4 }}>
          <Row label="Basic tax" value={fmt(calc.newBreak.basicTax)} />
          {calc.newBreak.rebate > 0 && <Row label="− 87A rebate" value={fmt(calc.newBreak.rebate)} color={C.danger} />}
          {calc.newBreak.surcharge > 0 && <Row label="+ Surcharge" value={fmt(calc.newBreak.surcharge)} />}
          <Row label="Health & Edu cess (4%)" value={fmt(calc.newBreak.cess)} />
          {calc.specialTaxTotal > 0 ? (
            <>
              <Row label="Tax on salary / slab income" value={fmt(calc.newBreak.total)} />
              <Row label="+ Capital gains / crypto tax" value={fmt(calc.specialTaxTotal)} sub="incl. 4% cess" />
              <Row label="Total tax payable" value={fmt(calc.newTotal)} strong />
            </>
          ) : (
            <Row label="Total tax" value={fmt(calc.newBreak.total)} strong />
          )}
          {calc.tdsPaid > 0 && (
            <>
              <Row label="− TDS already deducted" value={fmt(calc.tdsPaid)} color={C.danger} />
              <Row label={calc.newBalance >= 0 ? 'Balance tax payable' : 'Expected refund'} value={fmt(Math.abs(calc.newBalance))} strong color={calc.newBalance >= 0 ? C.fg : C.green} />
            </>
          )}
        </div>
      </div>

      {/* ── Slab-wise breakup — Old regime ── */}
      <div style={{ background: calc.recommendation === 'old' ? C.tint : C.card, border: `2px solid ${calc.recommendation === 'old' ? C.fg : C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Old regime · slab-wise</h3>
          {calc.recommendation === 'old' && <span style={{ fontSize: 9, fontWeight: 700, background: C.fg, color: T.onTeal, padding: '3px 8px', borderRadius: 3 }}>Recommended</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11.5 }}>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Rate</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Amount in slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Tax</div>
          {calc.oldBreak.rows.map((r: any, i: number) => (
            <Fragment key={i}>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: r.tax > 0 ? C.text : C.muted }}>{r.label}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{Math.round(r.rate * 100)}%</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{fmt(r.inSlab)}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', fontWeight: r.tax > 0 ? 600 : 400, color: r.tax > 0 ? C.fg : C.muted }}>{fmt(r.tax)}</div>
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 4 }}>
          <Row label="Basic tax" value={fmt(calc.oldBreak.basicTax)} />
          {calc.oldBreak.rebate > 0 && <Row label="− 87A rebate" value={fmt(calc.oldBreak.rebate)} color={C.danger} />}
          {calc.oldBreak.surcharge > 0 && <Row label="+ Surcharge" value={fmt(calc.oldBreak.surcharge)} />}
          <Row label="Health & Edu cess (4%)" value={fmt(calc.oldBreak.cess)} />
          {calc.specialTaxTotal > 0 ? (
            <>
              <Row label="Tax on salary / slab income" value={fmt(calc.oldBreak.total)} />
              <Row label="+ Capital gains / crypto tax" value={fmt(calc.specialTaxTotal)} sub="incl. 4% cess" />
              <Row label="Total tax payable" value={fmt(calc.oldTotal)} strong />
            </>
          ) : (
            <Row label="Total tax" value={fmt(calc.oldBreak.total)} strong />
          )}
          {calc.tdsPaid > 0 && (
            <>
              <Row label="− TDS already deducted" value={fmt(calc.tdsPaid)} color={C.danger} />
              <Row label={calc.oldBalance >= 0 ? 'Balance tax payable' : 'Expected refund'} value={fmt(Math.abs(calc.oldBalance))} strong color={calc.oldBalance >= 0 ? C.fg : C.green} />
            </>
          )}
        </div>
      </div>
      </div>
      )}
      </div>

      {/* ── Where you can save more ── */}
      <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 16px' }}>Where you can save more</h3>

        {!calc.hraFilled && calc.grossSalary > 0 && (
          <div style={{ padding: '12px', background: C.caution.fill, border: `1px solid ${C.wm}`, borderRadius: 6, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: C.caution.text, margin: 0, fontWeight: 500 }}>💡 You haven't entered rent details. If you pay rent, fill <Link href="/dashboard/profile/exemptions" style={{ color: C.caution.text, textDecoration: 'underline' }}>Allowances</Link> to claim HRA and save more.</p>
          </div>
        )}

        {(() => {
          // Only surface deductions that still have UNUSED headroom — a fully-claimed deduction
          // (gap = 0) is not a saving opportunity, so it must not appear under "save more".
          const saveItems = [
            { label: 'Home Loan Interest', limit: 200000, used: calc.sec24b },
            { label: '80C Investments', limit: 150000, used: calc.sec80C },
            { label: 'Health Insurance (80D)', limit: 100000, used: calc.sec80D },
            { label: 'NPS (80CCD(1B))', limit: 50000, used: calc.nps },
          ].filter(s => Math.max(0, s.limit - s.used) > 0)
          if (saveItems.length === 0) {
            return (
              <div style={{ padding: '12px', background: C.slip.fill, border: `1px solid ${C.slip.border}`, borderRadius: 6 }}>
                <p style={{ fontSize: 11.5, color: C.green, margin: 0, fontWeight: 500 }}>✓ You&apos;ve used all the major deduction limits (80C, 80D, NPS, home-loan interest). Nothing more to claim here.</p>
              </div>
            )
          }
          return (
          <div className="opt-save" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {saveItems.map(s => {
            const gap = Math.max(0, s.limit - s.used)
            const slabRate = 0.30   // assume 30% marginal slab for upper-middle salary
            const yearlyTaxSaved = gap * slabRate
            return (
              <Link key={s.label} href="/dashboard/profile/deductions" style={{ display: 'block', padding: '10px', background: T.card, borderRadius: 4, border: `1px solid ${C.border}`, textDecoration: 'none', color: 'inherit' }}>
                <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>{fmt(gap)} unused</p>
                <p style={{ fontSize: 9, color: C.muted, margin: '4px 0 0' }}>Annual tax saved ~{fmt(yearlyTaxSaved)}</p>
                <p style={{ fontSize: 10, color: C.fg, margin: '6px 0 0', fontWeight: 600 }}>Add at source →</p>
              </Link>
            )
          })}
          </div>
          )
        })()}
        <p style={{ fontSize: 10, color: C.muted, margin: '12px 0 0', fontStyle: 'italic' }}>Only invest if it makes financial sense — tax saving is a bonus, not the goal.</p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/deductions')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Edit deductions</button>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Done · Back to salary</button>
      </div>
    </div>
  )
}
