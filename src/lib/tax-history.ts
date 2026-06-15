/**
 * Historical income-tax rule tables — FY 2020-21 onward (the years the new regime, s.115BAC, exists).
 *
 * Purpose: recompute a PAST, already-filed year's tax under EITHER regime using *that year's actual
 * rules*, so we can show — honestly — how a different regime choice would have landed. This is the
 * foundation for the "how much you could have saved" read on a previously-filed ITR.
 *
 * Deliberately self-contained. It does NOT reuse `tax-engine.ts` / `tax-slabs.ts`: those encode a
 * single (and currently contested — see the FY-conflict handoff note) year, and running a prior year
 * through them would silently apply the wrong slabs. A retrospective number computed on the wrong
 * year's rules is a fabricated number — which the product's "no fabricated numbers" principle forbids.
 *
 * Pure: no React, no I/O. Rupee inputs are annual rupees (integers).
 *
 * Scope / documented simplifications (v1 — keep honest about what this does NOT model):
 *   - Resident individuals. HUF/firm/company rates not modelled.
 *   - Surcharge IS applied, but marginal relief ON surcharge is not (matters only just past ₹50L/1Cr/…).
 *   - Special-rate capital gains (equity STCG/LTCG etc.) are NOT folded in here — they're taxed at
 *     fixed rates independent of regime, so they don't change the regime-choice delta this engine is
 *     about. Slab-rate "other income" (interest, slab CG, etc.) IS supported via `otherSlabIncome`.
 *   - Marginal relief on the 87A rebate (new regime, income just over the threshold) IS modelled.
 *
 * Sources verified against cleartax / incometax.gov.in / tax2win (Jun 2026) for each FY's slabs,
 * standard deduction, and 87A thresholds — see the per-year comments.
 */

export type Regime = 'old' | 'new'
export type SeniorStatus = 'normal' | 'senior' | 'super_senior'

/** A slab boundary: income ABOVE `from` (up to the next boundary's `from`) is taxed at `rate`. */
type Slab = { from: number; rate: number }

interface Rebate87A {
  /** Total income at or below this gets the rebate. */
  thresholdTaxable: number
  /** Maximum rebate amount. */
  maxRebate: number
  /** New-regime marginal relief: just above the threshold, cap tax at (income − threshold). */
  marginalRelief: boolean
}

interface RegimeRules {
  slabs: Slab[]
  /** Salaried standard deduction available in THIS regime/year (0 where not allowed). */
  standardDeduction: number
  rebate87A: Rebate87A
  /** Whether VI-A / HRA / other exemptions reduce taxable income in this regime. New regime: false. */
  allowsDeductions: boolean
  /** Top surcharge rate (>₹5Cr). New regime is capped at 25% from FY 2023-24; old stays 37%. */
  topSurchargeRate: number
}

interface YearRules {
  fy: string
  ay: string
  old: RegimeRules
  new: RegimeRules
}

// ─── Old regime — constant across FY 2020-21 → FY 2025-26 ──────────────────────────────
// Slabs/rebate/standard-deduction for the old regime did not change over this window.

function oldSlabs(senior: SeniorStatus): Slab[] {
  if (senior === 'super_senior') {
    // 80+: basic exemption ₹5L.
    return [{ from: 0, rate: 0 }, { from: 500000, rate: 0.2 }, { from: 1000000, rate: 0.3 }]
  }
  if (senior === 'senior') {
    // 60–80: basic exemption ₹3L.
    return [{ from: 0, rate: 0 }, { from: 300000, rate: 0.05 }, { from: 500000, rate: 0.2 }, { from: 1000000, rate: 0.3 }]
  }
  return [{ from: 0, rate: 0 }, { from: 250000, rate: 0.05 }, { from: 500000, rate: 0.2 }, { from: 1000000, rate: 0.3 }]
}

