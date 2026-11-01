// PROTOTYPE (Phase 1) — a lightweight, live "best answer so far" used by the provisional-verdict
// screen and the sticky VerdictBar. It mirrors the Tax Optimizer's CORE math for the common
// salaried case (salary + HRA + 80C/80D/24(b)/NPS/80TTA/TTB, senior-aware) so the two agree, but it
// deliberately omits the long tail the optimizer handles (other §10 exemptions, 80G, capital gains /
// crypto special rates, exact AIS TDS). Those are the "sharpen" steps — the full optimizer stays the
// source of truth for the final, exact number. Reads localStorage; window-guarded.
//
// Productionising this means extracting the optimizer's computation into one shared engine that both
// screens call (so there is literally one code path). For the prototype we replicate the subset.

import type { SeniorStatus } from './tax-slabs'
import { getSalaryFacts } from './salary-facts'
import { computeRegimeCore, cap80DSelf, cap80DParents, CAP_80C, CAP_24B, CAP_NPS, CAP_80TTA, CAP_80TTB } from './verdict-engine'

export type ExactnessKey = 'salary' | 'slip' | 'rent' | '80c' | '80d' | 'nps' | 'ais'
// One weighted exactness signal. `adds` is what's still to earn, so the percentages always reach 100.
export interface ExactnessItem { key: ExactnessKey; label: string; done: boolean; adds: number }

export interface QuickVerdict {
  hasSalary: boolean
  recommendation: 'new' | 'old'
  newTotal: number
  oldTotal: number
  savings: number
  // First-look old-regime bill assuming typical deductions — same framing as the landing card.
  oldTypical: number
  // True once any deduction or rent is on file, including a rent too low to earn an HRA exemption.
  hasDeductions: boolean
  // 0–100 confidence the answer is exact, plus the signals behind it.
  exactness: { pct: number; items: ExactnessItem[] }
}

const n = (v: unknown) => Math.max(0, Number(v) || 0)
function readJSON(key: string): any {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}

const EMPTY: QuickVerdict = {
  hasSalary: false, recommendation: 'new', newTotal: 0, oldTotal: 0, savings: 0,
  oldTypical: 0, hasDeductions: false, exactness: { pct: 0, items: [] },
}

// Typical deductions almost any salaried investor can claim — used only for the first-look preview
// before any deduction is entered (₹1.5L 80C + ₹50k NPS + ₹25k 80D). Mirrors the landing card's assumption.
const TYPICAL_DEDUCTIONS = 225000

const ESTIMATE_LABEL = {
  typed: 'Salary (estimate)',
  ctc: 'Salary (estimated from CTC)',
  inhand: 'Salary (estimated from in-hand)',
}

export function computeQuickVerdict(): QuickVerdict {
  const facts = getSalaryFacts()
  const gross = facts.annualGross
  if (!gross) return EMPTY

  const ded = readJSON('av_deductions') || {}
  const exm = readJSON('av_exemptions') || {}
  const ais = readJSON('as_ais')

  // Slab-taxed other income (freelance / F&O / interest / rent) shifts the old-vs-new crossover, so it
  // MUST enter the comparison or the live bar can confidently recommend the wrong regime. We sum only
  // the unambiguous slab entries here; equity/crypto capital gains are special-rate (regime-independent,
  // so they don't change the pick) and are priced exactly by the full optimizer, not this quick view.
  const otherRaw = readJSON('av_other_income')
  const otherEntries: any[] = Array.isArray(otherRaw) ? otherRaw : []
  const slabOtherIncome = otherEntries.reduce(
    (t, e) => (e?.type === 'equity' || e?.type === 'crypto') ? t : t + n(e?.amount), 0)

  const senior: SeniorStatus =
    ded.selfSeniorStatus === 'super_senior' ? 'super_senior'
    : (ded.selfSeniorStatus === 'senior' || ded.selfSenior) ? 'senior' : 'normal'
  const parentsSenior = !!ded.parentsSenior

  // HRA — use the stored annual exemption when rent is present (same rule the optimizer prefers).
  const hra = exm.hra || {}
  const hraExempt = (typeof hra.annualExemption === 'number' && n(hra.rentPaid) > 0) ? Math.round(hra.annualExemption) : 0

  // Caps come from the shared engine — same limits the optimizer applies.
  const sec80C = Math.min(CAP_80C,
    n(ded.ppf) + n(ded.elss) + n(ded.lic) + n(ded.tuition) + n(ded.nsc) +
    n(ded.employeePF) + n(ded.homeLoanPrincipal) + n(ded.termInsurance) + n(ded.other80C))
  const sec80D = Math.min(n(ded.selfFamily), cap80DSelf(senior)) +
    Math.min(n(ded.parents) + (parentsSenior ? n(ded.parentsMedicalExp) : 0), cap80DParents(parentsSenior))
  const sec24b = Math.min(n(ded.homeLoanInterest), CAP_24B)
  const nps = Math.min(n(ded.nps), CAP_NPS)
  const sec80TTA = senior === 'normal' ? Math.min(n(ded.savingsInterest80TTA), CAP_80TTA) : 0
  const sec80TTB = senior !== 'normal' ? Math.min(n(ded.interest80TTB), CAP_80TTB) : 0

  const totalDeductions = sec80C + sec80D + sec24b + nps + sec80TTA + sec80TTB
  const totalExemptions = hraExempt

  // Regime comparison via the shared engine (identical code path to the Tax Optimizer's core).
  const { newTotal, oldTotal, recommendation, savings } = computeRegimeCore({
    annualGross: gross, slabOtherIncome, totalExemptions, totalDeductions, seniorStatus: senior,
  })

  const { oldTotal: oldTypical } = computeRegimeCore({
    annualGross: gross, slabOtherIncome, totalExemptions: 0, totalDeductions: TYPICAL_DEDUCTIONS, seniorStatus: senior,
  })
  const hasDeductions = totalDeductions > 0 || totalExemptions > 0 || n(hra.rentPaid) > 0

  // Exactness — weighted signals, summing to 100 when everything is supplied.
  const signal = (key: ExactnessKey, label: string, adds: number): ExactnessItem => ({ key, label, done: adds === 0, adds })
  const item = (key: ExactnessKey, done: boolean, doneLabel: string, todoLabel: string, weight: number) =>
    signal(key, done ? doneLabel : todoLabel, done ? 0 : weight)
  const items = [
    // A synthetic /try summary is an estimate, not a real slip — it earns no confidence and still asks
    // for the real slip, so the bar can't present invented salary as "exact". The 0% item just shows
    // the salary was counted.
    ...(facts.synthetic ? [signal('salary', ESTIMATE_LABEL[facts.estimatedFrom ?? 'typed'], 0)] : []),
    facts.source === 'slip-average'
      ? signal('slip', 'Add the rest of your slips', 15)
      : item('slip', facts.source === 'summary' && !facts.synthetic, 'Salary slip', 'Add salary slip', 30),
    item('rent', n(hra.rentPaid) > 0 || !!hra.noRent, 'Rent', 'Add rent', 20),
    item('80c', sec80C > 0, '80C', 'Add 80C', 20),
    item('80d', sec80D > 0, '80D', 'Add 80D', 10),
    item('nps', nps > 0, 'NPS', 'Add NPS', 5),
    item('ais', !!ais && Number(ais.totalTaxCredit) > 0, 'AIS / 26AS', 'Add AIS / 26AS', 15),
  ]
  const pct = 100 - items.reduce((t, i) => t + i.adds, 0)

  return { hasSalary: true, recommendation, newTotal, oldTotal, savings, oldTypical, hasDeductions, exactness: { pct, items } }
}
