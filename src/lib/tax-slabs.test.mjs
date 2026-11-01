import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  slabBreakdown, newRegimeAnnualTax, estimateAnnualTax, oldRegimeDeductionSaving,
  LATEST_ENACTED_FY, ENACTED_FYS, fyLabel,
} from './tax-slabs.ts'

test('new regime slabs match the optimizer (taxable 43,07,000)', () => {
  const r = slabBreakdown(4307000, 'new')
  // 5%·4L + 10%·4L + 15%·4L + 20%·4L + 25%·4L + 30%·19.07L = 8,72,100; +4% cess = 9,06,984
  assert.equal(r.basicTax, 872100)
  assert.equal(r.total, 906984)
})

test('old regime (normal) matches the optimizer (taxable 43,32,000)', () => {
  const r = slabBreakdown(4332000, 'old')
  // 5%·2.5L + 20%·5L + 30%·33.32L = 11,12,100; +4% cess = 11,56,584
  assert.equal(r.basicTax, 1112100)
  assert.equal(r.total, 1156584)
})

test('new regime 87A: taxable ₹12L is fully rebated to zero', () => {
  const r = slabBreakdown(1200000, 'new')
  assert.equal(r.basicTax, 60000)
  assert.equal(r.rebate, 60000)
  assert.equal(r.total, 0)
})

test('newRegimeAnnualTax applies the ₹75k standard deduction', () => {
  // 43,82,000 gross − 75,000 = 43,07,000 taxable → 9,06,984
  assert.equal(newRegimeAnnualTax(4382000), 906984)
})

test('surcharge kicks in above ₹50L taxable (new regime capped at 25%)', () => {
  const r = slabBreakdown(6000000, 'new')
  assert.ok(r.surcharge > 0, 'surcharge should apply above ₹50L')
})

// ── Year parameterization ────────────────────────────────────────────────────

test('two enacted FYs are present and the latest is FY 2026-27', () => {
  assert.deepEqual(ENACTED_FYS, [2025, 2026])
  assert.equal(LATEST_ENACTED_FY, 2026)
})

test('fyLabel formats the start year as FY YYYY-YY', () => {
  assert.equal(fyLabel(2025), 'FY 2025-26')
  assert.equal(fyLabel(2026), 'FY 2026-27')
})

test('FY 2025-26 and FY 2026-27 rule sets are identical (Budget 2026 made no slab change)', () => {
  for (const taxable of [500000, 1200000, 1800000, 4307000, 6000000, 30000000]) {
    for (const regime of ['new', 'old']) {
      const a = slabBreakdown(taxable, regime, 'normal', 2025)
      const b = slabBreakdown(taxable, regime, 'normal', 2026)
      assert.equal(a.total, b.total, `${regime} @ ${taxable}: 25-26 vs 26-27`)
    }
  }
  assert.equal(estimateAnnualTax(2000000, 'new', 'normal', 2025), estimateAnnualTax(2000000, 'new', 'normal', 2026))
  assert.equal(oldRegimeDeductionSaving(1500000, 150000, 'normal', 2025), oldRegimeDeductionSaving(1500000, 150000, 'normal', 2026))
})

test('an unknown FY falls back to the latest enacted rules (never a fabricated year)', () => {
  const fallback = slabBreakdown(2000000, 'new', 'normal', 2099)
  const latest = slabBreakdown(2000000, 'new', 'normal', LATEST_ENACTED_FY)
  assert.equal(fallback.total, latest.total)
})

test('old-regime senior slabs differ from normal at the ₹2.5–3L band', () => {
  // ₹3L taxable: normal pays 5% on ₹0.5L = ₹2,500 (before rebate); senior pays 0 (₹3L exemption).
  const normal = slabBreakdown(300000, 'old', 'normal')
  const senior = slabBreakdown(300000, 'old', 'senior')
  assert.equal(normal.basicTax, 2500)
  assert.equal(senior.basicTax, 0)
})

// ── Marginal relief ──────────────────────────────────────────────────────────

test('87A marginal relief just above ₹12L in the new regime', () => {
  assert.equal(slabBreakdown(1200000, 'new').total, 0)
  // ₹100 over the limit: tax is capped at that ₹100, plus 4% cess.
  assert.equal(slabBreakdown(1200100, 'new').total, 104)
  // ₹60,000 over: slab tax is ₹69,000, capped at ₹60,000, plus cess.
  assert.equal(slabBreakdown(1260000, 'new').total, 62400)
  // Relief ends where the excess passes slab tax (about ₹70,588 over): full ₹72,000 plus cess.
  assert.equal(slabBreakdown(1280000, 'new').total, 74880)
})

// Each row: threshold, tax with surcharge at the threshold, and the total ₹10,000 above it (with cess).
const SURCHARGE_CASES = [
  ['new', 5000000, 1080000, 1133600],
  ['new', 10000000, 2838000, 2961920],
  ['new', 20000000, 6417000, 6684080],
  ['old', 5000000, 1312500, 1375400],
  ['old', 10000000, 3093750, 3227900],
  ['old', 20000000, 6684375, 6962150],
  ['old', 50000000, 18515625, 19266650],
]

for (const [regime, threshold, atThreshold, justAbove] of SURCHARGE_CASES) {
  test(`surcharge marginal relief: ${regime} regime at ₹${threshold}`, () => {
    assert.equal(slabBreakdown(threshold, regime).total, Math.round(atThreshold * 1.04))
    assert.equal(slabBreakdown(threshold + 10000, regime).total, justAbove)
    assert.equal(justAbove - Math.round(atThreshold * 1.04), Math.round(10000 * 1.04), 'only the extra income is taxed')
  })
}

test('new regime has no jump at ₹5Cr: the 25% rate continues, so full surcharge applies', () => {
  assert.equal(slabBreakdown(50000000, 'new').total, 18954000)
  assert.equal(slabBreakdown(50010000, 'new').total, 18957900)
})

test('marginal relief ends once full surcharge is cheaper', () => {
  // At ₹60L the relief ceiling no longer binds, so the surcharge is a plain 10% of tax.
  const r = slabBreakdown(6000000, 'new')
  assert.equal(r.surcharge, Math.round((300000 + 3600000 * 0.3) * 0.1))
})

test('surcharge marginal relief uses senior slabs in the old regime', () => {
  // The ceiling must come from the senior slabs, so ₹10,000 of extra income still costs ₹10,000 plus cess.
  const atThreshold = slabBreakdown(5000000, 'old', 'senior').total
  const above = slabBreakdown(5010000, 'old', 'senior').total
  assert.equal(above - atThreshold, 10400)
})

test('tax never falls as income rises across every threshold', () => {
  for (const regime of ['new', 'old']) {
    let prev = -1
    for (let t = 4900000; t <= 51000000; t += 2500) {
      const total = slabBreakdown(t, regime).total
      assert.ok(total >= prev, `${regime} @ ${t}: ${total} < ${prev}`)
      prev = total
    }
  }
})
