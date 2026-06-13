'use client'
// Login: email OR phone + password (signInWithPassword) for returning users. "Forgot password"
// runs an OTP reset (send code → verify → set new password). Mock phone+password fallback when
// Supabase isn't configured, so the app keeps working pre-setup.

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAppStore, type AppUser } from '@/store/AppStore'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { tokens as T } from '@/lib/tokens'
import Logo from '@/components/Logo'
import { ThemeToggle, useArthvoTheme, useThemedBase } from '@/components/ThemeToggle'

const C = { green: T.teal, ink: T.ink, sub: T.muted, line: T.hairline }
const CONFIGURED = !!process.env.NEXT_PUBLIC_SUPABASE_URL
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const isValidPhone = (p: string) => /^[6-9]\d{9}$/.test(p)

function Shell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, resolved } = useArthvoTheme()
  useThemedBase(resolved)
  return (
    <div data-theme={resolved} suppressHydrationWarning style={{ minHeight: '100vh', background: T.paper, fontFamily: '"Sora",-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cta { transition: opacity .15s, transform .15s; }
        .cta:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
        .cta:disabled { opacity: .5; cursor: not-allowed; }
        .input { transition: border-color .15s, box-shadow .15s; }
        .input:focus { outline: none; border-color: var(--teal) !important; box-shadow: 0 0 0 3px rgba(14,77,71,.1); }
        .otp-input { text-align: center; letter-spacing: .5em; font-size: 18px; font-weight: 600; }
        .btn-ghost { transition: background .15s; }
        .btn-ghost:hover { background: var(--tint) !important; }
      `}</style>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 52px', borderBottom: `1px solid ${T.hairline}` }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
          <Logo variant="onLight" size={32} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: C.sub }}>New to ArthVo?{' '}<Link href="/signup" style={{ color: C.green, fontWeight: 600, textDecoration: 'none' }}>Sign up</Link></div>
          <ThemeToggle theme={theme} setTheme={setTheme} resolved={resolved} />
        </div>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {children}
          <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', marginTop: 10 }}>
            Just want to decode an offer letter?{' '}
            <Link href="/offer" style={{ color: C.green, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Try it free, no sign-up →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const label = { fontSize: 13, fontWeight: 500, color: T.ink, display: 'block', marginBottom: 6 } as const
const field = { width: '100%', padding: '12px 14px', border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 15, fontFamily: 'inherit' } as const
const cta = { width: '100%', padding: '14px', background: C.green, color: T.ivory, border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 } as const

function IdentifierToggle({ kind, setKind }: { kind: 'email' | 'phone'; setKind: (k: 'email' | 'phone') => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {(['email', 'phone'] as const).map(k => (
        <button key={k} type="button" onClick={() => setKind(k)}
          style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${kind === k ? C.green : C.line}`, background: kind === k ? T.tint : T.card, color: kind === k ? C.green : C.sub }}>
          {k === 'email' ? 'Email' : 'Mobile'}
        </button>
      ))}
    </div>
  )
}

