# ArthVo — session 4 handoff

## State
- Branch `ui-locked-changes`, last commit **`a361a7f`**.
- All page visits (Documents, Salary, Other earnings, Allowances, Deductions, Your Tax) + the mobile shell (top bar, 4-tab bottom bar, family segments) + dark mode **D1–D1.5** + the theming rules are **banked & pushed**.
- Dark-mode commits: `1843908` (D1+D1.1 — token indirection, system default, three-way control, on-teal pair), `c9a7506` (D1.3 surface audit + D1.5 input contrast), `a361a7f` (theming rules + status). Working tree clean; nothing dangling.

## ⚠️ Owed first — dark-mode gate walk
The code is **banked** but not yet **eyes-validated** in dark mode. This is the validate-after-bank step (banked-safe: anything wrong is one revert away, nothing rides unreviewed). Do this before any new work.

**Setup**
1. `npm run dev`, open the dashboard, switch **Appearance → Dark** (sidebar footer on desktop / account-menu dropdown on mobile). Confirm the choice persists across reload (`av_theme`) and that **System** tracks the OS setting live.
2. Seed data so every page renders its *computed* state, not just empty states:
   - `av_salary_timeline` — upload one slip (or seed) so Salary/Allowances/Deductions/Your Tax compute.
   - AIS banner seed (Other earnings): paste in console, then reload `/dashboard/profile/other-income`:
     ```js
     localStorage.setItem('as_ais', JSON.stringify({ totalInterestIncome: 42000, dividendIncome: 8500, totalCapitalGains: 120000, capitalGains: [ { gain: 90000, assetType: 'equity', gainType: 'LTCG' }, { gain: 30000, assetType: 'debt', gainType: 'STCG' } ] }))
     ```

**Strict six-gate order** (walk in this sequence; on each, eyeball every surface in dark):
1. **Documents** — cards, upload zones, backup/restore tab (both auto-on and manual-mode states), dialogs (confirm + password).
2. **Salary** — wizard (intent cards, confirm-periods rows, forecast toggles), the timeline grid + its cells, preview modal, manual-entry editor, summary bands.
3. **Other earnings** — AIS banner, type-picker, the form modal. **INPUT RETEST (D1.5):** type into every number field — values must render **light** (`#ECE6D9`), not dark-on-dark. Check caret + the asset `<select>` dropdown popup are dark-themed.
4. **Allowances (exemptions)** — accordion panels, HRA computed boxes, the amber/green/tint info boxes, the rent ₹-box input, the total band.
5. **Deductions** — every 80C/80D/… ₹-box input (**INPUT RETEST**: typed values light, caret dark-themed), the green/amber/tint boxes, the 80G donation rows (select + amount input), the summary band.
6. **Your Tax (optimizer)** — verdict hero, senior toggles, the side-by-side slab cards, the "Recommended" badges (on-teal label dark-on-light-teal), save-more cards.

**Per-gate checks:** no white cards/panels/inputs; typed input text light; semantic boxes tokenized (no light-mode hexes); on-teal labels legible. **Expected light patches (NOT bugs):** danger-red, the pink deduction panels, and the inferred-blue timeline cells/legend — see token-family debt below. Also re-walk **light mode** once to confirm it's pixel-unchanged.

## Locked principles (do not relitigate)
- **Positioning:** clarity-not-advice, no fabricated numbers, "free" retired.
- **Voice:** plain-English headers, statute codes demoted to faint footnotes, sentence case, destination-first nav buttons, no emoji anywhere in product.
- **Palette:** wheat/teal canon; tokens only, no raw hex in components; the dark palette + on-teal pair per `docs/theming.md` "Dark-mode surface rules".
- **Marigold** = empty/pending values + reveal-flash ONLY, never decoration.
- **Landing stays light** (dark treatment queued, mockup-first, preserve the wheat→CTA arc).
- **Workflow discipline:** read → curate → mock → build → diff+build → EYES (gate walk) → ONE commit. **GATES BEFORE BANK** (broken twice this session, both recovered — rule stands). Product-behavior changes logged for Kartik, never ridden into polish commits.
- **Curate, not just design:** evaluate before building, push back on the easy version, surface scope conflicts rather than expanding silently.

