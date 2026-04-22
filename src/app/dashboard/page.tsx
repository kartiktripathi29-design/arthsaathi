'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardRootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/ais')
  }, [router])

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Sora",-apple-system,sans-serif', color: '#64748B', fontSize: 14 }}>
      Loading…
    </div>
  )
}
