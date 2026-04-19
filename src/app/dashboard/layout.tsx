'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppProvider, useAppStore } from '@/store/AppStore'

const NAV = [
  { href: '/dashboard',              icon: '⊞',  label: 'Overview' },
  { href: '/dashboard/salary',       icon: '📄',  label: 'Salary Slip' },
  { href: '/dashboard/other-income', icon: '🏦',  label: 'Other Income' },
  { href: '/dashboard/tax',          icon: '📊',  label: 'Tax Optimiser' },
  { href: '/dashboard/invest',       icon: '📈',  label: 'Investments' },
  { href: '/dashboard/chat',         icon: '💬',  label: 'AI Advisor' },
]

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="14" fill="#C9A84C"/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#0F2640"/>
      <circle cx="90" cy="24" r="18" fill="#C9A84C"/>
      <circle cx="90" cy="24" r="11" fill="#0F2640"/>
    </svg>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { salary, clearAll } = useAppStore()
  return (
    <aside style={{ width: 230, minHeight: '100vh', background: '#0F2640', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50 }}>
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={32} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.02em' }}>
              Arth<span style={{ color: '#C9A84C' }}>Vo</span>
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
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, textDecoration: 'none', background: active ? '#C9A84C' : 'transparent', color: active ? '#0F2640' : 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {salary && (
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3, letterSpacing: '0.06em' }}>ACTIVE PROFILE</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{salary.employeeName || 'Your Profile'}</div>
            <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 2 }}>₹{salary.netSalary?.toLocaleString('en-IN')}/mo take-home</div>
          </div>
        )}
        <button onClick={clearAll} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
          ↺ Reset data
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
      <h1 style={{ fontSize: 15, fontWeight: 700, color: '#1C2833', margin: 0 }}>{page?.label || 'Dashboard'}</h1>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, background: '#FDF6E3', color: '#8B6914', padding: '3px 10px', borderRadius: 20, fontWeight: 600, border: '1px solid #E8D5A3' }}>ArthVo</span>
        <span style={{ fontSize: 11, background: '#E8F1FA', color: '#1A3C5E', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>FY 2024–25</span>
      </div>
    </header>
  )
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginLeft: 230, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <main style={{ flex: 1, padding: '28px', maxWidth: 1100, width: '100%' }}>
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
      </div>
    </AppProvider>
  )
}
