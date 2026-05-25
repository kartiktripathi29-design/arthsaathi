// Server-side Supabase client. Use in Server Components, Route Handlers, and Server Actions to
// read the current user from cookies. Reads/writes session cookies via Next.js cookies() API.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(toSet) {
          try {
            for (const c of toSet) cookieStore.set(c.name, c.value, c.options)
          } catch {
            // Server Component setAll calls can throw — middleware refreshes the session.
          }
        },
      },
    },
  )
}

/** Returns the currently logged-in Supabase user, or null. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
