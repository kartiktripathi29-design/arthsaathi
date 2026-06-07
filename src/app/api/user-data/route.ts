// BUG-8 cloud persistence — per-user sync store (privacy model B+).
//
// GET  → return this user's decrypted snapshot + server updatedAt (last-write-wins clock).
// PUT  → encrypt + upsert this user's snapshot.
//
// The server is ONLY a sync store: it never runs tax logic, it just holds an encrypted JSON blob of
// the user's `av_*`/`as_*` localStorage keys. Gated behind NEXT_PUBLIC_CLOUD_SYNC so it is inert
// until real auth + the UserData migration are in place (see docs/arthvo-bug8-cloud-persistence-plan.md).

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, UnauthorizedError } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encryptString, decryptString, isCryptoConfigured } from '@/lib/crypto'

// node:crypto + the pg adapter need the Node runtime (not edge).
export const runtime = 'nodejs'

const syncEnabled = () => process.env.NEXT_PUBLIC_CLOUD_SYNC === '1'

/** A snapshot is a flat map of localStorage key → string value. */
type Snapshot = Record<string, string>

function isSnapshot(v: unknown): v is Snapshot {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === 'string')
}

export async function GET() {
  if (!syncEnabled()) return NextResponse.json({ error: 'Cloud sync is disabled.' }, { status: 404 })
  if (!isCryptoConfigured()) return NextResponse.json({ error: 'Server encryption key not configured.' }, { status: 503 })
  try {
    const user = await requireUser()
    const row = await prisma.userData.findUnique({ where: { userId: user.id } })
    if (!row) return NextResponse.json({ snapshot: null, updatedAt: null })
    let snapshot: Snapshot
    try {
      snapshot = JSON.parse(decryptString(row.blob)) as Snapshot
    } catch (e) {
      console.error('[user-data] decrypt/parse failed:', e)
      return NextResponse.json({ error: 'Stored data could not be decrypted.' }, { status: 500 })
    }
    return NextResponse.json({ snapshot, updatedAt: row.updatedAt.toISOString() })
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    console.error('[user-data] GET error:', e)
    return NextResponse.json({ error: 'Failed to load data.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!syncEnabled()) return NextResponse.json({ error: 'Cloud sync is disabled.' }, { status: 404 })
  if (!isCryptoConfigured()) return NextResponse.json({ error: 'Server encryption key not configured.' }, { status: 503 })
  try {
    const user = await requireUser()
    const body = await req.json().catch(() => null)
    const snapshot = (body as { snapshot?: unknown } | null)?.snapshot
    if (!isSnapshot(snapshot)) {
      return NextResponse.json({ error: 'Body must be { snapshot: { [key]: string } }.' }, { status: 400 })
    }
    const blob = encryptString(JSON.stringify(snapshot))
    const row = await prisma.userData.upsert({
      where: { userId: user.id },
      update: { blob },
      create: { userId: user.id, blob },
    })
    return NextResponse.json({ updatedAt: row.updatedAt.toISOString() })
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    console.error('[user-data] PUT error:', e)
    return NextResponse.json({ error: 'Failed to save data.' }, { status: 500 })
  }
}
