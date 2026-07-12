# ArthVo — current state

<!-- Tip/status lines. Refresh these each state check. -->

- **Tip (origin/main):** `c8972db` — 2026-07-12 — Merge PR #42 (cross-device verdict context)
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
- **Data-assurance line** — single source `DataAssurance.tsx` on hero / `/try` / dashboard upload. *(Copy change to name AI explicitly is in open PR #43, not yet merged.)*

## What's gated / disabled (intentional)

- **Phase-2 APIs → 404** while `PHASE_2_ENABLED = false` (`src/lib/phase.ts`, code constant): `parse-bank-statement`, `parse-cas/token`, `parse-cas/save`. Verified 404 live.
- **FY 2026-27 "plan ahead" disabled** (PR #40) — option visible-but-disabled with hint "Available once next year's rules are finalised"; resolver **clamps** to the latest genuinely enacted FY (2025) because `FY_2026_27` is still an identical copy of `FY_2025_26`. Sentinel test auto-fails once real rules are encoded.
- **`/api/user-data`** inert (`NEXT_PUBLIC_CLOUD_SYNC=0`).

## Open PRs — close-out session (awaiting review/merge; none merged)

- **#43** — copy: `DataAssurance` line names AI explicitly ("Read automatically by AI — no human ever sees your slip.")
- **#44** — chore: remove verified-dead files (8 files, deletions only; `tsc` + tests green)
- **#45** — model: `/api/parse-ais` → `claude-sonnet-4-6` (A/B confirmed identical extraction)
- **#46** — chore: `scripts/smoke-prod.mjs` (14/14 green against prod)

## What remains — tracked in issue #39

1. **FY 2026-27** — CA-verified figures, then encode a real distinct rule set + a `≠ FY25-26` sentinel test, removing the #40 gate in the same PR. *(No CA figures supplied yet.)*
2. **Old Supabase project** `frmmuizbbhplcrdtaywy` — dashboard check for real rows; migrate if any.
3. **Past-years ITR validation** — run real past-year returns through `scripts/validate-past-years.mjs`.
4. **`/api/parse-itr`** still on `claude-opus-4-5` — upgrade to Sonnet with the same identical-extraction guardrail.

## Tooling

- **`scripts/smoke-prod.mjs`** (via PR #46) — live launch-critical smoke test, exit 0/1. `node scripts/smoke-prod.mjs [baseUrl]`.
- Tests: `node --test src/lib/*.test.mjs` (94 green); `npx tsc --noEmit` clean.

## Recent commits
```
c8972db Merge PR #42 — cross-device verdict context (/try?r=)
c903577 Merge PR #41 — final January email copy (verbatim)
1f8c776 Merge PR #35 — FY26-27 verification report
2dde3d2 Merge PR #40 — gate unverified FY (disable + clamp)
c182831 Merge PR #38 — capture copy fix + build-migrate
16a2fea Merge PR #36 — email capture on /try
fb4a793 Merge PR #37 — past-years harness
9f84b52 Merge PR #33 — derived FY resolution
```
