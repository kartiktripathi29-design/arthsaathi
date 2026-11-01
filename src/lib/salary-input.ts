// Turns the salary someone types on /try into monthly gross, the figure tax is worked out from.
// The result is an estimate: we only have one number, so the pay structure below is assumed.

import { LATEST_ENACTED_FY, TAX_RULES, newRegimeAnnualTax } from './tax-slabs.ts'

export type SalaryInputType = 'gross' | 'ctc' | 'inhand'

// The app's existing split of gross for a salary with no slip behind it.
export const BASIC_SHARE = 0.4
export const HRA_SHARE = 0.2
// PF on full basic, with no ₹15,000 wage ceiling. Employer and employee pay the same rate.
export const PF_RATE = 0.12
// The usual provision for gratuity: 15 days of basic per year, over a 26-day month.
export const GRATUITY_RATE = 15 / 26 / 12
// ₹200 a month. The real figure depends on the state, and some states charge none.
export const PROFESSIONAL_TAX_ANNUAL = 2400

// Below this, a CTC is more likely to be lakhs ("12") than a full yearly amount.
export const MIN_PLAUSIBLE_CTC = 10000

const round = (v: number) => Math.round(v)

export function monthlyStructure(monthlyGross: number) {
  return { basic: round(monthlyGross * BASIC_SHARE), hra: round(monthlyGross * HRA_SHARE) }
}

// Yearly pay after employee PF, professional tax and new-regime tax (the default TDS regime).
function annualInHand(annualGross: number): number {
  return annualGross
    - annualGross * BASIC_SHARE * PF_RATE
    - PROFESSIONAL_TAX_ANNUAL
    - newRegimeAnnualTax(annualGross)
}

export function monthlyInHandFromGross(monthlyGross: number): number {
  return round(annualInHand(monthlyGross * 12) / 12)
}

export function monthlyGrossFromCtc(annualCtc: number): number {
  return round(annualCtc / 12 / (1 + BASIC_SHARE * (PF_RATE + GRATUITY_RATE)))
}

// In-hand pay falls as gross rises just past the rebate limit and each surcharge threshold, so one
// in-hand figure can match several grosses. Those limits are where in-hand peaks. Between two peaks
// it dips and then only rises, so a binary search there finds the lowest matching gross.
function inHandPeaks(): number[] {
  const rules = TAX_RULES[LATEST_ENACTED_FY]
  return [rules.rebate.new.threshold, rules.surcharge.exemptUpTo, ...rules.surcharge.bands.map(b => b.upTo)]
    .map(taxable => taxable + rules.standardDeduction.new)
}

export function monthlyGrossFromInHand(monthlyInHand: number): number {
  const target = monthlyInHand * 12
  if (target <= 0) return 0
  let lo = 0
  let hi = 0
  for (const peak of inHandPeaks()) {
    hi = peak
    if (annualInHand(peak) >= target) break
    lo = peak
  }
  while (annualInHand(hi) < target) { lo = hi; hi *= 2 }
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2
    if (annualInHand(mid) < target) lo = mid
    else hi = mid
  }
  return round(hi / 12)
}

export function toMonthlyGross(type: SalaryInputType, amount: number): number {
  if (type === 'ctc') return monthlyGrossFromCtc(amount)
  if (type === 'inhand') return monthlyGrossFromInHand(amount)
  return round(amount)
}
