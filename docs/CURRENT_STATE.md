# ArthVo — current state

<!-- Tip/status lines. Refresh these each state check. -->

> **🔒 LAUNCH FROZEN** — tagged **`v1.0-launch`** (`2f274ea`). Launch target **2026-07-15**. No merges to `main` without the word **EMERGENCY** through **2026-07-16**.

- **Tip (origin/main):** `2f274ea` — 2026-07-13 — Merge PR #53 (health + counters) — **tagged `v1.0-launch`**
- **Repo location:** `C:\dev\arthsaathi` — moved out of OneDrive (OneDrive broke Next's file-watcher). Start sessions from here. *(The 2026-07-13 launch-readiness work was done from a fresh clone; everything is on `origin/main` — `git pull` here to sync.)*
- **Deploy:** production `arthsaathi-app` → **arthvo.com / www.arthvo.com** (Vercel, auto-deploys `main`). Everything below is live-verified.
- **⚠️ Action owed:** set **`HEALTH_TOKEN`** in Vercel prod — `/api/health` is deployed but inert (503 `health_not_configured`) until it's set.
- **DB:** Supabase project **`bsxwxqnighcjayxjikiv`** (the earlier `frmmuizbbhplcrdtaywy` was the wrong project — see #39). Full migration history applied; auto-migrate on prod deploys.
- **Landing hero:** animated `HeroJourney` (photo-hero PR #27 was reverted; `public/hero/hero.jpg` absent).

## What's live (verified on arthvo.com)

- **Email capture** on `/try` (PR #36) — stores email + verdict figures + `capturedAt`; idempotent; rate-limited **40/min/IP** (raised from 5 in #50 to clear office-NAT bursts), with a distinct friendly 429.
- **Unsubscribe** — `GET /unsubscribe?token=` sets `unsubscribed=true`, idempotent confirmation page.
- **Cross-device rehydrate** (PR #42) — `GET /api/email-capture/context?r=<token>` returns **only** `{verdictFY, verdictAmount}` for a non-unsubscribed capture (404 on unknown/short/unsubscribed); `/try?r=` shows a returning-user banner when the device has no local verdict (local wins). Prod round-trip verified end-to-end.
- **Final January email copy** (PR #41) — `docs/EMAIL-JANUARY.md` is the founder-final draft (no email is sent yet; the send itself is a future task).
- **Derived FY resolution** (PR #33) — FY derived from the slip (Apr–Mar), never hardcoded; `tax-slabs.ts` year-parameterized; `fy.ts` + `useSelectedFY`; retired `tax-engine.ts`.
- **Privacy guards** (PRs #29–#32) — Phase-2 gating (below); `PRIVACY-GUARD.md`; `NEXT_PUBLIC_CLOUD_SYNC=0` in prod.
- **Data-assurance line** (PR #43) — single source `DataAssurance.tsx` on hero / `/try` / dashboard upload: "Read automatically by AI — no human ever sees your slip."
- **AI parse routes on Sonnet** — `/api/parse-ais` (PR #45) and `/api/parse-itr` (PR #48) both run `claude-sonnet-4-6`; each verified live with an A/B showing identical extraction. No `claude-opus-4-5` remains in `src`.

## Launch-readiness hardening (PRs #50–#53, 2026-07-13) — the `v1.0-launch` set

- **#50 — capture resilience + invest gate.** Rate limit 5→**40/min/IP** (office-NAT bursts) + distinct friendly 429 copy; **`/api/invest` now Phase-2 gated (404)** — its page redirected but the endpoint was reachable and burned an Anthropic call (UI-gated≠API-gated, same class as #29).
- **#51 — honest parse failures.** `/api/parse-salary` returns **503 "reader briefly overloaded, try again in a minute"** on an Anthropic outage instead of the old 422 that blamed the user's slip. Shared `src/lib/anthropic-error.ts` → `isAnthropicOutage()` (unit-tested); same guard added to optional parse-ais/itr/offer.
- **#52 — no dead spinner.** `src/lib/fetchWithTimeout.ts`: **45s** client abort (route caps at 60s) + a ~10s "Still working — large or slow file…" reassurance + honest timeout copy, on both parse-salary callers.
- **#53 — launch monitoring.** `GET /api/health` (token-guarded via `HEALTH_TOKEN`; `?token=` or `x-health-token`) → DB reachability + **last-hour counters** + most-recent-capture timestamp (no PII). New `AnalyticsEvent` table + `recordEvent()`; counters: `try_visit, verdict_rendered, capture_ok, capture_fail, parse_ok, parse_fail_upstream, parse_fail_input`. The **upstream vs input** parse split is the on-call signal for whether a failure spike is ours or Anthropic's.

## What's gated / disabled (intentional)

- **Phase-2 APIs → 404** while `PHASE_2_ENABLED = false` (`src/lib/phase.ts`, code constant): `parse-bank-statement`, `parse-cas/token`, `parse-cas/save`, and now **`/api/invest`** (#50). Verified 404 live.
- **FY 2026-27 "plan ahead" disabled** (PR #40) — option visible-but-disabled with hint "Available once next year's rules are finalised"; resolver **clamps** to the latest genuinely enacted FY (2025) because `FY_2026_27` is still an identical copy of `FY_2025_26`. Sentinel test auto-fails once real rules are encoded.
- **`/api/user-data`** inert (`NEXT_PUBLIC_CLOUD_SYNC=0`).

## Close-out session — all PRs merged

PRs **#43–#48** are merged: DataAssurance AI copy (#43), dead-file removal (#44), parse-ais→Sonnet (#45), `smoke-prod.mjs` (#46), this doc's prior refresh (#47), parse-itr→Sonnet (#48).

## What remains — tracked in issue #39

1. **FY 2026-27** — CA-verified figures, then encode a real distinct rule set + a `≠ FY25-26` sentinel test, removing the #40 gate in the same PR. *(No CA figures supplied yet.)*
2. **Old Supabase project** `frmmuizbbhplcrdtaywy` — dashboard check for real rows; migrate if any.
3. **Past-years ITR validation** — run real past-year returns through `scripts/validate-past-years.mjs`.

## Tooling

- **`scripts/smoke-prod.mjs`** (via PR #46) — live launch-critical smoke test, exit 0/1. `node scripts/smoke-prod.mjs [baseUrl]`. Last run 2026-07-13: **7/7** (capture round-trip SKIPs without a DB URL — verify manually via `/api/health`).
- **`GET /api/health?token=<HEALTH_TOKEN>`** (#53) — live DB + last-hour counters; also the credential-free way to confirm the smoke's skipped capture round-trip (submit on live `/try`, watch `capture_ok` + `mostRecentCapture`).
- Tests: `node --test "src/**/*.test.mjs"` (**103 green**, incl. `anthropic-error` + `fetchWithTimeout`); `npx tsc --noEmit` clean.

## Recent commits
```
2f274ea Merge PR #53 — GET /api/health + timestamped funnel counters   [tag: v1.0-launch]
6c70df2 Merge PR #52 — client 45s abort + slow-file reassurance
d99b728 Merge PR #51 — parse-salary honest 503 on Anthropic outage
0845799 Merge PR #50 — capture rate-limit 5→40/IP + /api/invest gate
0ee2f93 Merge PR #49 — CURRENT_STATE.md post-#48 refresh
30db1a0 Merge PR #48 — parse-itr → claude-sonnet-4-6
```