function oldRegimeRules(senior: SeniorStatus): RegimeRules {
  return {
    slabs: oldSlabs(senior),
    standardDeduction: 50000,
    rebate87A: { thresholdTaxable: 500000, maxRebate: 12500, marginalRelief: false },
    allowsDeductions: true,
    topSurchargeRate: 0.37,
  }
}

// ─── New regime — changes per FY (the only moving part across these years) ──────────────

// FY 2020-21 / 21-22 / 22-23 — identical: 7-rate ladder, NO standard deduction, 87A ≤₹5L → ₹12,500,
// surcharge ladder same as old (top 37%).
const NEW_2020_22: RegimeRules = {
  slabs: [
    { from: 0, rate: 0 },
    { from: 250000, rate: 0.05 },
    { from: 500000, rate: 0.10 },
    { from: 750000, rate: 0.15 },
    { from: 1000000, rate: 0.20 },
    { from: 1250000, rate: 0.25 },
    { from: 1500000, rate: 0.30 },
  ],
  standardDeduction: 0,
  rebate87A: { thresholdTaxable: 500000, maxRebate: 12500, marginalRelief: false },
  allowsDeductions: false,
  topSurchargeRate: 0.37,
}

// FY 2023-24 — restructured to 6 rates, ₹50k standard deduction introduced, 87A ≤₹7L → ₹25k
// (+ marginal relief), top surcharge capped at 25%.
const NEW_2023: RegimeRules = {
  slabs: [
    { from: 0, rate: 0 },
    { from: 300000, rate: 0.05 },
    { from: 600000, rate: 0.10 },
    { from: 900000, rate: 0.15 },
    { from: 1200000, rate: 0.20 },
    { from: 1500000, rate: 0.30 },
  ],
  standardDeduction: 50000,
  rebate87A: { thresholdTaxable: 700000, maxRebate: 25000, marginalRelief: true },
  allowsDeductions: false,
  topSurchargeRate: 0.25,
}

// FY 2024-25 — slab widths nudged (3/7/10/12/15L), standard deduction raised to ₹75k.
const NEW_2024: RegimeRules = {
  slabs: [
    { from: 0, rate: 0 },
    { from: 300000, rate: 0.05 },
    { from: 700000, rate: 0.10 },
    { from: 1000000, rate: 0.15 },
    { from: 1200000, rate: 0.20 },
    { from: 1500000, rate: 0.30 },
  ],
  standardDeduction: 75000,
  rebate87A: { thresholdTaxable: 700000, maxRebate: 25000, marginalRelief: true },
  allowsDeductions: false,
  topSurchargeRate: 0.25,
}

// FY 2025-26 — Budget 2025 ladder (4/8/12/16/20/24L), 87A ≤₹12L → ₹60k (+ marginal relief), ₹75k SD.
const NEW_2025: RegimeRules = {
  slabs: [
    { from: 0, rate: 0 },
    { from: 400000, rate: 0.05 },
    { from: 800000, rate: 0.10 },
    { from: 1200000, rate: 0.15 },
    { from: 1600000, rate: 0.20 },
    { from: 2000000, rate: 0.25 },
    { from: 2400000, rate: 0.30 },
  ],
  standardDeduction: 75000,
  rebate87A: { thresholdTaxable: 1200000, maxRebate: 60000, marginalRelief: true },
  allowsDeductions: false,
  topSurchargeRate: 0.25,
}

const NEW_BY_FY: Record<string, RegimeRules> = {
  'FY 2020-21': NEW_2020_22,
  'FY 2021-22': NEW_2020_22,
  'FY 2022-23': NEW_2020_22,
  'FY 2023-24': NEW_2023,
  'FY 2024-25': NEW_2024,
  'FY 2025-26': NEW_2025,
}

/** FY → AY (FY 2024-25 → AY 2025-26). */
function ayOf(fy: string): string {
  const m = fy.match(/FY (\d{4})-(\d{2})/)
  if (!m) return ''
  const start = parseInt(m[1], 10) + 1
  return `AY ${start}-${(start + 1).toString().slice(2)}`
}