function IdentifierField({ kind, email, setEmail, phone, setPhone }: {
  kind: 'email' | 'phone'; email: string; setEmail: (v: string) => void; phone: string; setPhone: (v: string) => void
}) {
  if (kind === 'email') return (
    <div><label style={label}>Email address</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input" style={field} /></div>
  )
  return (
    <div><label style={label}>Mobile number</label>
      <div style={{ display: 'flex' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', background: T.tint, border: `1px solid ${C.line}`, borderRight: 'none', borderRadius: '10px 0 0 10px', fontSize: 14, color: T.ink, fontWeight: 500 }}>🇮🇳 +91</div>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" className="input" maxLength={10} style={{ ...field, borderRadius: '0 10px 10px 0' }} />
      </div></div>
  )
}

function LoginForm() {
  const { setUser } = useAppStore()
  const router = useRouter()
  const nextPath = useSearchParams().get('next') || '/dashboard'

  const [kind, setKind] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // 'login' = password sign-in; reset flow: 'send' → 'otp' → 'newpw'
  const [mode, setMode] = useState<'login' | 'send' | 'otp' | 'newpw'>('login')
  const [otp, setOtp] = useState('')
  const [newPw, setNewPw] = useState('')

  const e164 = () => `+91${phone}`
  const idValid = kind === 'email' ? isValidEmail(email) : isValidPhone(phone)
  const idLabel = kind === 'email' ? email : `+91 ${phone}`
  const supa = () => createSupabaseBrowserClient()

  const mirror = (u: { email?: string | null; created_at?: string }) => {
    const e = u.email || (kind === 'email' ? email : `${phone}@arthvo.local`)
    const user: AppUser = { email: e, name: e.split('@')[0], provider: 'email', createdAt: u.created_at || new Date().toISOString() }
    setUser(user)
  }

  const signIn = async () => {
    if (!idValid) { toast.error(kind === 'email' ? 'Enter a valid email' : 'Enter a valid mobile number'); return }
    if (password.length < 6) { toast.error('Enter your password'); return }
    setLoading(true)
    try {
      const { data, error } = kind === 'email'
        ? await supa().auth.signInWithPassword({ email, password })
        : await supa().auth.signInWithPassword({ phone: e164(), password })
      if (error || !data.user) { toast.error(error?.message || 'Invalid credentials.'); return }
      mirror(data.user)
      toast.success('Welcome back!')
      router.push(nextPath)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Sign-in failed.') } finally { setLoading(false) }
  }

  const sendReset = async () => {
    if (!idValid) { toast.error(kind === 'email' ? 'Enter a valid email' : 'Enter a valid mobile number'); return }
    setLoading(true)
    try {
      const { error } = kind === 'email'
        ? await supa().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
        : await supa().auth.signInWithOtp({ phone: e164(), options: { shouldCreateUser: false } })
      if (error) { toast.error(error.message); return }
      setMode('otp'); toast.success(`Code sent to ${idLabel}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not send the code.') } finally { setLoading(false) }
  }

  const verifyReset = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const { data, error } = kind === 'email'
        ? await supa().auth.verifyOtp({ email, token: otp, type: 'email' })
        : await supa().auth.verifyOtp({ phone: e164(), token: otp, type: 'sms' })
      if (error || !data.user) { toast.error(error?.message || 'That code didn’t work.'); return }
      setMode('newpw')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Verification failed.') } finally { setLoading(false) }
  }

  const saveNewPw = async () => {
    if (newPw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { data, error } = await supa().auth.updateUser({ password: newPw })
      if (error) { toast.error(error.message); return }
      mirror(data.user)
      toast.success('Password updated. You’re in!')
      router.push(nextPath)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not set password.') } finally { setLoading(false) }
  }

  if (mode === 'login') return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.ink, letterSpacing: '-0.025em', marginBottom: 6 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: C.sub }}>Sign in with your email or mobile number.</p>
      </div>
      <form onSubmit={e => { e.preventDefault(); signIn() }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <IdentifierToggle kind={kind} setKind={setKind} />
        <IdentifierField kind={kind} email={email} setEmail={setEmail} phone={phone} setPhone={setPhone} />
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={label}>Password</label>
            <button type="button" onClick={() => { setMode('send'); setOtp(''); setNewPw('') }} style={{ fontSize: 12, color: C.green, background: 'none', border: 'none', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Forgot?</button>
          </div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="input" style={field} />
        </div>
        <button type="submit" disabled={loading || !idValid} className="cta" style={cta}>{loading ? 'Signing in…' : 'Sign in →'}</button>
      </form>
      <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', marginTop: 18 }}>
        New to ArthVo?{' '}<Link href="/signup" style={{ color: C.green, fontWeight: 600, textDecoration: 'none' }}>Create an account →</Link>
      </p>
    </Shell>
  )

  // Reset-via-OTP flow
  return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.ink, letterSpacing: '-0.025em', marginBottom: 6 }}>Reset your password</h1>
        <p style={{ fontSize: 14, color: C.sub }}>
          {mode === 'send' ? 'We’ll send a code to verify it’s you.' : mode === 'otp' ? `Enter the code sent to ${idLabel}.` : 'Choose a new password.'}
        </p>
      </div>
      {mode === 'send' && (
        <form onSubmit={e => { e.preventDefault(); sendReset() }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <IdentifierToggle kind={kind} setKind={setKind} />
          <IdentifierField kind={kind} email={email} setEmail={setEmail} phone={phone} setPhone={setPhone} />
          <button type="submit" disabled={loading || !idValid} className="cta" style={cta}>{loading ? 'Sending…' : 'Send code →'}</button>
        </form>
      )}
      {mode === 'otp' && (
        <form onSubmit={e => { e.preventDefault(); verifyReset() }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className="input otp-input" maxLength={6} style={field} autoFocus />
          <button type="submit" disabled={loading || otp.length !== 6} className="cta" style={cta}>{loading ? 'Verifying…' : 'Verify →'}</button>
        </form>
      )}
      {mode === 'newpw' && (
        <form onSubmit={e => { e.preventDefault(); saveNewPw() }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password (min 6 chars)" className="input" style={field} autoFocus />
          <button type="submit" disabled={loading || newPw.length < 6} className="cta" style={cta}>{loading ? 'Saving…' : 'Set password & sign in →'}</button>
        </form>
      )}
      <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', marginTop: 18 }}>
        <button onClick={() => setMode('login')} style={{ color: C.green, background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>← Back to sign in</button>
      </p>
    </Shell>
  )
}

// Fallback when Supabase isn't configured: original mock phone+password login.
function MockLogin() {
  const { setUser } = useAppStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidPhone(phone)) { toast.error('Enter your 10-digit mobile number'); return }
    if (password.length < 6) { toast.error('Enter your password'); return }
    setLoading(true)
    setTimeout(() => {
      setUser({ email: `${phone}@arthvo.local`, name: `User ${phone.slice(-4)}`, provider: 'email', createdAt: new Date().toISOString() })
      toast.success('Welcome back!'); router.push('/dashboard')
    }, 600)
  }
  return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.ink, letterSpacing: '-0.025em', marginBottom: 6 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: C.sub }}>Sign in with your mobile number and password.</p>
      </div>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={label}>Mobile number</label>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', background: T.tint, border: `1px solid ${C.line}`, borderRight: 'none', borderRadius: '10px 0 0 10px', fontSize: 14, color: T.ink, fontWeight: 500 }}>🇮🇳 +91</div>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" className="input" maxLength={10} style={{ ...field, borderRadius: '0 10px 10px 0' }} />
          </div></div>
        <div><label style={label}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="input" style={field} /></div>
        <button type="submit" disabled={loading} className="cta" style={cta}>{loading ? 'Signing in…' : 'Sign in →'}</button>
      </form>
      <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', marginTop: 18 }}>
        Don&apos;t have an account?{' '}<Link href="/signup" style={{ color: C.green, fontWeight: 600, textDecoration: 'none' }}>Create one →</Link>
      </p>
    </Shell>
  )
}

export default function LoginPage() {
  if (!CONFIGURED) return <MockLogin />
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: T.paper }} />}>
      <LoginForm />
    </Suspense>
  )
}
