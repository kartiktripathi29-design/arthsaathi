# ArthVo — proto branch gate walk

Branch `proto/phase1-provisional-verdict` (commits `196a127..385bed1`). EYES gate walk of the
Phase 1–4 prototype journey: `/try`, `/dashboard/tax/{confirm,start,wizard}`, the shared
`ProvisionalVerdict` + `VerdictBar(Live)` components, and the proto edits to
deductions / exemptions / optimizer / landing.

## How it was walked (harness)
Real pixels, not static read. `scripts/gatewalk.mjs` drives headless Chrome over raw CDP (no deps),
seeds localStorage (mock `as_user` + a confirmed single slip: monthly gross ₹1,20,000), and captures
a PNG per **route × {light,dark} × {desktop 1280, mobile 320}** → `gatewalk-shots/` (32 shots).

**Harness caveat — how the server had to run.** The dashboard screens sit behind `AuthGate`, which in
real-auth mode needs a live Supabase session we don't have. Ran dev with `NEXT_PUBLIC_SUPABASE_URL=""`
(flips AuthGate → mock mode, keyed off `as_user`) **and** `NEXT_PUBLIC_CLOUD_SYNC=0`. The page bodies
render identically; only the auth redirect changes. First attempt (URL blank, cloud-sync still `1`)
painted the Next error overlay over every route — see Finding 5.

