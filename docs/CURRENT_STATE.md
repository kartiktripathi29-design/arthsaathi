# ArthVo — current state

<!-- Tip/status lines. Refresh these each state check. -->

- **Tip (origin/main):** `9f84b52` — 2026-07-12 — Merge PR #33 (derived FY resolution)
- **Repo location:** `C:\dev\arthsaathi` — **moved out of OneDrive** this session (OneDrive broke Next's file-watcher → stale hot-reload). Start sessions from here.
- **Deploy:** production `arthsaathi-app` → **arthvo.com** (Vercel, auto-deploys `main`). All work below is live-verified.
- **Landing hero:** animated `HeroJourney` (photo-hero PR #27 was reverted; `public/hero/hero.jpg` absent).

## Shipped this session

### Upload flow — PR #28
Uploading a slip + **Proceed** was jumping straight to "Your Tax" (a leftover from the prototype re-wire `385bed1`). Pointed Proceed back at the Salary page so the guided flow runs: **Documents → Salary → Other earnings → Allowances → Deductions → Your Tax.**

### Privacy guards (Phase-2 API gating) — PRs #29, #30, #31, #32
UI-hidden ≠ API-off. Introduced one flag `PHASE_2_ENABLED` (`src/lib/phase.ts`; no env var) and, on the server, **404** (not 403) before any parse/DB/auth:
- `parse-bank-statement` (+ belt-and-braces guard in `persistStatement`), `parse-cas/token`, `parse-cas/save`.
- Migrated the Invest/DNA/Decide client redirects to read the same flag (#31).
- Audited the data-handling assurance → **`PRIVACY-GUARD.md`** (#30, doc updated #32).
- **Vercel:** set `NEXT_PUBLIC_CLOUD_SYNC=0` explicitly in production + redeployed (`/api/user-data` inert; verified 404 live).

### Derived FY resolution — PR #33 (closes the session-4 FY conflict)
FY is now **derived from the slip** (Apr–Mar boundary), never hardcoded.
- **`tax-slabs.ts`** year-parameterized (`TAX_RULES` + `LATEST_ENACTED_FY`). FY2026-27 confirmed **identical** to FY2025-26 (Budget 2026 changed no slabs; FY2025-26 validated against the ITD portal).
- **`fy.ts`** resolver: `fyFromSlipMonth`, `resolveFY` (plan-ahead capped at latest enacted, convergence-disabled), `fyOptions`, `anchorFYFromSlips`.
- **Retired `tax-engine.ts`** (stale FY2024-25) → migrated `/api/tax-calc` + `dashboard/profile`. Live-verified the corrected numbers: ₹12.75L gross new-regime **₹83,200 → ₹0**; ₹15.75L **₹1,45,600 → ₹1,09,200**; old regime unchanged.
- **One `selectedFY`** (`useSelectedFY` hook): killed the chrome hardcode, current/plan-ahead picker on the optimizer, FY/AY labels threaded into the computation statement.
- **Mixed-FY gate:** compute on the most-months FY + a visible flag banner (not full slicing).
- **Past-years:** `tax-history.ts` kept self-contained; a cross-check test locks its FY2025-26 agreement with the consolidated engine.
- Tests: `node:test` suite **34 → 75**, green; `tsc --noEmit` clean; Vercel prod build green.

## Open items
- **Old OneDrive folder** (`…\Downloads\arthsaathi_v2`) — a scheduled task (`DeleteArthsaathiOneDrive`) deletes it automatically once the Claude session holding its lock closes.
- **PRIVACY-GUARD.md follow-ups:** disclosure wording for "never seen by a human" (Anthropic transmission); Phase-2 re-enable checklist.

## Recent commits
```
9f84b52 Merge PR #33 — derived FY resolution
69292ca Merge PR #32 — mark client-guard follow-up done
8157cc0 Merge PR #31 — gate client redirects on PHASE_2_ENABLED
0dc0858 Merge PR #30 — PRIVACY-GUARD.md
5b8c222 Merge PR #29 — server-side Phase-2 API gate
0bd9210 Merge PR #28 — post-upload Proceed → step-by-step flow
```
