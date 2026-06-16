import type { ReactNode } from 'react'
import { tokens as T } from '@/lib/tokens'

// ArthVo Guide strip — a small, proactive, data-aware narration block shown at the top of the
// data-heavy flow pages. It reads the real figures the page already computed and tells the user, in
// plain English, what was found / what needs attention / where it goes. It is NOT the "Ask ArthVo"
// chat: there's no LLM, no fabricated numbers (every figure is real and every line is pre-written),
// and no advice — it narrates facts and points to the next screen. This keeps it inside the locked
// "clarity-not-advice / no fabricated numbers" principles while doing the orientation job the
// reactive chat structurally can't (the chat is deliberately number-blind).
//
// Tone → surface tokens (never raw hex; dark mode resolves via the same CSS vars):
//   calm      — neutral wheat. Optional / on-track / nothing to flag.
//   attention — amber caution. Something the user should look at (missing import, a mismatch).
//   good      — green slip. Confirmed / reconciled / complete.
export type GuideTone = 'calm' | 'attention' | 'good'

const TONE: Record<GuideTone, { fill: string; border: string; eb: string }> = {
  calm: { fill: T.sand, border: T.taupeLine, eb: T.muted },
  attention: { fill: T.caution.fill, border: T.caution.border, eb: T.caution.text },
  good: { fill: T.slip.fill, border: T.slip.border, eb: T.slip.text },
}

export function GuideStrip({ tone, lines }: { tone: GuideTone; lines: ReactNode[] }) {
  const s = TONE[tone]
  return (
    <div style={{ background: s.fill, border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.eb}`, borderRadius: 8, padding: '14px 16px', marginBottom: 24 }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: s.eb, margin: '0 0 6px' }}>ArthVo Guide</p>
      {lines.map((l, i) => (
        <p key={i} style={{ fontSize: 12.5, color: T.ink, margin: i ? '6px 0 0' : 0, lineHeight: 1.6 }}>{l}</p>
      ))}
    </div>
  )
}

export default GuideStrip
