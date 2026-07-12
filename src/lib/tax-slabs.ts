// Single source of truth for income-tax slab math, year-parameterized by financial year.
//
// A financial year is identified by its START year: FY = 2025 means FY 2025-26 (1 Apr 2025 – 31 Mar
// 2026). Every rule set lives in TAX_RULES keyed by that number; LATEST_ENACTED_FY is the newest
// year with a complete rule set. All the math functions take an optional `fy` (defaulting to the
// latest enacted year) so the Tax Optimizer, the Salary forecast (Section-192 TDS) and the API all
// compute on the SAME rules for a given year and never disagree. Pure — no React, no I/O.
//
// FY resolution (which year a slip anchors to, current-year vs plan-ahead) lives in ./fy.ts.

// Type-only import — erased by the TS→JS strip, so `node --test` never resolves the '@/' alias and
// the pure engine stays directly testable. Used by the regime-computation layer at the bottom.
import type { TaxDeductions, TaxResult, TaxComparison, ParsedSalaryData } from '@/types'

export type SeniorStatus = 'normal' | 'senior' | 'super_senior'
export type FY = number // FY start year: 2025 = FY 2025-26
export interface SlabRow { label: string; rate: number; inSlab: number; tax: number }
export interface SlabResult { rows: SlabRow[]; basicTax: number; rebate: number; surcharge: number; cess: number; total: number }

type SlabTuple = [min: number, max: number, rate: number, label: string]

interface RuleSet {
  newRegimeSlabs: SlabTuple[]
  oldRegimeSlabs: Record<SeniorStatus, SlabTuple[]>
  // 87A rebate: taxable ≤ threshold → rebate up to `cap`. New regime also gets marginal relief above.
  rebate: {
    new: { threshold: number; cap: number; marginalRelief: boolean }
    old: { threshold: number; cap: number }
  }
  standardDeduction: { new: number; old: number }
  // Surcharge ladder: 0 up to `exemptUpTo`; then the first band whose `upTo` covers the income; above
  // the last band the rate is regime-dependent (`aboveTop`).
  surcharge: {
    exemptUpTo: number
    bands: { upTo: number; rate: number }[]
    aboveTop: { new: number; old: number }
  }
  cessRate: number
}

const OLD_NORMAL: SlabTuple[] = [
  [0, 250000, 0, '₹0 – ₹2.5L'],
  [250000, 500000, 0.05, '₹2.5L – ₹5L'],
  [500000, 1000000, 0.20, '₹5L – ₹10L'],
  [1000000, Number.POSITIVE_INFINITY, 0.30, '₹10L+'],
]
const OLD_SENIOR: SlabTuple[] = [
  [0, 300000, 0, '₹0 – ₹3L'],
  [300000, 500000, 0.05, '₹3L – ₹5L'],
  [500000, 1000000, 0.20, '₹5L – ₹10L'],
  [1000000, Number.POSITIVE_INFINITY, 0.30, '₹10L+'],
]
const OLD_SUPER_SENIOR: SlabTuple[] = [
  [0, 500000, 0, '₹0 – ₹5L'],
  [500000, 1000000, 0.20, '₹5L – ₹10L'],
  [1000000, Number.POSITIVE_INFINITY, 0.30, '₹10L+'],
]

// FY 2025-26 — validated field-for-field against the Income Tax Dept portal (AY 2026-27):
// https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1
const FY_2025_26: RuleSet = {
  newRegimeSlabs: [
    [0, 400000, 0, '₹0 – ₹4L'],
    [400000, 800000, 0.05, '₹4L – ₹8L'],
    [800000, 1200000, 0.10, '₹8L – ₹12L'],
    [1200000, 1600000, 0.15, '₹12L – ₹16L'],
    [1600000, 2000000, 0.20, '₹16L – ₹20L'],
    [2000000, 2400000, 0.25, '₹20L – ₹24L'],
    [2400000, Number.POSITIVE_INFINITY, 0.30, '₹24L+'],
  ],
  oldRegimeSlabs: { normal: OLD_NORMAL, senior: OLD_SENIOR, super_senior: OLD_SUPER_SENIOR },
  rebate: {
    new: { threshold: 1200000, cap: 60000, marginalRelief: true },
    old: { threshold: 500000, cap: 12500 },
  },
  standardDeduction: { new: 75000, old: 50000 },
  surcharge: {
    exemptUpTo: 5000000,
    bands: [
      { upTo: 10000000, rate: 0.10 },
      { upTo: 20000000, rate: 0.15 },
      { upTo: 50000000, rate: 0.25 },
    ],
    aboveTop: { new: 0.25, old: 0.37 },
  },
  cessRate: 0.04,
}

