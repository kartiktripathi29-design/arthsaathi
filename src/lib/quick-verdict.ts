// PROTOTYPE (Phase 1) — a lightweight, live "best answer so far" used by the provisional-verdict
// screen and the sticky VerdictBar. It mirrors the Tax Optimizer's CORE math for the common
// salaried case (salary + HRA + 80C/80D/24(b)/NPS/80TTA/TTB, senior-aware) so the two agree, but it
// deliberately omits the long tail the optimizer handles (other §10 exemptions, 80G, capital gains /
// crypto special rates, exact AIS TDS). Those are the "sharpen" steps — the full optimizer stays the
// source of truth for the final, exact number. Reads localStorage; window-guarded.
//
// Productionising this means extracting the optimizer's computation into one shared engine that both
// screens call (so there is literally one code path). For the prototype we replicate the subset.

import { slabBreakdown, estimateAnnualTax, type SeniorStatus } from './tax-slabs'
import { getSalaryFacts } from './salary-facts'

export interface QuickVerdict {
  hasSalary: boolean
  recommendation: 'new' | 'old'
  newTotal: number
  oldTotal: number
  savings: number
  // First-look range straight off the slip (salary only) — same framing as the landing card.
  range: { newTax: number; oldBare: number; oldTypical: number }
  // 0–100 confidence the answer is exact, plus the single biggest thing that would raise it.
  exactness: { pct: number; nextStep: string | null }
}

const n = (v: unknown) => Math.max(0, Number(v) || 0)
function readJSON(key: string): any {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

const EMPTY: QuickVerdict = {
  hasSalary: false, recommendation: 'new', newTotal: 0, oldTotal: 0, savings: 0,
  range: { newTax: 0, oldBare: 0, oldTypical: 0 }, exactness: { pct: 0, nextStep: 'Upload a salary slip' },
}

// Typical deductions almost any salaried investor can claim — used only for the salary-only "range"
// preview (₹1.5L 80C + ₹50k NPS + ₹25k 80D). Mirrors the landing card's assumption.
const TYPICAL_DEDUCTIONS = 225000

export function computeQuickVerdict(): QuickVerdict {
  const facts = getSalaryFacts()
  const gross = facts.annualGross
  if (!gross) return EMPTY

  const ded = readJSON('av_deductions') || {}
  const exm = readJSON('av_exemptions') || {}
  const ais = readJSON('as_ais')

  const senior: SeniorStatus =
    ded.selfSeniorStatus === 'super_senior' ? 'super_senior'
    : (ded.selfSeniorStatus === 'senior' || ded.selfSenior) ? 'senior' : 'normal'
  const parentsSenior = !!ded.parentsSenior

  // HRA — use the stored annual exemption when rent is present (same rule the optimizer prefers).
  const hra = exm.hra || {}
  const hraExempt = (typeof hra.annualExemption === 'number' && n(hra.rentPaid) > 0) ? Math.round(hra.annualExemption) : 0

  const sec80C = Math.min(150000,
    n(ded.ppf) + n(ded.elss) + n(ded.lic) + n(ded.tuition) + n(ded.nsc) +
    n(ded.employeePF) + n(ded.homeLoanPrincipal) + n(ded.termInsurance) + n(ded.other80C))
  const selfCap = senior !== 'normal' ? 50000 : 25000
  const parentsCap = parentsSenior ? 50000 : 25000
  const sec80D = Math.min(n(ded.selfFamily), selfCap) +
    Math.min(n(ded.parents) + (parentsSenior ? n(ded.parentsMedicalExp) : 0), parentsCap)
  const sec24b = Math.min(n(ded.homeLoanInterest), 200000)
  const nps = Math.min(n(ded.nps), 50000)
  const sec80TTA = senior === 'normal' ? Math.min(n(ded.savingsInterest80TTA), 10000) : 0
  const sec80TTB = senior !== 'normal' ? Math.min(n(ded.interest80TTB), 50000) : 0

  const totalDeductions = sec80C + sec80D + sec24b + nps + sec80TTA + sec80TTB
  const totalExemptions = hraExempt

  const taxableNew = Math.max(0, gross - 75000)
  const taxableOld = Math.max(0, gross - 50000 - totalExemptions - totalDeductions)
  const newTotal = slabBreakdown(taxableNew, 'new', 'normal').total
  const oldTotal = slabBreakdown(taxableOld, 'old', senior).total
  const recommendation = newTotal <= oldTotal ? 'new' : 'old'
  const savings = Math.abs(newTotal - oldTotal)

  const range = {
    newTax: estimateAnnualTax(gross, 'new', senior),
    oldBare: estimateAnnualTax(gross, 'old', senior),
    oldTypical: estimateAnnualTax(gross - TYPICAL_DEDUCTIONS, 'old', senior),
  }

  // Exactness — weighted signals, summing to 100 when everything is supplied.
  let pct = 0
  const missing: string[] = []
  if (facts.source === 'summary') pct += 30
  else if (facts.source === 'slip-average') { pct += 15; missing.push('Add the rest of your salary slips') }
  else missing.push('Add a salary slip')
  if (n(hra.rentPaid) > 0 || hra.noRent) pct += 20; else missing.push('Add your rent (HRA)')
  if (sec80C > 0) pct += 20; else missing.push('Add 80C investments')
  if (sec80D > 0) pct += 10; else missing.push('Add health insurance (80D)')
  if (nps > 0) pct += 5
  if (ais && Number(ais.totalTaxCredit) > 0) pct += 15; else missing.push('Add AIS / 26AS for exact TDS')
  pct = Math.min(100, pct)

  return { hasSalary: true, recommendation, newTotal, oldTotal, savings, range, exactness: { pct, nextStep: missing[0] || null } }
}
