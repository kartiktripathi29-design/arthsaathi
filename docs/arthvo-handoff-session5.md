# ArthVo — session 5 handoff

## State
- Branch `ui-locked-changes`, last commit **`cd6e182`**. Working tree clean (only an untracked `package-lock.json` from a local `npm install` done to run builds — not committed, not part of any change).
- This session was a **dark-mode rollout + frame/overflow/wrapping polish** pass, all on top of session-4. Everything below is **banked & pushed**.
- Every change this session was build-verified (`next build` green, 34 routes) and pushed commit-by-commit after review.

## What landed this session (plain English)
- **Mobile overflow fixes (carry-in, now resolved & banked).** The narrow-width (320–390px) horizontal-scroll work from late session-4 — timeline grid contained, mobile shell `min-width:0`, annual summary card rows stacked — plus the doc reconciliation that the leftover "369px residual" was a **measurement artifact**, not a real overflow. (`9df8967`, `54cb81a`, `7913df5`, and the `976ef87`/`1253cc2`/`d7a4f38` doc commits.)
- **Landing dark mode + theme toggle.** The landing page now supports dark mode and got a single icon → System/Light/Dark menu in its nav. The landing is 100% token-driven, so it flips fully once in `[data-theme]` scope. (`5dc3810`.)
- **Theme toggle consolidated into the top bar across all pages.** One shared `ThemeToggle` component (`src/components/ThemeToggle.tsx`) plus a shared `useArthvoTheme` hook (same `av_theme` key as the dashboard) and a `useThemedBase` helper. It's now the single appearance control on landing, sign-in, sign-up, the offer-decoder page, **and** the dashboard — where it **replaced** the old three-pill `AppearanceControl` that lived in the desktop sidebar footer and the mobile account dropdown. Same icon, same place (top-right), every page, desktop + mobile. (`5dc3810`, `2305cc5`, `1fbd2f0`, `0d28a2e`.)
- **Band / nav / footer dark fixes.** The landing had baked literals that don't flip: the sticky nav background (hardcoded light `rgba`) and the final-CTA + footer bands (which used `T.ink` as a "dark" ground — and `T.ink` *inverts* to a light value in dark mode). Made them theme-aware so the nav reads as dark glass and the CTA/footer stay dark grounds in both modes. (`e208ab9` area / the landing fix cluster.)
- **Overscroll / bounce fix.** Killed the white that showed when scrolling/bouncing past content: themed the `html`/`body` base with `--paper`, mirrored `data-theme` + `color-scheme` onto `<html>`. Then **kept the rubber-band bounce** (it signals page end) while keeping the revealed area themed, and made the bounce **two-tone** on the landing so each edge matches the section it borders (paper at the top, the footer's ground at the bottom). The same `useThemedBase` base-paint was applied to the auth pages, the offer page, and **all dashboard pages** (via the dashboard layout). (`ac3d24c`, `e208ab9`, `bec7e5d`, `46651e8`, `07a78a8`.)
- **Frame edge-to-edge fixes.** The dashboard top bar and bottom tab bar weren't reaching the screen edges — caused by the browser-default `body { margin: 8px }` (never reset for the dashboard). Reset it, enabled `viewport-fit=cover`, and made the header pad `env(safe-area-inset-top)` (the tab bar already padded the bottom inset) so the bars bleed to the true edges and sit correctly under the status bar / above the home indicator. Also matched the desktop teal sidebar cap height to the header bar so the top-left reads as one continuous band. (`bf02e25`, `549901d`.)
- **Wrapping-discipline pass.** Established one consistent rule across the app: if text fits it stays on one line; if not, the **secondary part** (parenthetical, qualifier, detail, trailing arrow) breaks to its own line **as a whole unit** — never mid-phrase, never an orphaned word or arrow — using `white-space: nowrap` on the secondary span. Applied to: salary intent cards (heading/question split), the timeline confirm card + its date detail, the forecast info box (re-laid as three scannable labelled lines), allowances subtitle + totals list, deductions parentheticals/sub-lines/labels, the optional qualifiers on Other earnings, the ITR-forms reference (now one form per line, behind an expander), and arrow/multi-word buttons. Also clarified the employer summary line (company+period grouped, gross/net as distinct labelled figures) and re-spaced the auth top bars. (`727dbaf`, `6595e88`, `c474eec`, `ee3a0bb`, `cd6e182`.)
- **Palette reference doc.** Added `docs/palette-reference.md` — every token paired light-hex ↔ dark-hex with role, plus **computed** WCAG contrast ratios for the text-on-ground pairings used in the app, flagging any below 4.5:1 (body) / 3:1 (large). The dark column is explicitly marked **D1 first draft**. (`0a1eb58`.)

## Decisions made this session
- **FY label stays as-is for now.** The FY-switch UI is **deferred to a separate engine PR**. Rule: the engine must be able to compute *each year's* rules before any UI year-filter ships — otherwise a year picker would lie. **Kartik decides scope** (which years, how far back). This is the same FY conflict logged in session-4 (engine assumes FY25-26, chrome shows FY26-27) — still his call, still parked.
- **Logo stays a placeholder.** The real logo swaps in **post-merge as a one-file change** — the `Logo` component is centralized (`src/components/Logo.tsx`), every surface reads from it, so the swap touches one file and updates everywhere. No reason to block the merge on it.
- **Dark palette is still D1 (first draft).** A tuning round is pending; `palette-reference.md` and the source comments both say so. Don't treat the dark hexes as final.

## Owed before / around merge
- **Team feedback round — in progress.** Collect and fold in before merging.
- **The merge itself — runbook ready** (see note below). The branch is `ui-locked-changes` → main.
- **Standing Kartik items** (product decisions owed, carried from session-4):
  1. **FY conflict (#1, biggest)** — which FY is live; engine work attached/ready once he picks the year.
  2. **Privacy page** — see `docs/privacy-findings.md`.
  3. **"Recommended" badge tension** — the recommended-regime badge vs the clarity-not-advice positioning; needs a product call on how strongly to assert a recommendation.

## Merge runbook
The `ui-locked-changes` → `main` merge sequence is written up in **`docs/merge-runbook.md`**: tag `pre-ui-merge` first, update the branch from `origin/main` and resolve conflicts (stop-and-confirm on any tax-logic/salary conflict), push, review **PR #6** on GitHub (a human merges — not the CLI), verify the Vercel deploy is green, with rollback options (reset-to-tag + force-push if solo, `git revert -m 1` if others have pulled, plus a Vercel deploy rollback for the live site). Deploy env vars / pre-launch tasks remain in **`docs/deploy-notes.md`**.

## Commits this session (`a361a7f..cd6e182`, newest first)
```
cd6e182 fix(salary,other-income): apply wrap rule to confirm card, optional qualifiers, forecast box
0d28a2e refactor(dashboard): use the shared ThemeToggle icon in the top bar
ee3a0bb fix(salary): clarify employer summary structure + keep period caption clean
1fbd2f0 feat(offer): dark mode + shared theme toggle on the offer-decoder page
c474eec fix(ui): consistent text-wrap (secondary parts break as units) + auth nav re-space
549901d fix(dashboard): match teal sidebar cap height to header bar
bf02e25 fix(dashboard): anchor header/tab bar to screen edges with safe-area insets
6595e88 fix(salary,tax): emphasize timeline amount, list ITR forms one per line
727dbaf fix(salary,tax): wrap timeline detail, rebalance wizard buttons, collapse ITR ref
07a78a8 fix(dashboard): theme html/body base to kill overscroll white on all pages
2305cc5 feat(auth): dark mode + shared theme toggle on login/signup
46651e8 fix(landing): two-tone overscroll matching each edge's section color
bec7e5d fix(landing): theme desktop overscroll via color-scheme on root
e208ab9 fix(landing): restore overscroll bounce, keep themed dark base
ac3d24c fix(landing): theme html/body base + kill overscroll white edges
5dc3810 feat(landing): dark mode support + theme toggle in nav
0a1eb58 docs: add palette reference with computed WCAG contrast
d7a4f38 docs: resolve 369 residual as measurement artifact
1253cc2 docs: reconcile resolved timeline-scroll section
976ef87 docs: log session findings — mobile overflow fixes, 369 residual, Kartik items
7913df5 fix(salary): stack annual summary card rows on mobile
54cb81a fix(dashboard): contain mobile shell at narrow widths
9df8967 fix(salary): contain timeline grid at narrow widths
```
(The four trailing session-4 doc commits — `77fe9e9`, `98f0e99`, `0704dc8`, `96f50c3`, `1520658` — predate this session and are recorded in the session-4 handoff.)

## Notes / still open (not blockers)
- **D1.6 (dialogs/toasts theme scope)** from session-4: `DialogHost` + `Toaster` are portaled from the root layout. This session's `useThemedBase` now mirrors `data-theme`/`color-scheme` onto `<html>` per route, which changes the root-scope picture — re-check whether dialogs/toasts now inherit dark, and fold any remaining fix into the landing-dark/root-scope bundle rather than quick-patching.
- **Landing "stays light" principle (session-4) is now superseded** — the landing ships dark-capable this session with the shared toggle. Flag for Kartik if that reverses any earlier sign-off.
- The dark palette tuning round, token-family trios (danger / pink / inferred-blue), and the shared money-formatter consolidation remain on the shelf (see session-4 "Way ahead").
