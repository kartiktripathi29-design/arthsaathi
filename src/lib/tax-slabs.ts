// Single source of truth for income-tax slab math (FY 2025-26 / 2026-27 rules).
// Used by the Tax Optimizer (to show the bill) AND the Salary forecast (to estimate the new
// employer's monthly TDS under Section 192) so the two never disagree. Pure — no React, no I/O.

export type SeniorStatus = 'normal' | 'senior' | 'super_senior'
export interface SlabRow { label: string; rate: number; inSlab: number; tax: number }
export interface SlabResult { rows: SlabRow[]; basicTax: number; rebate: number; surcharge: number; cess: number; total: number }

export function oldRegimeSlabs(seniorStatus: SeniorStatus): [number, number, number, string][] {
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
export function calcSurcharge(taxableIncome: number, taxAfterRebate: number, regime: 'new' | 'old'): number {
  if (taxableIncome <= 5000000) return 0
  let rate = 0
  if (taxableIncome <= 10000000) rate = 0.10
  else if (taxableIncome <= 20000000) rate = 0.15
  else if (taxableIncome <= 50000000) rate = 0.25
  else rate = regime === 'new' ? 0.25 : 0.37
  return taxAfterRebate * rate
}

export function slabBreakdown(taxable: number, regime: 'new' | 'old', seniorStatus: SeniorStatus = 'normal'): SlabResult {
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

// New-regime annual tax on a salary, after the ₹75k standard deduction. Used to estimate an
// employer's Section-192 monthly TDS withholding for the salary it pays (new regime is the default).
export function newRegimeAnnualTax(annualSalary: number, standardDeduction = 75000): number {
  return slabBreakdown(Math.max(0, annualSalary - standardDeduction), 'new').total
}

// Section-192 TDS estimate under the employee's chosen regime. Applies the regime's standard
// deduction (₹75k new / ₹50k old) and, for old regime, the senior-citizen slabs. Old regime here
// uses the standard-deduction baseline only — the employee's 80C/HRA declarations reduce the FINAL
// liability (shown in the optimizer), as they would once investment proofs are submitted.
export function estimateAnnualTax(annualSalary: number, regime: 'new' | 'old', seniorStatus: SeniorStatus = 'normal'): number {
  const standardDeduction = regime === 'old' ? 50000 : 75000
  return slabBreakdown(Math.max(0, annualSalary - standardDeduction), regime, seniorStatus).total
}

// Tax actually saved by claiming `extraDeduction` more of an old-regime Chapter VI-A deduction
// (80C / 80D / 80CCD(1B) / 24(b)), starting from the user's CURRENT old-regime taxable income.
// Exact slab-delta — it runs the full breakdown (87A rebate + cess included) at both points and
// returns the difference. So it correctly:
//   • uses the user's real marginal slab (senior-aware), not a flat assumed rate;
//   • tapers when the deduction crosses a slab boundary;
//   • returns ₹0 once taxable income is already in the rebate / zero-tax zone (≤ ₹5L old regime),
//     where a flat-rate guess would wrongly promise savings.
export function oldRegimeDeductionSaving(taxableOld: number, extraDeduction: number, seniorStatus: SeniorStatus = 'normal'): number {
  const before = slabBreakdown(Math.max(0, taxableOld), 'old', seniorStatus).total
  const after = slabBreakdown(Math.max(0, taxableOld - Math.max(0, extraDeduction)), 'old', seniorStatus).total
  return Math.max(0, before - after)
}
