'use client'
import { useState, useEffect, useRef } from 'react'
import { tokens as T } from '@/lib/tokens'

export type ThemeMode = 'system' | 'light' | 'dark'

// Shared theme state — reads/writes the same `av_theme` key the landing and dashboard use, so a
// choice made on any of those surfaces carries to the others (and vice versa). 'system' follows
// prefers-color-scheme; 'light'/'dark' force. Synchronous, window-guarded initializers resolve the
// right value on first paint.
export function useArthvoTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem('av_theme') as ThemeMode | null)) || 'system'
  )
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const setTheme = (t: ThemeMode) => {
    setThemeState(t)
    try { localStorage.setItem('av_theme', t) } catch {}
  }
  const resolved: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  return { theme, setTheme, resolved }
}

// Themed base for simple pages (login/signup): mirror the theme onto <html> so the tokens resolve per
// mode, paint html/body with --paper so a bounce/overscroll past content shows themed paper (not the
// default white), and follow color-scheme for native chrome. Scoped — everything is restored on
// unmount so other routes (e.g. the dashboard) are untouched. (Existing token only — no new color.)
export function useThemedBase(resolved: 'light' | 'dark') {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      theme: html.getAttribute('data-theme'),
      htmlBg: html.style.background, htmlScheme: html.style.colorScheme,
      bodyBg: body.style.background,
    }
    html.setAttribute('data-theme', resolved)
    html.style.colorScheme = resolved
    html.style.background = 'var(--paper)'
    body.style.background = 'var(--paper)'
    return () => {
      if (prev.theme === null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', prev.theme)
      html.style.colorScheme = prev.htmlScheme
      html.style.background = prev.htmlBg
      body.style.background = prev.bodyBg
    }
  }, [resolved])
}

// Single icon button that reveals a compact System / Light / Dark menu. Token-only colors so it flips
// correctly in both modes; the icon reflects the resolved state. Shared by the landing and the auth
// pages — one unobtrusive icon, not a pill ribbon. (Relies on a `.btn-ghost` hover rule being present
// on the host page for the hover tint; works fine without it.)
export function ThemeToggle({ theme, setTheme, resolved }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void; resolved: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on any tap outside the control.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const opts: { v: ThemeMode; label: string }[] = [
    { v: 'system', label: 'System' },
    { v: 'light', label: 'Light' },
    { v: 'dark', label: 'Dark' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button onClick={() => setOpen(o => !o)} className="btn-ghost"
        aria-label="Appearance" aria-haspopup="menu" aria-expanded={open}
        style={{ width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, background: 'transparent', border: `1px solid ${T.hairline}`, borderRadius: 8, color: T.muted, cursor: 'pointer' }}>
        {resolved === 'dark' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 144,
          background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 10,
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: 6, zIndex: 80,
        }}>
          {opts.map(o => {
            const active = theme === o.v
            return (
              <button key={o.v} role="menuitemradio" aria-checked={active}
                onClick={() => { setTheme(o.v); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
                  background: active ? T.tint : 'transparent',
                  color: active ? T.teal : T.nav,
                  fontWeight: active ? 700 : 500,
                }}>
                {o.label}
                {active && <span style={{ color: T.teal }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
