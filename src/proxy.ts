// Next 16 Proxy (formerly `middleware.ts`; renamed in v16, runs on the Node.js runtime).
// Delegates to the Supabase session-refresh helper, which no-ops until Supabase is configured.

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static asset files. Includes /api and pages so
    // the auth cookie is refreshed everywhere a session might be read.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
