'use client'
import { useState, useEffect } from 'react'

const PASSWORD = 'Arthvo@2026'
const SESSION_KEY = 'arthvo_access'
const SESSION_DURATION = 24 * 60 * 60 * 1000

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      const { expiry } = JSON.parse(stored)
      if (Date.now() < expiry) {
        setUnlocked(true)
      } else {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    setChecking(false)
  }, [])

  const attempt = () => {
    if (input === PASSWORD) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ expiry: Date.now() + SESSION_DURATION }))
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setInput('')
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') attempt()
  }

  if (checking) return null
  if (unlocked) return <>{children}</>

  return (
    <div style={{
      minHeight: '100vh', background: '#0F2640',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="64" height="64" viewBox="0 0 120 120" fill="none">
            <rect width="120" height="120" rx="16" fill="#C9A84C"/>
            <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#0F2640"/>
            <circle cx="90" cy="24" r="18" fill="#C9A84C"/>
            <circle cx="90" cy="24" r="11" fill="#0F2640"/>
          </svg>
        </div>

        <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>
          Arth<span style={{ color: '#C9A84C' }}>Vo</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', marginBottom: 40, textTransform: 'uppercase' }}>
          Wealth Evolved
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px 28px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Private Beta</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24, lineHeight: 1.6 }}>
            ArthVo is currently in private testing. Enter the access password to continue.
          </div>

          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            onKeyDown={onKey}
            placeholder="Enter access password"
            autoFocus
            style={{
              width: '100%', padding: '12px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${error ? '#E74C3C' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 10, fontSize: 14, color: '#fff',
              outline: 'none', marginBottom: 12,
              fontFamily: 'inherit',
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: '#E74C3C', marginBottom: 12 }}>
              Incorrect password. Please try again.
            </div>
          )}

          <button onClick={attempt}
            style={{
              width: '100%', padding: '12px',
              background: '#C9A84C', color: '#0F2640',
              border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
            Enter ArthVo →
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 24 }}>
          © 2025 ArthVo · Private Beta
        </div>
      </div>
    </div>
  )
}
