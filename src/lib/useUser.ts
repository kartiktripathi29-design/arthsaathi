'use client'
// Client hook exposing the current Supabase user to components. Subscribes to auth changes so the
// UI reacts to sign-in / sign-out. Returns { user: null, loading: false } when Supabase isn't
// configured yet (mock mode), so callers never crash on a missing env var.

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const CONFIGURED = !!process.env.NEXT_PUBLIC_SUPABASE_URL

export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(CONFIGURED)

  useEffect(() => {
    if (!CONFIGURED) return
    const supabase = createSupabaseBrowserClient()
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user)
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
