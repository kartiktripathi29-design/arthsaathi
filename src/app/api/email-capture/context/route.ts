import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCaptureContext, checkRateLimit, type ContextStore, type RateStore } from '@/lib/email-capture'

export const runtime = 'nodejs'

// Same best-effort in-memory rate limit as the capture route (5/min/IP; per-instance on serverless).
const rateMap = new Map<string, number[]>()
const rateStore: RateStore = { get: k => rateMap.get(k), set: (k, v) => rateMap.set(k, v) }

// The ?r= token grants read of exactly TWO numbers — verdictFY and verdictAmount — for a
// non-unsubscribed capture, and NOTHING else (never the email address or any other field). `select`
// enforces that at the query. Used by /try to rehydrate a returning user's prior verdict cross-device.
const store: ContextStore = {
  async contextByToken(token) {
    const row = await prisma.emailCapture.findFirst({
      where: { unsubscribeToken: token, unsubscribed: false },
      select: { verdictFY: true, verdictAmount: true },
    })
    return row ? { verdictFY: row.verdictFY, verdictAmount: row.verdictAmount } : null
  },
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(rateStore, ip, Date.now(), 60_000, 5)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const ctx = await getCaptureContext(store, req.nextUrl.searchParams.get('r'))
  if (!ctx) return new NextResponse(null, { status: 404 }) // unknown / unsubscribed → 404, no info leak
  return NextResponse.json(ctx) // ONLY { verdictFY, verdictAmount }
}
