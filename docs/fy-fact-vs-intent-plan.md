# FY as fact vs intent — redesign plan

**Status:** proposal. Trigger: an April-2026 slip upload surfaced that the FY control conflates two
different things and mislabels at least one of them. Raised by Kartik, 2026-07-15.

## The problem in one example

Upload a slip named **Apr 26**. By the app's own rule (`fyFromYearMonth`: April → new FY), an
April-2026 slip is **FY 2026-27**. Yet the FY control offered:

- **"This slip's year — FY 2025-26"** (selected)
- **"Plan ahead — FY 2026-27"** (disabled — "Available once next year's rules are finalised")

Two things are wrong, and they have different depths.

### (a) The label asserts a fact it doesn't have — FIXED in this change

At that moment **no slip was parsed** (the file was only selected). So the anchor was the
today's-date fallback (`fyFromSlipMonth(now)`), not the slip — and `resolveFY` then **clamped** it
down to `LATEST_GENUINE_FY` (FY 2025-26) because FY 2026-27's rules aren't genuinely enacted yet.
The control labelled that clamped fallback **"This slip's year"** — a claim about a slip it had never
read.

**Fix (shipped here):** `fyOptions(anchorFY, hasSlip)` only says *"This slip's year"* when the anchor
actually came from a parsed slip; otherwise *"This year"*. `resolveSelectedFY` computes `hasSlip` from
whether `av_salary_summary.fyStartYear` was present. Covered by `fy.test.mjs`.

### (b) A parsed slip whose true FY is clamped — DEFERRED (needs a decision)

Even after the April-26 slip parses (`fyStartYear = 2026`, anchor = FY 2026-27), `resolveFY` clamps
the computed year to FY 2025-26. So the label would read **"This slip's year — FY 2025-26"** for a
slip that genuinely belongs to **FY 2026-27**. There is no honest copy swap for this:

- Labeling it *FY 2026-27* implies we compute on FY 2026-27 rules — we don't (they're a copy).
- Labeling it *FY 2025-26* misstates which year the slip is from.

This is a **design decision, not a wording fix** — do NOT quick-patch (per the handoff's FY rule).
Options in "Open decisions" below.

## The conceptual split

The single "FY" control conflates a fact and an intent:

| Concept | Nature | Correct treatment |
| --- | --- | --- |
| Which FY a slip belongs to | **Fact** — derived from the slip's date | *Show* it, computed on parse. Never a picker. |
| File this year vs plan ahead | **Intent / preference** | A user choice, captured once — on the preferences/intent step, not on upload. |

A slip's FY should never be a question we ask. The only legitimate choice is intent, and intent has a
natural home in the flow — not the chrome, and not the raw upload page.

## Current architecture (as-is)

- **Anchor source:** `resolveSelectedFY(summaryRaw, modeRaw, now)` in `src/lib/useSelectedFY.ts`.
  Anchor = `av_salary_summary.fyStartYear` if present, else `fyFromSlipMonth(now)` (today's FY).
- **Resolution + gate:** `resolveFY(anchor, mode)` in `src/lib/fy.ts`. `current` = anchor;
  `plan_ahead` = `min(anchor+1, LATEST_ENACTED_FY)`; both clamped to `LATEST_GENUINE_FY`.
- **Options / labels:** `fyOptions(anchor, hasSlip)` — the one place label copy lives.
- **Intent persistence:** `setSelectedFYMode(mode)` writes `av_selected_fy_mode` and fires
  `av-fy-changed`; every `useSelectedFY` consumer re-reads.
- **Where it renders now:** the optimizer inline picker (`tax/optimizer/page.tsx`) is the only place
  a user can set intent. **The top-bar FY control has been removed** (this change) — it was chrome
  decoration over the mislabel, and today its only non-disabled option is the already-selected one.

## Proposed design (to-be)

1. **Derive + show the slip FY as a fact.** After parse, present the anchor FY read-only where the
   user is looking at their slips (Documents / Salary), e.g. *"From your April slip: FY 2026-27."* No
   picker.
2. **Capture intent on the preferences/intent step.** Move current-vs-plan-ahead to the salary
   intent step (the wizard already gathers intent-shaped input). Confirm exact location in
   implementation — today intent lives only in the optimizer, which is late.
3. **Resolve = anchor (fact) + intent (preference).** Unchanged mechanics; just sourced correctly.
4. **Chrome shows nothing pickable.** FY surfaces where it's computed (optimizer / computation),
   labelled honestly.

## Open decisions (owed to Kartik)

1. **Clamped-slip label (problem b).** For a slip whose true FY isn't genuinely enacted yet, do we:
   (i) show the slip's true year + a rule-basis note ("computed on FY 2025-26 rules"), or
   (ii) block plan-ahead-style until real rules land and say so? Ties into the existing FY-gate work
   (`docs/fy26-27-verification.md`).
2. **Where intent lives.** Confirm the preferences/intent step as the home; decide whether the
   optimizer picker stays as a secondary control or becomes read-only.

## Done in this change vs deferred

- **Done:** removed the top-bar FY control; made the current-year label honest for the no-parsed-slip
  case (`fy.ts` + `useSelectedFY.ts` + tests).
- **Deferred (this doc):** the fact-vs-intent move, the clamped-slip label decision, and the
  read-only fact display on Documents/Salary.
