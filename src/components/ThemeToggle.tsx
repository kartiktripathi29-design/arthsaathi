'use client'
import { useState, useEffect } from 'react'
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

// Appearance control: an "Auto" chip + a sliding pill switch.
//   - Auto chip → follow the OS (theme 'system'); highlighted teal when active.
//   - Slider → an explicit light / dark choice; the knob carries the active glyph and slides across a
//     track that tints teal in dark. It always reflects the RESOLVED appearance, so in Auto mode it
//     shows whatever the OS currently is; tapping it switches to an explicit choice (turning Auto off).
// Token-only colors so it flips correctly in both modes. Shared by the landing, auth pages and the
// dashboard top bar. Relies on a `.btn-ghost` hover rule on the host page for the hover tint; fine
// without. (`theme` distinguishes the explicit-vs-system state the slider alone can't show.)
export function ThemeToggle({ theme, setTheme, resolved }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void; resolved: 'light' | 'dark' }) {
  const isDark = resolved === 'dark'
  const isAuto = theme === 'system'
  const W = 52, H = 28, KNOB = 22, PAD = 2

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      {/* Auto / follow-system chip */}
      <button onClick={() => setTheme('system')} className="btn-ghost"
        aria-pressed={isAuto} title="Follow system appearance"
        style={{
          height: H, padding: '0 9px', flexShrink: 0, cursor: 'pointer',
          borderRadius: H / 2, border: `1px solid ${isAuto ? T.teal : T.hairline}`,
          background: isAuto ? T.tint : 'transparent', color: isAuto ? T.teal : T.muted,
          fontFamily: 'inherit', fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
          transition: 'all .15s ease',
        }}>
        Auto
      </button>

      {/* Light/dark slider */}
      <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="btn-ghost"
        role="switch" aria-checked={isDark} aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`} title="Appearance"
        style={{
          position: 'relative', width: W, height: H, flexShrink: 0, padding: 0, cursor: 'pointer',
          borderRadius: H / 2, border: `1px solid ${T.hairline}`,
          background: isDark ? T.teal : T.sand, transition: 'background .2s ease',
        }}>
        {/* Track glyphs — the inactive side shows faintly; the knob covers the active side. */}
        <span aria-hidden="true" style={{ position: 'absolute', left: 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: isDark ? T.ivory : T.muted, opacity: isDark ? 0.45 : 0 }}>
          <SunGlyph />
        </span>
        <span aria-hidden="true" style={{ position: 'absolute', right: 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: isDark ? T.ivory : T.muted, opacity: isDark ? 0 : 0.45 }}>
          <MoonGlyph />
        </span>
        {/* Knob — slides left (light) / right (dark) and carries the active glyph. */}
        <span style={{
          position: 'absolute', top: PAD, left: isDark ? W - KNOB - PAD : PAD,
          width: KNOB, height: KNOB, borderRadius: '50%',
          background: T.card, border: `1px solid ${T.hairline}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isDark ? T.ivory : T.teal,
          transition: 'left .2s ease',
        }}>
          {isDark ? <MoonGlyph /> : <SunGlyph />}
        </span>
      </button>
    </div>
  )
}

function SunGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
