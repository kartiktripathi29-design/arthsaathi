import { tokens as T } from '@/lib/tokens'

// Single source for the data-handling assurance shown adjacent to every upload/signup CTA
// (brief Change 3). ONLY the founder-cleared claim prints here — "read automatically by AI, never
// seen by a human". The "never sold" claim and the retention policy (deleted vs stored-encrypted)
// are NOT yet confirmed and are deliberately absent; when the founder clears them, update this ONE
// place. Used on the landing hero, the public /try entry, and the dashboard Documents upload.
export const DATA_ASSURANCE = 'Read automatically by AI — no human ever sees your slip.'

export default function DataAssurance({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, display: 'flex', gap: 6, ...style }}>
      <span style={{ color: T.green, fontWeight: 700 }} aria-hidden>✓</span>
      <span>{DATA_ASSURANCE}</span>
    </div>
  )
}
