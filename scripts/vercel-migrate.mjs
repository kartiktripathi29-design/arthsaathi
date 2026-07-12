// Apply pending DB migrations during the build — PRODUCTION Vercel builds only.
//
// Wired into `build` (package.json) so a production deploy runs `prisma migrate deploy` before
// `next build`, instead of migrations needing a manual run (the gap that caused the wrong-project /
// missing-table incident). Guarded on VERCEL_ENV so preview and local builds are untouched — their
// migrations are applied out of band. Fatal by design: if a production migration fails, the deploy
// fails rather than shipping code against a schema that isn't there.
//
// Requires the production build env to reach the DB via DIRECT_DATABASE_URL (falls back to
// DATABASE_URL). If a prod build ever fails here on connectivity, point migrations at the Supabase
// session pooler (IPv4) or move this to a deploy hook.
import { execSync } from 'node:child_process'

if (process.env.VERCEL_ENV === 'production') {
  console.log('[build] VERCEL_ENV=production -> prisma migrate deploy')
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
} else {
  console.log(`[build] skipping migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV || 'unset'})`)
}
