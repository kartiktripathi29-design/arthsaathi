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
