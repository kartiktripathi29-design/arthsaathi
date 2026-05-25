// Browser-side Supabase client. Use in client components for sign-in / sign-up / sign-out actions
// or to read the current user from the session cookie via supabase.auth.getUser().

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
