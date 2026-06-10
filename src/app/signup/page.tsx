'use client'
// Signup: identifier (email or phone) → OTP → set password. Real auth via Supabase when configured;
// a minimal mock (no real OTP) when Supabase env is absent so local/dev still works.
//
// NOTE: phone OTP requires an SMS provider configured in Supabase (paid). Email OTP requires
// "Confirm email" OFF + a Magic Link template that contains {{ .Token }} so a CODE is sent.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/AppStore'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { tokens as T } from '@/lib/tokens'
import Logo from '@/components/Logo'

const CONFIGURED = !!process.env.NEXT_PUBLIC_SUPABASE_URL
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const isValidPhone = (p: string) => /^[6-9]\d{9}$/.test(p)

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: T.paper, fontFamily: '"Sora",-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cta { transition: opacity .15s, transform .15s; }
        .cta:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
        .cta:disabled { opacity: .5; cursor: not-allowed; }
        .input { transition: border-color .15s, box-shadow .15s; }
        .input:focus { outline: none; border-color: var(--teal) !important; box-shadow: 0 0 0 3px rgba(14,77,71,.1); }
        .otp-input { text-align: center; letter-spacing: .5em; font-size: 18px; font-weight: 600; }
      `}</style>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 52px', borderBottom: `1px solid ${T.hairline}` }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Logo variant="onLight" size={32} />
        </Link>
        <div style={{ fontSize: 13, color: T.muted }}>Already have an account?{' '}<Link href="/login" style={{ color: T.teal, fontWeight: 600, textDecoration: 'none' }}>Sign in</Link></div>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>{children}</div>
      </div>
    </div>
  )
}

const label = { fontSize: 13, fontWeight: 500, color: T.ink, display: 'block', marginBottom: 6 } as const
const field = { width: '100%', padding: '12px 14px', border: `1px solid ${T.hairline}`, borderRadius: 10, fontSize: 15, fontFamily: 'inherit' } as const
const cta = { width: '100%', padding: '14px', background: T.teal, color: T.ivory, border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 } as const

function IdentifierToggle({ kind, setKind }: { kind: 'email' | 'phone'; setKind: (k: 'email' | 'phone') => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {(['email', 'phone'] as const).map(k => (
        <button key={k} type="button" onClick={() => setKind(k)}
          style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${kind === k ? T.teal : T.hairline}`, background: kind === k ? T.tint : T.card, color: kind === k ? T.teal : T.muted }}>
          {k === 'email' ? 'Email' : 'Mobile'}
        </button>
      ))}
    </div>
  )
}

