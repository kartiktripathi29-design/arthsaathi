'use client'
// Phase-1 email capture, shown AFTER the /try provisional verdict (never gates it). Retention
// infrastructure, not a newsletter. Fully self-contained: every network call is fire-and-forget and
// error-swallowed, and nothing here can throw during render — so the verdict above always stands.

import { useEffect, useRef, useState } from 'react'
import { tokens as T } from '@/lib/tokens'
import { computeQuickVerdict } from '@/lib/quick-verdict'
import { useSelectedFY } from '@/lib/useSelectedFY'
import { isValidEmail, submitCapture } from '@/lib/email-capture'

function fireEvent(event: 'capture_shown' | 'capture_submitted' | 'capture_dismissed') {
  try {
    void fetch('/api/analytics/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }),
    }).catch(() => {})
  } catch { /* never surface */ }
}

export default function EmailCapture() {
  const selFY = useSelectedFY()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'invalid' | 'failed'>('idle')
  const [dismissed, setDismissed] = useState(false)
  const shownFired = useRef(false)

  useEffect(() => {
    if (shownFired.current) return
    shownFired.current = true
    fireEvent('capture_shown')
  }, [])

  if (dismissed) return null

  const onSubmit = async () => {
    try {
      if (!isValidEmail(email)) { setStatus('invalid'); return }
      setStatus('submitting')
      // Capture the could-have-saved figure + FY shown at this moment (resolver + pure verdict read —
      // no verdict logic touched). verdictAmount is nullable only if genuinely uncomputable.
      let verdictAmount: number | null = null
      try { const v = computeQuickVerdict(); verdictAmount = Number.isFinite(v?.savings) ? v.savings : null } catch { verdictAmount = null }
      const verdictFY = selFY?.fy
      if (!Number.isInteger(verdictFY)) { setStatus('failed'); return }
      const res = await submitCapture(fetch, { email: email.trim(), verdictFY: verdictFY as number, verdictAmount })
      if (res.ok) { setStatus('done'); fireEvent('capture_submitted') }
      else { setStatus(res.status === 400 ? 'invalid' : 'failed') } // 400 = bad email; else a save failure
    } catch {
      setStatus('failed') // a capture failure must never break the page
    }
  }

  const card: React.CSSProperties = {
    maxWidth: 760, margin: '20px auto 0', background: T.card, border: `1px solid ${T.hairline}`,
    borderRadius: 12, padding: '18px 20px',
  }

  if (status === 'done') {
    return (
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>You&apos;re on the list.</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>We&apos;ll send one reminder in January. Nothing else.</div>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em' }}>This year is decided. Next year isn&apos;t.</div>
        <button type="button" onClick={() => { setDismissed(true); fireEvent('capture_dismissed') }}
          style={{ background: 'transparent', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, padding: 0 }}>
          Not now
        </button>
      </div>
      <div style={{ fontSize: 13, color: T.muted, margin: '6px 0 14px', lineHeight: 1.5 }}>
        One email in January — the month you can still change your tax. Nothing else.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flex: 1, minWidth: 200, border: `1.5px solid ${status === 'invalid' ? T.marigold : T.hairline}`, borderRadius: 10, overflow: 'hidden', background: T.card }}>
          <input type="email" inputMode="email" value={email} autoComplete="email"
            onChange={e => { setEmail(e.target.value); if (status === 'invalid' || status === 'failed') setStatus('idle') }}
            onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
            placeholder="you@email.com"
            style={{ flex: 1, width: '100%', padding: '11px 12px', border: 'none', outline: 'none', fontSize: 14, fontFamily: '"Sora",sans-serif', background: 'transparent', color: T.ink }} />
        </div>
        <button type="button" onClick={onSubmit} disabled={status === 'submitting'}
          style={{ padding: '11px 18px', background: T.teal, color: T.onTeal, borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: status === 'submitting' ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: status === 'submitting' ? 0.7 : 1 }}>
          Remind me in January
        </button>
      </div>
      {status === 'invalid' && (
        <div style={{ fontSize: 11.5, color: T.marigold, marginTop: 8 }}>Please enter a valid email and try again.</div>
      )}
      {status === 'failed' && (
        <div style={{ fontSize: 11.5, color: T.marigold, marginTop: 8 }}>Couldn’t save that just now — please try again in a moment.</div>
      )}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>
        One reminder email. Unsubscribe with one click. No marketing.
      </div>
    </div>
  )
}
