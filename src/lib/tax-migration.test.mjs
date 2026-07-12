// Parity / delta test for retiring tax-engine.ts.
//
// tax-engine.ts computed /api/tax-calc + dashboard/profile on STALE FY 2024-25 slabs. The migration
// moves them onto the consolidated engine (tax-slabs.ts), which uses the correct FY 2025-26 / 2026-27
// rules. This test pins the LEGACY FY 2024-25 output (inlined below, reference only) against the NEW
// engine's output so the intended behaviour change is explicit and locked:
//   • NEW regime: numbers change materially (the Budget-2025 ₹12L rebate + rebuilt slabs).
//   • OLD regime: numbers are UNCHANGED (old-regime slabs & 87A were identical in FY 2024-25).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcNewRegime, slabBreakdown } from './tax-slabs.ts'

// ── Legacy FY 2024-25 formulas, copied verbatim from the retired tax-engine.ts (reference only) ──
function legacySurcharge(income, basicTax) {
  if (income <= 5000000) return 0
  if (income <= 10000000) return basicTax * 0.10
  if (income <= 20000000) return basicTax * 0.15
  if (income <= 50000000) return basicTax * 0.25
  return basicTax * 0.37
}
function legacyNewRegimeTotal(annualGross) {
  const T = Math.max(0, annualGross - 75000) // ₹75k standard deduction
  let basic = 0
  if (T <= 300000) basic = 0
  else if (T <= 700000) basic = (T - 300000) * 0.05
  else if (T <= 1000000) basic = 20000 + (T - 700000) * 0.10
  else if (T <= 1200000) basic = 50000 + (T - 1000000) * 0.15
  else if (T <= 1500000) basic = 80000 + (T - 1200000) * 0.20
  else basic = 140000 + (T - 1500000) * 0.30
  const rebate = T <= 700000 ? Math.min(basic, 25000) : 0 // 87A ≤ ₹7L → ₹25k
  const afterRebate = Math.max(0, basic - rebate)
  const surcharge = legacySurcharge(T, afterRebate)
  return Math.round(afterRebate + surcharge + (afterRebate + surcharge) * 0.04)
}
function legacyOldRegimeTotal(taxable) {
  let basic = 0
  if (taxable <= 250000) basic = 0
  else if (taxable <= 500000) basic = (taxable - 250000) * 0.05
  else if (taxable <= 1000000) basic = 12500 + (taxable - 500000) * 0.20
  else basic = 112500 + (taxable - 1000000) * 0.30
  const rebate = taxable <= 500000 ? Math.min(basic, 12500) : 0
  const afterRebate = Math.max(0, basic - rebate)
  const surcharge = legacySurcharge(taxable, afterRebate)
  return Math.round(afterRebate + surcharge + (afterRebate + surcharge) * 0.04)
}

// ── NEW regime: the migration corrects these numbers (documented deltas) ────────────────────────

test('new regime — the migration changes the number (legacy FY24-25 → new FY25-26)', () => {
  const cases = [
    // gross,     legacy FY24-25,  new FY25-26,   note
    [875000, 31200, 0], //   ₹8.75L: legacy ₹31,200 → now ₹0 (fully rebated)
    [1275000, 83200, 0], //  ₹12.75L: legacy ₹83,200 → now ₹0 (₹12L rebate)
    [1575000, 145600, 109200], // ₹15.75L: legacy ₹1,45,600 → now ₹1,09,200 (−₹36,400)
  ]
  for (const [gross, legacy, expectedNew] of cases) {
    assert.equal(legacyNewRegimeTotal(gross), legacy, `legacy baseline @ ${gross}`)
    const now = calcNewRegime(gross).totalTax
    assert.equal(now, expectedNew, `new engine @ ${gross}`)
    assert.notEqual(now, legacy, `@ ${gross}: migration must change the new-regime number`)
  }
})

// ── OLD regime: the migration must NOT change the number (identical slabs both years) ───────────

test('old regime — migration leaves the number unchanged (FY24-25 old slabs == FY25-26)', () => {
  for (const taxable of [400000, 750000, 1000000, 2500000, 6000000]) {
    const legacy = legacyOldRegimeTotal(taxable)
    const now = slabBreakdown(taxable, 'old', 'normal').total
    assert.equal(now, legacy, `old regime @ taxable ${taxable} must be unchanged`)
  }
})
