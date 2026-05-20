'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }

const PROFILE_TABS = [
  { key:'documents', label:'Documents', path:'/dashboard/profile/documents', icon:'📑' },
  { key:'salary', label:'Salary', path:'/dashboard/profile/salary', icon:'💰' },
  { key:'other-income', label:'Other Income', path:'/dashboard/profile/other-income', icon:'📊' },
  { key:'exemptions', label:'Exemptions', path:'/dashboard/profile/exemptions', icon:'✓' },
  { key:'deductions', label:'Deductions', path:'/dashboard/profile/deductions', icon:'💸' },
]

function ProfileTabBar() {
  const pathname = usePathname()
  const router = useRouter()
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
    } catch (e) {
      console.error('Failed to load profile completion:', e)
    }
  }, [])

  const activeTab = PROFILE_TABS.find(t => pathname === t.path)?.key || 'documents'

  const handleTabClick = (tabKey: string) => {
    if (!unlocked[tabKey]) {
      toast.error(`Complete previous steps to unlock "${PROFILE_TABS.find(t => t.key === tabKey)?.label}"`)
      return
    }
    const path = PROFILE_TABS.find(t => t.key === tabKey)?.path
    if (path) router.push(path)
  }

  return (
    <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.border}`, background:'#fff', marginBottom:24 }}>
      {PROFILE_TABS.map(tab => {
        const isActive = activeTab === tab.key
        const isLocked = !unlocked[tab.key]
        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            disabled={isLocked}
            style={{
              padding:'12px 16px',
              fontSize:13,
              fontWeight: isActive ? 600 : 400,
              color: isLocked ? C.muted : isActive ? C.fg : C.text,
              background: isActive ? C.wl : 'transparent',
              border:'none',
              borderBottom: isActive ? `2px solid ${C.fg}` : '1px solid transparent',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontFamily:'inherit',
              opacity: isLocked ? 0.5 : 1,
              transition:'all 0.15s',
              display:'flex',
              alignItems:'center',
              gap:6,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {isLocked && <span style={{ fontSize:11, marginLeft:4 }}>🔒</span>}
          </button>
        )
      })}
    </div>
  )
}

export function unlockNextTab(currentTabKey: string) {
  try {
    const currentIndex = PROFILE_TABS.findIndex(t => t.key === currentTabKey)
    if (currentIndex === -1) return
    
    const completion = JSON.parse(localStorage.getItem('av_profile_completion') || '{}')
    const nextTab = PROFILE_TABS[currentIndex + 1]
    
    if (nextTab) {
      completion[nextTab.key] = true
      localStorage.setItem('av_profile_completion', JSON.stringify(completion))
    }
  } catch (e) {
    console.error('Failed to unlock next tab:', e)
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div style={{ height:46, background:'#fff', borderBottom:`1px solid ${C.border}` }} />}>
        <ProfileTabBar />
      </Suspense>
      <div>
        {children}
      </div>
    </div>
  )
}
