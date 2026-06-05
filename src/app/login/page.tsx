'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/AppStore'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="16" fill="#059669"/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#FFFFFF"/>
      <circle cx="90" cy="24" r="18" fill="#FFFFFF"/>
      <circle cx="90" cy="24" r="11" fill="#059669"/>
    </svg>
  )
}

const CONFIGURED = !!process.env.NEXT_PUBLIC_SUPABASE_URL
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

function LoginForm() {
  const { setUser } = useAppStore()
  const router = useRouter()
  const params = useSearchParams()
  const nextPath = params.get('next') || '/dashboard'

  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpTimer, setOtpTimer] = useState(0)

  // Resend countdown
  useEffect(() => {
    if (otpTimer <= 0) return
    const t = setInterval(() => setOtpTimer(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [otpTimer])

  const sendOtp = async () => {
    if (!isValidEmail(email)) { toast.error('Enter a valid email address'); return }
    if (!CONFIGURED) { toast.error('Email sign-in isn’t configured yet.'); return }
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }, // passwordless: signs in OR creates the account
      })
      if (error) { toast.error(error.message); return }
      setStep('otp')
      setOtpTimer(30)
      toast.success('We sent a 6-digit code to your email.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the code.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
      if (error || !data.user) { toast.error(error?.message || 'That code didn’t work.'); return }
      // Mirror into the client store the rest of the app already reads.
      setUser({
        email: data.user.email || email,
        name: (data.user.email || email).split('@')[0],
        provider: 'email',
        createdAt: data.user.created_at || new Date().toISOString(),
      })
      toast.success('Welcome to ArthVo!')
      router.push(nextPath)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (otpTimer > 0) return
    await sendOtp()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: '"Sora",-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cta { transition: opacity 0.15s, transform 0.15s; }
        .cta:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .cta:disabled { opacity: 0.5; cursor: not-allowed; }
        .input { transition: border-color 0.15s, box-shadow 0.15s; }
        .input:focus { outline: none; border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.1); }
        .otp-input { text-align: center; letter-spacing: 0.5em; font-size: 18px; font-weight: 600; }
      `}</style>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 52px', borderBottom: '1px solid #F0FDF4' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Logo size={32} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, color: '#1E293B', letterSpacing: '-0.025em' }}>Arth<span style={{ color: '#059669' }}>Vo</span></div>
            <div style={{ fontSize: 8, color: '#94A3B8', letterSpacing: '0.18em', marginTop: -1 }}>WEALTH EVOLVED</div>
          </div>
        </Link>
        <div style={{ fontSize: 13, color: '#64748B' }}>
          New to ArthVo?{' '}
          <Link href="/signup" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
        </div>
      </nav>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {!CONFIGURED && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: '#92400E', lineHeight: 1.5 }}>
              ⚠️ Email sign-in isn’t configured on this environment yet. Set the Supabase keys to enable it.
            </div>
          )}

          {step === 'email' ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Sign in</h1>
                <p style={{ fontSize: 14, color: '#64748B' }}>We’ll email you a 6-digit code — no password needed.</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); sendOtp() }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
                    placeholder="you@example.com" className="input"
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }} />
                </div>
                <button type="submit" disabled={loading || !isValidEmail(email)} className="cta"
                  style={{ padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                  {loading ? 'Sending code…' : 'Email me a code →'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Enter your code</h1>
                <p style={{ fontSize: 14, color: '#64748B' }}>
                  Sent to {email}{' '}
                  <button onClick={() => { setStep('email'); setOtp('') }} style={{ color: '#059669', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>(change)</button>
                </p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); verifyOtp() }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••" className="input otp-input" maxLength={6} autoFocus
                  style={{ width: '100%', padding: '14px', border: '1px solid #CBD5E1', borderRadius: 10, fontFamily: 'inherit' }} />
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {otpTimer > 0 ? (
                    <>Resend code in <span style={{ color: '#059669', fontWeight: 500 }}>{otpTimer}s</span></>
                  ) : (
                    <button type="button" onClick={resend} style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>Resend code</button>
                  )}
                </div>
                <button type="submit" disabled={loading || otp.length !== 6} className="cta"
                  style={{ padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                  {loading ? 'Verifying…' : 'Verify & continue →'}
                </button>
              </form>
            </>
          )}

          <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 24 }}>
            New to ArthVo?{' '}
            <Link href="/signup" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>Create an account →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FFFFFF' }} />}>
      <LoginForm />
    </Suspense>
  )
}
