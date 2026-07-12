// #6 — Past-years cross-check.
//
// FY 2025-26 rules exist in BOTH engines: tax-history.ts's historical table (FY 2020-21 → 2025-26)
// and the consolidated tax-slabs.ts. tax-history stays self-contained (it needs years tax-slabs
// doesn't carry, and uses a different slab representation), so instead of merging we LOCK that the
// overlapping year agrees — this test fails loudly if the duplicate ever drifts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeYearTax } from './tax-history.ts'
import { slabBreakdown } from './tax-slabs.ts'

test('FY 2025-26: tax-history and tax-slabs agree on tax (new & old regime)', () => {
  const STD = { new: 75000, old: 50000 } // standard deduction, salaried
  // Incomes kept below the ₹50L surcharge threshold so both engines are compared on plain slab math.
  for (const gross of [875000, 1275000, 1575000, 2500000, 4000000]) {
    for (const regime of ['new', 'old']) {
      const history = computeYearTax('FY 2025-26', regime, { grossSalary: gross }).totalTax
      const consolidated = slabBreakdown(gross - STD[regime], regime, 'normal', 2025).total
      assert.equal(history, consolidated, `${regime} @ gross ${gross}: tax-history vs tax-slabs`)
    }
  }
})