export const SUPPORTED_FYS = Object.keys(NEW_BY_FY)
export function isSupportedFY(fy: string): boolean {
  return Object.prototype.hasOwnProperty.call(NEW_BY_FY, fy)
}

export function getYearRules(fy: string, senior: SeniorStatus = 'normal'): YearRules | null {
  const nw = NEW_BY_FY[fy]
  if (!nw) return null
  return { fy, ay: ayOf(fy), old: oldRegimeRules(senior), new: nw }
}

// ─── Core math ─────────────────────────────────────────────────────────────────────────

// Max house-property loss set off against other heads under the old regime (s.71B), per year.
const HOUSE_LOSS_SETOFF_CAP = 200000

function slabTax(taxable: number, slabs: Slab[]): number {
  let tax = 0
  for (let i = 0; i < slabs.length; i++) {
    const from = slabs[i].from
    const to = i + 1 < slabs.length ? slabs[i + 1].from : Infinity
    if (taxable > from) tax += (Math.min(taxable, to) - from) * slabs[i].rate
  }
  return tax
}

function rebate(taxable: number, basicTax: number, r: Rebate87A): number {
  if (taxable <= r.thresholdTaxable) return Math.min(basicTax, r.maxRebate)
  if (r.marginalRelief) {
    // Just above the threshold, total tax (incl. cess-less basic) is capped so it can't exceed the
    // income earned past the threshold. Keeps the cliff smooth.
    const excess = taxable - r.thresholdTaxable
    if (basicTax > excess) return basicTax - excess
  }
  return 0
}

function surcharge(taxable: number, taxAfterRebate: number, topRate: number): number {
  if (taxable <= 5000000) return 0
  let rate: number
  if (taxable <= 10000000) rate = 0.10
  else if (taxable <= 20000000) rate = 0.15
  else if (taxable <= 50000000) rate = 0.25
  else rate = topRate
  return taxAfterRebate * rate
}

// ─── Income components (what a filed return breaks down into) ────────────────────────────

export interface IncomeComponents {
  /** Salary head, GROSS — before standard deduction and before any s.10 exemption (HRA/LTA/etc.). */
  grossSalary: number
  /** s.10 exemptions claimed against salary (HRA + LTA + others). Old regime only; ignored in new. */
  exemptAllowances?: number
  /** Net income from other heads taxed at SLAB rate (house property, interest, slab-rate CG, etc.).
   *  MAY be negative — a house-property loss (home-loan interest) set off against salary. */
  otherSlabIncome?: number
  /** Chapter VI-A deductions claimed (80C/80D/80CCD(1B)/24b/80G/…). Old regime only; ignored in new. */
  chapterVIA?: number
  /** Whether the salaried standard deduction applies (true for salaried/pensioner). */
  isSalaried?: boolean
}

export interface YearTaxResult {
  fy: string
  ay: string
  regime: Regime
  grossTotalIncome: number   // after standard deduction + exemptions, before VI-A — i.e. ITR's GTI
  standardDeduction: number
  exemptAllowances: number
  chapterVIA: number
  taxableIncome: number      // "Total Income" — the figure slabs apply to
  basicTax: number
  rebate: number
  surcharge: number
  cess: number
  totalTax: number
  effectiveRate: number      // % of taxable income
}

/**
 * Compute tax for one regime in one year from gross income components, using that year's rules.
 * Old regime applies standard deduction + exemptions + VI-A; new regime applies only its own
 * standard deduction (where the year allows it) and ignores exemptions/VI-A.
 */
