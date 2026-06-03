// Unit tests for the HRA exemption helpers. No test framework is installed; we use
// Node's built-in test runner + native TypeScript type-stripping (Node ≥ 22.6).
//
//   node --test src/lib/salary-analytics.test.mjs
//
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAnnualHraExemption, extractHraBasis } from './salary-analytics.ts'

// Helper: a constant-pay 12-month basis.
const constantBasis = (basic, hra) =>
  Array.from({ length: 12 }, (_, i) => ({
    monthKey: `2025-${String((i + 4 - 1) % 12 + 1).padStart(2, '0')}`,
    basic,
    hra,
  }))

test('mid-year raise is summed month-by-month, not (last month × 12)', () => {
  // Apr–Sep on ₹50k basic / ₹20k HRA, Oct–Mar on ₹80k basic / ₹32k HRA.
  const basis = [
    ...Array.from({ length: 6 }, (_, i) => ({ monthKey: `2025-0${i + 4}`, basic: 50000, hra: 20000 })),
    { monthKey: '2025-10', basic: 80000, hra: 32000 },
    { monthKey: '2025-11', basic: 80000, hra: 32000 },
    { monthKey: '2025-12', basic: 80000, hra: 32000 },
    { monthKey: '2026-01', basic: 80000, hra: 32000 },
    { monthKey: '2026-02', basic: 80000, hra: 32000 },
    { monthKey: '2026-03', basic: 80000, hra: 32000 },
  ]
  const rent = 25000 // constant, non-metro (40%)

  // First 6 months: min(20000, 25000−5000=20000, 0.4×50000=20000) = 20000 → ₹120,000
  // Last  6 months: min(32000, 25000−8000=17000, 0.4×80000=32000) = 17000 → ₹102,000
  const res = computeAnnualHraExemption(basis, rent, false)
  assert.equal(res.annualExemption, 222000)
  assert.equal(res.monthsCounted, 12)
  assert.equal(res.basicVaried, true)

  // The old buggy method (latest month × 12) would have given a different — wrong — number.
  const buggy = 17000 * 12 // = 204,000
  assert.notEqual(res.annualExemption, buggy)
})

test('constant pay: equals one month × 12 and flags basicVaried = false', () => {
  const basis = constantBasis(50000, 20000)
  // min(20000, 25000−5000=20000, 0.4×50000=20000) = 20000 → ₹240,000
  const res = computeAnnualHraExemption(basis, 25000, false)
  assert.equal(res.annualExemption, 240000)
  assert.equal(res.basicVaried, false)
  assert.equal(res.annualHraReceived, 240000)
})

test('metro 50% vs non-metro 40% changes the limiting factor', () => {
  const basis = constantBasis(50000, 30000)
  // Non-metro: min(30000, 30000−5000=25000, 0.4×50000=20000) = 20000 → ₹240,000
  assert.equal(computeAnnualHraExemption(basis, 30000, false).annualExemption, 240000)
  // Metro:     min(30000, 25000,            0.5×50000=25000) = 25000 → ₹300,000
  assert.equal(computeAnnualHraExemption(basis, 30000, true).annualExemption, 300000)
})

test('rent below 10% of basic clamps that month to zero (no negative exemption)', () => {
  const basis = constantBasis(50000, 20000)
  // rent 4000 → 4000 − 5000 = −1000 → max(0, min(...)) = 0 every month.
  const res = computeAnnualHraExemption(basis, 4000, false)
  assert.equal(res.annualExemption, 0)
})

test('extractHraBasis pulls Basic/HRA from per-month earnings and sorts by month', () => {
  const employments = [{
    id: 'emp-1',
    fromMonth: '2025-04',
    toMonth: '2026-03',
    months: [
      { monthKey: '2025-05', gross: 70000, net: 60000, source: 'actual',
        earnings: [{ label: 'Basic', amount: 50000 }, { label: 'HRA', amount: 20000 }, { label: 'Special Allowance', amount: 0 }] },
      { monthKey: '2025-04', gross: 70000, net: 60000, source: 'actual',
        earnings: [{ label: 'House Rent Allowance', amount: 21000 }, { label: 'Basic Pay', amount: 49000 }] },
      // Out of range — must be ignored.
      { monthKey: '2026-04', gross: 99999, net: 88888, source: 'projected',
        earnings: [{ label: 'Basic', amount: 99999 }, { label: 'HRA', amount: 99999 }] },
    ],
  }]
  const basis = extractHraBasis(employments)
  assert.equal(basis.length, 2)                 // out-of-range month dropped
  assert.equal(basis[0].monthKey, '2025-04')    // sorted ascending
  assert.equal(basis[0].basic, 49000)           // "Basic Pay" matches /basic/i
  assert.equal(basis[0].hra, 21000)             // "House Rent Allowance" matches /hra|house rent/i
  assert.equal(basis[1].monthKey, '2025-05')
  assert.equal(basis[1].basic, 50000)
  assert.equal(basis[1].hra, 20000)
})
