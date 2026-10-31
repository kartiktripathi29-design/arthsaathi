import { siteConfig, type SocialKey } from '@/lib/site-config'
import { tokens as T } from '@/lib/tokens'

const SOCIALS: { key: SocialKey; label: string; path: string }[] = [
  { key: 'linkedin', label: 'LinkedIn', path: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z' },
  { key: 'instagram', label: 'Instagram', path: 'M12 2.2c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92C8.42 2.17 8.8 2.16 12 2.16zm0 4.72a5.08 5.08 0 1 0 0 10.16 5.08 5.08 0 0 0 0-10.16zm0 8.38a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6zm5.28-9.78a1.19 1.19 0 1 0 0 2.38 1.19 1.19 0 0 0 0-2.38z' },
  { key: 'x', label: 'X', path: 'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24H16.17l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25H8.08l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z' },
  { key: 'youtube', label: 'YouTube', path: 'M23.5 6.2a3 3 0 0 0-2.12-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.13c1.88.52 9.38.52 9.38.52s7.5 0 9.38-.52a3 3 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z' },
]

export default function SocialLinks({ style }: { style?: React.CSSProperties }) {
  const items = SOCIALS.filter(s => siteConfig.social[s.key])
  if (!items.length) return null
  return (
    <div style={{ display: 'flex', gap: 14, ...style }}>
      {items.map(s => (
        <a key={s.key} href={siteConfig.social[s.key]} target="_blank" rel="noopener noreferrer" aria-label={`${siteConfig.companyName} on ${s.label}`} style={{ color: T.teal, display: 'inline-flex', padding: 2 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={s.path} /></svg>
        </a>
      ))}
    </div>
  )
}
