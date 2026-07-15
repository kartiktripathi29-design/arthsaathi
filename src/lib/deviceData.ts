// BUG-1 — device-owner tagging so a new or different account never inherits the previous
// occupant's locally-stored tax data. Cloud sync is off, so tax data lives only in localStorage
// and is otherwise account-agnostic; this ties it to the last account that claimed the device.
//   signup                      → always clear (a new account starts empty)
//   login, owner set & differs  → clear (a different person is signing in on this device)
//   login, owner unset or same  → keep (returning user's own device; also rollout-safe)
// Then the device is claimed for the current account.
//
// Kept dependency-free (isAppKey inlined rather than imported from backupSync) so it runs under
// `node --test` like the other leaf libs. The namespaces mirror backupSync.isAppKey exactly.

// The two namespaces that hold all user-owned app state.
const isAppKey = (k: string) => k.startsWith('av_') || k.startsWith('as_')

// Non-`av_`/`as_` so it is never swept into a cloud snapshot nor cleared as app data
// (same convention as SyncProvider's `arthvo_cloud_synced_at`).
const OWNER_KEY = 'arthvo_data_owner'

// UI-only prefs (not financial data) — survive a wipe so theme / FY view don't reset.
const PRESERVE = new Set(['av_theme', 'av_selected_fy', 'av_selected_fy_mode'])

/** Remove every app-owned (`av_*`/`as_*`) localStorage key except the preserved UI prefs. */
export function clearTaxData(): void {
  if (typeof window === 'undefined') return
  const stale: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isAppKey(k) && !PRESERVE.has(k)) stale.push(k)
  }
  for (const k of stale) localStorage.removeItem(k)
}

/**
 * Reconcile this device's local data with the account that just authenticated.
 * @param identity stable per-account id — we use the account email
 * @param opts.isSignup true on a fresh signup (always start empty), false on login
 */
export function reconcileDeviceOwner(identity: string, opts: { isSignup: boolean }): void {
  if (typeof window === 'undefined' || !identity) return
  const prev = localStorage.getItem(OWNER_KEY)
  if (opts.isSignup || (prev && prev !== identity)) clearTaxData()
  localStorage.setItem(OWNER_KEY, identity)
}
