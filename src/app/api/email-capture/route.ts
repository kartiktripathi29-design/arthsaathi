import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { captureEmail, checkRateLimit, type CaptureStore, type RateStore } from '@/lib/email-capture'

// node:crypto + the pg adapter need the Node runtime.
export const runtime = 'nodejs'

// Best-effort in-memory rate limiter: 40 submits / minute / IP. Sized to clear a launch-day burst of
// real users sharing ONE public IP (office NAT / shared Wi-Fi) — where a whole team hits /try in the
// same minute behind a single x-forwarded-for — while still throttling casual single-IP flooding.
// Capture is one idempotent upsert; no legitimate network emits 40 distinct captures/min. NOTE: on
// serverless this is PER-INSTANCE and resets on cold start — it throttles casual abuse, not a
// determined attacker. A hard limit would need a shared store (Redis / a DB counter), not wired here.
const rateMap = new Map<string, number[]>()
const rateStore: RateStore = { get: k => rateMap.get(k), set: (k, v) => rateMap.set(k, v) }

const store: CaptureStore = {
  async upsert(i) {
    await prisma.emailCapture.upsert({
      where: { email: i.email },
      // Token + consent set only on CREATE — re-capture updates the verdict data but never rotates the
      // unsubscribe token or un-does an unsubscribe.
      create: {
        email: i.email, source: i.source, verdictFY: i.verdictFY, verdictAmount: i.verdictAmount,
        unsubscribeToken: randomBytes(24).toString('base64url'),
      },
      update: { verdictFY: i.verdictFY, verdictAmount: i.verdictAmount, capturedAt: new Date() },
    })
  },
  async markUnsubscribed(token) {
    const r = await prisma.emailCapture.updateMany({ where: { unsubscribeToken: token }, data: { unsubscribed: true } })
    return r.count > 0
  },
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(rateStore, ip, Date.now(), 60_000, 40)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({} as any))
  const res = await captureEmail(store, {
    email: body?.email,
    verdictFY: Number(body?.verdictFY),
    verdictAmount: body?.verdictAmount == null ? null : Number(body.verdictAmount),
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  // 200 for both new and duplicate — no subscriber enumeration.
  return NextResponse.json({ ok: true })
}
