'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAppStore } from '@/store/AppStore'

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

export default function LoginPage() {
  const { setUser } = useAppStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const handleOAuth = (provider: 'google' | 'facebook' | 'apple') => {
    toast('OAuth sign-in coming soon. Please use email for now.', { icon: '🔒', duration: 3500 })
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please enter email and password'); return
    }
    setLoading(true)
    setTimeout(() => {
      const name = form.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      setUser({
        email: form.email, name, provider: 'email',
        createdAt: new Date().toISOString(),
      })
      toast.success(`Welcome back, ${name}!`)
      router.push('/dashboard/ais')
    }, 600)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: '"Sora",-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .oauth-btn { transition: background 0.15s, border-color 0.15s; }
        .oauth-btn:hover { background: #F8FAFC !important; border-color: #94A3B8 !important; }
        .cta { transition: opacity 0.15s, transform 0.15s; }
        .cta:hover { opacity: 0.92; transform: translateY(-1px); }
        .input { transition: border-color 0.15s, box-shadow 0.15s; }
        .input:focus { outline: none; border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.1); }
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
          <Link href="/signup" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>Create account</Link>
        </div>
      </nav>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 8 }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>Sign in to access your dashboard.</p>
          </div>

          {/* OAuth */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button onClick={() => handleOAuth('google')} className="oauth-btn" style={{ padding: '11px 14px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </button>
            <button onClick={() => handleOAuth('facebook')} className="oauth-btn" style={{ padding: '11px 14px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Sign in with Facebook
            </button>
            <button onClick={() => handleOAuth('apple')} className="oauth-btn" style={{ padding: '11px 14px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Sign in with Apple
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>or with email</span>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com" className="input"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>Password</label>
                <a href="#" onClick={(e) => { e.preventDefault(); toast('Password reset coming soon', { icon: '🔒' }) }}
                  style={{ fontSize: 12, color: '#059669', textDecoration: 'none', fontWeight: 500 }}>Forgot?</a>
              </div>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Your password" className="input"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 14, fontFamily: 'inherit' }} />
            </div>
            <button type="submit" disabled={loading} className="cta"
              style={{ padding: '13px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
