# PRIVACY-GUARD

Server-side gating of Phase-2 data ingestion, and an audit of the data-handling
assurance against the code paths actually reachable in Phase-1.

**Principle: UI gating is not API gating.** Hiding a page (a client redirect) does
not stop its API route from running. A route that parses a financial document and
writes it to the DB while its UI is "off" contradicts the assurance printed next to
every upload CTA. This document records the guards that close that gap.

Shipped: PR #29 (`fix(api): server-side Phase-2 gate on bank-statement + CAS routes`),
merged to `main`, deployed to production (arthvo.com), verified live.

---

## The one flag

`src/lib/phase.ts`

```ts
export const PHASE_2_ENABLED = false
```

Single source of truth. No env var. Both the API guards and the client-page redirects
read it. **To turn Phase-2 back on, flip this one constant to `true`** — every guard
below opens at once.

The Phase-2 pages (`dashboard/invest`, `dashboard/dna`, `dashboard/decide`) redirect
away with `useEffect(() => { if (!PHASE_2_ENABLED) router.replace('/dashboard/profile/documents') })`
— reading the same flag (PR #31), so UI and API open together. Note this is a
convenience/consistency gate, **not** a security boundary: the API `404` guards are the
enforcement.

---

## Guarded routes (Phase-2)

Each returns **`404` (not `403`)** — so the endpoint isn't even advertised — **before**
any parse / DB / auth work runs.

| Route | Guard | File |
|---|---|---|
| `POST /api/parse-bank-statement` | `if (!PHASE_2_ENABLED) return new NextResponse(null, { status: 404 })` at top of `POST` | `src/app/api/parse-bank-statement/route.ts` |
| ↳ `persistStatement()` | belt-and-braces early `return` (same flag) — second layer before the Prisma write | same file |
| `POST /api/parse-cas/token` | `404` at top (also mints a **paid external** CASparser token) | `src/app/api/parse-cas/token/route.ts` |
| `POST /api/parse-cas/save` | `404` at top | `src/app/api/parse-cas/save/route.ts` |

**Two layers, one flag:** the route guard stops the request; `persistStatement`'s guard
stops the DB write even if reached another way.

### Note on the CAS/demat decision

The bank-statement UI is **not** behind a Phase-2 route guard — it lives in the
orphaned legacy `/dashboard/profile` page (docs tab), reachable by direct URL but
dropped from the Phase-1 nav. The **demat/CAS UI sits in the same tab, identical
gating**. So CAS was gated for consistency and because `token` calls a paid third
party. The CAS routes write **nothing** to the DB (`save` only echoes a summary);
gating them is defense + cost control, not DB-write prevention. If demat is ever
declared a Phase-1 feature, revert the two CAS guards.

---

## Left running in Phase-1 (intentional)

| Route | Write | Why it stays |
|---|---|---|
| `POST /api/parse-salary` | `prisma.salarySlip.upsert` — **full slip JSON** (`components`) + `activityEvent` — `src/app/api/parse-salary/route.ts:203` | The Phase-1 core flow. Auth-gated (`if (!user) return`): pre-auth `/try` never persists; only signed-in dashboard uploads store. |
| `GET/PUT /api/user-data` | `prisma.userData.upsert` — encrypted blob of all `av_*`/`as_*` localStorage — `src/app/api/user-data/route.ts:61` | Gated by `NEXT_PUBLIC_CLOUD_SYNC` (`:29`, `:51` → `404` when off). |

Full inventory of Prisma writes under `src/app/api`: `statement.upsert` (now gated),
`salarySlip.upsert` (Phase-1), `userData.upsert` (flag-gated), `activityEvent.create`
(audit metadata). CAS routes: none.

---

## Cloud-sync state

`NEXT_PUBLIC_CLOUD_SYNC` controls `/api/user-data`.

- **Local (`.env.local`):** `0`.
- **Vercel Production (`arthsaathi-app`):** set **explicitly to `0`**, production
  redeployed so it's baked into the build. `GET /api/user-data` on arthvo.com returns
  `404`, confirming sync is inert.
- `.env.example` documents `0` as the default.

Because `NEXT_PUBLIC_*` is inlined at build time, changing this flag requires a
redeploy to take effect.

---

## Data-handling assurance — audit

Source (single component): `src/components/DataAssurance.tsx:8`

> **"Your salary slip is processed automatically — never seen by a human."**

Rendered on exactly three surfaces:
- Landing hero — `src/app/page.tsx:198`
- Public `/try` — `src/app/try/page.tsx:100`
- Documents upload — `src/app/dashboard/profile/documents/page.tsx:567`

| Claim | Verdict | Basis |
|---|---|---|
| "processed **automatically**" | **TRUE** | `parse-salary` → `parseSalaryFromBase64`/`parseSalaryFromText` (`src/lib/claude.ts`) — automated model pipeline, no human step. |
| "**never seen by a human**" | **TRUE (literal) / AMBIGUOUS (disclosure)** | Sent to Anthropic's Claude API for automated OCR — no human reviews it. But the sentence doesn't disclose that the slip **leaves the device to a third-party model provider**; a reader could read "never seen" as "never leaves us." Literal claim holds; transparency gap remains. |
| *(implicit)* "not stored" | **NOT CLAIMED** | The component comment deliberately omits retention. So `salarySlip.upsert` and the `user-data` blob **do not contradict the printed sentence** — but *would* contradict a "stays on your device" claim. |

Deliberately absent (per the component's own comment): the "never sold" claim and the
retention policy. Add them in that **one** place only, once founder-cleared.

Adjacent (non-DataAssurance) copy on `/try`: *"Your numbers stay on your device until
you save"* (`try/page.tsx:99`) — **TRUE**: pre-auth `/try` never persists; DB writes
require sign-in ("…until you save").

**Net:** after the guards, every claim in the assurance sentence is TRUE for
Phase-1-reachable code. The only soft spot is the undisclosed third-party (Anthropic)
transmission behind "never seen by a human."

---

## Verified live (arthvo.com)

| Endpoint | Result | Meaning |
|---|---|---|
| `POST /api/parse-bank-statement` | `404` | Phase-2 gated ✓ |
| `POST /api/parse-cas/token` | `404` | Phase-2 gated ✓ |
| `POST /api/parse-cas/save` | `404` | Phase-2 gated ✓ |
| `GET /api/user-data` | `404` | cloud sync off ✓ |
| `POST /api/parse-salary` | `400` | Phase-1 core still runs ✓ |
| `GET /` | `200` | site healthy ✓ |

---

## Open / follow-ups

- ✅ **Phase-2 client guards** — *done (PR #31)*: the three `router.replace` redirects
  now read `PHASE_2_ENABLED`, so UI and API share the one flag literally.
- **Transparency copy:** decide whether "never seen by a human" should disclose the
  Anthropic transmission (or reword). Product/founder call.
- **Re-enabling Phase-2:** flip `PHASE_2_ENABLED` → `true`, ensure `CASPARSER_API_KEY`
  is set, and re-confirm this assurance audit against the then-reachable bank/demat
  paths (bank statements are also sent to Claude and persisted).
