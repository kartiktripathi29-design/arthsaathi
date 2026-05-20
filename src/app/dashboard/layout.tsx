'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/store/AppStore'

// ─── Palette ─────────────────────────────────────────────────────────────────
// Feldgrau: #3A4B41 | Wheat: #E6CFA7 | Off-white: #FDFAF6 | Border: #E4DDD1

const TAX_NAV = [
  { href: '/dashboard/profile', icon: '👤', label: 'My Profile' },
  { href: '/dashboard/tax',     icon: '📊', label: 'Tax Optimiser' },
]
const TOOLS_NAV = [
  { href: '/dashboard/invest',  icon: '📈', label: 'Investments' },
  { href: '/dashboard/decide',  icon: '🤔', label: 'Can I Buy This?' },
  { href: '/dashboard/chat',    icon: '💬', label: 'AI Advisor' },
]
const ALL_NAV = [...TAX_NAV, ...TOOLS_NAV]

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="14" fill="#E6CFA7"/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#3A4B41"/>
      <circle cx="90" cy="24" r="18" fill="#3A4B41"/>
      <circle cx="90" cy="24" r="11" fill="#E6CFA7"/>
    </svg>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAppStore()
  const initials = user?.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <aside style={{
      width: 216, minHeight: '100vh', background: '#3A4B41',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      fontFamily: '"Sora",-apple-system,sans-serif',
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(230,207,167,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Arth<span style={{ color: '#E6CFA7' }}>Vo</span>
            </div>
            <div style={{ fontSize: 8, color: 'rgba(230,207,167,0.35)', letterSpacing: '0.12em', marginTop: 1 }}>WEALTH EVOLVED</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column' }}>

        {/* Tax flow */}
        <div style={{ fontSize: 9, color: 'rgba(230,207,167,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 16px 5px' }}>
          Tax Flow
        </div>
        {TAX_NAV.map(item => (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '10px 16px', textDecoration: 'none',
            fontSize: 13, fontFamily: 'inherit',
            borderLeft: `2px solid ${isActive(item.href) ? '#E6CFA7' : 'transparent'}`,
            background: isActive(item.href) ? 'rgba(230,207,167,0.1)' : 'transparent',
            color: isActive(item.href) ? '#E6CFA7' : 'rgba(255,255,255,0.45)',
            fontWeight: isActive(item.href) ? 600 : 400,
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {/* Divider */}
        <div style={{ margin: '6px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }} />

        {/* Everyday tools proceed */}
        <Link href="/dashboard/invest" style={{
          margin: '2px 10px 6px', padding: '8px 12px',
          background: 'rgba(230,207,167,0.06)', border: '1px solid rgba(230,207,167,0.14)',
          borderRadius: 6, textDecoration: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(230,207,167,0.55)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Everyday Tools</span>
          <span style={{ fontSize: 12, color: '#E6CFA7' }}>↓</span>
        </Link>

        {TOOLS_NAV.map(item => (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '10px 16px', textDecoration: 'none',
            fontSize: 13, fontFamily: 'inherit',
            borderLeft: `2px solid ${isActive(item.href) ? '#E6CFA7' : 'transparent'}`,
            background: isActive(item.href) ? 'rgba(230,207,167,0.1)' : 'transparent',
            color: isActive(item.href) ? '#E6CFA7' : 'rgba(255,255,255,0.45)',
            fontWeight: isActive(item.href) ? 600 : 400,
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
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
              background: '#E6CFA7', color: '#3A4B41',
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
  const page = ALL_NAV.find(n => pathname.startsWith(n.href))
  return (
    <header style={{
      height: 46, borderBottom: '1px solid #E4DDD1', background: '#fff',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 10,
      position: 'sticky', top: 0, zIndex: 40,
      fontFamily: '"Sora",-apple-system,sans-serif',
    }}>
      <span style={{ fontSize: 15 }}>{page?.icon}</span>
      <h1 style={{ fontSize: 13, fontWeight: 600, color: '#1C2B22', margin: 0 }}>{page?.label || 'Dashboard'}</h1>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#A09080' }}>FY 2024–25</span>
        <span style={{
          fontSize: 11, background: '#F5ECD8', color: '#3A4B41',
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
  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('as_user') : null
      if (!stored && !user) router.replace('/login')
    }, 150)
    return () => clearTimeout(timer)
  }, [user, router])
  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#FDFAF6', fontFamily: '"Sora",-apple-system,sans-serif' }}>
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
