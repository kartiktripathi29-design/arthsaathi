// Shared classifier: is a thrown error an Anthropic UPSTREAM outage (overloaded / rate-limited / 5xx /
// connection-dropped / timed-out) rather than a problem with the user's document?
//
// Why it matters: when the AI call fails, the parse routes must NOT tell a user with a perfectly clean
// slip that their document is unreadable — the honest, retryable message is "our reader is briefly
// overloaded, try again in a minute." This helper draws that line in ONE place so every route reports it
// the same way. (Step 3's launch counters also use it to split parse_fail_upstream from parse_fail_input,
// which is how we'll tell on the 15th whether a failure spike is our problem or Anthropic's.)
//
// Content problems (Claude replied but we couldn't extract JSON, empty/blurry doc, bad input) are NOT
// outages — those are plain Errors with no HTTP status and fall through to false, keeping their 422.

import { APIError, APIConnectionError } from '@anthropic-ai/sdk'

// Single source of truth for the user-facing copy, so every route says it identically.
export const UPSTREAM_BUSY_MESSAGE =
  'Our document reader is briefly overloaded. Please try again in a minute.'

export function isAnthropicOutage(err: unknown): boolean {
  // Connection failures and timeouts carry no HTTP status — always transient/retryable.
  // (APIConnectionTimeoutError extends APIConnectionError, so this covers timeouts too.)
  if (err instanceof APIConnectionError) return true
  if (err instanceof APIError) {
    const s = typeof err.status === 'number' ? err.status : 0
    // 429 rate-limit, 529 overloaded, any 5xx server error, or a statusless API error = upstream.
    // A 4xx other than 429 (e.g. 400 bad request) is OUR request's problem, not an outage.
    return s === 429 || s === 529 || (s >= 500 && s <= 599) || s === 0
  }
  // Defensive fallback for errors that lost their prototype (rewrapped/serialized upstream): match by
  // shape. Keep this narrow so genuine content errors (e.g. "Could not extract JSON…") stay false.
  const e = err as { status?: unknown; name?: unknown; message?: unknown }
  const s = typeof e?.status === 'number' ? e.status : 0
  if (s === 429 || s === 529 || (s >= 500 && s <= 599)) return true
  const text = `${String(e?.name ?? '')} ${String(e?.message ?? '')}`
  return /\boverloaded\b|rate.?limit|\btimeout\b|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|Connection error/i.test(text)
}
