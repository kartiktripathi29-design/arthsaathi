import { test } from 'node:test'
import assert from 'node:assert/strict'
import { breakEvenDeductions, computeRegimeCore, regimeOutlook } from './verdict-engine.ts'

const TYPICAL = 225000
const totals = (annualGross, totalDeductions, seniorStatus = 'normal') =>
  computeRegimeCore({ annualGross, totalExemptions: 0, totalDeductions, seniorStatus })
const outlook = (annualGross, claimed, hasEntered, seniorStatus = 'normal') => regimeOutlook({
  annualGross, seniorStatus, claimed, hasEntered, oldTypical: totals(annualGross, TYPICAL, seniorStatus).oldTotal,
})

test('old regime can never win when new-regime tax is zero', () => {
  assert.equal(breakEvenDeductions({ annualGross: 1200000 }), null)
  assert.deepEqual(outlook(1200000, 0, false), { kind: 'new-tax-zero' })
  assert.deepEqual(outlook(1200000, 500000, true), { kind: 'new-tax-zero' })
})

test('break-even is the first rupee where old beats new', () => {
  for (const gross of [1500000, 2400000, 5000000, 8995248]) {
    const x = breakEvenDeductions({ annualGross: gross })
    const at = totals(gross, x)
    const before = totals(gross, x - 1)
    assert.ok(at.oldTotal < at.newTotal, `old should win at ${x} on ${gross}`)
    assert.ok(before.oldTotal >= before.newTotal, `old should not win below ${x} on ${gross}`)
  }
})

test('new regime winning with typical deductions reports the margin', () => {
  const t = totals(8995248, TYPICAL)
  assert.deepEqual(outlook(8995248, 0, false), { kind: 'new-wins-typical', margin: t.oldTotal - t.newTotal })
})

test('old regime could win when typical deductions already beat the new regime', () => {
  // No salary reaches this with ₹2.25L of typical deductions, so the old-regime figure is supplied.
  const gross = 2400000
  const { newTotal } = totals(gross, 0)
  assert.deepEqual(
    regimeOutlook({ annualGross: gross, claimed: 0, hasEntered: false, oldTypical: newTotal - 1 }),
    { kind: 'old-could-win', breakEven: breakEvenDeductions({ annualGross: gross }) },
  )
})

test('entered deductions report how much more is needed', () => {
  const x = breakEvenDeductions({ annualGross: 2400000 })
  assert.deepEqual(outlook(2400000, 200000, true), { kind: 'needs-more', more: x - 200000 })
})

test('reports the margin once entered deductions pass break-even', () => {
  const x = breakEvenDeductions({ annualGross: 2400000 })
  const t = totals(2400000, x + 50000)
  assert.deepEqual(outlook(2400000, x + 50000, true), { kind: 'old-wins', margin: t.newTotal - t.oldTotal })
})

test('other income moves the break-even', () => {
  const salaryOnly = breakEvenDeductions({ annualGross: 1400000 })
  const withOther = breakEvenDeductions({ annualGross: 1400000, slabOtherIncome: 600000 })
  assert.notEqual(salaryOnly, withOther)
})