## Way ahead (priority order)
1. **Phone walk** — the gate walk above on a real device (mobile shell + dark mode together; verify the account-menu Appearance control and native dropdown/caret theming on iOS/Android). **Measurement caveat:** DevTools' responsive frame drifted off the set width repeatedly this session — read `window.innerWidth` on every mobile reading, not the dimension field.
2. **Kartik items** — decisions owed to product:
   - **FY conflict** (engine FY25-26 vs chrome FY26-27 — biggest find; engine work is attached/ready once he picks the year).
   - **Sign-off — timeline glance gross**: the at-a-glance timeline cell now renders compact (`₹12.3L`) instead of the full figure, to fit 4 cells at 320px. Full precision is one tap away (preview modal / employer subtotals / all-months accordion). Reversible (one formatter swap).
   - **Sign-off — annual summary cards**: the gross/net and gross/TDS card rows now **stack** full-width on mobile keeping **full precision** — chose stacking over abbreviation for these headline figures, deliberately different from the timeline glance cell. Reversible.
3. **Daylight design** (the queued dark-mode maturation): palette tuning round → token-family trios (danger / pink / inferred-blue) → **landing dark mockup-first** (must preserve the wheat→CTA arc, not a flat invert).
4. **Small leftovers** — the deferred polish items surfaced this session (e.g. tint-box borders mapped to `T.hairline` pending a dedicated `--tint-border`; any copy stragglers). **Dual compact-money formatters** now coexist — `formatINR` (tax-engine.ts; L/Cr) and `fmtGlance` (salary/page.tsx; K/L/Cr) — divergent notation for the same money; consolidate in a shared format pass (same shelf as `--tint-border`).
5. **Carry-overs** — open items from prior sessions not yet closed (privacy findings, auth/cloud-sync follow-ups, BUG-8 persistence — see the respective `docs/` notes).

## D1.6 (owed) — Dialog/Toaster theme scope
`DialogHost` + `Toaster` are portaled from the ROOT layout (`app/layout.tsx`), outside the `[data-theme="dark"]` subtree (set on the dashboard flex root). Result: confirm dialogs, password dialogs, and toasts render in LIGHT mode even when the app is dark. Page-inline modals (salary preview, other-income form) are fine — they're inside `<main>` within the themed subtree. Latent: Dialog password input (line 112) sets `background: C.bg` but no `color` — moot while the dialog is light, would bite once dark-scoped.

Fix has a tradeoff, decide deliberately (do NOT quick-patch):
- Wrap `DialogHost`/`Toaster` in their own `data-theme` consumer → duplicates theme-resolution logic (localStorage + matchMedia), risks drift.
- Move `data-theme` to `<html>`/root with theme state lifted → cleanest, themes everything once, BUT pulls the landing into dark scope, which violates the locked "landing stays light" principle UNLESS the landing wrapper is explicitly pinned `data-theme="light"`.
- Likely best solved TOGETHER with the landing-dark work (one root-level theme-scope decision). Logged, not fixed.

## Overscroll / scroll-background white in dark mode (owed — same root-scope cause as D1.6)
Confirmed in dark mode: scrolling/overscrolling past content reveals WHITE behind the dark app. Cause: `--surface` (body/root background) is not overridden in the `[data-theme="dark"]` block, AND `data-theme` sits on the dashboard div, not `<html>`/root — so the root-level scroll/overscroll area can't inherit dark regardless. This is the SAME architectural root cause as D1.6 (portaled dialogs + toasts escape the theme scope because the scope is below root).

