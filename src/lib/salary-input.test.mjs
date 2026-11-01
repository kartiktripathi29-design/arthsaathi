import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  monthlyGrossFromCtc, monthlyGrossFromInHand, monthlyInHandFromGross, toMonthlyGross,
  BASIC_SHARE, PF_RATE, GRATUITY_RATE,
} from './salary-input.ts'

const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`)

test('gross passes through unchanged', () => {
  assert.equal(toMonthlyGross('gross', 100000), 100000)
})

test('CTC removes employer PF and gratuity, and rebuilds to the same CTC', () => {
  const gross = monthlyGrossFromCtc(9600000)
  assert.equal(gross, 749604)
  const basic = gross * BASIC_SHARE
  near((gross + basic * PF_RATE + basic * GRATUITY_RATE) * 12, 9600000, 12)
})

test('in-hand below the rebate limit only reverses PF and professional tax', () => {
  // (75,000 × 12 + 2,400) ÷ (1 − 0.048); no tax applies at this level.
  assert.equal(monthlyGrossFromInHand(75000), 78992)
})

test('in-hand round-trips through gross across the tax bands', () => {
  for (const gross of [30000, 78992, 100000, 150000, 300000, 750000, 2000000]) {
    near(monthlyGrossFromInHand(monthlyInHandFromGross(gross)), gross, 2)
  }
})

test('in-hand picks the lowest gross where in-hand dips past the rebate limit', () => {
  // Gross of ₹1,06,250 a month is ₹12L taxable: the last point with no tax. Higher grosses just past
  // it take home less, so this in-hand figure must not resolve to one of those later matches.
  const atLimit = monthlyInHandFromGross(106250)
  near(monthlyGrossFromInHand(atLimit), 106250, 2)
})

test('in-hand at a very high salary still converges above the surcharge thresholds', () => {
  const gross = monthlyGrossFromInHand(1000000)
  assert.ok(monthlyInHandFromGross(gross) >= 999999)
  assert.ok(gross > 1000000)
})

test('zero converts to zero', () => {
  assert.equal(toMonthlyGross('ctc', 0), 0)
  assert.equal(toMonthlyGross('inhand', 0), 0)
})