Seed limits (states a synthetic seed can't settle — owed to a human/device walk):
- The confirm **"couldn't read"** amber/marigold state (needs a slip missing a *critical* field) was not
  exercised — the seed filled every critical field, so only the happy read-signal box was seen.
- Live count-up, the real upload→confirm→start handoff, and the landing `?m=` carry are behavioral,
  not pixel — taken from the wire commit's own verification, not re-proven here.

## Result by surface
| Surface | Light | Dark | 320px | Notes |
|---|---|---|---|---|
| `/try` (public) | ✅ | ❌ light-only | ⚠️ cramp/overflow | F1 (emoji), F2 (no theme), F3 (320) |
| `/dashboard/tax/confirm` | ✅ | ✅ | ✅ | F1 (emoji) only; layout clean incl. 320 |
| `/dashboard/tax/start` | ✅ | ✅ | ⚠️ cramp | F3 (320) — shares `ProvisionalVerdict` |
| `/dashboard/tax/wizard` | ✅ | ✅ | ✅ | best-behaved; single-col by design |
| deductions / exemptions (proto edit) | ✅ | ✅ | ✅ | `VerdictBarLive` injects + themes; see F4 |
| landing (CTA rewire) | ✅ | ✅ | ✅ | "See which one's yours →" present |

## Findings (priority order)

### F1 — [MUST FIX · violates LOCKED no-emoji principle] 🔒 lock emoji reintroduced
The proto work re-added emoji after the session's full emoji sweep (`1b09041`).
- `src/app/try/page.tsx` — `🔒 No account needed…` (salary-gate card) **and** `🔒 Saved on this device · no account yet` (entered state).
- `src/app/dashboard/tax/confirm/page.tsx` — `🔒 Your slip stays on your device…` (footnote).
Fix: drop the glyph (or replace with a tokenized lock SVG if a privacy mark is wanted). Plain text reads fine.

### F2 — [MEDIUM] `/try` renders light-only in dark mode, and has no theme toggle
`/try` lives outside `/dashboard`, so it gets neither the dashboard layout's `data-theme` wrapper nor
`useThemedBase`. Its custom public header has only a "Sign in" link — no `ThemeToggle`. Result: a dark
preference set elsewhere is ignored, and dark is unreachable, on the one **public, pre-auth** screen.
Same root-scope class as the D1.6 / overscroll debt.
Fix: wrap `/try` in the shared themed base and add the existing `<ThemeToggle>` to its header
(`useArthvoTheme` + `useThemedBase` already exist and are used on landing/auth/offer).

### F3 — [MEDIUM] `ProvisionalVerdict` doesn't collapse to one column at 320px
Two grids stay 2-up on narrow screens:
- regime cards — inline `gridTemplateColumns: '1fr 1fr'` (ProvisionalVerdict.tsx:114)
- "Make it exact" questions — inline `repeat(2, 1fr)` (ProvisionalVerdict.tsx:138)
The `.demo-regime` stack-at-≤480 rule is **landing-scoped** (styled-jsx in `page.tsx:129`, component-local)
so it never reaches this component, and the inline style would override it anyway. At 320px: regime
numbers cramped and question-input placeholders clip ("up to 2,(", "e.g. 25,("). On `/try` it produces
horizontal overflow; on `/start` the dashboard shell contains the scroll but content still clips.
Affects `/try` **and** `/start` (both render `ProvisionalVerdict`).
Fix: a real responsive rule on this component (container/media `max-width:~480` → single column for both
grids), authored where it applies — not in landing's local styled-jsx.

### F4 — [DIAGNOSED · real bug, root cause found] savings jumps on the deductions/exemptions pages
**Not a computation bug** — the verdict engine is consistent (same data → ₹51,324 everywhere; proven by
`scripts/probe-f4.mjs`: `/start` and `/deductions` both read `ppf:90000` and report 51,324 at rest, in
both navigation orders). The divergent ₹76,559 / 80C ₹69,120 is a **mount-time write-back clobber**:

- The **deductions** page has a load effect (reads `av_deductions` → `setDed`) AND a write-back effect
  `useEffect(() => localStorage.setItem('av_deductions', JSON.stringify(ded)), [ded])`. The write-back
  fires on the **initial mount with the default all-zeros `ded`**, before the load's `setDed` is applied —
  persisting an empty `av_deductions`. The PF auto-prefill then refills only `employeePF` (₹69,120), so
  `ppf:90000` is gone → 80C = 69,120 → old regime ~₹25,234 worse → savings shows ₹76,559. The arithmetic
  reconciles to the penny (1,440,000 − 50,000 − 168,000 − 69,120 vs −150,000).
- The **exemptions** page (`page.tsx:265`) has the identical unguarded write-back — visiting it can wipe
  `av_exemptions.hra` (rentPaid/annualExemption → 0) the same way.

Manifestation: in dev (React StrictMode double-invoke) it reliably persists the wiped state (what the
gate-walk screenshots caught). In production (single mount) it **self-heals at rest** — but leaves (a) a
visible flicker as the live number animates from the wrong value, and (b) a transient empty
`av_deductions`/`av_exemptions` window that `SyncProvider`'s 3s poll could push to the cloud = **possible
data loss**. So it's a real data-safety bug, not just cosmetic.

**Fix (recommended):** guard both write-back effects so they don't persist until after the initial load
has populated state (a `hydrated` ref/flag, set true at the end of the load effect; the write-back
early-returns until then). Small, contained, kills the clobber + flicker + sync-loss risk. Touches the
pre-existing deductions/exemptions pages (outside the proto new-files set) — a slightly wider blast
radius, so flagged for a deliberate go-ahead rather than ridden in with the proto fixes.

### F5 — [LATENT · minor in prod] `SyncProvider` has no unconfigured-Supabase guard
`AuthGate` and `useUser` both guard the "Supabase not configured" (mock) case; `SyncProvider`
(`app/layout.tsx:41`) does not — it gates on `NEXT_PUBLIC_CLOUD_SYNC` instead, and with cloud-sync on
+ an empty URL it calls `createSupabaseBrowserClient()` and throws, painting the Next error overlay over
**every** route (including public ones). Moot in prod (URL always set) but it means the documented
mock mode can't actually boot with cloud-sync enabled. One-line fix: early-return / skip client
construction when `NEXT_PUBLIC_SUPABASE_URL` is empty.

## Not findings (expected / out of scope)
- `FY 2026–27` in the chrome — the known FY conflict (engine FY25-26 vs chrome), a parked Kartik decision.
- The red "1 Issue" badge + "N" circle in shots = Next.js dev overlay, not the app.
- Dark hexes are D1 first-draft (tuning round pending) — not re-litigated here.

## Fixes applied (2026-06-27, after the walk)
F1/F2/F3/F5 fixed and **re-walked** (real pixels) — all verified; `next build` green (34 routes):
- **F1** — stripped `🔒` from `/try` (×2) and `confirm` (×1).
- **F2** — `/try` now wires `useArthvoTheme` + `useThemedBase` + a `data-theme` wrapper and renders the
  shared `<ThemeToggle>` in its header. Re-walk: `/try` is fully dark and switchable.
- **F3** — `ProvisionalVerdict` regime + question grids moved to `.pv-regime` / `.pv-questions` classes
  with a `@media (max-width:480px)` single-column rule (inline `gridTemplateColumns` removed so the media
  rule wins). Re-walk: both `/try` and `/start` stack cleanly at 320px, placeholders no longer clip.
- **F5** — `SyncProvider` `ENABLED` now also requires `NEXT_PUBLIC_SUPABASE_URL`, so it stays inert
  (no client construction, no overlay) when Supabase is unconfigured.

**Still open: F4** (savings divergence) — needs a real uploaded slip, not fixed here.

## Discipline note
This was the walk first (no fixes ridden into it); the F1/F2/F3/F5 fixes were then applied and
re-walked as their own pass. F4 remains until checked on real data.
