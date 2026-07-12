import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fyFromYearMonth, fyFromSlipMonth, resolveFY, planAheadAvailable, fyOptions,
  anchorFYFromSlips, PLAN_AHEAD_CONVERGED_HINT,
} from './fy.ts'
import { LATEST_ENACTED_FY, fyLabel } from './tax-slabs.ts'

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

// ── resolveFY: two modes + the LATEST_ENACTED_FY cap ─────────────────────────

test('resolveFY current-year returns the slip FY', () => {
  assert.equal(resolveFY(2025, 'current'), 2025)
  assert.equal(resolveFY(2026, 'current'), 2026)
})

test('resolveFY plan-ahead is the next FY, capped at LATEST_ENACTED_FY', () => {
  assert.equal(resolveFY(2025, 'plan_ahead'), 2026, 'Mar-26 slip → plan FY 2026-27')
  // Anchor already at the latest enacted FY: plan-ahead must NOT run past it (no assumed continuation).
  assert.equal(resolveFY(LATEST_ENACTED_FY, 'plan_ahead'), LATEST_ENACTED_FY)
  assert.equal(resolveFY(2026, 'plan_ahead'), 2026)
})

// ── April convergence: both modes collapse → disable plan-ahead ──────────────

test('April convergence: an Apr-2026 slip has plan-ahead disabled', () => {
  const anchor = fyFromYearMonth(2026, 4) // 2026 = LATEST_ENACTED_FY
  assert.equal(planAheadAvailable(anchor), false)
  const opts = fyOptions(anchor)
  const current = opts.find(o => o.mode === 'current')
  const plan = opts.find(o => o.mode === 'plan_ahead')
  assert.equal(current.fy, 2026)
  assert.equal(current.label, `This slip's year — ${fyLabel(2026)}`)
  assert.equal(current.disabled, false)
  assert.equal(plan.disabled, true)
  assert.equal(plan.hint, PLAN_AHEAD_CONVERGED_HINT)
})

test('a Mar-2026 slip offers both distinct years', () => {
  const anchor = fyFromYearMonth(2026, 3) // 2025
  assert.equal(planAheadAvailable(anchor), true)
  const opts = fyOptions(anchor)
  assert.equal(opts.find(o => o.mode === 'current').fy, 2025)
  assert.equal(opts.find(o => o.mode === 'plan_ahead').fy, 2026)
  assert.equal(opts.find(o => o.mode === 'plan_ahead').disabled, false)
  assert.equal(opts.find(o => o.mode === 'current').label, `This slip's year — ${fyLabel(2025)}`)
  assert.equal(opts.find(o => o.mode === 'plan_ahead').label, `Plan ahead — ${fyLabel(2026)}`)
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
