'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppProvider, useAppStore } from '@/store/AppStore'

const NAV = [
  { href: '/dashboard',         icon: '⊞',  label: 'Overview' },
  { href: '/dashboard/salary',  icon: '📄',  label: 'Salary Slip' },
  { href: '/dashboard/tax',     icon: '📊',  label: 'Tax Optimiser' },
  { href: '/dashboard/invest',  icon: '📈',  label: 'Investments' },
  { href: '/dashboard/chat',    icon: '💬',  label: 'AI Advisor' },
]

function Sidebar() {
  const pathname = usePathname()
  const { salary, clearAll } = useAppStore()
  return (
    <aside style={{
      width: 230, minHeight: '100vh', background: '#0F2640',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: '#E67E22', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, color: '#fff', flexShrink: 0 }}>₹</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>ArthSaathi</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>SEBI RIA Registered</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(item => {
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={`nav-link${active ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, textDecoration: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: active ? 600 : 400 }}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User profile / status */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {salary && (
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Active profile</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{salary.employeeName || 'Your Profile'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>₹{salary.netSalary?.toLocaleString('en-IN')}/mo take-home</div>
          </div>
        )}
        <button onClick={clearAll} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
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
    <header style={{ height: 60, borderBottom: '1px solid #E5E9ED', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
      <span style={{ fontSize: 18 }}>{page?.icon}</span>
      <h1 style={{ fontSize: 16, fontWeight: 600, color: '#1C2833', margin: 0 }}>{page?.label || 'Dashboard'}</h1>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, background: '#E8F1FA', color: '#1A3C5E', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>FY 2024–25</span>
        <span style={{ fontSize: 11, background: '#E9F7EF', color: '#1E8449', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>AY 2025–26</span>
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
