'use client'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

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
// Honors regime + senior-citizen status (old regime only — new regime slabs are flat).
type SeniorStatus = 'normal' | 'senior' | 'super_senior'
interface SlabRow { label: string; rate: number; inSlab: number; tax: number }
interface SlabResult { rows: SlabRow[]; basicTax: number; rebate: number; surcharge: number; cess: number; total: number }

function oldRegimeSlabs(seniorStatus: SeniorStatus): [number, number, number, string][] {
  if (seniorStatus === 'super_senior') {
    return [
      [0, 500000, 0, '₹0 – ₹5L'],
      [500000, 1000000, 0.20, '₹5L – ₹10L'],
      [1000000, Number.POSITIVE_INFINITY, 0.30, '₹10L+'],
    ]
  }
  if (seniorStatus === 'senior') {
    return [
      [0, 300000, 0, '₹0 – ₹3L'],
      [300000, 500000, 0.05, '₹3L – ₹5L'],
      [500000, 1000000, 0.20, '₹5L – ₹10L'],
      [1000000, Number.POSITIVE_INFINITY, 0.30, '₹10L+'],
    ]
  }
  return [
    [0, 250000, 0, '₹0 – ₹2.5L'],
    [250000, 500000, 0.05, '₹2.5L – ₹5L'],
    [500000, 1000000, 0.20, '₹5L – ₹10L'],
    [1000000, Number.POSITIVE_INFINITY, 0.30, '₹10L+'],
  ]
}

// Surcharge ladder. Old regime: 10/15/25/37%. New regime: capped at 25%.
function calcSurcharge(taxableIncome: number, taxAfterRebate: number, regime: 'new' | 'old'): number {
  if (taxableIncome <= 5000000) return 0
  let rate = 0
  if (taxableIncome <= 10000000) rate = 0.10
  else if (taxableIncome <= 20000000) rate = 0.15
  else if (taxableIncome <= 50000000) rate = 0.25
  else rate = regime === 'new' ? 0.25 : 0.37
  return taxAfterRebate * rate
}

function slabBreakdown(taxable: number, regime: 'new' | 'old', seniorStatus: SeniorStatus = 'normal'): SlabResult {
  const slabs: [number, number, number, string][] = regime === 'new'
    ? [
        [0, 400000, 0,     '₹0 – ₹4L'],
        [400000, 800000, 0.05, '₹4L – ₹8L'],
        [800000, 1200000, 0.10, '₹8L – ₹12L'],
        [1200000, 1600000, 0.15, '₹12L – ₹16L'],
        [1600000, 2000000, 0.20, '₹16L – ₹20L'],
        [2000000, 2400000, 0.25, '₹20L – ₹24L'],
        [2400000, Number.POSITIVE_INFINITY, 0.30, '₹24L+'],
      ]
    : oldRegimeSlabs(seniorStatus)
  const rows: SlabRow[] = []
  let basicTax = 0
  for (const [min, max, rate, label] of slabs) {
    const inSlab = Math.max(0, Math.min(taxable, max) - min)
    const tax = inSlab * rate
    rows.push({ label, rate, inSlab, tax })
    basicTax += tax
  }
  // 87A rebate (FY 2025-26):
  //   New regime: taxable ≤ ₹12L → rebate up to ₹60k + marginal relief above ₹12L
  //   Old regime: taxable ≤ ₹5L → rebate up to ₹12,500
  let rebate = 0
  if (regime === 'new') {
    if (taxable <= 1200000) {
      rebate = Math.min(basicTax, 60000)
    } else {
      const exceeds12L = taxable - 1200000
      if (basicTax > exceeds12L) rebate = basicTax - exceeds12L
    }
  } else {
    if (taxable <= 500000) rebate = Math.min(basicTax, 12500)
  }
  const taxAfterRebate = Math.max(0, basicTax - rebate)
  const surcharge = calcSurcharge(taxable, taxAfterRebate, regime)
  const cess = (taxAfterRebate + surcharge) * 0.04
  const total = Math.round(taxAfterRebate + surcharge + cess)
  return {
    rows,
    basicTax: Math.round(basicTax),
    rebate: Math.round(rebate),
    surcharge: Math.round(surcharge),
    cess: Math.round(cess),
    total,
  }
}

