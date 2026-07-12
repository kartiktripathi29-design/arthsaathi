import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fyFromYearMonth, fyFromSlipMonth, resolveFY, planAheadAvailable, fyOptions,
  anchorFYFromSlips, FY_NOT_ENACTED_HINT,
} from './fy.ts'
import { LATEST_ENACTED_FY, LATEST_GENUINE_FY, TAX_RULES, fyLabel } from './tax-slabs.ts'

// ── Apr–Mar boundary: a slip anchors to the FY of its month ──────────────────

test('fyFromYearMonth applies the Apr–Mar boundary', () => {
  assert.equal(fyFromYearMonth(2026, 3), 2025, 'Mar-2026 → FY 2025-26')
  assert.equal(fyFromYearMonth(2026, 4), 2026, 'Apr-2026 → FY 2026-27')
  assert.equal(fyFromYearMonth(2026, 1), 2025, 'Jan-2026 → FY 2025-26')
  assert.equal(fyFromYearMonth(2025, 12), 2025, 'Dec-2025 → FY 2025-26')
  assert.equal(fyFromYearMonth(2025, 4), 2025, 'Apr-2025 → FY 2025-26')
})

test('fyFromSlipMonth: Mar-31 vs Apr-1 land on different FYs (the boundary itself)', () => {
  assert.equal(fyFromSlipMonth(new Date(2026, 2, 31)), 2025, 'Mar 31 2026 → FY 2025-26')
  assert.equal(fyFromSlipMonth(new Date(2026, 3, 1)), 2026, 'Apr 1 2026 → FY 2026-27')
})

// ── resolveFY: two modes, then clamped to the latest GENUINELY enacted FY (the gate) ─────────────

test('resolveFY current-year returns the slip FY, clamped to the latest genuine FY', () => {
  assert.equal(resolveFY(2025, 'current'), 2025)
  // A 2026 (FY 2026-27) slip clamps down to 2025 while FY 2026-27 is a copy — never shown as real.
  assert.equal(resolveFY(2026, 'current'), 2025)
})

test('resolveFY plan-ahead is clamped to the latest genuine FY (never a copied year)', () => {
  assert.equal(resolveFY(2025, 'plan_ahead'), 2025, 'Mar-26 slip cannot plan into the copied FY 2026-27')
  assert.equal(resolveFY(2026, 'plan_ahead'), 2025)
})

// ── The FY 2026-27 GATE. These MUST FAIL the moment real FY 2026-27 rules are encoded (so the gate
//    can't be forgotten) — i.e. once FY_2026_27 stops being the same object as FY_2025_26. ──────────

test('GATE canary: FY 2026-27 is a copy of FY 2025-26, so the latest genuine FY is 2025', () => {
  assert.equal(TAX_RULES[2026] === TAX_RULES[2025], true, 'FY26-27 is a copy — the gate applies')
  assert.equal(LATEST_GENUINE_FY, 2025)
  // The newest table entry is still 2026 — the gate keys off genuine-vs-copy, not the table max.
  assert.equal(LATEST_ENACTED_FY, 2026)
})

test('GATE: no anchor/mode resolves to the copied FY 2026-27', () => {
  for (const anchor of [2024, 2025, 2026, 2027, 9999]) {
    for (const mode of ['current', 'plan_ahead']) {
      assert.ok(resolveFY(anchor, mode) <= LATEST_GENUINE_FY, `${mode} @ ${anchor} must not exceed the genuine FY`)
      assert.notEqual(resolveFY(anchor, mode), 2026, `${mode} @ ${anchor} must never resolve to FY 2026-27`)
    }
  }
})

test('GATE: the FY 2026-27 picker option is visible but disabled with the not-finalised hint', () => {
  const anchor = fyFromYearMonth(2026, 3) // Mar-2026 → 2025
  const plan = fyOptions(anchor).find(o => o.mode === 'plan_ahead')
  assert.equal(plan.disabled, true, 'plan-ahead into FY 2026-27 is disabled while it is a copy')
  assert.equal(plan.hint, FY_NOT_ENACTED_HINT)
  assert.equal(plan.label, `Plan ahead — ${fyLabel(2026)}`, 'still shows the year, just disabled')
  assert.equal(planAheadAvailable(anchor), false)
})

test('current-year option always resolves to a genuine, selectable FY', () => {
  const current = fyOptions(fyFromYearMonth(2026, 3)).find(o => o.mode === 'current')
  assert.equal(current.disabled, false)
  assert.equal(current.fy, 2025)
  assert.equal(current.label, `This slip's year — ${fyLabel(2025)}`)
})

// ── Mixed-FY: slips spanning two FYs map to distinct FYs (sliced, never blended) ──

test('mixed-FY slips map to distinct FYs (basis for per-FY slicing)', () => {
  const slips = [
    { year: 2026, month: 2 }, // Feb-2026 → 2025
    { year: 2026, month: 3 }, // Mar-2026 → 2025
    { year: 2026, month: 4 }, // Apr-2026 → 2026
    { year: 2026, month: 5 }, // May-2026 → 2026
  ]
  const byFY = new Map()
  for (const s of slips) {
    const fy = fyFromYearMonth(s.year, s.month)
    byFY.set(fy, (byFY.get(fy) ?? 0) + 1)
  }
  assert.deepEqual([...byFY.entries()].sort(), [[2025, 2], [2026, 2]])
  assert.equal(byFY.size, 2, 'spans two FYs → must be sliced, not collapsed to one rule set')
})

// ── anchorFYFromSlips: the gate (most-months FY + excluded) ──────────────────

test('single-FY upload: anchor is that FY, nothing excluded', () => {
  const r = anchorFYFromSlips([{ year: 2026, month: 4 }, { year: 2026, month: 5 }].map(s => ({ year: s.year, monthNum: s.month })))
  assert.equal(r.anchorFY, 2026)
  assert.equal(r.spansMultiple, false)
  assert.deepEqual(r.excluded, [])
})

test('mixed-FY: anchor = FY with the most months, the rest are excluded', () => {
  const slips = [
    { year: 2026, monthNum: 3 }, // Mar-2026 → FY 2025-26 (1 month)
    { year: 2026, monthNum: 4 }, // Apr-2026 → FY 2026-27
    { year: 2026, monthNum: 5 }, // May-2026 → FY 2026-27
    { year: 2026, monthNum: 6 }, // Jun-2026 → FY 2026-27 (3 months)
  ]
  const r = anchorFYFromSlips(slips)
  assert.equal(r.anchorFY, 2026, 'FY 2026-27 has the most months')
  assert.equal(r.spansMultiple, true)
  assert.deepEqual(r.excluded, [{ year: 2026, monthNum: 3 }], 'the Mar-2026 slip is flagged, not blended')
})

test('mixed-FY tie breaks to the later FY', () => {
  const slips = [
    { year: 2026, monthNum: 2 }, // FY 2025-26
    { year: 2026, monthNum: 3 }, // FY 2025-26  (2)
    { year: 2026, monthNum: 4 }, // FY 2026-27
    { year: 2026, monthNum: 5 }, // FY 2026-27  (2)
  ]
  const r = anchorFYFromSlips(slips)
  assert.equal(r.anchorFY, 2026, 'tie → later FY')
  assert.equal(r.excluded.length, 2)
})
