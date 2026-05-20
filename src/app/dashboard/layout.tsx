'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAppStore } from '@/store/AppStore'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A' }

const FREE_NAV = [
  { href:'/dashboard', icon:'≡ƒôè', label:'Dashboard' },
  { href:'/dashboard/profile', icon:'≡ƒæñ', label:'My Profile', submenu: true },
  { href:'/dashboard/tax', icon:'≡ƒº«', label:'Tax Optimization' },
]

const PROFILE_SUBMENU = [
  { key:'documents', icon:'≡ƒôü', label:'Documents', path:'/dashboard/profile/documents' },
  { key:'salary', icon:'≡ƒÆ╝', label:'Salary', path:'/dashboard/profile/salary' },
  { key:'other-income', icon:'≡ƒöì', label:'Other Income', path:'/dashboard/profile/other-income' },
  { key:'exemptions', icon:'≡ƒöé', label:'Exemptions', path:'/dashboard/profile/exemptions' },
  { key:'deductions', icon:'≡ƒôè', label:'Deductions', path:'/dashboard/profile/deductions' },
]

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 120 120" fill="none">
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
  const initials = user?.name?.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase() || '?'
  const isActive = (href:string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
  const isProfile = pathname.startsWith('/dashboard/profile')

  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({
    documents: true,
    salary: false,
    'other-income': false,
    exemptions: false,
    deductions: false,
  })

  useEffect(() => {
    try {
      const completion = localStorage.getItem('av_profile_completion')
      if (completion) {
        setUnlocked(JSON.parse(completion))
      }
    } catch {}
  }, [pathname])

  const allProfileTabsComplete = unlocked.documents && unlocked.salary && unlocked['other-income'] && unlocked.exemptions && unlocked.deductions

  return (
    <aside style={{ width:216, minHeight:'100vh', background:C.fg, display:'flex', flexDirection:'column', flexShrink:0, position:'fixed', top:0, left:0, bottom:0, zIndex:50, fontFamily:'"Sora",-apple-system,sans-serif' }}>

      {/* Logo */}
      <div style={{ padding:'16px', borderBottom:'1px solid rgba(230,207,167,0.1)', display:'flex', alignItems:'center', gap:10 }}>
        <Link href="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10 }}>
          <Logo />
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:'-0.02em', lineHeight:1.2 }}>Arth<span style={{ color:C.wheat }}>Vo</span></div>
            <div style={{ fontSize:8, color:'rgba(230,207,167,0.3)', letterSpacing:'0.12em', marginTop:1 }}>WEALTH EVOLVED</div>
          </div>
        </Link>
      </div>

      <nav style={{ flex:1, padding:'8px 0' }}>
        {/* Free section */}
        <div style={{ fontSize:9, color:'rgba(230,207,167,0.3)', letterSpacing:'0.14em', textTransform:'uppercase', padding:'10px 16px 5px' }}>Free</div>
        {FREE_NAV.map(item => (
          <div key={item.href}>
            <Link href={item.href} style={{
              display:'flex', alignItems:'center', gap:9, padding:'10px 16px', textDecoration:'none',
              fontSize:13, fontFamily:'inherit',
              borderLeft:`2px solid ${isActive(item.href)?C.wheat:'transparent'}`,
              background:isActive(item.href)?'rgba(230,207,167,0.1)':'transparent',
              color:isActive(item.href)?C.wheat:'rgba(255,255,255,0.45)',
              fontWeight:isActive(item.href)?600:400,
              transition:'all 0.15s',
            }}>
              <span style={{ fontSize:15, width:20, textAlign:'center' }}>{item.icon}</span>
              {item.label}
            </Link>
            
            {/* Sub-nav under My Profile */}
            {item.submenu && isProfile && (
              <div style={{ marginLeft:28, borderLeft:'1px solid rgba(230,207,167,0.15)', paddingLeft:0, marginTop:2, marginBottom:4 }}>
                {PROFILE_SUBMENU.map(sub => {
                  const isSubActive = pathname === sub.path
                  const isLocked = !unlocked[sub.key]
                  return (
                    <Link
                      key={sub.key}
                      href={isLocked ? '#' : sub.path}
                      onClick={e => { if (isLocked) e.preventDefault() }}
                      style={{
                        display:'flex', alignItems:'center', gap:7, padding:'7px 12px',
                        fontSize:11.5, fontFamily:'inherit', textDecoration:'none',
                        borderRadius:0,
                        borderLeft:`2px solid ${isSubActive && !isLocked ? C.wheat : 'transparent'}`,
                        background: isSubActive && !isLocked ? 'rgba(230,207,167,0.08)' : 'transparent',
                        color: isLocked ? 'rgba(255,255,255,0.2)' : isSubActive ? C.wheat : 'rgba(255,255,255,0.5)',
                        fontWeight: isSubActive && !isLocked ? 500 : 400,
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        transition:'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize:12, width:16, textAlign:'center' }}>{sub.icon}</span>
                      {sub.label}
                      {isLocked && <span style={{ marginLeft:'auto', fontSize:9, opacity:0.5 }}>≡ƒöÆ</span>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding:10, borderTop:'1px solid rgba(230,207,167,0.08)' }}>
        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', marginBottom:6 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:C.wheat, color:C.fg, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:'#fff', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</div>
              <div style={{ fontSize:10, color:'rgba(230,207,167,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(user as any).phone||(user as any).email||''}</div>
            </div>
          </div>
        )}
        <button onClick={logout} style={{ width:'100%', padding:'7px 10px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:5, color:'rgba(255,255,255,0.3)', fontSize:11.5, cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
          Γå¬ Sign out
        </button>
      </div>
    </aside>
  )
}

function TopBar() {
  const pathname = usePathname()
  const page = FREE_NAV.find(n => n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href))

  const isProfile = pathname.startsWith('/dashboard/profile')
  const currentSubTab = isProfile ? PROFILE_SUBMENU.find(s => pathname === s.path) : null
  const headingLabel = currentSubTab ? currentSubTab.label : (page?.label || 'Dashboard')
  const headingIcon = currentSubTab ? currentSubTab.icon : page?.icon

  const [fyLabel, setFyLabel] = useState('')
  useEffect(() => {
    try {
      const stl = localStorage.getItem('av_salary_timeline')
      if (stl) {
        const t = JSON.parse(stl)
        if (t?.fy) { setFyLabel(t.fy.replace('FY ', '').replace('-', 'ΓÇô')); return }
      }
    } catch {}
    const d = new Date()
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const startYear = m >= 4 ? y : y - 1
    const endShort = String((startYear + 1) % 100).padStart(2, '0')
    setFyLabel(`${startYear}ΓÇô${endShort}`)
  }, [pathname])

  return (
    <header style={{ height:46, borderBottom:'1px solid #E4DDD1', background:'#fff', display:'flex', alignItems:'center', padding:'0 24px', gap:10, position:'sticky', top:0, zIndex:40, fontFamily:'"Sora",-apple-system,sans-serif' }}>
      <span style={{ fontSize:15 }}>{headingIcon}</span>
      <h1 style={{ fontSize:13, fontWeight:600, color:'#1C2B22', margin:0 }}>
        {isProfile && currentSubTab ? (
          <>
            <span style={{ color:'#A09080', fontWeight:400 }}>My Profile</span>
            <span style={{ color:'#A09080', margin:'0 6px' }}>┬╖</span>
            {currentSubTab.label}
          </>
        ) : headingLabel}
      </h1>
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
        {fyLabel && <span style={{ fontSize:11, color:'#A09080' }}>FY {fyLabel}</span>}
        <span style={{ fontSize:11, background:'#F5ECD8', color:'#3A4B41', padding:'2px 9px', borderRadius:3, fontWeight:500, border:'1px solid #D4B98A' }}>ArthVo</span>
      </div>
    </header>
  )
}

function AuthGate({ children }: { children:React.ReactNode }) {
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

export default function DashboardLayout({ children }: { children:React.ReactNode }) {
  return (
    <AuthGate>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ display:'flex', minHeight:'100vh', background:'#FDFAF6', fontFamily:'"Sora",-apple-system,sans-serif' }}>
        <Suspense fallback={<aside style={{ width:216, minHeight:'100vh', background:C.fg }} />}>
          <Sidebar />
        </Suspense>
        <div style={{ marginLeft:216, flex:1, display:'flex', flexDirection:'column' }}>
          <Suspense fallback={<header style={{ height:46, borderBottom:'1px solid #E4DDD1', background:'#fff', position:'sticky', top:0, zIndex:40 }} />}>
            <TopBar />
          </Suspense>
          <main style={{ flex:1, padding:'24px 28px', maxWidth:1100, width:'100%' }}>
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  )
}
