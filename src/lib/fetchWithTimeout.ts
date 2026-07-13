// Client-safe fetch wrapper that bounds how long a request can hang and can reassure the user while a
// slow-but-alive request is still in flight. Motivation: the document parse fetches had NO timeout, so a
// stalled/overloaded upstream left the "Parsing…" spinner up indefinitely — a dead spinner to the user.
//
// - timeoutMs:   abort the request after this long (default 45s; the server caps at 60s, so we give up a
//                little earlier and tell the user honestly rather than letting the socket hang).
// - slowAfterMs: if the request is still running after this, call onSlow() once (e.g. swap the spinner
//                label to "Still working — large or slow file…") so a slow request reassures, not alarms.
//
// On timeout it throws RequestTimeoutError so the caller can show an honest, retryable message instead of
// a generic failure. Any other fetch rejection (network drop, etc.) propagates unchanged.

export class RequestTimeoutError extends Error {
  constructor(message = 'That took too long — please try again') {
    super(message)
    this.name = 'RequestTimeoutError'
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { timeoutMs?: number; slowAfterMs?: number; onSlow?: () => void } = {},
): Promise<Response> {
  const { timeoutMs = 45_000, slowAfterMs, onSlow } = opts
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const slowId = slowAfterMs != null && onSlow ? setTimeout(onSlow, slowAfterMs) : undefined
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (e: unknown) {
    // A timeout surfaces as the AbortController firing → an AbortError. Translate it into a clear,
    // caller-distinguishable timeout so the UI can say "that took too long" and not "your file is bad".
    if (e instanceof Error && e.name === 'AbortError') throw new RequestTimeoutError()
    throw e
  } finally {
    clearTimeout(timeoutId)
    if (slowId != null) clearTimeout(slowId)
  }
}
