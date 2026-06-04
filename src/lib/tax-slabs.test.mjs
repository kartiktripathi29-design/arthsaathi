import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slabBreakdown, newRegimeAnnualTax } from './tax-slabs.ts'

test('new regime FY26-27 slabs match the optimizer (taxable 43,07,000)', () => {
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
