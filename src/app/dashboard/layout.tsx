'use client'
import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/store/AppStore'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/useUser'
import { tokens as T } from '@/lib/tokens'
import Logo from '@/components/Logo'
import { useThemedBase } from '@/components/ThemeToggle'

const SUPABASE_CONFIGURED = !!process.env.NEXT_PUBLIC_SUPABASE_URL

// Dashboard chrome palette (desktop): taupe rail + teal brand cap + sand header.
const C = { rail: T.taupe, railLine: T.taupeLine, cap: T.teal, accent: T.teal, nav: T.nav, bg: T.paper }

type ThemeMode = 'system' | 'light' | 'dark'

// Three-way appearance pills (System / Light / Dark). Active pill: tint bg + teal text; inactive: nav.
// Shared by the desktop sidebar footer and the mobile top-bar account dropdown — both drive setTheme.
function AppearanceControl({ theme, setTheme }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void }) {
  const opts: { v: ThemeMode; label: string }[] = [
    { v: 'system', label: 'System' },
    { v: 'light', label: 'Light' },
    { v: 'dark', label: 'Dark' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {opts.map(o => {
        const active = theme === o.v
        return (
          <button key={o.v} onClick={() => setTheme(o.v)} style={{
            flex: 1, padding: '5px 4px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${active ? T.teal : T.hairline}`,
            background: active ? T.tint : 'transparent',
            color: active ? T.teal : T.nav,
            fontSize: 10.5, fontWeight: active ? 700 : 500,
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

function Sidebar({ theme, setTheme }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAppStore()
  const [hasSalaryData, setHasSalaryData] = useState(false)

  // Clear the real Supabase session (when configured) before wiping local state, otherwise the
  // auth cookie lingers and Proxy keeps treating the user as signed in.
  const handleSignOut = async () => {
    try {
      if (SUPABASE_CONFIGURED) await createSupabaseBrowserClient().auth.signOut()
    } catch {
      // ignore — still clear local state below
    }
    logout()
    router.replace('/login')
  }
  
  const initials = user?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timeline = localStorage.getItem('av_salary_timeline')
      setHasSalaryData(!!(timeline && JSON.parse(timeline).length > 0))
    }
  }, [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // One top-level profile item (Documents), then two always-visible families. Each family renders a
  // section label styled like "MY PROFILE" with its sub-items nested below — no expand/collapse.
  // (This is the sidebar's own structure; TopBar keeps its separate title lookup.)
  const PROFILE_TOP = [
    { href: '/dashboard/profile/documents', label: 'Documents' },
  ]
  const PROFILE_FAMILIES = [
    { label: 'Income', items: [
      { href: '/dashboard/profile/salary', label: 'Salary' },
      { href: '/dashboard/profile/other-income', label: 'Other earnings' },
    ] },
    { label: 'Tax breaks', items: [
      { href: '/dashboard/profile/exemptions', label: 'Allowances' },
      { href: '/dashboard/profile/deductions', label: 'Deductions' },
    ] },
  ]
  // Shared section-label style so the family labels match "MY PROFILE" exactly.
  const sectionLabelStyle: React.CSSProperties = { fontSize: 10, color: T.nav, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 16px 5px' }
  // One profile link; paddingLeft sets the indent (26 = top-level, 42 = nested under a family).
  const profileLink = (item: { href: string; label: string }, paddingLeft: number) => {
    const active = isActive(item.href)
    return (
      <Link key={item.href} href={item.href} style={{
        display: 'flex', alignItems: 'center',
        padding: `9px 16px 9px ${paddingLeft}px`, textDecoration: 'none',
        fontSize: 13, fontFamily: 'inherit',
        borderLeft: `2px solid ${active ? C.accent : 'transparent'}`,
        background: active ? T.tint : 'transparent',
        color: active ? C.accent : C.nav,
        fontWeight: active ? 600 : 500,
        transition: 'all 0.15s',
      }}>
        {item.label}
      </Link>
    )
  }

  return (
    <aside className="dash-rail" style={{
      width: 216, minHeight: '100vh', background: C.rail,
      borderRight: `1px solid ${C.railLine}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      {/* Teal brand cap — logo reads in ivory on the teal block */}
      <div style={{ padding: '18px 16px 14px', background: T.cap, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo variant="onTeal" size={28} />
        </Link>
      </div>

      <nav style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {hasSalaryData && (
          <>
            <Link href="/dashboard" style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '10px 16px', textDecoration: 'none',
              fontSize: 13, fontFamily: 'inherit',
              borderLeft: `2px solid ${pathname === '/dashboard' ? C.accent : 'transparent'}`,
              background: pathname === '/dashboard' ? T.tint : 'transparent',
              color: pathname === '/dashboard' ? C.accent : C.nav,
              fontWeight: pathname === '/dashboard' ? 600 : 500,
              transition: 'all 0.15s',
            }}>
              Dashboard
            </Link>
            <div style={{ margin: '6px 16px', borderTop: `1px solid ${C.railLine}` }} />
          </>
        )}

        <div style={sectionLabelStyle}>My Profile</div>
        {PROFILE_TOP.map(item => profileLink(item, 26))}

        {PROFILE_FAMILIES.map(family => (
          <Fragment key={family.label}>
            <div style={sectionLabelStyle}>{family.label}</div>
            {family.items.map(item => profileLink(item, 42))}
          </Fragment>
        ))}

        <div style={{ margin: '8px 16px 6px', borderTop: `1px solid ${C.railLine}` }} />

        <Link href="/dashboard/tax/optimizer" style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 16px', textDecoration: 'none',
          fontSize: 13, fontFamily: 'inherit',
          borderLeft: `2px solid ${isActive('/dashboard/tax') ? C.accent : 'transparent'}`,
          background: isActive('/dashboard/tax') ? T.tint : 'transparent',
          color: isActive('/dashboard/tax') ? C.accent : C.nav,
          fontWeight: isActive('/dashboard/tax') ? 600 : 500,
          transition: 'all 0.15s',
        }}>
          Your Tax
        </Link>
      </nav>

      <div style={{ padding: 10, borderTop: `1px solid ${C.railLine}` }}>
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', marginBottom: 6,
            background: T.card, border: `1px solid ${T.hairline}`,
            borderRadius: 7,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: C.cap, color: T.onTeal,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(user as any).phone || (user as any).email || ''}</div>
            </div>
          </div>
        )}
        <div style={{ fontSize: 10, color: T.nav, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '2px 2px 6px' }}>Appearance</div>
        <div style={{ marginBottom: 8 }}>
          <AppearanceControl theme={theme} setTheme={setTheme} />
        </div>
        <button onClick={handleSignOut} style={{
          width: '100%', padding: '7px 10px', background: 'transparent',
          border: `1px solid ${C.railLine}`, borderRadius: 5,
          color: C.nav, fontSize: 12, cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit', letterSpacing: '0.01em',
        }}>
          ↪ Sign out
        </button>
      </div>
    </aside>
  )
}

function TopBar({ theme, setTheme }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAppStore()
  const [selectedFY, setSelectedFY] = useState('FY 2026–27')
  // Mobile-only account menu: the sidebar footer (chip + sign-out) hides with the rail under 768px,
  // so the chip resurfaces here in the top bar as a tap-to-open dropdown.
  const [menuOpen, setMenuOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)

  const initials = user?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'

  // Same teardown as the sidebar's sign-out: clear the Supabase session before wiping local state.
  const handleSignOut = async () => {
    try {
      if (SUPABASE_CONFIGURED) await createSupabaseBrowserClient().auth.signOut()
    } catch {
      // ignore — still clear local state below
    }
    logout()
    router.replace('/login')
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('av_selected_fy')
      if (stored) setSelectedFY(stored)
    }
  }, [])

  // Close the account menu on any tap outside the chip.
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const pageTitle = pathname === '/dashboard' ? 'Dashboard'
    : pathname.startsWith('/dashboard/profile/documents') ? 'Documents'
    : pathname.startsWith('/dashboard/profile/salary') ? 'Salary'
    : pathname.startsWith('/dashboard/profile/other-income') ? 'Other earnings'
    : pathname.startsWith('/dashboard/profile/exemptions') ? 'Allowances'
    : pathname.startsWith('/dashboard/profile/deductions') ? 'Deductions'
    : pathname.startsWith('/dashboard/tax') ? 'Your Tax'
    : 'Dashboard'

  return (
    <header style={{
      height: 46, borderBottom: `2px solid ${T.teal}`, background: T.sand,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 10,
      position: 'sticky', top: 0, zIndex: 40,
      fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      {/* Mobile-only brand lockup — same V mark as the sidebar cap, teal on sand. Hidden on desktop. */}
      <Link href="/dashboard" className="dash-toplogo" style={{ display: 'none', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <svg width={22} height={22} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <rect x="8" y="8" width="104" height="104" rx="28" fill="none" stroke={T.teal} strokeWidth="8" />
          <polygon points="28,28 36,28 60,85 84,28 92,28 60,92" fill={T.teal} />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>ArthVo</span>
      </Link>
      <h1 className="dash-toptitle" style={{ fontSize: 13, fontWeight: 600, color: T.ink, margin: 0 }}>{pageTitle}</h1>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: T.muted }}>{selectedFY}</span>
        <span className="dash-topbadge" style={{
          fontSize: 11, background: T.card, color: T.teal,
          padding: '2px 9px', borderRadius: 3, fontWeight: 500,
          border: `1px solid ${T.taupeLine}`,
        }}>ArthVo</span>
        {/* Mobile-only account chip — hidden on desktop (display:none flipped by .dash-topchip media rule). */}
        <div className="dash-topchip" ref={chipRef} style={{ display: 'none', position: 'relative', alignItems: 'center' }}>
          <button onClick={() => setMenuOpen(o => !o)} aria-label="Account menu" style={{
            width: 28, height: 28, borderRadius: '50%',
            background: T.teal, color: T.onTeal, border: 'none',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
          }}>{initials}</button>
          {menuOpen && user && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 200,
              background: T.card, border: `1px solid ${T.hairline}`, borderRadius: 10,
              boxShadow: '0 6px 24px rgba(0,0,0,0.12)', padding: 6, zIndex: 70,
            }}>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(user as any).phone || (user as any).email || ''}</div>
              </div>
              <div style={{ padding: '8px 10px', borderTop: `1px solid ${T.hairline}` }}>
                <div style={{ fontSize: 9.5, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>Appearance</div>
                <AppearanceControl theme={theme} setTheme={setTheme} />
              </div>
              <button onClick={handleSignOut} style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', marginTop: 2,
                background: 'transparent', border: 'none', borderTop: `1px solid ${T.hairline}`,
                color: T.nav, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>↪ Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// Mobile bottom tab bar — 4 family-level tabs. Hidden on desktop (display:none flipped by media rule).
function BottomTabBar() {
  const pathname = usePathname()
  const tabs = [
    { label: 'Documents', href: '/dashboard/profile/documents', active: pathname.startsWith('/dashboard/profile/documents') },
    { label: 'Income', href: '/dashboard/profile/salary', active: pathname.startsWith('/dashboard/profile/salary') || pathname.startsWith('/dashboard/profile/other-income') },
    { label: 'Tax breaks', href: '/dashboard/profile/exemptions', active: pathname.startsWith('/dashboard/profile/exemptions') || pathname.startsWith('/dashboard/profile/deductions') },
    { label: 'Your Tax', href: '/dashboard/tax/optimizer', active: pathname.startsWith('/dashboard/tax') },
  ]
  return (
    <nav className="dash-tabbar" style={{
      display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
      background: T.card, borderTop: `1px solid ${T.hairline}`,
      paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 60,
      fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      {tabs.map(tab => (
        <Link key={tab.href} href={tab.href} style={{
          flex: 1, minWidth: 0, textAlign: 'center', textDecoration: 'none',
          fontSize: 11, fontWeight: 600, padding: '10px 0 12px',
          color: tab.active ? T.teal : T.nav,
          borderTop: `2px solid ${tab.active ? T.teal : 'transparent'}`,
        }}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

// Mobile family segment — the two-pill control under the top bar on Income / Tax breaks routes.
// Renders nothing off-family or on desktop (display:none flipped by media rule).
function FamilySegment() {
  const pathname = usePathname()
  let pills: { label: string; href: string }[] | null = null
  if (pathname.startsWith('/dashboard/profile/salary') || pathname.startsWith('/dashboard/profile/other-income')) {
    pills = [
      { label: 'Salary', href: '/dashboard/profile/salary' },
      { label: 'Other earnings', href: '/dashboard/profile/other-income' },
    ]
  } else if (pathname.startsWith('/dashboard/profile/exemptions') || pathname.startsWith('/dashboard/profile/deductions')) {
    pills = [
      { label: 'Allowances', href: '/dashboard/profile/exemptions' },
      { label: 'Deductions', href: '/dashboard/profile/deductions' },
    ]
  }
  if (!pills) return null
  return (
    <div className="dash-segment" style={{
      display: 'none', margin: '10px 16px 0', background: T.sand,
      borderRadius: 10, padding: 3, fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      {pills.map(pill => {
        const active = pathname.startsWith(pill.href)
        return (
          <Link key={pill.href} href={pill.href} style={{
            flex: 1, textAlign: 'center', textDecoration: 'none',
            fontSize: 13, fontWeight: 600, padding: '7px 0', borderRadius: 8,
            background: active ? T.teal : 'transparent',
            color: active ? T.onTeal : T.nav,
          }}>
            {pill.label}
          </Link>
        )
      })}
    </div>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const { user: supaUser, loading } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Real-auth mode: trust the Supabase session (Proxy also guards server-side). Don't bounce a
    // valid session just because local `as_user` is empty (e.g. a fresh device before sync).
    if (SUPABASE_CONFIGURED) {
      if (loading) return
      if (!supaUser) { router.replace('/login'); return }
      if (pathname === '/dashboard') router.replace('/dashboard/profile/documents')
      return
    }
    // Mock mode (Supabase not configured): original localStorage-based gate.
    const timer = setTimeout(() => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('as_user') : null
      if (!stored && !user) {
        router.replace('/login')
      } else if (user && pathname === '/dashboard') {
        router.replace('/dashboard/profile/documents')
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [user, supaUser, loading, router, pathname])

  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Theme: 'system' follows prefers-color-scheme; 'light'/'dark' force. Synchronous initializers
  // (localStorage + matchMedia, both window-guarded) resolve the right value on the first client
  // paint — no light-then-dark flash. The matchMedia listener keeps system mode live.
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

  // Mirror the resolved theme onto <html> and paint the html/body base with --paper, so an
  // overscroll/rubber-band past any dashboard page (Documents, Salary, Other earnings, Allowances,
  // Deductions, Your Tax) shows themed paper instead of the default white. The dashboard track is a
  // single ground (--paper) top-to-bottom, so one tone is correct here (no two-tone like the landing).
  // Restored on unmount, so leaving the dashboard for the landing/auth pages hands <html> back clean.
  useThemedBase(resolved)

  return (
    <AuthGate>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');`}</style>
      {/* Mobile overrides only — desktop (≥768px) gets no rules here, so inline styles rule untouched. */}
      <style>{`
        @media (max-width: 767px) {
          .dash-rail { display: none !important; }
          .dash-main { margin-left: 0 !important; padding-bottom: 76px; }
          .dash-tabbar { display: flex !important; }
          .dash-segment { display: flex !important; }
          .dash-topchip { display: flex !important; }
          .dash-toplogo { display: flex !important; }
          .dash-toptitle { display: none !important; }
          .dash-topbadge { display: none !important; }
        }
      `}</style>
      <div data-theme={resolved} suppressHydrationWarning style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: '"Sora",-apple-system,sans-serif' }}>
        <Sidebar theme={theme} setTheme={setTheme} />
        <BottomTabBar />
        <div className="dash-main" style={{ marginLeft: 216, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar theme={theme} setTheme={setTheme} />
          <FamilySegment />
          <main style={{ flex: 1, padding: '28px 28px', maxWidth: 1100, width: '100%' }}>
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  )
}
