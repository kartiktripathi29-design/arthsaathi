'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AppProvider, useAppStore } from '@/store/AppStore'

const NAV = [
  { href: '/dashboard',              icon: '⊞',  label: 'Overview' },
  { href: '/dashboard/ais',          icon: '📑',  label: 'AIS / 26AS' },
  { href: '/dashboard/salary',       icon: '📄',  label: 'Salary Slip' },
  { href: '/dashboard/other-income', icon: '🏦',  label: 'Other Income' },
  { href: '/dashboard/total-income', icon: '📋',  label: 'Total Income' },
  { href: '/dashboard/tax',          icon: '📊',  label: 'Tax Optimiser' },
  { href: '/dashboard/invest',       icon: '📈',  label: 'Investments' },
  { href: '/dashboard/chat',         icon: '💬',  label: 'AI Advisor' },
]

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="14" fill="#059669"/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#FFFFFF"/>
      <circle cx="90" cy="24" r="18" fill="#FFFFFF"/>
      <circle cx="90" cy="24" r="11" fill="#059669"/>
    </svg>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { user, salary, logout } = useAppStore()
  const initials = user?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <aside style={{ width: 230, minHeight: '100vh', background: '#1E293B', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={32} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.02em' }}>
              Arth<span style={{ color: '#34D399' }}>Vo</span>
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginTop: 1 }}>WEALTH EVOLVED</div>
          </div>
        </Link>
      </div>

      <nav style={{ padding: '14px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map(item => {
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, textDecoration: 'none', background: active ? '#059669' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {user && (
          <div style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
        )}
        {salary && (
          <div style={{ fontSize: 10, color: '#34D399', marginBottom: 8, paddingLeft: 4 }}>₹{salary.netSalary?.toLocaleString('en-IN')}/mo take-home</div>
        )}
        <button onClick={logout} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          ↪ Sign out
        </button>
      </div>
    </aside>
  )
}

function TopBar() {
  const pathname = usePathname()
  const page = NAV.find(n => n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href))
  return (
    <header style={{ height: 58, borderBottom: '1px solid #E5E9ED', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
      <span style={{ fontSize: 17 }}>{page?.icon}</span>
      <h1 style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: 0, fontFamily: '"Sora",-apple-system,sans-serif' }}>{page?.label || 'Dashboard'}</h1>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, background: '#ECFDF5', color: '#065F46', padding: '3px 10px', borderRadius: 20, fontWeight: 600, border: '1px solid #A7F3D0' }}>ArthVo</span>
        <span style={{ fontSize: 11, background: '#E0F2FE', color: '#075985', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>FY 2024–25</span>
      </div>
    </header>
  )
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginLeft: 230, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Sora",-apple-system,sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');`}</style>
      <TopBar />
      <main style={{ flex: 1, padding: '28px', maxWidth: 1100, width: '100%' }}>
        {children}
      </main>
    </div>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    // Wait for store hydration then check
    const timer = setTimeout(() => {
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('as_user') : null
      if (!storedUser && !user) {
        router.replace('/login')
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [user, router])

  // While checking, show a loading state instead of flashing the dashboard
  if (!user && typeof window !== 'undefined' && !localStorage.getItem('as_user')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Sora",-apple-system,sans-serif', color: '#64748B', fontSize: 14 }}>
        Redirecting to sign in…
      </div>
    )
  }

  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthGate>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <DashboardContent>{children}</DashboardContent>
        </div>
      </AuthGate>
    </AppProvider>
  )
}
