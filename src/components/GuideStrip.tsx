'use client'
import { useState, type ReactNode } from 'react'
import { tokens as T } from '@/lib/tokens'

// ArthVo Guide strip — a quiet, data-aware one-liner at the top of the data-heavy flow pages. It
// reads the real figures the page already computed and says, in ONE short line, what was found /
// what needs attention / where it goes. Any extra detail is hidden behind a "More" tap so nobody
// gets a paragraph they didn't ask for (progressive disclosure).
//
// Not the "Ask ArthVo" chat: no LLM, no fabricated numbers (every figure is real, every line
// pre-written), no advice — it narrates facts and points to the next screen.
//
// Tone → surface tokens (never raw hex; dark mode resolves via the same CSS vars):
//   calm — neutral wheat · attention — amber caution · good — green slip.
export type GuideTone = 'calm' | 'attention' | 'good'

const TONE: Record<GuideTone, { fill: string; border: string; accent: string }> = {
  calm: { fill: T.sand, border: T.taupeLine, accent: T.muted },
  attention: { fill: T.caution.fill, border: T.caution.border, accent: T.caution.text },
  good: { fill: T.slip.fill, border: T.slip.border, accent: T.slip.text },
}

// `lines[0]` is the always-visible summary; lines[1..] (if any) are detail revealed on tap.
export function GuideStrip({ tone, lines }: { tone: GuideTone; lines: ReactNode[] }) {
  const [open, setOpen] = useState(false)
  const s = TONE[tone]
  const [head, ...rest] = lines
  const hasDetail = rest.length > 0
  return (
    <div style={{ background: s.fill, border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.accent}`, borderRadius: 8, padding: '10px 14px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <p style={{ flex: 1, fontSize: 12.5, color: T.ink, margin: 0, lineHeight: 1.55 }}>{head}</p>
        {hasDetail && (
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-label={open ? 'Hide details' : 'More info'}
            title={open ? 'Hide details' : 'More info'}
            style={{
              flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
              background: open ? s.accent : 'transparent', color: open ? s.fill : s.accent,
              border: `1px solid ${s.accent}`, padding: 0, cursor: 'pointer',
              fontFamily: 'Georgia, serif', fontSize: 12, fontStyle: 'italic', fontWeight: 700,
              lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            i
          </button>
        )}
      </div>
      {open && rest.map((l, i) => (
        <p key={i} style={{ fontSize: 12, color: T.ink, margin: '8px 0 0', lineHeight: 1.55 }}>{l}</p>
      ))}
    </div>
  )
}

export default GuideStrip
