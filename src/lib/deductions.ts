// Pure helpers for Chapter VI-A deduction math shared between the Deductions page
// (data entry) and the Tax Optimizer (verdict). Keeping the Section 80G logic in one
// place stops the two screens from quietly diverging — they previously duplicated the
// rate-and-cap formula and had to be hand-kept "in sync".

// Section 80G qualifying-limit buckets:
//   100NoLimit:   100% deduction, no qualifying ceiling   (PM CARES, PMNRF, National Defence Fund, …)
//   50NoLimit:    50%  deduction, no qualifying ceiling   (JN Memorial Fund, Rajiv Gandhi Foundation, …)
//   100WithLimit: 100% deduction, capped at 10% of Adjusted GTI (Indian Olympic Assoc., family-planning, …)
//   50WithLimit:  50%  deduction, capped at 10% of Adjusted GTI (most approved trusts / NGOs)
export type DonationCat = '100NoLimit' | '50NoLimit' | '100WithLimit' | '50WithLimit'

export interface DonationRow {
  id?: string
  category: DonationCat
  amount: number
}

export interface Sec80GBreakdown {
  g100NoLimit: number               // gross donations in each bucket
  g50NoLimit: number
  g100WithLimit: number
  g50WithLimit: number
  eligibleNoLimit: number           // 100NoLimit + 50% × 50NoLimit (not subject to the AGTI ceiling)
  eligibleWithLimitUncapped: number // 100WithLimit + 50% × 50WithLimit, before the AGTI ceiling
  cap10pctAGTI: number              // the 10%-of-Adjusted-GTI ceiling
  eligibleWithLimit: number         // min(uncapped, cap)
  deduction: number                 // total 80G deduction = eligibleNoLimit + eligibleWithLimit
}

// Compute the Section 80G deduction. `adjustedGTI` is Gross Total Income minus the other
// Chapter VI-A deductions (excluding 80G itself); the caller supplies it because it depends
// on the rest of the deductions. The two "with limit" buckets share a single 10%-of-AGTI
// ceiling, applied AFTER the 50%/100% rate. Rate-first, then cap — per the Income Tax Act.
export function computeSec80G(rows: DonationRow[], adjustedGTI: number): Sec80GBreakdown {
  const sum = (cat: DonationCat) =>
    (rows || [])
      .filter(r => r.category === cat)
      .reduce((s, r) => s + Math.max(0, r.amount || 0), 0)

  const g100NoLimit = sum('100NoLimit')
  const g50NoLimit = sum('50NoLimit')
  const g100WithLimit = sum('100WithLimit')
  const g50WithLimit = sum('50WithLimit')

  const eligibleNoLimit = g100NoLimit + 0.5 * g50NoLimit
  const eligibleWithLimitUncapped = g100WithLimit + 0.5 * g50WithLimit
  const cap10pctAGTI = Math.round(Math.max(0, adjustedGTI) * 0.10)
  const eligibleWithLimit = Math.min(eligibleWithLimitUncapped, cap10pctAGTI)
  const deduction = Math.round(eligibleNoLimit + eligibleWithLimit)

  return {
    g100NoLimit, g50NoLimit, g100WithLimit, g50WithLimit,
    eligibleNoLimit, eligibleWithLimitUncapped,
    cap10pctAGTI, eligibleWithLimit, deduction,
  }
}
