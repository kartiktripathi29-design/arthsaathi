import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReturn, fyFromAY } from './itr-parse.ts'

// `parsed` here is what the model extracts from an uploaded document — for a filed ITR JSON it's the
// rich, schedule-level shape (gross salary present), which unlocks the full regime comparison. These
// tests drive normalizeReturn directly, so they cover the upload OUTCOME without the model call.

// A realistic full ITR-1 JSON extraction (mirrors a real return: salaried + home-loan loss, filed old).
const FULL_ITR_JSON = {
  documentType: 'itr_json',
  assessmentYear: 'AY 2025-26',
  itrForm: 'ITR-1',
  filedRegime: 'new',            // model misread the A20 checkbox — should be corrected to 'old'
  isSalaried: true,
  grossSalary: 2509943,
  exemptAllowances: 531713,
  otherSlabIncome: -165622,      // house-property loss set off against salary
  chapterVIA: 156484,
  reportedGrossTotalIncome: 1762608,
  reportedTotalIncome: 1606120,
  reportedTotalTax: 306109,
  reportedRefundOrPayable: -139170,
  missing: [],
}

test('full ITR JSON upload → full comparison, regime inferred from reported tax', () => {
  const r = normalizeReturn(FULL_ITR_JSON, 'normal')
  assert.equal(r.fy, 'FY 2024-25')
  assert.equal(r.documentType, 'itr_json')
  assert.equal(r.canComputeSavings, true)        // gross salary present → exact comparison
  // Model said 'new', but old reproduces the reported tax → inference corrects it.
  assert.equal(r.filedRegime, 'old')
  assert.equal(r.regimeSource, 'reported_tax')
  assert.ok(r.savings)
  assert.equal(r.savings.cheaperRegime, 'old')
  assert.equal(r.savings.filedOptimalRegime, true)   // filed the cheaper one
  assert.equal(r.savings.regimeSwitchSaving, 0)
  // Recomputed filed tax reconciles to the return within a rupee or two.
  assert.ok(Math.abs(r.savings.asFiled.totalTax - 306109) <= 5, 'recompute reconciles to reported tax')
})

test('full ITR JSON, filed old and read correctly, where switching to new would save', () => {
  const r = normalizeReturn({
    documentType: 'itr_json', assessmentYear: 'AY 2025-26', itrForm: 'ITR-1',
    filedRegime: 'old', isSalaried: true,
    grossSalary: 1200000, chapterVIA: 150000, reportedTotalTax: 117000, missing: [],
  }, 'normal')
  assert.equal(r.canComputeSavings, true)
  assert.equal(r.filedRegime, 'old')
  assert.equal(r.regimeSource, 'reported_tax')   // old recompute matches reported 117000
  assert.equal(r.savings.cheaperRegime, 'new')
  assert.equal(r.savings.regimeSwitchSaving, 45500)
})

test('model number fields delivered as strings are coerced', () => {
  const r = normalizeReturn({
    documentType: 'itr_json', assessmentYear: 'AY 2025-26', filedRegime: 'old',
    grossSalary: '1200000', chapterVIA: '150000', reportedTotalTax: '117000', missing: [],
  }, 'normal')
  assert.equal(r.components.grossSalary, 1200000)
  assert.equal(r.canComputeSavings, true)
  assert.equal(r.savings.regimeSwitchSaving, 45500)
})

test('no reported tax → keep the document-stated regime (no inference)', () => {
  const r = normalizeReturn({
    documentType: 'itr_json', assessmentYear: 'AY 2025-26', filedRegime: 'old',
    grossSalary: 1200000, chapterVIA: 150000, missing: [],   // no reportedTotalTax
  }, 'normal')
  assert.equal(r.filedRegime, 'old')
  assert.equal(r.regimeSource, 'document')
})

test('totals-only ITR-V (gross salary missing) → no savings, gated honestly', () => {
  const r = normalizeReturn({
    documentType: 'itr_v_acknowledgement', assessmentYear: 'AY 2024-25', filedRegime: 'new',
    grossSalary: 0, reportedTotalIncome: 925000, reportedTotalTax: 49500,
    missing: ['grossSalary', 'exemptAllowances'],
  }, 'normal')
  assert.equal(r.fy, 'FY 2023-24')
  assert.equal(r.canComputeSavings, false)
  assert.equal(r.savings, null)
  assert.equal(r.regimeSource, 'document')   // never inferred when we can't compute
})

test('unreadable assessment year → empty fy, unsupported, no savings', () => {
  const r = normalizeReturn({ documentType: 'full_itr', assessmentYear: 'unknown', grossSalary: 1200000 }, 'normal')
  assert.equal(r.ay, '')
  assert.equal(r.fy, '')
  assert.equal(r.fySupported, false)
  assert.equal(r.canComputeSavings, false)
})

test('fyFromAY maps AY→FY and rejects junk', () => {
  assert.equal(fyFromAY('AY 2025-26'), 'FY 2024-25')
  assert.equal(fyFromAY('AY 2021-22'), 'FY 2020-21')
  assert.equal(fyFromAY('unknown'), '')
  assert.equal(fyFromAY(''), '')
})
