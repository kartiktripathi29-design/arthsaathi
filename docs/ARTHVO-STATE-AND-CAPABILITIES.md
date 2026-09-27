# ArthVo — State & Capabilities

> Combined status snapshot **and** code-verified capability inventory.
> Built from the live code + git history, not from README/handoff prose.
>
> **Audited against:** `origin/main @ 0ee2f93` (Merge PR #49) · **Date:** 2026-07-13
> **Source-of-truth reminder:** the *locked principles* (positioning, voice, tax/classification
> rules) live in `docs/arthvo-handoff-session4.md` / `-session5.md` and are product spec — not
> restated here. This file holds *facts about the current build*; refresh it each session.

---

## 1. At a glance

- **Product:** ArthVo — an India tax-optimization assistant. Upload a salary slip / offer / AIS /
  ITR, it reads them with AI, computes Old-vs-New regime tax, and shows where you can save.
- **Deploy:** production → **arthvo.com / www.arthvo.com** (Vercel, auto-deploys `main`).
- **Repo canonical location:** `C:\dev\arthsaathi` (moved out of OneDrive — it broke Next's
  file-watcher). True tip is **`origin/main`**, never local `main`.
- **DB:** Supabase project **`bsxwxqnighcjayxjikiv`** (the earlier `frmmuizbbhplcrdtaywy` was the
  wrong project — issue #39). Full migration history applied; auto-migrate on prod deploys.
- **AI model:** every AI call is **`claude-sonnet-4-6`** — the only model literal left in `src`
  (9 references, all via `src/lib/claude.ts` plus `parse-ais` / `parse-itr`). No `claude-opus-4-5`
  remains.
- **Phase gating:** one code constant `PHASE_2_ENABLED = false` (`src/lib/phase.ts`) gates the
  entire planning surface (Invest / DNA / Decide) **and** bank-statement + demat/CAS ingestion, at
  both the page layer (client redirect) and the API layer (404). No env var — flip the constant to
  enable Phase-2 everywhere at once.

---

## 2. Page routes (`src/app/**/page.tsx`)

Legend: **Live** = wired & reachable · **Guarded** = Phase-2, redirects out while `PHASE_2_ENABLED=false`.

| Route | Status | Notes |
|---|---|---|
| `/` | Live | Landing. Animated `HeroJourney` hero (photo-hero PR #27 was reverted). Uses `tax-slabs.ts` for the demo figure. Dark-capable. |
| `/login` | Live | Email/phone + OTP + password; Supabase, mock fallback when unconfigured. |
| `/signup` | Live | Same auth stack. |
| `/offer` | Live | Standalone offer-letter decoder → `/api/parse-offer-letter`; uses `tax-slabs.ts`. |
| `/try` | Live | **Public provisional-verdict flow** — upload a slip, get an Old-vs-New verdict without signup. Phase-1 **email capture** on the verdict; `/try?r=<token>` rehydrates a returning user's verdict cross-device. |
| `/unsubscribe` | Live | `?token=` → sets `unsubscribed=true`; idempotent confirmation page. |
| `/privacy` | Live | Static policy. |
| `/dashboard` | Live | Visual tax dashboard + "Where you can save more" card; links to computation. |
| `/dashboard/profile` | Live | Large data-entry + bank/CAS upload orchestration hub. |
| `/dashboard/profile/documents` | Live | Upload salary slip / AIS / ITR / offer → parse. |
| `/dashboard/profile/salary` | Live | Month-by-month salary timeline; forecast via `tax-slabs.ts`. |
| `/dashboard/profile/other-income` | Live | Reads/writes `av_other_income`. |
| `/dashboard/profile/exemptions` | Live | Section-10 allowances (HRA etc.). |
| `/dashboard/profile/deductions` | Live | Chapter VI-A. |
| `/dashboard/profile/form-12b` | Live | Per-employer Form 12B generator. |
| `/dashboard/tax/start` | Live | **Prototype (Phase 1)** — in-app provisional-verdict step; thin wrapper over the shared verdict. |
| `/dashboard/tax/confirm` | Live | **Prototype (Phase 2)** — "Here's what we read" trust step between parsing a slip and committing it. |
| `/dashboard/tax/wizard` | Live | **Prototype (Phase 3)** — guided "tax breaks" wizard collapsing Allowances + Deductions. |
| `/dashboard/tax/optimizer` | Live | Old vs New regime; uses `tax-slabs.ts`. |
| `/dashboard/tax/computation` | Live | CA-ready "Computation of Income" statement; Summary/Detailed toggle. |
| `/dashboard/tax/past-years` | Live | Consumes `/api/parse-itr` output; past-return validation surface. |
| `/dashboard/chat` | Live | **"Ask ArthVo"** help guide. In the dashboard nav, **no Phase-2 guard**. Streams `/api/chat`; no-financial-advice guardrails in `buildChatSystem`. |
| `/dashboard/invest` | **Guarded** | Investment planner — `PHASE_2_ENABLED` redirect. |
| `/dashboard/dna` | **Guarded** | Financial-DNA quiz — same guard. |
| `/dashboard/decide` | **Guarded** | Affordability tool — same guard. |

---

## 3. API routes

Legend: **Live** · **Gated** = Phase-2 / env-gated → 404/503.

| Route | Status | Model | Notes |
|---|---|---|---|
| `/api/parse-salary` | Live | claude-sonnet-4-6 | Salary slip: image/PDF (base64) + text. |
| `/api/parse-offer-letter` | Live | claude-sonnet-4-6 | base64 / text / multi-page variants. |
| `/api/parse-ais` | Live | claude-sonnet-4-6 | Handles **AIS and Form 26AS** (one endpoint). Moved off Opus → Sonnet in PR #45. |
| `/api/parse-itr` | Live | claude-sonnet-4-6 | Parses filed ITRs; feeds `/dashboard/tax/past-years`. Moved to Sonnet in PR #48. |
| `/api/chat` | Live | claude-sonnet-4-6 | `streamChatResponse`; guardrails in `buildChatSystem`. |
| `/api/invest` | Endpoint live, **orphaned** | claude-sonnet-4-6 | `generateInvestmentPlan` — only caller page (`/dashboard/invest`) is Phase-2 guarded. |
| `/api/tax-calc` | Live | none | Pure; imports `compareTaxRegimes` / `LATEST_ENACTED_FY` from **`tax-slabs.ts`**. |
| `/api/email-capture` | Live | none | Stores email + verdict figures + `capturedAt`; idempotent, rate-limited. |
| `/api/email-capture/context` | Live | none | `?r=<token>` → returns **only** `{verdictFY, verdictAmount}` for a non-unsubscribed capture (404 on unknown/short/unsubscribed). |
| `/api/analytics/capture` | Live | none | Analytics event sink. |
| `/api/blob-upload` | Live | none | Vercel Blob upload helper. |
| `/api/auth/callback` | Live | none | Supabase auth callback. |
| `/api/auth/signout` | Live | none | Supabase signout. |
| `/api/user-data` | **Gated inert** | none | Encrypted sync store (GET/PUT). Inert while `NEXT_PUBLIC_CLOUD_SYNC=0` (404), 503 without crypto key. |
| `/api/parse-bank-statement` | **Gated (Phase-2)** | none | Local template/pipeline parsers (no LLM call). Returns 404 while `PHASE_2_ENABLED=false`. |
| `/api/parse-cas/token` | **Gated (Phase-2)** | none | Mints a CASparser third-party token. 404 while Phase-2 off. |
| `/api/parse-cas/save` | **Gated (Phase-2)** | none | Receives parsed CAS payload. 404 while Phase-2 off. |

---

## 4. Document parsers

| Parser | Status | Path | Notes |
|---|---|---|---|
| Salary slip | Live | `/api/parse-salary` | Image/PDF + text; called from documents, salary, profile, `/try`. |
| Offer letter | Live | `/api/parse-offer-letter` | base64 / text / multi-page; called from offer, salary, profile. |
| AIS / Form 26AS | Live | `/api/parse-ais` | One endpoint for both; AIS treated as superset of 26AS. |
| ITR (filed return) | Live | `/api/parse-itr` | Feeds past-years validation. |
| Bank statement | **Gated (Phase-2)** | `/api/parse-bank-statement` | Local parsers + `pipeline.ts` + `txn-intelligence.ts`; no LLM. Route 404 while Phase-2 off. |
| CAS (demat) | **Gated (Phase-2)** | CASparser widget (`token`+`save`) | Front end `DematHoldings.tsx`; both routes 404 while Phase-2 off. |

Format ingestion helpers: `lib/{docxText,pdfToImages,pdfNormalize,pdfText}.ts` (DOCX + image coverage
beyond PDF, feeding parse-offer-letter).

---

## 5. Tax engine — consolidated

The old two-engine drift is **resolved**. `src/lib/tax-engine.ts` has been **retired**; the single
source of truth is now:

- **`src/lib/tax-slabs.ts`** — year-parameterized slab rules; used by optimizer, salary forecast,
  `/offer`, landing, `/api/tax-calc`, `BgDemo`.
- **`src/lib/fy.ts`** (+ `useSelectedFY`) — **derived FY resolution** (PR #33): FY is derived from the
  slip (Apr–Mar), never hardcoded, and there is one `selectedFY` value.

**FY 2026-27 is deliberately disabled** (PR #40): the option is visible-but-disabled with the hint
"Available once next year's rules are finalised", and the resolver **clamps** to the latest genuinely
enacted FY (2025) because `FY_2026_27` is still an *identical copy* of `FY_2025_26`. A sentinel test
auto-fails the moment real distinct FY26-27 rules are encoded, forcing the gate's removal.

---

## 6. Embedded features & libs (no route of their own)

| Capability | Status | Files |
|---|---|---|
| Data-assurance line | Live | `components/DataAssurance.tsx` — single source on hero / `/try` / dashboard upload: "Read automatically by AI — no human ever sees your slip." (PR #43) |
| Owner-identity verification | Live | `lib/identity.ts` — blocks slip upload on PAN/name mismatch; masks PAN in CA statement. |
| Salary analytics (confidence + anomaly) | Live | `lib/salary-analytics.ts` — per-month anomaly badges; HRA-exemption compute. |
| Annual-earnings source of truth | Live | `lib/salary-facts.ts` — feeds downstream tax math. |
| Chapter VI-A deduction helpers | Live | `lib/deductions.ts`. |
| ITR-form recommendation | Live | optimizer + `lib/claude.ts` — "which ITR" guidance. |
| Encrypted backup / restore | Live | `components/BackupRestore.tsx`, `lib/backupSync.ts`, `lib/crypto.ts` — export/import for the browser-only store. |
| Transaction-intelligence engine | Live (behind Phase-2 ingestion) | `lib/txn-intelligence.ts`, `lib/pipeline.ts`, `lib/categories.ts`, `lib/statementParser.ts` — 5-stage normalize→categorize→analyze→report. |
| Demat holdings / CAS portfolio UI | Live UI (Phase-2 routes gated) | `components/DematHoldings.tsx`. |
| Financial-DNA validator | Guarded | `lib/dnaValidator.ts` → `/dashboard/dna`. |
| Design-token / dark-mode system | Live | `lib/tokens.ts`, `components/ThemeToggle.tsx`; `av_theme`, System/Light/Dark across all pages. |
| Activity / audit logging | Live | `lib/activity.ts`. |

---

## 7. Data & persistence

| Mechanism | Status | Notes |
|---|---|---|
| localStorage (`av_*`) | Live — **primary store** | `av_salary_timeline`, `av_other_income`, `av_theme`, `av_selected_fy`, `as_ais`, etc. All real client state. |
| Supabase (auth + email capture) | Live | Auth stack + email-capture/unsubscribe rows persist to Supabase `bsxwxqnighcjayxjikiv`. |
| Supabase + Prisma cloud sync (`/api/user-data`) | Infra built, **gated inert** | `NEXT_PUBLIC_CLOUD_SYNC=0` in prod → 404/503. |

---

## 8. What remains — tracked in issue #39

1. **FY 2026-27** — need CA-verified figures, then encode a real distinct rule set + a `≠ FY25-26`
   sentinel, removing the #40 gate in the same PR. *(No CA figures supplied yet.)*
2. **Old Supabase project `frmmuizbbhplcrdtaywy`** — check for real rows; migrate if any.
3. **Past-years ITR validation** — run real past-year returns through
   `scripts/validate-past-years.mjs`.
4. **January reactivation email** — final copy is `docs/EMAIL-JANUARY.md` (PR #41), but **no email is
   sent yet**; the send is a future task.

---

## 9. Known drift / debt

- **README is stale** — still says the AI-advisor chat is "Parked for Phase 2 … routes hidden."
  **False:** `/dashboard/chat` is live and unguarded; only invest/dna/decide are guarded. README also
  predates the `/try`, email-capture, `tax/{start,confirm,wizard,past-years}`, and parse-itr surfaces.
- **Locked voice rule "no emoji anywhere in product"** — now **honored** (the old `📄` prefixes are
  gone from the codebase).
- **`claude-sonnet-4-6`** is the model everywhere; note the latest Opus is 4.8 — a future upgrade
  decision, not a bug.

---

## 10. Tooling & verification

- **`scripts/smoke-prod.mjs`** (PR #46) — live launch-critical smoke test, exit 0/1:
  `node scripts/smoke-prod.mjs [baseUrl]`.
- **`scripts/validate-past-years.mjs`** — past-year ITR validation harness.
- Tests: `node --test src/lib/*.test.mjs` (94 green); `npx tsc --noEmit` clean.
- Test coverage exists for `tax-slabs`, `fy`, `salary-facts`, `salary-analytics`, `deductions`,
  `crypto`, `backupSync`, `cloudSync`.

---

### Caveats

- Audited **statically** against `origin/main @ 0ee2f93` (git grep + file reads). Items depending on
  env/DB/routing behaviour are stated per the maintained `docs/CURRENT_STATE.md` (live-verified by the
  team) but not independently executed here.
- ⚠️ The local branch `fix-landing-copy` is based on old PR #13 (`e385e63`) and its working tree does
  **not** reflect current code. All facts above are read from `origin/main`, not the local checkout.
