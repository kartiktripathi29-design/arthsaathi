// Shared regime-comparison core (FY 2025-26). The ONE place the standard deductions, the senior-aware
// Chapter VI-A caps, and the old-vs-new pick live — so the Tax Optimizer and the quick-verdict can
// never disagree on the core math. Built on tax-slabs.ts (the current slab source of truth).
//
// NOTE: this regime-comparison layer (for the quick-verdict + optimizer) is built on the shared
// tax-slabs.ts slab math. The old FY 2024-25 tax-engine.ts it used to warn against has been retired
// and its regime-computation folded into tax-slabs.ts.

import { slabBreakdown, type SeniorStatus } from './tax-slabs.ts'

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

// The smallest whole-rupee total of deductions and exemptions at which the old regime costs less than
// the new one. Null when the new regime's tax is ₹0, since the old regime can't beat that. This is the
// arithmetic only: the amount may be more than the statutory caps let someone actually claim.
export function breakEvenDeductions(i: Omit<RegimeCoreInput, 'totalExemptions' | 'totalDeductions'>): number | null {
  const oldBeatsNew = (deductions: number) => {
    const { oldTotal, newTotal } = computeRegimeCore({ ...i, totalExemptions: 0, totalDeductions: deductions })
    return oldTotal < newTotal
  }
  const { newTotal, oldBreak } = computeRegimeCore({ ...i, totalExemptions: 0, totalDeductions: 0 })
  if (newTotal - (i.specialTaxTotal ?? 0) <= 0) return null
  if (oldBreak.total < newTotal - (i.specialTaxTotal ?? 0)) return 0
  // Old-regime tax only falls as deductions rise, so a binary search finds the first winning rupee.
  let lo = 0
  let hi = i.annualGross + (i.slabOtherIncome ?? 0)
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (oldBeatsNew(mid)) hi = mid
    else lo = mid
  }
  return hi
}

export type RegimeOutlook =
  | { kind: 'new-tax-zero' }
  | { kind: 'new-wins-typical'; margin: number }
  | { kind: 'old-could-win'; breakEven: number }
  | { kind: 'old-wins'; margin: number }
  | { kind: 'needs-more'; more: number }
  | { kind: 'old-unlikely' }

const rupees = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`

// The one wording for the line under the regime figures, wherever they appear.
export function regimeOutlookText(o: RegimeOutlook): string {
  switch (o.kind) {
    case 'new-tax-zero': return 'Your new regime tax is ₹0, so the old regime can never win.'
    case 'new-wins-typical': return `Even with typical deductions, the new regime wins by ~${rupees(o.margin)}.`
    case 'old-could-win': return `The old regime could win if your deductions exceed ${rupees(o.breakEven)}. Answer the questions below to check.`
    case 'old-wins': return `With what you've entered, the old regime wins by ${rupees(o.margin)}.`
    case 'needs-more': return `You'd need ${rupees(o.more)} more in deductions for the old regime to win.`
    case 'old-unlikely': return 'The old regime is unlikely to win for you, even with maximum deductions.'
  }
}

// The most someone could realistically claim: the 80C, 80D, NPS and home-loan caps, plus their HRA.
export function realisticMaxDeductions(senior: SeniorStatus, parentsSenior: boolean, possibleHra: number): number {
  return CAP_80C + cap80DTotal(senior, parentsSenior) + CAP_NPS + CAP_24B + possibleHra
}

export interface RegimeOutlookInput extends Omit<RegimeCoreInput, 'totalExemptions' | 'totalDeductions'> {
  claimed: number // deductions and exemptions counted so far
  hasEntered: boolean // whether anything has been entered, even if it counts for ₹0
  oldTypical: number // old-regime tax with typical deductions
  realisticMax: number // see realisticMaxDeductions
}

// Which message the regime cards should carry, and the figure that goes in it.
export function regimeOutlook({ claimed, hasEntered, oldTypical, realisticMax, ...core }: RegimeOutlookInput): RegimeOutlook {
  const breakEven = breakEvenDeductions(core)
  if (breakEven === null) return { kind: 'new-tax-zero' }
  const { newTotal } = computeRegimeCore({ ...core, totalExemptions: 0, totalDeductions: 0 })
  const outOfReach = breakEven > realisticMax
  if (!hasEntered) {
    if (newTotal < oldTypical) return { kind: 'new-wins-typical', margin: oldTypical - newTotal }
    return outOfReach ? { kind: 'old-unlikely' } : { kind: 'old-could-win', breakEven }
  }
  const { oldTotal } = computeRegimeCore({ ...core, totalExemptions: 0, totalDeductions: claimed })
  if (oldTotal < newTotal) return { kind: 'old-wins', margin: newTotal - oldTotal }
  return outOfReach ? { kind: 'old-unlikely' } : { kind: 'needs-more', more: breakEven - claimed }
}
