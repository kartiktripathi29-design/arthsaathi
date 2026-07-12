import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Minimal server-side counter for the /try email-capture funnel — no third-party analytics is wired.
// One row per event key in AnalyticsCounter. Fire-and-forget: never blocks or errors the client.
export const runtime = 'nodejs'

const ALLOWED = new Set(['capture_shown', 'capture_submitted', 'capture_dismissed'])

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
  return NextResponse.json({ ok: true })
}
