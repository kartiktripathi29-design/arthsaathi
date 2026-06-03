import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSalaryFacts } from './salary-facts.ts'

// getSalaryFacts reads localStorage and guards on `window`, so stub both for the node test env.
function stubStorage(map) {
  globalThis.window = {}
  globalThis.localStorage = { getItem: (k) => (k in map ? map[k] : null) }
}

test('prefers the careful month-by-month summary over slip averages', () => {
  stubStorage({
    av_salary_summary: JSON.stringify({
      annualGross: 1200000, annualNet: 1000000, annualTDS: 80000,
      fyStartYear: 2025, hraBasis: [{ monthKey: '2025-04', basic: 50000, hra: 20000 }],
    }),
    av_salary_timeline: JSON.stringify([{ grossSalary: 50000, netSalary: 40000 }]),
  })
  const f = getSalaryFacts()
  assert.equal(f.source, 'summary')
  assert.equal(f.annualGross, 1200000)   // summary wins over slip avg×12 (= 600000)
  assert.equal(f.annualNet, 1000000)
  assert.equal(f.annualTDS, 80000)
  assert.equal(f.fyStartYear, 2025)
  assert.equal(f.hraBasis.length, 1)
})

test('falls back to avg(slip) × 12 when no summary is present', () => {
  stubStorage({
    av_salary_timeline: JSON.stringify([
      { grossSalary: 50000, netSalary: 40000 },
      { grossSalary: 70000, netSalary: 50000 },
    ]),
  })
  const f = getSalaryFacts()
  assert.equal(f.source, 'slip-average')
  assert.equal(f.annualGross, 60000 * 12)  // avg gross 60000 × 12
  assert.equal(f.annualNet, 45000 * 12)    // avg net 45000 × 12
  assert.deepEqual(f.hraBasis, [])
})

test('net falls back to basicSalary when netSalary is missing', () => {
  stubStorage({ av_salary_timeline: JSON.stringify([{ grossSalary: 50000, basicSalary: 30000 }]) })
  assert.equal(getSalaryFacts().annualNet, 30000 * 12)
})

test('a summary with annualGross 0 is treated as absent (Salary page never writes one)', () => {
  stubStorage({
    av_salary_summary: JSON.stringify({ annualGross: 0, hraBasis: [{ monthKey: 'x', basic: 1, hra: 1 }] }),
    av_salary_timeline: JSON.stringify([{ grossSalary: 10000 }]),
  })
  const f = getSalaryFacts()
  assert.equal(f.source, 'slip-average')
  assert.equal(f.annualGross, 120000)
})

test('handles the {employments:[{slips}]} timeline shape', () => {
  stubStorage({
    av_salary_timeline: JSON.stringify({ employments: [{ slips: [{ grossSalary: 80000, netSalary: 60000 }] }] }),
  })
  const f = getSalaryFacts()
  assert.equal(f.source, 'slip-average')
  assert.equal(f.annualGross, 80000 * 12)
})

test('returns empty facts when there is no salary data at all', () => {
  stubStorage({})
  const f = getSalaryFacts()
  assert.equal(f.source, 'none')
  assert.equal(f.annualGross, 0)
  assert.deepEqual(f.hraBasis, [])
})
