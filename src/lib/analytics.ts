import { prisma } from '@/lib/db'

// The event keys /api/health reports on. Client funnel events (try_visit, verdict_rendered, capture_ok,
// capture_fail) arrive via /api/analytics/capture; the parse_* events are recorded server-side in the
// parse route — the only place that authoritatively knows an UPSTREAM outage from a bad-document input,
// which is the split that tells us on the 15th whether a failure spike is ours or Anthropic's.
export const ANALYTICS_KEYS = [
  'try_visit',
  'verdict_rendered',
  'capture_ok',
  'capture_fail',
  'parse_ok',
  'parse_fail_upstream',
  'parse_fail_input',
] as const
export type AnalyticsKey = (typeof ANALYTICS_KEYS)[number]

// Record one timestamped event. NEVER throws — analytics must not affect UX or a route's result. Returns
// the promise so a serverless route about to return can `await` the tiny indexed insert (fire-and-forget
// without awaiting risks the function freezing before the write flushes); callers that don't care ignore it.
export async function recordEvent(key: AnalyticsKey): Promise<void> {
  try {
    await prisma.analyticsEvent.create({ data: { key } })
  } catch {
    /* best-effort — a lost analytics row must never surface to the user */
  }
}