// FY 2026-27 — Union Budget 2026 (1 Feb 2026) announced NO change to the income-tax slabs, the
// Section-87A rebate, or the standard deduction; FY 2026-27 is identical to FY 2025-26. This is a
// CONFIRMED-identical rule set (not a placeholder), kept as its own entry so a future budget can
// diverge it by replacing this object without touching FY 2025-26. Sources: ITD portal (above),
// Budget-2026 coverage (ClearTax / BusinessToday / Axis Max Life, Feb 2026).
// WARNING: confirmed-COPY, NOT independently founder/CA signed off — see docs/fy26-27-verification.md.
// "Plan ahead" therefore renders FY 2025-26 math under an FY 2026-27 label until the real enacted
// Feb-2026 figures land (a separate task needing sign-off — do not invent values).
const FY_2026_27: RuleSet = FY_2025_26

export const TAX_RULES: Record<FY, RuleSet> = {
  2025: FY_2025_26,
  2026: FY_2026_27,
}

// The newest FY with a complete rule set — derived from the table, never hardcoded. Plan-ahead never
// resolves beyond this (see ./fy.ts).
export const LATEST_ENACTED_FY: FY = Math.max(...Object.keys(TAX_RULES).map(Number))

/** Every FY we have a rule table entry for, ascending (a later entry MAY still be a copy). */
export const ENACTED_FYS: FY[] = Object.keys(TAX_RULES).map(Number).sort((a, b) => a - b)

// The newest FY whose rule set is INDEPENDENTLY enacted — i.e. NOT the same object as the prior
// year's. FY_2026_27 = FY_2025_26 (a confirmed copy pending real Feb-2026 figures + founder/CA
// sign-off — see docs/fy26-27-verification.md), so FY 2026-27 is NOT genuine and this resolves to
// 2025. resolveFY() clamps to it and the FY picker disables anything above it, so a copied year is
// never presented as real output. Auto-advances (and lifts the gate) the moment FY_2026_27 is given
// its own object.
export const LATEST_GENUINE_FY: FY = (() => {
  let latest = ENACTED_FYS[0]
  for (let i = 1; i < ENACTED_FYS.length; i++) {
    if (TAX_RULES[ENACTED_FYS[i]] !== TAX_RULES[ENACTED_FYS[i - 1]]) latest = ENACTED_FYS[i]
  }
  return latest
})()

/** True if we have a complete rule set for this FY. */
export function isEnactedFY(fy: FY): boolean {
  return fy in TAX_RULES
}

/** Display label: 2025 → "FY 2025-26". */
export function fyLabel(fy: FY): string {
  const end = (fy + 1) % 100
  return `FY ${fy}-${String(end).padStart(2, '0')}`
}

/** Assessment-year label for an FY: 2025 (FY 2025-26) → "AY 2026-27". */
export function ayLabel(fy: FY): string {
  const ayStart = fy + 1
  return `AY ${ayStart}-${String((ayStart + 1) % 100).padStart(2, '0')}`
}

function rulesFor(fy: FY): RuleSet {
  return TAX_RULES[fy] ?? TAX_RULES[LATEST_ENACTED_FY]
}

export function oldRegimeSlabs(seniorStatus: SeniorStatus, fy: FY = LATEST_ENACTED_FY): SlabTuple[] {
  return rulesFor(fy).oldRegimeSlabs[seniorStatus]
}

// Surcharge on the tax-after-rebate. Old regime: 10/15/25/37%. New regime: capped at 25%.
export function calcSurcharge(taxableIncome: number, taxAfterRebate: number, regime: 'new' | 'old', fy: FY = LATEST_ENACTED_FY): number {
  const s = rulesFor(fy).surcharge
  if (taxableIncome <= s.exemptUpTo) return 0
  let rate = s.aboveTop[regime]
  for (const b of s.bands) {
    if (taxableIncome <= b.upTo) { rate = b.rate; break }
  }
  return taxAfterRebate * rate
}

