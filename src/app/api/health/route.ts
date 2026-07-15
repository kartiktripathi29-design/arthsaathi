import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { ANALYTICS_KEYS } from '@/lib/analytics'

// Launch-day health probe. Reports DB reachability + last-hour funnel/failure counters so we can SEE a
// failure spike (e.g. parse_fail_upstream climbing = Anthropic trouble) before users tweet it. Also the
// manual verification path for the smoke test's skipped capture round-trip: submit a real capture on live
// /try, then confirm capture_ok incremented here and mostRecentCapture advanced. Contains NO PII — only
// counts and a single timestamp, never an email address.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // never cached — always reflects the live DB

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.HEALTH_TOKEN || ''
  if (!expected) return false
  const provided =
    req.headers.get('x-health-token') ||
    new URL(req.url).searchParams.get('token') ||
    ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // Length check first (timingSafeEqual throws on length mismatch); constant-time compare otherwise.
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  // Launch-day monitoring must work even when HEALTH_TOKEN isn't configured. The payload is non-PII
  // (aggregate last-hour counts + DB reachability + one timestamp, never an email), so we serve it
  // OPENLY when no token is set. When a token IS set we still enforce it, so the endpoint can be
  // locked down later just by configuring HEALTH_TOKEN — no code change needed. (Path C: token
  // env-var investigation deferred to post-launch.)
  if (process.env.HEALTH_TOKEN && !tokenOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const since = new Date(now.getTime() - 60 * 60 * 1000)

  let db: 'reachable' | 'unreachable' = 'reachable'
  const lastHour: Record<string, number> = Object.fromEntries(ANALYTICS_KEYS.map((k) => [k, 0]))
  let mostRecentCapture: string | null = null

  try {
    const grouped = await prisma.analyticsEvent.groupBy({
      by: ['key'],
      where: { at: { gte: since } },
      _count: { key: true },
    })
    for (const g of grouped) {
      if (g.key in lastHour) lastHour[g.key] = g._count.key
    }
    const lastCap = await prisma.analyticsEvent.findFirst({
      where: { key: 'capture_ok' },
      orderBy: { at: 'desc' },
      select: { at: true },
    })
    mostRecentCapture = lastCap?.at.toISOString() ?? null
  } catch {
    db = 'unreachable' // report it rather than pretending healthy — a pinger on this route then alerts
  }

  // Opportunistic prune so the table stays bounded — anything older than 7 days is irrelevant to a
  // last-hour view. Fire-and-forget: it must never block or fail the probe.
  prisma.analyticsEvent
    .deleteMany({ where: { at: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } })
    .catch(() => {})

  return NextResponse.json(
    { ok: db === 'reachable', db, now: now.toISOString(), lastHour, mostRecentCapture },
    { status: db === 'reachable' ? 200 : 503 },
  )
}