export function computeYearTax(
  fy: string,
  regime: Regime,
  income: IncomeComponents,
  senior: SeniorStatus = 'normal'
): YearTaxResult | null {
  const rules = getYearRules(fy, senior)
  if (!rules) return null
  const rr = regime === 'old' ? rules.old : rules.new

  const gross = Math.max(0, income.grossSalary || 0)
  const isSalaried = income.isSalaried !== false
  const std = isSalaried ? Math.min(rr.standardDeduction, gross) : 0
  const exemptAllowances = rr.allowsDeductions ? Math.max(0, income.exemptAllowances || 0) : 0
  const chapterVIA = rr.allowsDeductions ? Math.max(0, income.chapterVIA || 0) : 0
  // Other slab-head income can be NEGATIVE — a house-property loss (home-loan interest) set off
  // against salary. Old regime allows that set-off up to ₹2L; new regime disallows it (the loss
  // can't reduce salary), so a negative is floored at 0 there. Positive other income always adds.
  const otherSlabRaw = income.otherSlabIncome || 0
  const otherSlab = rr.allowsDeductions
    ? Math.max(otherSlabRaw, -HOUSE_LOSS_SETOFF_CAP)
    : Math.max(0, otherSlabRaw)

  // Gross Total Income: salary net of standard deduction & exemptions, plus other slab-rate heads
  // (which may be a loss). Floored at 0 — a loss beyond income can't make GTI negative here.
  const salaryAfterExempt = Math.max(0, gross - std - exemptAllowances)
  const grossTotalIncome = Math.max(0, salaryAfterExempt + otherSlab)
  const taxableIncome = Math.max(0, grossTotalIncome - chapterVIA)

  const basicTax = slabTax(taxableIncome, rr.slabs)
  const reb = rebate(taxableIncome, basicTax, rr.rebate87A)
  const taxAfterRebate = Math.max(0, basicTax - reb)
  const sur = surcharge(taxableIncome, taxAfterRebate, rr.topSurchargeRate)
  const cess = (taxAfterRebate + sur) * 0.04
  const totalTax = Math.round(taxAfterRebate + sur + cess)

  return {
    fy,
    ay: rules.ay,
    regime,
    grossTotalIncome: Math.round(grossTotalIncome),
    standardDeduction: Math.round(std),
    exemptAllowances: Math.round(exemptAllowances),
    chapterVIA: Math.round(chapterVIA),
    taxableIncome: Math.round(taxableIncome),
    basicTax: Math.round(basicTax),
    rebate: Math.round(reb),
    surcharge: Math.round(sur),
    cess: Math.round(cess),
    totalTax,
    effectiveRate: taxableIncome > 0 ? parseFloat(((totalTax / taxableIncome) * 100).toFixed(2)) : 0,
  }
}

// ─── "What you could have saved" comparison ──────────────────────────────────────────────

export interface SavingsResult {
  fy: string
  ay: string
  filedRegime: Regime
  asFiled: YearTaxResult
  alternate: YearTaxResult
  cheaperRegime: Regime
  /** Tax you'd have paid in the cheaper regime less what you paid as filed — ≥0 when a switch helps. */
  regimeSwitchSaving: number
  /** True when the regime you filed was already the cheaper one. */
  filedOptimalRegime: boolean
}

/**
 * Given the components a return broke into and the regime actually filed, compute the tax both ways
 * and report the regime-switch saving — a concrete, fully-derived number (no counterfactual
 * "if you'd invested" assumptions). This is the honest headline for "could have saved".
 */
export function computeSavings(
  fy: string,
  filedRegime: Regime,
  income: IncomeComponents,
  senior: SeniorStatus = 'normal'
): SavingsResult | null {
  const asFiled = computeYearTax(fy, filedRegime, income, senior)
  const otherRegime: Regime = filedRegime === 'old' ? 'new' : 'old'
  const alternate = computeYearTax(fy, otherRegime, income, senior)
  if (!asFiled || !alternate) return null

  const cheaperRegime: Regime = alternate.totalTax < asFiled.totalTax ? otherRegime : filedRegime
  const regimeSwitchSaving = Math.max(0, asFiled.totalTax - alternate.totalTax)

  return {
    fy,
    ay: asFiled.ay,
    filedRegime,
    asFiled,
    alternate,
    cheaperRegime,
    regimeSwitchSaving,
    filedOptimalRegime: cheaperRegime === filedRegime,
  }
}
