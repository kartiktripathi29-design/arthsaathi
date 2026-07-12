# ArthVo — current state

<!-- Tip/status lines. Refresh these each state check. -->

- **Tip (origin/main):** `30db1a0` — 2026-07-12 — Merge PR #48 (parse-itr → Sonnet)
- **Repo location:** `C:\dev\arthsaathi` — moved out of OneDrive (OneDrive broke Next's file-watcher). Start sessions from here.
- **Deploy:** production `arthsaathi-app` → **arthvo.com / www.arthvo.com** (Vercel, auto-deploys `main`). Everything below is live-verified.
- **DB:** Supabase project **`bsxwxqnighcjayxjikiv`** (the earlier `frmmuizbbhplcrdtaywy` was the wrong project — see #39). Full migration history applied; auto-migrate on prod deploys.
- **Landing hero:** animated `HeroJourney` (photo-hero PR #27 was reverted; `public/hero/hero.jpg` absent).

## What's live (verified on arthvo.com)

- **Email capture** on `/try` (PR #36) — stores email + verdict figures + `capturedAt`; idempotent; rate-limited.
- **Unsubscribe** — `GET /unsubscribe?token=` sets `unsubscribed=true`, idempotent confirmation page.
- **Cross-device rehydrate** (PR #42) — `GET /api/email-capture/context?r=<token>` returns **only** `{verdictFY, verdictAmount}` for a non-unsubscribed capture (404 on unknown/short/unsubscribed); `/try?r=` shows a returning-user banner when the device has no local verdict (local wins). Prod round-trip verified end-to-end.
- **Final January email copy** (PR #41) — `docs/EMAIL-JANUARY.md` is the founder-final draft (no email is sent yet; the send itself is a future task).
- **Derived FY resolution** (PR #33) — FY derived from the slip (Apr–Mar), never hardcoded; `tax-slabs.ts` year-parameterized; `fy.ts` + `useSelectedFY`; retired `tax-engine.ts`.
- **Privacy guards** (PRs #29–#32) — Phase-2 gating (below); `PRIVACY-GUARD.md`; `NEXT_PUBLIC_CLOUD_SYNC=0` in prod.
- **Data-assurance line** (PR #43) — single source `DataAssurance.tsx` on hero / `/try` / dashboard upload: "Read automatically by AI — no human ever sees your slip."
- **AI parse routes on Sonnet** — `/api/parse-ais` (PR #45) and `/api/parse-itr` (PR #48) both run `claude-sonnet-4-6`; each verified live with an A/B showing identical extraction. No `claude-opus-4-5` remains in `src`.

## What's gated / disabled (intentional)

- **Phase-2 APIs → 404** while `PHASE_2_ENABLED = false` (`src/lib/phase.ts`, code constant): `parse-bank-statement`, `parse-cas/token`, `parse-cas/save`. Verified 404 live.
- **FY 2026-27 "plan ahead" disabled** (PR #40) — option visible-but-disabled with hint "Available once next year's rules are finalised"; resolver **clamps** to the latest genuinely enacted FY (2025) because `FY_2026_27` is still an identical copy of `FY_2025_26`. Sentinel test auto-fails once real rules are encoded.
- **`/api/user-data`** inert (`NEXT_PUBLIC_CLOUD_SYNC=0`).

## Close-out session — all PRs merged

PRs **#43–#48** are merged: DataAssurance AI copy (#43), dead-file removal (#44), parse-ais→Sonnet (#45), `smoke-prod.mjs` (#46), this doc's prior refresh (#47), parse-itr→Sonnet (#48).

## What remains — tracked in issue #39

1. **FY 2026-27** — CA-verified figures, then encode a real distinct rule set + a `≠ FY25-26` sentinel test, removing the #40 gate in the same PR. *(No CA figures supplied yet.)*
2. **Old Supabase project** `frmmuizbbhplcrdtaywy` — dashboard check for real rows; migrate if any.
3. **Past-years ITR validation** — run real past-year returns through `scripts/validate-past-years.mjs`.

## Tooling

- **`scripts/smoke-prod.mjs`** (via PR #46) — live launch-critical smoke test, exit 0/1. `node scripts/smoke-prod.mjs [baseUrl]`.
- Tests: `node --test src/lib/*.test.mjs` (94 green); `npx tsc --noEmit` clean.

## Recent commits
```
30db1a0 Merge PR #48 — parse-itr → claude-sonnet-4-6
bfcd2b9 Merge PR #46 — scripts/smoke-prod.mjs
8939655 Merge PR #45 — parse-ais → claude-sonnet-4-6
8ab2698 Merge PR #44 — remove verified-dead files
f7c5979 Merge PR #43 — DataAssurance line names AI
d6ea91e Merge PR #47 — CURRENT_STATE.md close-out refresh
c8972db Merge PR #42 — cross-device verdict context (/try?r=)
c903577 Merge PR #41 — final January email copy (verbatim)
```
