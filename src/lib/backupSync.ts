// Shared collector/applier for ArthVo's browser-only storage (BUG-8).
//
// All of a user's salary/exemptions/deductions/tax inputs live in localStorage under two app
// namespaces: `av_*` (the wizard) and `as_*` (AppStore). Both manual Backup & Restore
// (components/BackupRestore.tsx) and cloud sync (SyncProvider) need the exact same notion of
// "what counts as app data" and how to read/write it — so it lives here, once.

/** The two namespaces that hold all user-owned app state. */
export const isAppKey = (k: string) => k.startsWith('av_') || k.startsWith('as_')

/** A flat snapshot of every app-owned localStorage key → its raw string value. */
export type AppData = Record<string, string>

/** Read every `av_*`/`as_*` key out of localStorage. Returns {} when not in a browser. */
export function collectAppData(): AppData {
  const data: AppData = {}
  if (typeof window === 'undefined') return data
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isAppKey(k)) {
      const v = localStorage.getItem(k)
      if (v != null) data[k] = v
    }
  }
  return data
}

/**
 * Write an app-data snapshot back into localStorage.
 *
 * - By default this *merges* (each entry is set; unmentioned keys are left alone) — this matches the
 *   long-standing file-restore behaviour.
 * - With `{ replace: true }` it first removes every existing `av_*`/`as_*` key, so the snapshot
 *   becomes the whole truth. Cloud sync uses this so a newer remote state can drop keys deleted
 *   on another device (last-write-wins).
 *
 * Non-string / non-app entries are ignored. Returns the number of keys written.
 */
export function applyAppData(data: AppData, opts: { replace?: boolean } = {}): number {
  if (typeof window === 'undefined') return 0
  if (opts.replace) {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && isAppKey(k)) stale.push(k)
    }
    for (const k of stale) localStorage.removeItem(k)
  }
  let written = 0
  for (const [k, v] of Object.entries(data)) {
    if (isAppKey(k) && typeof v === 'string') {
      localStorage.setItem(k, v)
      written++
    }
  }
  return written
}

/** Version of the backup-file envelope this build writes. */
export const BACKUP_VERSION = 1

/** The on-disk backup-file shape (also what we send to / receive from the server, unencrypted). */
export interface BackupEnvelope {
  _arthvo_backup: 1
  version: number
  exportedAt: string
  data: AppData
}

/** Wrap a snapshot in the versioned backup envelope (for file download or transport). */
export function makeBackupEnvelope(data: AppData): BackupEnvelope {
  return { _arthvo_backup: 1, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

/**
 * Validate + extract the app-data map from a parsed backup envelope. Returns the filtered
 * `{ key: value }` map (only valid `av_*`/`as_*` string entries), or null if it isn't an ArthVo
 * backup. Used by both file-restore and the cloud-sync download path.
 */
export function readBackupEnvelope(parsed: unknown): AppData | null {
  if (!parsed || typeof parsed !== 'object') return null
  const env = parsed as Partial<BackupEnvelope>
  if (!env._arthvo_backup || !env.data || typeof env.data !== 'object') return null
  const out: AppData = {}
  for (const [k, v] of Object.entries(env.data)) {
    if (isAppKey(k) && typeof v === 'string') out[k] = v
  }
  return out
}
