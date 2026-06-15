import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeYearTax, computeSavings, SUPPORTED_FYS, getYearRules } from './tax-history.ts'

// ── FY 2024-25 — ₹12L gross salaried, old regime with ₹1.5L 80C ──────────────────────────
test('FY 2024-25 old regime: ₹12L gross, ₹1.5L VI-A → taxable ₹10L → ₹1,17,000', () => {
  const r = computeYearTax('FY 2024-25', 'old', { grossSalary: 1200000, chapterVIA: 150000 })
  assert.equal(r.taxableIncome, 1000000) // 12L − 50k std − 1.5L VI-A
  assert.equal(r.basicTax, 112500)       // 12,500 + 20%·5L
  assert.equal(r.totalTax, 117000)       // +4% cess
})

test('FY 2024-25 new regime: ₹12L gross → taxable ₹11.25L → ₹71,500', () => {
  const r = computeYearTax('FY 2024-25', 'new', { grossSalary: 1200000, chapterVIA: 150000 })
  assert.equal(r.taxableIncome, 1125000) // 12L − 75k std (VI-A ignored in new)
  assert.equal(r.basicTax, 68750)        // 5%·4L + 10%·3L + 15%·1.25L
  assert.equal(r.totalTax, 71500)
})

test('FY 2024-25 savings: filed old, new is cheaper by ₹45,500', () => {
  const s = computeSavings('FY 2024-25', 'old', { grossSalary: 1200000, chapterVIA: 150000 })
  assert.equal(s.asFiled.totalTax, 117000)
  assert.equal(s.alternate.totalTax, 71500)
  assert.equal(s.cheaperRegime, 'new')
  assert.equal(s.regimeSwitchSaving, 45500)
  assert.equal(s.filedOptimalRegime, false)
})

// ── FY 2021-22 — early new regime (NO standard deduction) ─────────────────────────────────
test('FY 2021-22 new regime has no standard deduction', () => {
  const r = computeYearTax('FY 2021-22', 'new', { grossSalary: 1500000 })
  assert.equal(r.standardDeduction, 0)
  assert.equal(r.taxableIncome, 1500000)
  assert.equal(r.basicTax, 187500) // 5%·2.5 +10%·2.5 +15%·2.5 +20%·2.5 +25%·2.5 (L)
  assert.equal(r.totalTax, 195000)
})

test('FY 2021-22 savings: ₹15L gross filed old w/ ₹1.5L VI-A → new saves ₹15,600', () => {
  const s = computeSavings('FY 2021-22', 'old', { grossSalary: 1500000, chapterVIA: 150000 })
  assert.equal(s.asFiled.totalTax, 210600) // taxable 13L: 12,500+100,000+90,000 → 202,500 +cess
  assert.equal(s.alternate.totalTax, 195000)
  assert.equal(s.regimeSwitchSaving, 15600)
})

// ── Rebate 87A edges ─────────────────────────────────────────────────────────────────────
test('FY 2025-26 new regime: taxable ₹12L fully rebated to ₹0', () => {
  const r = computeYearTax('FY 2025-26', 'new', { grossSalary: 1275000 }) // 12.75L − 75k = 12L
  assert.equal(r.taxableIncome, 1200000)
  assert.equal(r.basicTax, 60000)
  assert.equal(r.rebate, 60000)
  assert.equal(r.totalTax, 0)
})

test('FY 2025-26 new regime marginal relief triggers just past ₹12L', () => {
  const r = computeYearTax('FY 2025-26', 'new', { grossSalary: 1325000 }) // taxable 12.5L
  assert.equal(r.taxableIncome, 1250000)
  assert.equal(r.basicTax, 67500)
  assert.equal(r.rebate, 17500)  // 67,500 − (12.5L−12L) = 67,500 − 50,000
  assert.equal(r.totalTax, 52000) // 50,000 + 4% cess
})

// ── House-property loss set-off (regression: real ITR-1, FY 2024-25, filed old) ───────────
test('FY 2024-25 old regime: house-property loss reduces taxable; reconciles to filed tax', () => {
  // Real return: gross 25,09,943; s.10 exempts 5,31,713; house-property loss −1,65,622; VI-A 1,56,484.
  const r = computeYearTax('FY 2024-25', 'old', {
    grossSalary: 2509943, exemptAllowances: 531713, otherSlabIncome: -165622, chapterVIA: 156484,
  })
  assert.equal(r.grossTotalIncome, 1762608) // 25,09,943 − 50k std − 5,31,713 exempt − 1,65,622 loss
  assert.equal(r.taxableIncome, 1606124)     // − 1,56,484 VI-A (return rounds to 16,06,120)
  assert.equal(r.totalTax, 306111)           // return reports ₹3,06,109 — reconciles within ₹2
})

test('new regime disallows the house-property loss set-off (floored at 0)', () => {
  const r = computeYearTax('FY 2024-25', 'new', { grossSalary: 2509943, otherSlabIncome: -165622 })
  assert.equal(r.grossTotalIncome, 2434943) // loss does NOT reduce salary in new regime
})

test('house-property loss set-off is capped at ₹2L (old regime)', () => {
  const r = computeYearTax('FY 2024-25', 'old', { grossSalary: 1000000, otherSlabIncome: -500000 })
  // gross 10L − 50k std − min(5L,2L)=2L loss → GTI 7.5L
  assert.equal(r.grossTotalIncome, 750000)
})

// ── Old regime is constant across the window ─────────────────────────────────────────────
test('old regime ₹10L taxable is identical in FY 2020-21 and FY 2025-26', () => {
  const a = computeYearTax('FY 2020-21', 'old', { grossSalary: 1050000 }) // −50k std → 10L
  const b = computeYearTax('FY 2025-26', 'old', { grossSalary: 1050000 })
  assert.equal(a.totalTax, b.totalTax)
  assert.equal(a.totalTax, 117000)
})

// ── Coverage / guards ────────────────────────────────────────────────────────────────────
test('all six FYs from 2020-21 to 2025-26 are supported', () => {
  assert.deepEqual(SUPPORTED_FYS, ['FY 2020-21', 'FY 2021-22', 'FY 2022-23', 'FY 2023-24', 'FY 2024-25', 'FY 2025-26'])
})

test('unsupported year (pre new-regime) returns null', () => {
  assert.equal(getYearRules('FY 2019-20'), null)
  assert.equal(computeYearTax('FY 2019-20', 'old', { grossSalary: 1000000 }), null)
})

test('FY → AY mapping is correct', () => {
  assert.equal(getYearRules('FY 2024-25').ay, 'AY 2025-26')
})