export function slabBreakdown(taxable: number, regime: 'new' | 'old', seniorStatus: SeniorStatus = 'normal', fy: FY = LATEST_ENACTED_FY): SlabResult {
  const rules = rulesFor(fy)
  const slabs: SlabTuple[] = regime === 'new' ? rules.newRegimeSlabs : rules.oldRegimeSlabs[seniorStatus]
  const rows: SlabRow[] = []
  let basicTax = 0
  for (const [min, max, rate, label] of slabs) {
    const inSlab = Math.max(0, Math.min(taxable, max) - min)
    const tax = inSlab * rate
    rows.push({ label, rate, inSlab, tax })
    basicTax += tax
  }
  // 87A rebate — per the FY's rule set.
  let rebate = 0
  if (regime === 'new') {
    const rb = rules.rebate.new
    if (taxable <= rb.threshold) {
      rebate = Math.min(basicTax, rb.cap)
    } else if (rb.marginalRelief) {
      const exceeds = taxable - rb.threshold
      if (basicTax > exceeds) rebate = basicTax - exceeds
    }
  } else {
    const rb = rules.rebate.old
    if (taxable <= rb.threshold) rebate = Math.min(basicTax, rb.cap)
  }
  const taxAfterRebate = Math.max(0, basicTax - rebate)
  const surcharge = calcSurcharge(taxable, taxAfterRebate, regime, fy)
  const cess = (taxAfterRebate + surcharge) * rules.cessRate
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

// New-regime annual tax on a salary, after that year's standard deduction. Used to estimate an
// employer's Section-192 monthly TDS withholding for the salary it pays (new regime is the default).
export function newRegimeAnnualTax(annualSalary: number, fy: FY = LATEST_ENACTED_FY, standardDeduction = rulesFor(fy).standardDeduction.new): number {
  return slabBreakdown(Math.max(0, annualSalary - standardDeduction), 'new', 'normal', fy).total
}

// Section-192 TDS estimate under the employee's chosen regime, on that FY's rules. Applies the
// regime's standard deduction (₹75k new / ₹50k old) and, for old regime, the senior-citizen slabs.
// Old regime here uses the standard-deduction baseline only — the employee's 80C/HRA declarations
// reduce the FINAL liability (shown in the optimizer), as they would once proofs are submitted.
export function estimateAnnualTax(annualSalary: number, regime: 'new' | 'old', seniorStatus: SeniorStatus = 'normal', fy: FY = LATEST_ENACTED_FY): number {
  const standardDeduction = regime === 'old' ? rulesFor(fy).standardDeduction.old : rulesFor(fy).standardDeduction.new
  return slabBreakdown(Math.max(0, annualSalary - standardDeduction), regime, seniorStatus, fy).total
}

// Tax actually saved by claiming `extraDeduction` more of an old-regime Chapter VI-A deduction
// (80C / 80D / 80CCD(1B) / 24(b)), starting from the user's CURRENT old-regime taxable income.
// Exact slab-delta — runs the full breakdown (87A rebate + cess) at both points and returns the
// difference, on the given FY's rules. So it uses the real marginal slab (senior-aware), tapers at
// slab boundaries, and returns ₹0 once already in the rebate/zero-tax zone.
export function oldRegimeDeductionSaving(taxableOld: number, extraDeduction: number, seniorStatus: SeniorStatus = 'normal', fy: FY = LATEST_ENACTED_FY): number {
  const before = slabBreakdown(Math.max(0, taxableOld), 'old', seniorStatus, fy).total
  const after = slabBreakdown(Math.max(0, taxableOld - Math.max(0, extraDeduction)), 'old', seniorStatus, fy).total
  return Math.max(0, before - after)
}

// ─── Regime computation (migrated from the retired tax-engine.ts) ────────────────────────────────
// tax-engine.ts computed on stale FY 2024-25 slabs and backed /api/tax-calc + dashboard/profile.
// These replacements compute on THIS module's year-parameterized slabs (default: latest enacted FY),
// returning the same TaxResult/TaxComparison shapes so the two consumers migrate without shape churn.

// HRA exemption (Rule 2A) — year-independent, moved verbatim from tax-engine.ts.
export function calcHRAExemption(basicSalary: number, hra: number, rentPaidMonthly: number, isMetroCity: boolean): number {
  const annualBasic = basicSalary * 12
  const annualHRA = hra * 12
  const annualRent = rentPaidMonthly * 12
  if (rentPaidMonthly === 0) return 0
  const cityPercent = isMetroCity ? 0.50 : 0.40
  const hraExempt = Math.min(
    annualHRA,                       // actual HRA received
    annualBasic * cityPercent,       // 50%/40% of basic
    annualRent - annualBasic * 0.10, // rent paid − 10% of basic
  )
  return Math.max(0, hraExempt)
}

export function calcOldRegime(annualGross: number, deductions: TaxDeductions, fy: FY = LATEST_ENACTED_FY): TaxResult {
  const rules = rulesFor(fy)
  const totalDeductions =
    Math.min(deductions.section80C, 150000) +
    Math.min(deductions.section80CCD1B, 50000) +
    Math.min(deductions.section80D, 50000) +
    Math.min(deductions.section24b, 200000) +
    deductions.hraExemption +
    Math.min(deductions.standardDeduction, rules.standardDeduction.old) +
    deductions.otherDeductions
  const taxableIncome = Math.max(0, annualGross - totalDeductions)
  const b = slabBreakdown(taxableIncome, 'old', 'normal', fy)
  return {
    regime: 'old',
    grossIncome: annualGross,
    totalDeductions,
    taxableIncome,
    basicTax: b.basicTax,
    surcharge: b.surcharge,
    cess: b.cess,
    totalTax: b.total,
    effectiveRate: annualGross > 0 ? parseFloat(((b.total / annualGross) * 100).toFixed(2)) : 0,
    monthlyTDS: Math.round(b.total / 12),
    rebate87A: b.rebate,
  }
}

export function calcNewRegime(annualGross: number, fy: FY = LATEST_ENACTED_FY): TaxResult {
  const standardDeduction = rulesFor(fy).standardDeduction.new
  const taxableIncome = Math.max(0, annualGross - standardDeduction)
  const b = slabBreakdown(taxableIncome, 'new', 'normal', fy)
  return {
    regime: 'new',
    grossIncome: annualGross,
    totalDeductions: standardDeduction,
    taxableIncome,
    basicTax: b.basicTax,
    surcharge: b.surcharge,
    cess: b.cess,
    totalTax: b.total,
    effectiveRate: annualGross > 0 ? parseFloat(((b.total / annualGross) * 100).toFixed(2)) : 0,
    monthlyTDS: Math.round(b.total / 12),
    rebate87A: b.rebate,
  }
}

export function compareTaxRegimes(salary: ParsedSalaryData, deductions: TaxDeductions, rentPaidMonthly = 0, isMetroCity = true, fy: FY = LATEST_ENACTED_FY): TaxComparison {
  const annualGross = salary.grossSalary * 12
  const hraExemption = calcHRAExemption(salary.basicSalary, salary.hra, rentPaidMonthly, isMetroCity)
  const oldResult = calcOldRegime(annualGross, { ...deductions, hraExemption }, fy)
  const newResult = calcNewRegime(annualGross, fy)
  const recommendation: 'old' | 'new' = oldResult.totalTax <= newResult.totalTax ? 'old' : 'new'
  const savings = Math.abs(oldResult.totalTax - newResult.totalTax)
  const higherTax = Math.max(oldResult.totalTax, newResult.totalTax)
  const savingsPercent = higherTax > 0 ? parseFloat(((savings / higherTax) * 100).toFixed(1)) : 0
  return { old: oldResult, new: newResult, recommendation, savings, savingsPercent }
}

// Deduction gap suggestions — year-independent product logic, moved verbatim from tax-engine.ts.
export function getDeductionSuggestions(salary: ParsedSalaryData, currentDeductions: TaxDeductions) {
  const suggestions = []
  const empPFAnnual = salary.employeePF * 12
  const used80C = Math.min(currentDeductions.section80C + empPFAnnual, 150000)
  const gap80C = 150000 - used80C
  if (gap80C > 5000) {
    suggestions.push({ section: '80C', current: used80C, max: 150000, gap: gap80C, products: ['ELSS mutual fund', 'PPF', 'NSC', 'Tax-saver FD'], potentialSaving: Math.round(gap80C * 0.30) })
  }
  if (currentDeductions.section80CCD1B < 50000) {
    const gap = 50000 - currentDeductions.section80CCD1B
    suggestions.push({ section: '80CCD(1B) — NPS', current: currentDeductions.section80CCD1B, max: 50000, gap, products: ['NPS Tier 1'], potentialSaving: Math.round(gap * 0.30) })
  }
  if (currentDeductions.section80D < 25000) {
    const gap = 25000 - currentDeductions.section80D
    suggestions.push({ section: '80D — Health Insurance', current: currentDeductions.section80D, max: 25000, gap, products: ['Family floater health insurance'], potentialSaving: Math.round(gap * 0.30) })
  }
  return suggestions
}
