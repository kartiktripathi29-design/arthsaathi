import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkRateLimit, isValidEmail, type RateStore } from '@/lib/email-capture'

// The pg adapter needs the Node runtime; never cache — always reflect the live auth table.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Best-effort in-memory IP rate limit (same limiter the capture route uses). 30/min/IP: enough for a
// real user retrying, tight enough that this can't be used to bulk-probe which emails are registered.
// Per-instance on serverless (resets on cold start) — throttles casual abuse, not a determined
// attacker; a hard cap would need a shared store.
const rateMap = new Map<string, number[]>()
const rateStore: RateStore = { get: (k) => rateMap.get(k), set: (k, v) => rateMap.set(k, v) }

// BUG-2: deterministic server-side existence check, called by /signup BEFORE any OTP is sent or
// password is set. Reads Supabase's `auth.users` over the existing DATABASE_URL connection — this is
// reliable regardless of the project's signUp enumeration-protection behaviour, which the client
// response is NOT. Returns ONLY { exists: boolean } — never any user field, so it leaks nothing beyond
// the yes/no the signup form already needs. No service_role key is used or introduced.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(rateStore, ip, Date.now(), 60_000, 30)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({} as any))
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email) = lower(${email})) AS "exists"
    `
    return NextResponse.json({ exists: rows[0]?.exists === true })
  } catch (e) {
    // Fail-closed at the caller: report an error so signup STOPS rather than risk the overwrite path.
    console.error('[email-exists] auth.users query failed:', e)
    return NextResponse.json({ error: 'check_failed' }, { status: 503 })
  }
}
