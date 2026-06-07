# Plan — Real per-user cloud persistence (BUG-8), privacy model B+

## Context
Today all ArthVo financial data lives in **browser `localStorage` only** (28 `av_*`/`as_*` keys). Clearing the browser or switching devices loses everything. We already shipped manual **Backup & Restore** (`components/BackupRestore.tsx`). The user now wants **automatic per-user cloud persistence** so data follows their login across devices, using privacy model **B+** (encrypted at rest, per-user isolated, PAN/Aadhaar masked + field-encrypted, recoverable — *not* zero-knowledge). **No tax logic changes** — the server is only a sync store; all math stays client-side.

## ⚠️ Critical blocker found during exploration
**There is no real authentication.** This must be resolved first — "per-user" is meaningless without a real user identity.
- `app/login/page.tsx` & `app/signup/page.tsx` are **mocks** — they only set `as_user` in `localStorage` (24h timeout); no Supabase sign-in runs.
- `dashboard/layout.tsx` `AuthGate` checks `localStorage`, not a Supabase session.
- `lib/auth.ts:requireUser()` exists but is **unused**, and `prisma.user.upsert({create:{id,email}})` would **crash** — `User.name` is required with no default (`prisma/schema.prisma:12`).
- API routes (`parse-salary`, etc.) hardcode `userId:'anonymous'`.
- `prisma/schema.prisma:6` says `provider="sqlite"` but runtime is **Postgres** (`@prisma/adapter-pg`, `migrations/migration_lock.toml:3`, generated client). The schema is stale.

## Recommended approach (after real auth exists)

### 1. Fix foundations (safe, no prod DB)
- `prisma/schema.prisma`: set `provider = "postgresql"`; give `User.name` a default (`@default("")`) or make nullable to stop the upsert crash.
- Extract `collectBackup()` + restore from `components/BackupRestore.tsx` into **`lib/backupSync.ts`** (`collectAppData()` / `applyAppData()`) so both Backup/Restore and cloud-sync share one collector. `isAppKey` = `av_*`/`as_*`.

### 2. Real auth (prerequisite — needs user's choice + Supabase config)
- Implement actual Supabase login (method TBD — see question) using `lib/supabase/client.ts` (browser) + `server.ts`; wire `requireUser()`; replace the mock login/signup; make `AuthGate` use the real session. Expose the user to client via a hook.

### 3. DB model + migration (needs prod migration step)
- New Prisma model `UserData { userId String @id; blob String; updatedAt DateTime }` (one row/user; `blob` = encrypted JSON of all `av_*`/`as_*` keys).
- PAN/Aadhaar (`lib/identity.ts` → `av_user_identity`) **field-encrypted** before storage and **masked in UI** (`••••1234`).
- `npx prisma migrate dev` locally → `migrate deploy` against Supabase (user-run, one time).

### 4. API (auth-gated, mirrors `api/auth/*` pattern)
- `GET /api/user-data` → `requireUser()` → return `{ blob, updatedAt }`.
- `PUT /api/user-data` → `requireUser()` → upsert `{ blob, updatedAt }`.
- Encrypt/decrypt the blob server-side (key from env) — encrypted at rest; recoverable.

### 5. Client sync provider
- New `<SyncProvider>` mounted in `app/layout.tsx` inside `AppProvider` (after `DialogHost`).
- On auth + mount: `GET` server blob; if newer than local `av_synced_at`, `applyAppData()` then refresh. On local change (debounced ~2s): `collectAppData()` → `PUT`. **Last-write-wins** by `updatedAt`.

### 6. Honest UI line (B+ — only what's true)
> 🔒 Your data is encrypted and tied to your account — you reach it by logging in. We mask your PAN and Aadhaar and never store them in full.
(Do **not** write "even we can't see it" — false under B+.)

## What needs the user (cannot be done unattended)
1. **Auth method choice** (email OTP / email+password / Google).
2. **Supabase project config** (providers, redirect URLs, env keys).
3. **Run the DB migration** against live Supabase Postgres (`DATABASE_URL`).

## Safe groundwork I *could* do autonomously now (no prod, behind a flag)
Schema-provider fix, `User.name` default, extract `lib/backupSync.ts`, write (un-applied) `UserData` model + migration file, scaffold the API routes + `SyncProvider` behind a `NEXT_PUBLIC_CLOUD_SYNC` flag (off). None testable/shippable until real auth + migration land.

## Verification
- Local: `npx prisma migrate dev`; log in on browser A, enter data; log in on browser B → data appears. Edit on B → A reflects after refresh. Confirm PAN/Aadhaar stored encrypted + shown masked. `npm test` + `tsc --noEmit` green.

---
*Saved 2026-06-05. Source plan: `~/.claude/plans/transient-napping-pony.md`. This is a plan only — no code from it has been implemented yet.*
