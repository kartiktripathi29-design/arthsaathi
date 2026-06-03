// Unit tests for the shared Section 80G helper. Built-in Node test runner + native
// TypeScript type-stripping (Node ≥ 22.6):
//
//   node --test src/lib/deductions.test.mjs   (or: npm test)
//
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeSec80G } from './deductions.ts'

test('no-limit buckets ignore the AGTI ceiling; 50% bucket is halved', () => {
  const rows = [
    { category: '100NoLimit', amount: 100000 },
    { category: '50NoLimit', amount: 40000 },
  ]
  // AGTI = 0 → cap = 0, but no-limit buckets aren't capped.
  const r = computeSec80G(rows, 0)
  assert.equal(r.eligibleNoLimit, 120000)        // 100000 + 0.5×40000
  assert.equal(r.eligibleWithLimit, 0)
  assert.equal(r.deduction, 120000)
})

test('a large "with-limit" donation is bound by the 10%-of-AGTI cap, not zeroed', () => {
  // This is the regression: when the income base was read as 0, the cap was 0 and this
  // entire ₹100k donation silently vanished. With a real AGTI the cap binds correctly.
  const rows = [{ category: '50WithLimit', amount: 100000 }]
  const adjustedGTI = 600000
  const r = computeSec80G(rows, adjustedGTI)
  assert.equal(r.eligibleWithLimitUncapped, 50000)   // 0.5 × 100000
  assert.equal(r.cap10pctAGTI, 60000)                // 10% × 600000
  assert.equal(r.eligibleWithLimit, 50000)           // uncapped < cap → full 50000 allowed
  assert.equal(r.deduction, 50000)
})

test('the 10%-of-AGTI ceiling actually clips an oversized with-limit donation', () => {
  const rows = [{ category: '100WithLimit', amount: 200000 }]
  const adjustedGTI = 600000
  const r = computeSec80G(rows, adjustedGTI)
  assert.equal(r.eligibleWithLimitUncapped, 200000)
  assert.equal(r.cap10pctAGTI, 60000)                // cap binds
  assert.equal(r.eligibleWithLimit, 60000)
  assert.equal(r.deduction, 60000)
})

test('AGTI of 0 wipes ONLY the with-limit buckets, never the no-limit ones', () => {
  const rows = [
    { category: '100NoLimit', amount: 25000 },
    { category: '100WithLimit', amount: 25000 },
  ]
  const r = computeSec80G(rows, 0)
  assert.equal(r.deduction, 25000)                   // no-limit survives, with-limit → 0
})

test('the no-limit and with-limit caps combine independently', () => {
  const rows = [
    { category: '100NoLimit', amount: 50000 },   // → 50000
    { category: '50NoLimit', amount: 50000 },    // → 25000
    { category: '100WithLimit', amount: 80000 }, // uncapped 80000, capped to 50000
    { category: '50WithLimit', amount: 40000 },  // adds 20000 to with-limit (still capped together)
  ]
  const adjustedGTI = 500000                        // cap = 50000
  const r = computeSec80G(rows, adjustedGTI)
  assert.equal(r.eligibleNoLimit, 75000)
  assert.equal(r.eligibleWithLimitUncapped, 100000) // 80000 + 0.5×40000
  assert.equal(r.eligibleWithLimit, 50000)          // clipped to the shared cap
  assert.equal(r.deduction, 125000)                 // 75000 + 50000
})

test('negative / missing amounts and empty input are handled safely', () => {
  assert.equal(computeSec80G([], 1000000).deduction, 0)
  assert.equal(computeSec80G(undefined, 1000000).deduction, 0)
  const r = computeSec80G([{ category: '100NoLimit', amount: -5000 }], 1000000)
  assert.equal(r.deduction, 0)                       // negative clamped to 0
})
