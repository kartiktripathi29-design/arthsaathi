'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/store/AppStore'

const C = { primary: '#3A4B41', accent: '#E6CFA7', white: '#fff', bg: '#FDFAF6' }

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="14" fill={C.accent}/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill={C.primary}/>
      <circle cx="90" cy="24" r="18" fill={C.primary}/>
      <circle cx="90" cy="24" r="11" fill={C.accent}/>
    </svg>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAppStore()
  const [hasSalaryData, setHasSalaryData] = useState(false)
  
  const initials = user?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timeline = localStorage.getItem('av_salary_timeline')
      setHasSalaryData(!!(timeline && JSON.parse(timeline).length > 0))
    }
  }, [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const PROFILE_SECTIONS = [
    { href: '/dashboard/profile/documents', label: 'Documents' },
    { href: '/dashboard/profile/salary', label: 'Salary' },
    { href: '/dashboard/profile/other-income', label: 'Other Income' },
    { href: '/dashboard/profile/exemptions', label: 'Exemptions' },
    { href: '/dashboard/profile/deductions', label: 'Deductions' },
  ]

  return (
    <aside style={{
      width: 216, minHeight: '100vh', background: C.primary,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(230,207,167,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Arth<span style={{ color: C.accent }}>Vo</span>
            </div>
            <div style={{ fontSize: 8, color: 'rgba(230,207,167,0.35)', letterSpacing: '0.12em', marginTop: 1 }}>WEALTH EVOLVED</div>
          </div>
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
              background: pathname === '/dashboard' ? 'rgba(230,207,167,0.1)' : 'transparent',
              color: pathname === '/dashboard' ? C.accent : 'rgba(255,255,255,0.45)',
              fontWeight: pathname === '/dashboard' ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>📊</span>
              Dashboard
            </Link>
            <div style={{ margin: '6px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }} />
          </>
        )}

        <div style={{ fontSize: 9, color: 'rgba(230,207,167,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 16px 5px' }}>
          My Profile
        </div>
        {PROFILE_SECTIONS.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center',
              padding: '9px 16px 9px 26px', textDecoration: 'none',
              fontSize: 12.5, fontFamily: 'inherit',
              borderLeft: `2px solid ${active ? C.accent : 'transparent'}`,
              background: active ? 'rgba(230,207,167,0.1)' : 'transparent',
              color: active ? C.accent : 'rgba(255,255,255,0.4)',
              fontWeight: active ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              {item.label}
            </Link>
          )
        })}

        <div style={{ margin: '8px 16px 6px', borderTop: '1px solid rgba(255,255,255,0.07)' }} />

        <Link href="/dashboard/tax" style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 16px', textDecoration: 'none',
          fontSize: 13, fontFamily: 'inherit',
          borderLeft: `2px solid ${isActive('/dashboard/tax') ? C.accent : 'transparent'}`,
          background: isActive('/dashboard/tax') ? 'rgba(230,207,167,0.1)' : 'transparent',
          color: isActive('/dashboard/tax') ? C.accent : 'rgba(255,255,255,0.45)',
          fontWeight: isActive('/dashboard/tax') ? 600 : 400,
          transition: 'all 0.15s',
        }}>
          <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>🎯</span>
          Tax Optimizer
        </Link>
      </nav>

      <div style={{ padding: 10, borderTop: '1px solid rgba(230,207,167,0.08)' }}>
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 10px', marginBottom: 6,
            background: 'rgba(230,207,167,0.07)', border: '1px solid rgba(230,207,167,0.12)',
            borderRadius: 7,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: C.accent, color: C.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(230,207,167,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(user as any).phone || (user as any).email || ''}</div>
            </div>
          </div>
        )}
        <button onClick={logout} style={{
          width: '100%', padding: '7px 10px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5,
          color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit', letterSpacing: '0.01em',
        }}>
          ↪ Sign out
        </button>
      </div>
    </aside>
  )
}

function TopBar() {
  const pathname = usePathname()
  const [selectedFY, setSelectedFY] = useState('FY 2026–27')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('av_selected_fy')
      if (stored) setSelectedFY(stored)
    }
  }, [])

  const pageTitle = pathname === '/dashboard' ? 'Dashboard'
    : pathname.startsWith('/dashboard/profile/documents') ? 'Documents'
    : pathname.startsWith('/dashboard/profile/salary') ? 'Salary'
    : pathname.startsWith('/dashboard/profile/other-income') ? 'Other Income'
    : pathname.startsWith('/dashboard/profile/exemptions') ? 'Exemptions'
    : pathname.startsWith('/dashboard/profile/deductions') ? 'Deductions'
    : pathname.startsWith('/dashboard/tax') ? 'Tax Optimizer'
    : 'Dashboard'

  return (
    <header style={{
      height: 46, borderBottom: '1px solid #E4DDD1', background: '#fff',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 10,
      position: 'sticky', top: 0, zIndex: 40,
      fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      <h1 style={{ fontSize: 13, fontWeight: 600, color: '#1C2B22', margin: 0 }}>{pageTitle}</h1>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#A09080' }}>{selectedFY}</span>
        <span style={{
          fontSize: 11, background: '#F5ECD8', color: C.primary,
          padding: '2px 9px', borderRadius: 3, fontWeight: 500,
          border: '1px solid #D4B98A',
        }}>ArthVo</span>
      </div>
    </header>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const router = useRouter()
  const pathname = usePathname()
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('as_user') : null
      if (!stored && !user) {
        router.replace('/login')
      } else if (user && pathname === '/dashboard') {
        // Redirect to Documents if user lands on /dashboard without data
        router.replace('/dashboard/profile/documents')
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [user, router, pathname])
  
  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: '"Sora",-apple-system,sans-serif' }}>
        <Sidebar />
        <div style={{ marginLeft: 216, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar />
          <main style={{ flex: 1, padding: '28px 28px', maxWidth: 1100, width: '100%' }}>
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  )
}
