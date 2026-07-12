import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSelectedFY } from './useSelectedFY.ts'
import { FY_NOT_ENACTED_HINT } from './fy.ts'

// Stale/stored-value clamp: a stored av_selected_fy_mode='plan_ahead' (which would target the copied
// FY 2026-27) must resolve to FY 2025-26 — never surface next-year output — with the plan option
// disabled + hint, and no error. Two layers: the resolveFY clamp + the fyOptions gate, exercised here
// through the exact resolveSelectedFY path the app runs.
const NOW = new Date(2026, 6, 1) // Jul 2026

test('stored plan_ahead on a 2025 anchor clamps to FY 2025-26, plan option disabled', () => {
  const sel = resolveSelectedFY(JSON.stringify({ fyStartYear: 2025 }), 'plan_ahead', NOW)
  assert.equal(sel.fy, 2025)
  assert.equal(sel.label, 'FY 2025-26')
  const plan = sel.options.find(o => o.mode === 'plan_ahead')
  assert.equal(plan.disabled, true)
  assert.equal(plan.hint, FY_NOT_ENACTED_HINT)
})

test('stored plan_ahead on a 2026 anchor still clamps to FY 2025-26 (no next-year output)', () => {
  const sel = resolveSelectedFY(JSON.stringify({ fyStartYear: 2026 }), 'plan_ahead', NOW)
  assert.equal(sel.fy, 2025)
  assert.notEqual(sel.fy, 2026)
  assert.equal(sel.label, 'FY 2025-26')
})

test('no summary → anchors to today’s FY, still clamped to the genuine FY', () => {
  const sel = resolveSelectedFY(null, 'plan_ahead', NOW) // Jul 2026 → anchor 2026 → clamp 2025
  assert.equal(sel.fy, 2025)
})
