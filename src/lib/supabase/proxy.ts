// Supabase session refresh for Next 16 Proxy (the file convention formerly called "middleware").
//
// Runs before every matched request: refreshes the auth cookie so server components / route
// handlers see a live session, and coarse-gates /dashboard. Real authorization still happens in
// each route via requireUser() — Proxy alone is not an auth boundary (Next 16 docs).
//
// GUARD: when Supabase env vars are absent the whole thing is a no-op, so the app keeps running in
// its current (mock-auth) mode until Supabase is configured. Nothing breaks before setup.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return response // not configured yet → pass through untouched

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Must be called to refresh an expired token and rewrite the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Coarse redirect for unauthenticated dashboard hits. (Defense-in-depth; routes re-check.)
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}
