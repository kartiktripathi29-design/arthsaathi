import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ANALYTICS_KEYS, recordEvent, type AnalyticsKey } from '@/lib/analytics'

// Minimal server-side counter for the /try funnel — no third-party analytics is wired. Keeps the
// cumulative AnalyticsCounter (one row per key) AND, for the keys /api/health reports on, a timestamped
// AnalyticsEvent row so last-hour counts are possible. Fire-and-forget: never blocks or errors the client.
export const runtime = 'nodejs'

// The original funnel events plus the health-reported client events (parse_* are recorded server-side).
const ALLOWED = new Set<string>([
  'capture_shown', 'capture_submitted', 'capture_dismissed',
  'try_visit', 'verdict_rendered', 'capture_ok', 'capture_fail',
])
const HEALTH_KEYS = new Set<string>(ANALYTICS_KEYS)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))
  const key = String(body?.event ?? '')
  if (!ALLOWED.has(key)) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await prisma.analyticsCounter.upsert({
      where: { key },
      create: { key, count: 1 },
      update: { count: { increment: 1 } },
    })
  } catch { /* counters are best-effort — never surface to the user */ }
  // Timestamped copy for the health endpoint's last-hour view (only the keys it reports on).
  if (HEALTH_KEYS.has(key)) await recordEvent(key as AnalyticsKey)
  return NextResponse.json({ ok: true })
}
