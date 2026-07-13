// Canonical site origin for building auth redirect URLs (email confirm / magic link / password reset).
//
// Read from NEXT_PUBLIC_SITE_URL so each environment uses its OWN origin — local → localhost, preview →
// the preview URL, prod → https://www.arthvo.com. The auth calls pass this explicitly as emailRedirectTo
// instead of letting Supabase fall back to its dashboard "Site URL" default. That default is exactly how
// `http://localhost:3000` leaked into production confirmation emails (dead link on real devices): the app
// passed no redirect, so Supabase used whatever the dashboard was last set to. Driving it from env makes
// that class of bug impossible to recur across environments.
//
// Fallbacks: the running origin in the browser (correct for whatever host served the page), then the prod
// domain on the server if the env var is somehow unset — never localhost.
export function getSiteURL(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return 'https://www.arthvo.com'
}