export default function SignupPage() {
  const { setUser } = useAppStore()
  const router = useRouter()
  const [kind, setKind] = useState<'email' | 'phone'>('email')
  const [step, setStep] = useState<'identify' | 'otp' | 'password'>('identify')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const e164 = () => `+91${phone}`
  const identifierValid = kind === 'email' ? isValidEmail(email) : isValidPhone(phone)
  const idLabel = kind === 'email' ? email : `+91 ${phone}`

  const finishUser = (resolvedEmail: string) => {
    setUser({
      email: resolvedEmail || (kind === 'email' ? email : `${phone}@arthvo.local`),
      name: (resolvedEmail || (kind === 'email' ? email : `User ${phone.slice(-4)}`)).split('@')[0],
      provider: 'email',
      createdAt: new Date().toISOString(),
    })
    toast.success('Account created! Welcome to ArthVo 🎉')
    router.push('/dashboard')
  }

  const sendOtp = async () => {
    if (!identifierValid) { toast.error(kind === 'email' ? 'Enter a valid email' : 'Enter a valid 10-digit mobile number'); return }
    if (!CONFIGURED) { setStep('password'); return } // mock: skip OTP
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = kind === 'email'
        ? await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
        : await supabase.auth.signInWithOtp({ phone: e164(), options: { shouldCreateUser: true } })
      if (error) { toast.error(error.message); return }
      setStep('otp')
      toast.success(`Code sent to ${idLabel}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the code.')
    } finally { setLoading(false) }
  }

  const verifyOtp = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      // New-user codes can verify under either 'email' (Magic Link / Confirm-email-off) or 'signup'
      // (Confirm signup template). Try 'email' first, fall back to 'signup' so it works regardless
      // of the project's "Confirm email" setting.
      let res
      if (kind === 'email') {
        res = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
        if (res.error) res = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' })
      } else {
        res = await supabase.auth.verifyOtp({ phone: e164(), token: otp, type: 'sms' })
      }
      if (res.error || !res.data.user) { toast.error(res.error?.message || 'That code didn’t work.'); return }
      setStep('password')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed.')
    } finally { setLoading(false) }
  }

  const setPwd = async () => {
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (!CONFIGURED) { finishUser(kind === 'email' ? email : ''); return } // mock
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.auth.updateUser({ password })
      if (error) { toast.error(error.message); return }
      finishUser(data.user?.email || '')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set password.')
    } finally { setLoading(false) }
  }

  return (
    <Shell>
      {!CONFIGURED && (
        <div style={{ background: T.caution.fill, border: `1px solid ${T.caution.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: T.caution.text, lineHeight: 1.5 }}>
          ⚠️ Auth isn’t configured here — this is a local placeholder signup (no real OTP).
        </div>
      )}

      {step === 'identify' && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: '-0.025em', marginBottom: 6 }}>Create your account</h1>
          <p style={{ fontSize: 14, color: T.muted, marginBottom: 22 }}>We’ll send a one-time code to verify it’s you.</p>
          <IdentifierToggle kind={kind} setKind={setKind} />
          {kind === 'email' ? (
            <>
              <label style={label}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input" style={{ ...field, marginBottom: 18 }} autoFocus />
            </>
          ) : (
            <>
              <label style={label}>Mobile number</label>
              <div style={{ display: 'flex', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', background: T.tint, border: `1px solid ${T.hairline}`, borderRight: 'none', borderRadius: '10px 0 0 10px', fontSize: 14, color: T.ink, fontWeight: 500 }}>🇮🇳 +91</div>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" className="input" maxLength={10} style={{ ...field, borderRadius: '0 10px 10px 0' }} autoFocus />
              </div>
            </>
          )}
          <button onClick={sendOtp} disabled={loading || !identifierValid} className="cta" style={cta}>{loading ? 'Sending…' : 'Send OTP →'}</button>
        </>
      )}

      {step === 'otp' && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: '-0.025em', marginBottom: 6 }}>Enter the code</h1>
          <p style={{ fontSize: 14, color: T.muted, marginBottom: 22 }}>Sent to {idLabel}{' '}<button onClick={() => { setStep('identify'); setOtp('') }} style={{ color: T.teal, background: 'none', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>(change)</button></p>
          <input type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className="input otp-input" maxLength={6} style={{ ...field, marginBottom: 18 }} autoFocus />
          <button onClick={verifyOtp} disabled={loading || otp.length !== 6} className="cta" style={cta}>{loading ? 'Verifying…' : 'Verify →'}</button>
        </>
      )}

      {step === 'password' && (
        <>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: '-0.025em', marginBottom: 6 }}>Set a password</h1>
          <p style={{ fontSize: 14, color: T.muted, marginBottom: 22 }}>You’ll use {idLabel} + this password to sign in next time.</p>
          <label style={label}>Create password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" className="input" style={{ ...field, marginBottom: 16 }} autoFocus />
          <label style={label}>Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" className="input" style={{ ...field, marginBottom: 18 }} />
          <button onClick={setPwd} disabled={loading || password.length < 6 || password !== confirm} className="cta" style={cta}>{loading ? 'Creating…' : 'Create account →'}</button>
        </>
      )}
    </Shell>
  )
}
