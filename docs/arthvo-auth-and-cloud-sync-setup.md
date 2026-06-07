# ArthVo — Email OTP auth + cloud sync: setup & before-launch checklist

This branch (`feat/bug8-cloud-sync-groundwork`) adds **real email-OTP authentication** and the
**BUG-8 cloud-persistence** foundation. Everything is built to be **inert until you configure it** —
the app keeps running in its current mock mode until the Supabase env vars are present.

**Tracking PR:** https://github.com/kartiktripathi29-design/arthsaathi/pull/3

---

## A. One-time setup (you must do this — it needs your accounts)

### 1. Create / configure the Supabase project
- Create a project at supabase.com (or reuse the existing one).
- **Authentication → Providers → Email**: enable **Email OTP** (the 6-digit code). Turn **off**
  "Confirm email" if you want first-time codes to also create the account in one step.
- **Authentication → URL Configuration**: add your site URL(s) to the allow-list (local
  `http://localhost:3000` and your prod domain).

### 2. Set environment variables (`.env.local` for dev, host env for prod)
See `.env.example` for the full list. The ones that turn things on:
```
NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true"   # pooled (runtime)
DIRECT_DATABASE_URL="postgresql://...:5432/postgres"           # direct (migrations)
ARTHVO_DATA_ENC_KEY="<32 random bytes, base64>"                # cloud-sync encryption
NEXT_PUBLIC_CLOUD_SYNC="0"                                     # keep 0 until ready
```
Generate the encryption key:
```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Run the database migration
```
npx prisma migrate deploy      # prod — applies migration files only
# or locally first to verify the reconstructed schema is in sync:
npx prisma migrate dev         # should report "already in sync", create NO new migration
```

### 4. Turn cloud sync on (only after 1–3)
Set `NEXT_PUBLIC_CLOUD_SYNC="1"` and redeploy.

---

## B. What happens at each stage
| State | Auth | Cloud sync |
|---|---|---|
| No Supabase env | Mock (current behaviour); Proxy no-ops | Off (404) |
| Supabase env set, `CLOUD_SYNC=0` | **Real email OTP**; Proxy guards `/dashboard` | Off (404) |
| Supabase env set, `CLOUD_SYNC=1` + key + migration | Real email OTP | **On** — per-user encrypted sync |

---

## C. ⚠️ Before you point REAL users at it (launch gates)

1. **Production email/SMTP** — Supabase's built-in email is rate-limited and not for production.
   Configure a custom SMTP (Resend / SES / Postmark) under Authentication → Emails, or OTP codes
   won't reliably arrive. **Hard launch blocker.**
2. **Back up `ARTHVO_DATA_ENC_KEY`** in a secrets manager. Once real data is encrypted with it,
   losing it = losing all synced data. Document a rotation plan (re-encrypt migration).
3. **Use the pooled `DATABASE_URL`** (port 6543, `pgbouncer=true`) in production, not the direct
   connection, or you'll exhaust Postgres connections under load.
4. **Sync is last-write-wins** — concurrent edits on two devices can lose data, and the current
   `SyncProvider` reloads the page on remote updates and polls every 3s. Replace with event-driven
   writes + basic conflict handling before heavy multi-device use.
5. **The phone/PAN/Aadhaar signup flow (`/signup`) is still mock** — it "verifies" nothing. With
   real auth on, its fake session won't pass the Proxy, so users get bounced to `/login`. Decide:
   remove it, or wire it to a real KYC provider. (Login via email OTP both signs in and registers,
   so a separate signup isn't strictly required.)
6. **DPDP Act (India)** — storing PAN/Aadhaar (even masked + encrypted) requires consent, retention
   limits, breach reporting, and honoring deletion. Account deletion already cascades to `UserData`.

---

## D. How it's wired (for reviewers)
- `src/proxy.ts` + `src/lib/supabase/proxy.ts` — Next 16 Proxy; refreshes the Supabase session and
  coarse-guards `/dashboard`. No-ops without env.
- `src/app/login/page.tsx` — two-step email OTP (`signInWithOtp` → `verifyOtp`), mirrors the user
  into `AppStore`. Shows a notice when unconfigured.
- `src/lib/useUser.ts` — client hook for the current Supabase user.
- `src/app/dashboard/layout.tsx` — `AuthGate` trusts the real session when configured; sign-out
  clears the Supabase session before local state.
- `src/lib/auth.ts` `requireUser()` — the real authorization check used by API routes (Proxy is
  defense-in-depth only, per Next 16 docs).
