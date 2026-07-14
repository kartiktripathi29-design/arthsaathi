// Financial-year resolution — the single place that decides which FY a salary slip anchors to and
// which FY a given mode (current year vs plan ahead) resolves to. Pure; no React, no I/O.
//
// DECISION (session-4 FY conflict, closed here): FY is DERIVED, never hardcoded. A slip anchors to
// the FY of its month on the Apr–Mar boundary — Mar-2026 → FY 2025-26, Apr-2026 → FY 2026-27.
// Plan-ahead is the next FY, but NEVER beyond the latest enacted budget (LATEST_ENACTED_FY) — no
// assumed-continuation fallback. When both modes land on the same FY, plan-ahead is disabled.

// Explicit .ts extension: this is a runtime import (LATEST_ENACTED_FY/fyLabel are values), and the
// pure engine is exercised under `node --test`, whose ESM resolver needs the extension.
// tsconfig has allowImportingTsExtensions + moduleResolution:bundler, so the build accepts it too.
import { type FY, LATEST_ENACTED_FY, LATEST_GENUINE_FY, fyLabel } from './tax-slabs.ts'

export type FYMode = 'current' | 'plan_ahead'

/** The FY (start year) that a slip dated year/monthNum belongs to. monthNum is 1-12. */
export function fyFromYearMonth(year: number, monthNum: number): FY {
  return monthNum >= 4 ? year : year - 1
}

/** The FY a slip's date belongs to. Apr–Mar boundary: Mar-31 → prior FY, Apr-1 → new FY. */
export function fyFromSlipMonth(date: Date): FY {
  return fyFromYearMonth(date.getFullYear(), date.getMonth() + 1)
}

// Shown when plan-ahead collapses onto the current year (e.g. an Apr-slip already sits in the newest
// enacted FY, so there is no further year to plan for).
export const PLAN_AHEAD_CONVERGED_HINT = "You're already in the year you'd be planning for."

// Shown on a plan-ahead option whose target FY exists in the rule table but is a COPY of the prior
// year (not independently enacted) — visible but disabled until real rules land.
export const FY_NOT_ENACTED_HINT = "Available once next year's rules are finalised."

/**
 * Resolve the FY to compute on, from the slip's anchor FY and the chosen mode.
 *   current    → the slip's own FY
 *   plan_ahead → min(anchorFY + 1, LATEST_ENACTED_FY)  — the next FY, capped at the newest table entry
 * …then GATED: the result is clamped to LATEST_GENUINE_FY so a copied / not-signed-off rule set never
 * surfaces (see below).
 */
export function resolveFY(anchorFY: FY, mode: FYMode): FY {
  const derived = mode === 'current' ? anchorFY : Math.min(anchorFY + 1, LATEST_ENACTED_FY)
  // GATE (layer 2 — logic clamp): never resolve beyond the latest GENUINELY enacted FY. FY 2026-27
  // mirrors FY 2025-26 today, so it must never surface as real output — even if a stale
  // av_selected_fy_mode or a URL param asks for it. Auto-lifts when real FY 2026-27 rules are
  // encoded (LATEST_GENUINE_FY then advances). See docs/fy26-27-verification.md.
  return Math.min(derived, LATEST_GENUINE_FY)
}

/** Plan-ahead is offered only when it resolves to a DIFFERENT FY than current-year. */
export function planAheadAvailable(anchorFY: FY): boolean {
  return resolveFY(anchorFY, 'plan_ahead') !== resolveFY(anchorFY, 'current')
}

export interface FYOption {
  mode: FYMode
  fy: FY
  label: string
  disabled: boolean
  hint?: string
}

export interface SlipFYSpan {
  anchorFY: FY
  monthsByFY: Map<FY, number>
  excluded: { year: number; monthNum: number }[]
  spansMultiple: boolean
}

/**
 * Mixed-FY gate. Group slips by their FY, and anchor to the FY with the MOST slip-months (ties → the
 * later FY). When slips span more than one FY we compute on the anchor's rules ONLY and flag the
 * excluded months — never blend two years' rule sets into one number. Callers guard the empty case.
 */
export function anchorFYFromSlips(slips: { year: number; monthNum: number }[]): SlipFYSpan {
  const monthsByFY = new Map<FY, number>()
  for (const s of slips) {
    const fy = fyFromYearMonth(s.year, s.monthNum)
    monthsByFY.set(fy, (monthsByFY.get(fy) ?? 0) + 1)
  }
  let anchorFY: FY = NaN
  let best = -1
  for (const [fy, count] of monthsByFY) {
    if (count > best || (count === best && fy > anchorFY)) { best = count; anchorFY = fy }
  }
  const excluded = slips.filter(s => fyFromYearMonth(s.year, s.monthNum) !== anchorFY)
  return { anchorFY, monthsByFY, excluded, spansMultiple: monthsByFY.size > 1 }
}

/**
 * The two mode options for a slip's anchor FY, with their resolved FY, display label and disabled
 * state — the ONE source screens read so nothing hardcodes an FY label. Label copy lives here.
 *
 * `hasSlip` gates the honesty of the current-year label: only claim "This slip's year" when the
 * anchor actually came from a parsed slip. With no slip the anchor is a today's-date fallback, so the
 * label reads "This year" — it must not assert a slip fact we don't have. (NOTE: a separate, deeper
 * mislabel remains when a real slip's true FY is clamped by LATEST_GENUINE_FY — see
 * docs/fy-fact-vs-intent-plan.md; that one needs a design decision, not a copy swap.)
 */
export function fyOptions(anchorFY: FY, hasSlip = false): FYOption[] {
  const current = resolveFY(anchorFY, 'current')            // already clamped to LATEST_GENUINE_FY
  const rawPlan = Math.min(anchorFY + 1, LATEST_ENACTED_FY) // the year they'd plan for, pre-gate
  const gated = rawPlan > LATEST_GENUINE_FY                 // exists in the table but isn't genuine (a copy)
  const converged = resolveFY(anchorFY, 'plan_ahead') === current
  return [
    // GATE (layer 1 — UI): current always resolves to a genuine FY; the plan-ahead option is shown but
    // disabled when its target year isn't independently enacted yet.
    { mode: 'current', fy: current, label: `${hasSlip ? "This slip's year" : 'This year'} — ${fyLabel(current)}`, disabled: false },
    {
      mode: 'plan_ahead',
      fy: rawPlan, // label the year they'd plan for even when disabled, so the hint reads correctly
      label: `Plan ahead — ${fyLabel(rawPlan)}`,
      disabled: gated || converged,
      ...(gated ? { hint: FY_NOT_ENACTED_HINT } : converged ? { hint: PLAN_AHEAD_CONVERGED_HINT } : {}),
    },
  ]
}