[Confirm location: is the white BELOW content (pure body case) or in SIDE GUTTERS at narrow widths (may overlap the salary horizontal-scroll finding)?]

Likely solved TOGETHER with D1.6 + landing-dark as one root-level theme-scope decision: lift `data-theme` to `<html>`/root, pin the landing wrapper `data-theme="light"`, override `--surface` in the dark block. One fix closes dialogs, toasts, and overscroll-white.

## Salary timeline — horizontal scroll at narrow widths (RESOLVED)
RESOLVED by `9df8967` (timeline cells: `minmax(0,1fr)` + cell `min-width:0` + compact glance gross), `54cb81a` (shell: `dash-main`/tab-bar `min-width:0`), and `7913df5` (annual card rows stacked). See the **"Mobile overflow sweep (320px)"** bullet under Key findings for the per-element breakdown. **Lesson (one line):** the reported symptom was "timeline scrolls sideways," but the real cause was full-₹ figures overflowing in four places (timeline grid + two card rows) amplified by the shell flex layout — diagnosis had to scope *wider* than the reported element. **Resolved:** the ~49px "369 residual" turned out to be a measurement artifact, not a layout bug — see Key-findings item (d).

## Key findings logged
- **FY conflict** — the tax engine + slab lib assume **FY 2025-26** (and the optimizer copy says so), but the TopBar chrome advertises **FY 2026-27**. Biggest find of the session; it's a **Kartik decision** (which year is live), and it's a logic+copy change (engine work attached), not cosmetic — parked deliberately.
- **Dormant AppStore slices** — `as_salary` / `as_other_income` are written by the AppStore context but **not** read by the page flow (which uses `av_salary_timeline` / `av_other_income`). Effectively dead for the current flow; flagged so no one trusts them as the source of truth.
- **Three token-family debts** — `danger #B94040`, the pink `#FBF0F0` danger-fill (salary deduction panels), and the inferred-blue source-state trio (`#CFE0F0` / `#1F4E7A` / `#7AA8D1`, salary timeline cells/legend). Intentionally un-flipped — they render as **light patches in dark mode by design** until the `tokens.ts` pass formalizes their dark trios (see `docs/theming.md` rule 5).
- **Mobile overflow sweep (320px)** — narrow-width horizontal scroll chased and fixed in order: (a) `dash-main` flex blowout (grew to content min-content) → `min-width: 0` — fixed `54cb81a`; (b) bottom tab-bar's four tabs summed ~370px > 320 → fluid tabs (`flex: 1 + min-width: 0`), full labels survive 320 (incl. "Tax breaks"/"Documents") — fixed `54cb81a`; (c) salary annual gross/net + gross/TDS `1fr 1fr` card rows (two 7-digit ₹ side-by-side) → stacked full-width on mobile via `.sal-annual` — fixed `7913df5`. (Salary timeline grid itself contained earlier — `9df8967`.) **(d) RESOLVED — ARTIFACT:** the ~49px overflow at 369px did **not** reproduce at any deterministic, artifact-free width. Verified clean via CDP (width set *before* load): shell (`dash-main`/`dash-tabbar`) @369; single-employer review @369; and the **forecast scenarios grid** (`2fr 1fr 1fr`) @320 **and** @369 — all contained (`scrollWidth === clientWidth`, nothing past the viewport). The forecast grid wraps ₹ figures *within* cells rather than flooring tracks, so it is **not** the annual-card class — no stack rule needed. Conclusion: the original reading was a **DevTools frame-drift artifact** (the same instrument that drifted repeatedly this session); a ~50px phantom also surfaced in the CDP harness from a fixed-vs-visual-viewport quirk (`position:fixed` tabbar measured against a stale `innerWidth=370`), confirming the artifact class. Salary **in-flow content is contained at 320 and 369**. Only residual: fixed-position states (modal/toast) can't be measured by the harness — but those belong to the logged **data-theme / D1.6** bundle, not salary content.
