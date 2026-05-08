'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAppStore } from '@/store/AppStore'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A' }

const FREE_NAV = [
  { href:'/dashboard', icon:'📊', label:'Dashboard' },
  { href:'/dashboard/profile', icon:'👤', label:'My Profile' },
  { href:'/dashboard/tax', icon:'🧮', label:'Tax Optimiser' },
]

const PROFILE_SUBNAV = [
  { key:'docs', icon:'📁', label:'Documents', query:'' },
  { key:'salary', icon:'💼', label:'Salary', query:'?tab=salary' },
  { key:'review', icon:'🔍', label:'Review', query:'?tab=review' },
  { key:'reports', icon:'📊', label:'Reports', query:'?tab=reports' },
  { key:'analytics', icon:'📈', label:'Analytics', query:'?tab=analytics' },
]
const PREMIUM_NAV = [
  { href:'/dashboard/invest', icon:'📈', label:'Investment Plan' },
  { href:'/dashboard/decide', icon:'🤔', label:'Can I Buy This?' },
  { href:'/dashboard/chat', icon:'💬', label:'AI Advisor' },
]
const ALL_NAV = [...FREE_NAV, ...PREMIUM_NAV]

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

  // Progressive unlock: check localStorage for what's been completed
  const [unlocked, setUnlocked] = useState<Record<string,boolean>>({ docs:true, salary:false, review:false, reports:false, analytics:false })
  useEffect(() => {
    try {
      const banks = localStorage.getItem('av_banks')
      const hasBanks = banks ? JSON.parse(banks).length > 0 : false
      const hasSalary = !!localStorage.getItem('av_salary_timeline')
      const hasOverrides = !!localStorage.getItem('av_bucket_overrides')
      const hasConfirmed = !!localStorage.getItem('av_confirmed_salary_ids')
      setUnlocked({
        docs: true,
        salary: hasSalary,
        review: hasBanks,
        reports: hasBanks,
        analytics: hasBanks,
      })
    } catch {}
  }, [pathname]) // Re-check on every navigation

  // Read current tab from URL search params
  const searchParams = useSearchParams()
  const currentTab = isProfile ? (searchParams.get('tab') || 'docs') : ''

  // Load DNA for sidebar badge
  let dnaEmoji = null
  if (typeof window !== 'undefined') {
    try {
      const d = localStorage.getItem('av_dna')
      if (d) {
        const type = JSON.parse(d).type
        dnaEmoji = {E:'🌊',B:'🌿',P:'🏔️',O:'⚡'}[type as string]
      }
    } catch {}
  }

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
            {item.href === '/dashboard/profile' && isProfile && (
              <div style={{ marginLeft:28, borderLeft:'1px solid rgba(230,207,167,0.15)', paddingLeft:0, marginTop:2, marginBottom:4 }}>
                {PROFILE_SUBNAV.map(sub => {
                  const isSubActive = currentTab === sub.key
                  const isLocked = !unlocked[sub.key]
                  return (
                    <Link
                      key={sub.key}
                      href={isLocked ? '#' : `/dashboard/profile${sub.query}`}
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
                      {isLocked && <span style={{ marginLeft:'auto', fontSize:9, opacity:0.5 }}>🔒</span>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {/* Divider */}
        <div style={{ margin:'8px 0', borderTop:'1px solid rgba(255,255,255,0.07)' }} />

        {/* Premium section */}
        <div style={{ padding:'4px 16px 6px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:9, color:'rgba(230,207,167,0.3)', letterSpacing:'0.14em', textTransform:'uppercase' }}>Premium</span>
          <span style={{ fontSize:9, background:'rgba(230,207,167,0.15)', color:C.wheat, padding:'2px 8px', borderRadius:10, fontWeight:600, letterSpacing:'0.04em' }}>🔒 ₹199/mo</span>
        </div>
        {PREMIUM_NAV.map(item => (
          <Link key={item.href} href={item.href} style={{
            display:'flex', alignItems:'center', gap:9, padding:'10px 16px', textDecoration:'none',
            fontSize:13, fontFamily:'inherit',
            borderLeft:`2px solid ${isActive(item.href)?C.wheat:'transparent'}`,
            background:isActive(item.href)?'rgba(230,207,167,0.1)':'transparent',
            color:'rgba(255,255,255,0.3)',
            fontWeight:400, transition:'all 0.15s', opacity:0.6,
          }}>
            <span style={{ fontSize:15, width:20, textAlign:'center' }}>{item.icon}</span>
            {item.label}
            <span style={{ marginLeft:'auto', fontSize:11 }}>🔒</span>
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding:10, borderTop:'1px solid rgba(230,207,167,0.08)' }}>
        {/* Upgrade CTA */}
        <div style={{ background:'rgba(230,207,167,0.07)', border:'1px solid rgba(230,207,167,0.14)', borderRadius:7, padding:'10px 12px', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
            {dnaEmoji && <span style={{ fontSize:16 }}>{dnaEmoji}</span>}
            <div>
              <p style={{ fontSize:11, color:'rgba(230,207,167,0.7)', fontWeight:600, margin:0 }}>Free plan</p>
              <p style={{ fontSize:10, color:'rgba(230,207,167,0.35)', margin:0 }}>Unlock investment plan</p>
            </div>
          </div>
          <Link href="/upgrade" style={{ display:'block', width:'100%', padding:'7px', background:C.wheat, color:C.fg, border:'none', borderRadius:5, fontSize:11.5, fontWeight:700, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
            Upgrade to Premium
          </Link>
        </div>

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
          ↪ Sign out
        </button>
      </div>
    </aside>
  )
}

function TopBar() {
  const pathname = usePathname()
  const page = ALL_NAV.find(n => n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href))
  const isPremium = PREMIUM_NAV.some(n => pathname.startsWith(n.href))
  return (
    <header style={{ height:46, borderBottom:'1px solid #E4DDD1', background:'#fff', display:'flex', alignItems:'center', padding:'0 24px', gap:10, position:'sticky', top:0, zIndex:40, fontFamily:'"Sora",-apple-system,sans-serif' }}>
      <span style={{ fontSize:15 }}>{page?.icon}</span>
      <h1 style={{ fontSize:13, fontWeight:600, color:'#1C2B22', margin:0 }}>{page?.label||'Dashboard'}</h1>
      {isPremium && <span style={{ fontSize:10, background:'#1E293B', color:C.wheat, padding:'2px 8px', borderRadius:20, fontWeight:600 }}>🔒 Premium</span>}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, color:'#A09080' }}>FY 2024–25</span>
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
          <TopBar />
          <main style={{ flex:1, padding:'24px 28px', maxWidth:1100, width:'100%' }}>
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  )
}
