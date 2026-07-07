// Shared regime-comparison core (FY 2025-26). The ONE place the standard deductions, the senior-aware
// Chapter VI-A caps, and the old-vs-new pick live — so the Tax Optimizer and the quick-verdict can
// never disagree on the core math. Built on tax-slabs.ts (the current slab source of truth).
//
// NOTE: this is intentionally separate from the legacy tax-engine.ts, which still carries FY 2024-25
// slabs and feeds a different API route. Don't cross the streams.

import { slabBreakdown, type SeniorStatus } from './tax-slabs'

// Standard deduction by regime.
export const STD_DEDUCTION = { new: 75000, old: 50000 } as const

// Chapter VI-A statutory caps — the single home for these limits.
export const CAP_80C = 150000
export const CAP_24B = 200000
export const CAP_NPS = 50000 // 80CCD(1B)
export const CAP_80TTA = 10000
export const CAP_80TTB = 50000

// 80D caps depend on senior-citizen status of self and parents (₹25k → ₹50k each).
export const cap80DSelf = (s: SeniorStatus) => (s !== 'normal' ? 50000 : 25000)
export const cap80DParents = (parentsSenior: boolean) => (parentsSenior ? 50000 : 25000)
export const cap80DTotal = (s: SeniorStatus, parentsSenior: boolean) => cap80DSelf(s) + cap80DParents(parentsSenior)

export interface RegimeCoreInput {
  annualGross: number
  slabOtherIncome?: number // slab-taxed other income (freelance, interest, debt-MF gains); default 0
  totalExemptions: number  // §10 exemptions already summed (HRA + LTA etc.)
  totalDeductions: number  // capped Chapter VI-A already summed
  seniorStatus?: SeniorStatus
  specialTaxTotal?: number // regime-independent special-rate tax (capital gains / crypto); default 0
}

export interface RegimeCore {
  taxableNew: number
  taxableOld: number
  newBreak: ReturnType<typeof slabBreakdown>
  oldBreak: ReturnType<typeof slabBreakdown>
  newTotal: number
  oldTotal: number
  recommendation: 'new' | 'old'
  savings: number
}

// Apply standard deductions, run the slab math (87A rebate + surcharge + cess all inside
// slabBreakdown), add the regime-independent special-rate tax, and pick the cheaper regime.
export function computeRegimeCore(i: RegimeCoreInput): RegimeCore {
  const slabOther = i.slabOtherIncome ?? 0
  const special = i.specialTaxTotal ?? 0
  const senior = i.seniorStatus ?? 'normal'

  const taxableNew = Math.max(0, i.annualGross + slabOther - STD_DEDUCTION.new)
  // New-regime slabs are flat regardless of age; senior bands only affect the old regime.
  const taxableOld = Math.max(0, i.annualGross + slabOther - STD_DEDUCTION.old - i.totalExemptions - i.totalDeductions)

  const newBreak = slabBreakdown(taxableNew, 'new', 'normal')
  const oldBreak = slabBreakdown(taxableOld, 'old', senior)
  const newTotal = newBreak.total + special
  const oldTotal = oldBreak.total + special

  return {
    taxableNew,
    taxableOld,
    newBreak,
    oldBreak,
    newTotal,
    oldTotal,
    recommendation: newTotal <= oldTotal ? 'new' : 'old',
    savings: Math.abs(newTotal - oldTotal),
  }
}
