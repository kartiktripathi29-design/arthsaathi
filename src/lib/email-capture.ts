// Pure, browser-safe helpers for the /try email capture. NO node-only imports (the /try component
// imports isValidEmail + submitCapture), so token generation stays in the server route. The DB-touching
// bits go through the CaptureStore interface — the route backs it with Prisma, tests inject a fake.

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

// Deliberately simple, permissive-but-safe server-side format check (not a deliverability check).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(raw: unknown): boolean {
  const e = normalizeEmail(raw)
  return e.length >= 3 && e.length <= 254 && EMAIL_RE.test(e)
}

// ── Rate limiter — pure over an injectable store (best-effort; see the route for the serverless caveat)
export interface RateStore {
  get(key: string): number[] | undefined
  set(key: string, hits: number[]): void
}
export function checkRateLimit(store: RateStore, key: string, now: number, windowMs: number, max: number): boolean {
  const hits = (store.get(key) ?? []).filter(t => now - t < windowMs)
  if (hits.length >= max) { store.set(key, hits); return false }
  hits.push(now)
  store.set(key, hits)
  return true
}

// ── Capture core — validate, then upsert idempotently. Caller returns 200 for both new & duplicate
//    (no account/subscriber enumeration). The store generates the unsubscribe token on CREATE only, so
//    re-capture never rotates a token or resurrects an unsubscribe.
export interface CaptureStore {
  upsert(input: { email: string; source: string; verdictFY: number; verdictAmount: number | null }): Promise<void>
  markUnsubscribed(token: string): Promise<boolean>
}

export interface CaptureInput {
  email: string
  verdictFY: number
  verdictAmount: number | null
  source?: string
}
export type CaptureResult = { ok: true } | { ok: false; error: 'invalid_email' | 'invalid_verdict' }

export async function captureEmail(store: CaptureStore, input: CaptureInput): Promise<CaptureResult> {
  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_email' }
  if (!Number.isInteger(input.verdictFY)) return { ok: false, error: 'invalid_verdict' }
  const verdictAmount = Number.isFinite(input.verdictAmount as number) ? Math.round(input.verdictAmount as number) : null
  await store.upsert({ email, source: input.source || 'try-verdict', verdictFY: input.verdictFY, verdictAmount })
  return { ok: true }
}

export async function unsubscribeByToken(store: CaptureStore, token: unknown): Promise<boolean> {
  const t = String(token ?? '')
  if (t.length < 16) return false // unguessable tokens are long; reject obviously-bad input
  return store.markUnsubscribed(t)
}

// ── Client submit that NEVER throws — a capture failure must not break the /try verdict.
export async function submitCapture(
  fetchImpl: typeof fetch,
  payload: { email: string; verdictFY: number; verdictAmount: number | null },
): Promise<{ ok: boolean; status: number }> {
  try {
    const r = await fetchImpl('/api/email-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: r.ok, status: r.status }
  } catch {
    return { ok: false, status: 0 }
  }
}
