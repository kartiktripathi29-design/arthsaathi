// Public site footer (logged-out pages). All details come from src/lib/site-config.ts; empty values
// and empty columns are hidden.

import Link from 'next/link'
import Logo from '@/components/Logo'
import SocialLinks from '@/components/SocialLinks'
import { footerColumns, siteConfig } from '@/lib/site-config'
import { tokens as T } from '@/lib/tokens'

export default function SiteFooter() {
  const { companyName, tagline, cin, email, dataNote, madeIn } = siteConfig
  const heading: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }
  const small: React.CSSProperties = { fontSize: 11.5, color: T.muted, lineHeight: 1.6, margin: 0 }

  return (
    <footer style={{ background: T.card, borderTop: `1px solid ${T.hairline}`, fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <style>{`
        .sf-grid { display: grid; grid-template-columns: 1.6fr repeat(${footerColumns.length}, 1fr); gap: 32px; }
        .sf-bottom { display: flex; justify-content: space-between; gap: 8px 32px; flex-wrap: wrap; }
        @media (max-width: 760px) {
          .sf-grid { grid-template-columns: 1fr; gap: 26px; }
        }
      `}</style>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 28px 24px' }}>
        <div className="sf-grid">
          <div>
            <Logo variant="onLight" size={28} />
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, margin: '12px 0 14px' }}>{tagline}</p>
            <SocialLinks />
          </div>
          {footerColumns.map(column => (
            <nav key={column.title} aria-label={column.title}>
              <p style={heading}>{column.title}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {column.links.map(l => <Link key={l.label} href={l.href} style={{ fontSize: 13, color: T.ink, textDecoration: 'none' }}>{l.label}</Link>)}
              </div>
            </nav>
          ))}
        </div>
        <div className="sf-bottom" style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${T.hairline}` }}>
          <p style={{ ...small, flex: '1 1 320px', maxWidth: 640 }}>{dataNote}</p>
          <p style={small}>
            {madeIn && `${madeIn} · `}© {new Date().getFullYear()} {companyName}
            {cin && ` · CIN ${cin}`}
            {email && <> · <a href={`mailto:${email}`} style={{ color: 'inherit' }}>{email}</a></>}
          </p>
        </div>
      </div>
    </footer>
  )
}
