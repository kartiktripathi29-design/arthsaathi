// One-click unsubscribe. The (future) January email links here with the row's unguessable token.
// Looks the row up by token, sets unsubscribed = true (idempotent), and renders a plain confirmation.
// Built now, ships with capture — even though no email is sent yet.
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function applyUnsubscribe(token: string | undefined): Promise<'done' | 'invalid'> {
  if (!token || token.length < 16) return 'invalid'
  try {
    const r = await prisma.emailCapture.updateMany({ where: { unsubscribeToken: token }, data: { unsubscribed: true } })
    return r.count > 0 ? 'done' : 'invalid'
  } catch {
    return 'invalid'
  }
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const result = await applyUnsubscribe(token)

  const wrap: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, background: '#f7f6f2', fontFamily: '"Sora",-apple-system,sans-serif',
  }
  const card: React.CSSProperties = {
    maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #e5e3dc',
    borderRadius: 12, padding: '28px 26px', textAlign: 'center', color: '#1c2b22',
  }

  return (
    <div style={wrap}>
      <div style={card}>
        {result === 'done' ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>You&apos;re unsubscribed.</h1>
            <p style={{ fontSize: 13.5, color: '#5b665e', margin: 0, lineHeight: 1.6 }}>
              We won&apos;t send you the January reminder. No further action needed.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>This link isn&apos;t valid.</h1>
            <p style={{ fontSize: 13.5, color: '#5b665e', margin: 0, lineHeight: 1.6 }}>
              It may have already been used, or the link is incomplete. If you keep getting emails, reply
              to one and we&apos;ll remove you.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
