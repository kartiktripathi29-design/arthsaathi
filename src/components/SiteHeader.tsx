'use client'
// Public site header (logged-out pages). Links come from src/lib/site-config.ts. `actions` holds a
// page's own controls, such as the theme toggle: beside the links on desktop, in the ☰ menu on phones.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import SocialLinks from '@/components/SocialLinks'
import { headerLinks, siteConfig } from '@/lib/site-config'
import { tokens as T } from '@/lib/tokens'

export default function SiteHeader({ actions }: { actions?: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)
  const navLink: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: T.ink, textDecoration: 'none', whiteSpace: 'nowrap' }
  const signIn: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: T.muted, textDecoration: 'none', whiteSpace: 'nowrap' }

  return (
    <header style={{ background: T.paper, borderBottom: `1px solid ${T.hairline}`, fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <style>{`
        .sh-row { display: flex; align-items: center; gap: 24px; max-width: 1080px; margin: 0 auto; padding: 16px 28px; }
        .sh-links { display: flex; align-items: center; gap: 22px; flex: 1; min-width: 0; }
        .sh-right { display: flex; align-items: center; gap: 16px; margin-left: auto; flex-shrink: 0; }
        .sh-wide { display: inline-flex; align-items: center; }
        .sh-toggle, .sh-menu { display: none; }
        @media (max-width: 760px) {
          .sh-row { gap: 12px; padding: 12px 16px; }
          .sh-links, .sh-wide { display: none; }
          .sh-right { gap: 10px; }
          .sh-toggle { display: inline-flex; }
          .sh-menu.sh-open { display: flex; flex-direction: column; gap: 14px; padding: 6px 16px 18px; }
        }
      `}</style>
      <div className="sh-row">
        <Link href="/" aria-label={`${siteConfig.companyName} home`} onClick={close} style={{ display: 'flex', textDecoration: 'none', flexShrink: 0 }}>
          <Logo variant="onLight" size={30} />
        </Link>
        <nav className="sh-links" aria-label="Main">
          {headerLinks.map(l => <Link key={l.label} href={l.href} style={navLink}>{l.label}</Link>)}
        </nav>
        <div className="sh-right">
          {actions && <span className="sh-wide">{actions}</span>}
          <Link href="/try" onClick={close} style={{ padding: '9px 16px', background: T.teal, color: T.onTeal, borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Try free →</Link>
          <span className="sh-wide"><Link href={siteConfig.signIn} style={signIn}>Sign in</Link></span>
          <button
            type="button" className="sh-toggle" aria-expanded={open} aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(o => !o)}
            style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, color: T.teal, background: 'none', border: `1px solid ${T.hairline}`, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}
          >{open ? '✕' : '☰'}</button>
        </div>
      </div>
      <nav id="site-menu" className={open ? 'sh-menu sh-open' : 'sh-menu'} aria-label="Menu">
        {headerLinks.map(l => <Link key={l.label} href={l.href} onClick={close} style={{ ...navLink, fontSize: 14 }}>{l.label}</Link>)}
        <Link href={siteConfig.signIn} onClick={close} style={{ ...signIn, fontSize: 14 }}>Sign in</Link>
        {actions && <div>{actions}</div>}
        <SocialLinks />
      </nav>
    </header>
  )
}