export default function TaxOptimizerPage() {
  const router = useRouter()
  const [calc, setCalc] = useState<any>(null)
  const [calcError, setCalcError] = useState<string | null>(null)
  // Senior-citizen status — affects old-regime slabs + 80D + 80TTB. Persisted locally.
  const [seniorStatus, setSeniorStatus] = useState<SeniorStatus>('normal')
  const [parentsSenior, setParentsSenior] = useState(false)

  // Senior status sync — Deductions tab stores selfSenior/parentsSenior (binary 60+). The optimizer's
  // own av_user_senior key can escalate self to 'super_senior' (80+). Read deductions first as the
  // primary truth; only use the optimizer-only key if deductions says no.
  useEffect(() => {
    try {
      const ded = JSON.parse(localStorage.getItem('av_deductions') || '{}')
      const overlaySenior = localStorage.getItem('av_user_senior') as SeniorStatus | null
      if (overlaySenior === 'super_senior') setSeniorStatus('super_senior')
      else if (ded?.selfSenior || overlaySenior === 'senior') setSeniorStatus('senior')
      if (ded?.parentsSenior) setParentsSenior(true)
    } catch {}
  }, [])
  // Writes propagate to BOTH the deductions data and the optimizer overlay so the two tabs stay aligned.
  const persistSenior = (s: SeniorStatus) => {
    setSeniorStatus(s)
    try {
      localStorage.setItem('av_user_senior', s)
      const ded = JSON.parse(localStorage.getItem('av_deductions') || '{}')
      localStorage.setItem('av_deductions', JSON.stringify({ ...ded, selfSenior: s !== 'normal' }))
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
      const monthlyAvgGross = slipsArr.length > 0
        ? slipsArr.reduce((s: number, slip: any) => s + (slip.grossSalary || 0), 0) / slipsArr.length
        : 0
      const monthlyAvgNet = slipsArr.length > 0
        ? slipsArr.reduce((s: number, slip: any) => s + (slip.netSalary || slip.basicSalary || 0), 0) / slipsArr.length
        : 0
      // Annual income: prefer the Salary page's careful month-by-month summary (raises, bonuses,
      // corrections) so the tax verdict is computed off the number the user actually reviewed.
      // Fall back to avg(slip) × 12 only for users who haven't re-saved the salary wizard.
      const salarySummary = (() => {
        try { return JSON.parse(localStorage.getItem('av_salary_summary') || 'null') } catch { return null }
      })()
      const grossSalary = (salarySummary && (salarySummary.annualGross || 0) > 0)
        ? Math.round(salarySummary.annualGross)
        : Math.round(monthlyAvgGross * 12)
      const netSalary = (salarySummary && (salarySummary.annualGross || 0) > 0)
        ? Math.round(salarySummary.annualNet || 0)
        : Math.round(monthlyAvgNet * 12)

      // ─── Other income: split slab-taxed from special-rate (capital gains / crypto) ───────
      // Equity LTCG (12.5% above ₹1.25L aggregate), equity STCG (20%), crypto/VDA (30%) are taxed
      // at special rates in BOTH regimes — they must NOT enter the slab base. Everything else
      // (freelance, F&O, interest, other) is slab income, using each entry's precomputed taxable `amount`.
      const otherEntries: any[] = Array.isArray(otherData) ? otherData : []
      let slabOtherIncome = 0
      let ltcgEquityTotal = 0, stcgEquityTotal = 0, cryptoTotal = 0
      for (const e of otherEntries) {
        if (e?.type === 'equity') {
          ltcgEquityTotal += Math.max(0, Number(e.ltcgGains) || 0)
          stcgEquityTotal += Math.max(0, Number(e.stcgGains) || 0)
        } else if (e?.type === 'crypto') {
          cryptoTotal += Math.max(0, Number(e.cryptoGains) || 0)
        } else {
          slabOtherIncome += Math.max(0, Number(e?.amount) || 0)
        }
      }
      const ltcgEquityTaxable = Math.max(0, ltcgEquityTotal - 125000)   // ₹1.25L exemption on aggregate LTCG
      const specialIncomeTotal = ltcgEquityTotal + stcgEquityTotal + cryptoTotal
      // Special-rate tax + its own 4% cess. No 87A rebate applies to STCG 111A / LTCG 112A / VDA.
      const specialRateTax = Math.round(ltcgEquityTaxable * 0.125 + stcgEquityTotal * 0.20 + cryptoTotal * 0.30)
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
          const sumCat = (cat: string) => rows
            .filter((r: any) => r.category === cat)
            .reduce((s: number, r: any) => s + Math.max(0, r.amount || 0), 0)
          const eligibleNoLimit = sumCat('100NoLimit') + 0.5 * sumCat('50NoLimit')
          const eligibleWithLimitUncapped = sumCat('100WithLimit') + 0.5 * sumCat('50WithLimit')
          // Adjusted GTI ≈ annual gross − other Chapter VI-A deductions (excluding 80G itself).
          const otherChapterVIA = sec80C + sec80D + sec24b + nps + sec80TTA + sec80TTB + sec80E
          const adjustedGTI = Math.max(0, grossSalary - otherChapterVIA)
          const eligibleWithLimit = Math.min(eligibleWithLimitUncapped, Math.round(adjustedGTI * 0.10))
          sec80G = Math.round(eligibleNoLimit + eligibleWithLimit)
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
      const salaryTDS = (salarySummary && (salarySummary.annualGross || 0) > 0) ? Math.round(salarySummary.annualTDS || 0) : 0
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
        // Special-rate (capital gains / crypto) income + tax
        specialIncome: { ltcg: ltcgEquityTotal, ltcgTaxable: ltcgEquityTaxable, stcg: stcgEquityTotal, crypto: cryptoTotal, total: specialIncomeTotal },
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
        <p style={{ fontSize: 14, color: C.danger, margin: '0 0 8px' }}>Tax Optimizer hit an error: {calcError}</p>
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>Your salary data is safe. Try clearing this page's stale state and recomputing.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => { setCalcError(null); router.push('/dashboard/profile/salary') }} style={{ padding: '10px 20px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Back to Salary</button>
          <button onClick={() => location.reload()} style={{ padding: '10px 20px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      </div>
    )
  }

  if (!calc) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: C.danger, margin: 0 }}>Upload a salary slip first to see your tax calculation.</p>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ marginTop: 20, padding: '10px 20px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Go to Salary</button>
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
        {sub && <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>{sub}</span>}
      </div>
      <span style={{ fontSize: strong ? 13 : 12, color: color || C.fg, fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Tax Optimization</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>Your tax picture for FY 2025-26</p>

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
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income & components</h3>
        <Row label="Gross salary" value={fmt(calc.grossSalary)} href="/dashboard/profile/salary" />
        <Row label="Net salary" value={fmt(calc.netSalary)} href="/dashboard/profile/salary" />
        <Row label="Other income (slab-taxed)" value={fmt(calc.slabOtherIncome)} href="/dashboard/profile/other-income" sub="freelance · F&O · interest · other" />
        {calc.specialIncome.total > 0 && (
          <Row label="Capital gains / crypto (special rate)" value={fmt(calc.specialIncome.total)} href="/dashboard/profile/other-income" sub="taxed separately — not at slab" />
        )}
        <Row label="Total exemptions" value={fmt(calc.totalExemptions)} href="/dashboard/profile/exemptions" sub={`HRA ${fmt(calc.hraExempt)} · Other ${fmt(calc.otherExempts)}`} />
        {/* Sanity warning — exemptions north of 40% of gross are almost always a data-entry error
            (e.g., PF withdrawal or gratuity entered while still employed). Flag it and link to fix. */}
        {calc.grossSalary > 0 && calc.totalExemptions > calc.grossSalary * 0.4 && (
          <div style={{ marginTop: 8, padding: '10px 12px', background: '#FFF3DD', border: `1px solid ${C.wm}`, borderRadius: 4 }}>
            <p style={{ fontSize: 11, color: '#856404', margin: 0, lineHeight: 1.5 }}>
              ⚠️ <strong>Exemptions {fmt(calc.totalExemptions)} are {Math.round(calc.totalExemptions / calc.grossSalary * 100)}% of gross salary</strong> — unusually high. Common causes: <strong>PF withdrawal</strong> or <strong>Gratuity</strong> entered while still employed (these only apply on retirement / separation), or <strong>Driver/Car/Daily-allowance</strong> entered without the employer actually providing those perks. <Link href="/dashboard/profile/exemptions" style={{ color: '#856404', textDecoration: 'underline' }}>Review exemptions →</Link>
            </p>
          </div>
        )}
        <Row
          label="Total deductions"
          value={fmt(calc.totalDeductions)}
          href="/dashboard/profile/deductions"
          sub={[
            `80C ${fmt(calc.sec80C)}`,
            `80D ${fmt(calc.sec80D)}`,
            `24(b) ${fmt(calc.sec24b)}`,
            `NPS ${fmt(calc.nps)}`,
            calc.sec80TTA > 0 ? `80TTA ${fmt(calc.sec80TTA)}` : null,
            calc.sec80TTB > 0 ? `80TTB ${fmt(calc.sec80TTB)}` : null,
            calc.sec80E > 0 ? `80E ${fmt(calc.sec80E)}` : null,
            calc.sec80G > 0 ? `80G ${fmt(calc.sec80G)}` : null,
          ].filter(Boolean).join(' · ')}
        />

      </div>

      {/* ── How taxable income was computed ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How taxable income is computed</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0, fontSize: 12 }}>
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
      </div>

      {/* ── Capital gains & crypto — special-rate breakdown (both regimes) ── */}
      {calc.specialIncome.total > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capital gains &amp; crypto · special rates</h3>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px' }}>Taxed at flat statutory rates, not slab. Same in both regimes.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11.5 }}>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Type</div>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Gains</div>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Rate</div>
            <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Tax</div>
            {[
              { label: 'Equity LTCG (>1yr)', gains: calc.specialIncome.ltcg, taxable: calc.specialIncome.ltcgTaxable, rate: 0.125, tax: Math.round(calc.specialIncome.ltcgTaxable * 0.125), note: 'after ₹1.25L exemption' },
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
        </div>
      )}

      {/* ── Slab-wise breakup — side-by-side comparison ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      <div style={{ background: calc.recommendation === 'new' ? '#F0F9F7' : C.card, border: `2px solid ${calc.recommendation === 'new' ? C.fg : C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New regime · slab-wise</h3>
          {calc.recommendation === 'new' && <span style={{ fontSize: 9, fontWeight: 700, background: C.fg, color: '#fff', padding: '3px 8px', borderRadius: 3 }}>✓ RECOMMENDED</span>}
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
              <Row label={calc.newBalance >= 0 ? 'Balance tax payable' : 'Expected refund'} value={fmt(Math.abs(calc.newBalance))} strong color={calc.newBalance >= 0 ? C.fg : '#2A7A4A'} />
            </>
          )}
        </div>
      </div>

      {/* ── Slab-wise breakup — Old regime ── */}
      <div style={{ background: calc.recommendation === 'old' ? '#FEF4E8' : C.card, border: `2px solid ${calc.recommendation === 'old' ? C.wm : C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Old regime · slab-wise</h3>
          {calc.recommendation === 'old' && <span style={{ fontSize: 9, fontWeight: 700, background: C.wm, color: '#fff', padding: '3px 8px', borderRadius: 3 }}>✓ RECOMMENDED</span>}
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
              <Row label={calc.oldBalance >= 0 ? 'Balance tax payable' : 'Expected refund'} value={fmt(Math.abs(calc.oldBalance))} strong color={calc.oldBalance >= 0 ? C.fg : '#2A7A4A'} />
            </>
          )}
        </div>
      </div>
      </div>

      {/* ── Balance payable / refund — headline for the recommended regime ── */}
      {calc.tdsPaid > 0 && (() => {
        const bal = calc.recommendation === 'new' ? calc.newBalance : calc.oldBalance
        const total = calc.recommendation === 'new' ? calc.newTotal : calc.oldTotal
        const refund = bal < 0
        return (
          <div style={{ background: refund ? '#F0F9F4' : '#FEF4E8', border: `1px solid ${refund ? '#CFE6D8' : C.wm}`, borderRadius: 8, padding: 20, marginBottom: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase' as const }}>{refund ? 'Expected refund' : 'Balance tax still payable'} · {calc.recommendation === 'new' ? 'New' : 'Old'} regime</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: refund ? '#2A7A4A' : C.fg, margin: 0 }}>{fmt(Math.abs(bal))}</p>
            <p style={{ fontSize: 10.5, color: C.muted, margin: '8px 0 0' }}>Tax liability {fmt(total)} − TDS already deducted {fmt(calc.tdsPaid)}{refund ? ' = refund due' : ' = still to pay'}</p>
            <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0', fontStyle: 'italic' }}>
              {calc.tdsSource === 'ais'
                ? '✓ TDS from your uploaded AIS / 26AS (covers all heads incl. crypto, interest, dividends)'
                : calc.tdsSource === 'estimated'
                ? 'TDS = salary slips + estimated on other income (interest/dividend/freelance @10%, crypto as entered). Upload AIS / 26AS for an exact figure.'
                : 'TDS from your salary slips. Add other-income TDS or upload AIS / 26AS for an exact figure.'}
            </p>
          </div>
        )
      })()}

      {/* ── Savings ── */}
      <div style={{ background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 8, padding: 20, marginBottom: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase' as const }}>Tax savings by choosing {calc.recommendation === 'new' ? 'New' : 'Old'} Regime</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(calc.savings)}</p>
      </div>

      {/* ── Which ITR form to file ── */}
      <div style={{ background: C.card, border: `2px solid ${C.fg}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Which ITR form to file</h3>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.fg, letterSpacing: '0.02em' }}>{calc.itrForm}</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          {calc.itrReasons.map((r: string, i: number) => (
            <p key={i} style={{ fontSize: 12, color: C.text, margin: '4px 0', lineHeight: 1.5 }}>• {r}</p>
          ))}
        </div>
        <div style={{ padding: 10, background: C.bg, borderRadius: 4, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          <strong style={{ color: C.fg }}>Quick reference:</strong>{' '}
          <strong>ITR-1</strong> = salary + 1 house + interest, ≤ ₹50L, no capital gains beyond ₹1.25L LTCG;{' '}
          <strong>ITR-2</strong> = capital gains, crypto, ESOPs, multiple houses, foreign assets, or income &gt; ₹50L;{' '}
          <strong>ITR-3</strong> = freelance with actual expenses, business income, F&O;{' '}
          <strong>ITR-4</strong> = presumptive freelance / small business u/s 44ADA / 44AD, ≤ ₹50L.
        </div>
      </div>

      {/* ── Where you can save more ── */}
      <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 16px' }}>Where You Can Save More</h3>

        {!calc.hraFilled && calc.grossSalary > 0 && (
          <div style={{ padding: '12px', background: '#FFF3DD', border: `1px solid ${C.wm}`, borderRadius: 6, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#856404', margin: 0, fontWeight: 500 }}>💡 You haven't entered rent details. If you pay rent, fill <Link href="/dashboard/profile/exemptions" style={{ color: '#856404', textDecoration: 'underline' }}>Exemptions</Link> to claim HRA and save more.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            // `project: true` only for wealth-building deductions (80C, NPS) where the unused
            // gap would be plausibly invested. Health (80D) is a consumed expense and
            // Home Loan Interest is debt service — neither builds a corpus, so no projection.
            { label: 'Home Loan Interest', limit: 200000, used: calc.sec24b, project: false },
            { label: '80C Investments', limit: 150000, used: calc.sec80C, project: true },
            { label: 'Health Insurance (80D)', limit: 100000, used: calc.sec80D, project: false },
            { label: 'NPS (80CCD(1B))', limit: 50000, used: calc.nps, project: true },
          ].map(s => {
            const gap = Math.max(0, s.limit - s.used)
            const slabRate = 0.30   // assume 30% marginal slab for upper-middle salary
            const yearlyTaxSaved = gap * slabRate
            // FV of yearly contribution at end of each period: FV = P × ((1+r)^n - 1) / r
            // Using a conservative 8% (closer to long-term Indian debt/bank-MF returns) over 15 yrs.
            const r = 0.08, n = 15
            const fv = (yearly: number) => Math.round(yearly * (Math.pow(1 + r, n) - 1) / r)
            // Pick the "yearly investment" reference: prefer unused headroom (encourages topping up),
            // otherwise fall back to current contribution (encourages staying the course).
            const yearlyContrib = gap > 0 ? gap : s.used
            const corpusFromContrib = yearlyContrib > 0 ? fv(yearlyContrib) : 0
            const corpusFromTaxSaved = yearlyContrib > 0 ? fv(yearlyContrib * slabRate) : 0
            return (
              <div key={s.label} style={{ padding: '10px', background: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>{fmt(gap)} unused</p>
                <p style={{ fontSize: 9, color: C.muted, margin: '4px 0 0' }}>Annual tax saved ~{fmt(yearlyTaxSaved)}</p>
                {s.project && corpusFromContrib > 0 && (
                  <div style={{ marginTop: 6, padding: '6px 8px', background: '#F0F9F4', border: '1px solid #CFE6D8', borderRadius: 4 }}>
                    <p style={{ fontSize: 9, color: C.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{gap > 0 ? 'If you top up the headroom' : 'If you keep investing at this rate'} (8% · 15 yrs)</p>
                    <p style={{ fontSize: 9.5, color: '#2A7A4A', margin: 0, lineHeight: 1.5 }}>
                      💰 <strong>{fmt(yearlyContrib)}/yr</strong> contribution → <strong>{fmt(corpusFromContrib)}</strong> corpus.
                    </p>
                    <p style={{ fontSize: 9.5, color: '#2A7A4A', margin: '2px 0 0', lineHeight: 1.5 }}>
                      💸 <strong>{fmt(yearlyContrib * slabRate)}/yr</strong> tax saved (@ 30%) → <strong>{fmt(corpusFromTaxSaved)}</strong> corpus.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: 10, color: C.muted, margin: '12px 0 0', fontStyle: 'italic' }}>Only invest if it makes financial sense. Tax saving is a bonus, not the goal.</p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/deductions')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Edit Deductions</button>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done · Back to Salary</button>
      </div>
    </div>
  )
}
