'use client'
import { useState, useEffect } from 'react'
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

// Tiny helpers
const isValidPhone = (p: string) => /^[6-9]\d{9}$/.test(p)
const isValidPAN = (p: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p.toUpperCase())
const isValidAadhaar = (a: string) => /^\d{12}$/.test(a)

type Step = 'phone' | 'phone_otp' | 'pan' | 'aadhaar_consent' | 'aadhaar_otp' | 'password'

export default function SignupPage() {
  const { setUser } = useAppStore()
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [loading, setLoading] = useState(false)
  const [otpTimer, setOtpTimer] = useState(0)

  // Form data across steps
  const [phone, setPhone] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [pan, setPan] = useState('')
  const [dob, setDob] = useState('')
  const [kycConsent, setKycConsent] = useState(true)
  const [aadhaar, setAadhaar] = useState('')
  const [aadhaarOtp, setAadhaarOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // OTP countdown timer
  useEffect(() => {
    if (otpTimer <= 0) return
    const t = setInterval(() => setOtpTimer(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [otpTimer])

  const handleSendPhoneOtp = () => {
    if (!isValidPhone(phone)) { toast.error('Please enter a valid 10-digit mobile number starting with 6-9'); return }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep('phone_otp')
      setOtpTimer(30)
      toast.success('OTP sent! (For now, any 6 digits will work)')
    }, 700)
  }

  const handleVerifyPhoneOtp = () => {
    if (phoneOtp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep('pan')
      toast.success('Mobile verified')
    }, 600)
  }

  const handleResendOtp = () => {
    if (otpTimer > 0) return
    setOtpTimer(30)
    toast.success('OTP resent')
  }

  const handleSubmitPan = () => {
    if (!isValidPAN(pan)) { toast.error('PAN format: ABCDE1234F'); return }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) { toast.error('Please enter your date of birth'); return }
    if (!kycConsent) { toast.error('Please agree to CKYC consent to continue'); return }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep('aadhaar_consent')
      toast.success('PAN verified')
    }, 700)
  }

  const handleAadhaarContinue = () => {
    setStep('aadhaar_otp')
    setOtpTimer(30)
    toast('Redirecting to Digilocker…', { icon: '🔒' })
  }

  const handleVerifyAadhaarOtp = () => {
    if (!isValidAadhaar(aadhaar)) { toast.error('Enter your 12-digit Aadhaar number'); return }
    if (aadhaarOtp.length !== 6) { toast.error('Enter the 6-digit Aadhaar OTP'); return }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep('password')
      toast.success('Aadhaar KYC complete')
    }, 800)
  }

  const handleSetPassword = () => {
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    setTimeout(() => {
      setUser({
        email: `${phone}@arthvo.local`,
        name: `User ${phone.slice(-4)}`,
        provider: 'email',
        createdAt: new Date().toISOString(),
      })
      toast.success('Account created! Welcome to ArthVo 🎉')
      router.push('/dashboard/ais')
    }, 800)
  }

  const stepNumber: Record<Step, number> = { phone: 1, phone_otp: 2, pan: 3, aadhaar_consent: 4, aadhaar_otp: 5, password: 6 }
  const currentStep = stepNumber[step]
  const totalSteps = 6

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
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </nav>

      {/* Progress bar */}
      <div style={{ padding: '16px 52px 0', maxWidth: 520, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: '#64748B' }}>
          <span style={{ fontWeight: 600, color: '#059669' }}>Step {currentStep} of {totalSteps}</span>
          <span>{Math.round((currentStep / totalSteps) * 100)}% complete</span>
        </div>
        <div style={{ height: 4, background: '#E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(currentStep / totalSteps) * 100}%`, background: '#059669', transition: 'width 0.4s ease', borderRadius: 10 }} />
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px 48px' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {/* STEP 1: Phone */}
          {step === 'phone' && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Sign up now</h1>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 28 }}>Join thousands of Indians taking control of their taxes.</p>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Mobile number</label>
              <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRight: 'none', borderRadius: '10px 0 0 10px', fontSize: 14, color: '#334155', fontWeight: 500 }}>
                  🇮🇳 +91
                </div>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number" className="input" maxLength={10}
                  style={{ flex: 1, padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '0 10px 10px 0', fontSize: 15, fontFamily: 'inherit' }} />
              </div>
              <button onClick={handleSendPhoneOtp} disabled={loading || !isValidPhone(phone)} className="cta"
                style={{ width: '100%', padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Sending OTP…' : 'Get OTP →'}
              </button>
              <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 18, lineHeight: 1.6 }}>
                By proceeding, you agree to our <a href="#" style={{ color: '#64748B', textDecoration: 'underline' }}>Terms</a> and{' '}
                <a href="/privacy" style={{ color: '#64748B', textDecoration: 'underline' }}>Privacy Policy</a>
              </p>
            </>
          )}

          {/* STEP 2: Phone OTP */}
          {step === 'phone_otp' && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Mobile OTP</h1>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 28 }}>
                Sent to +91 {phone}{' '}
                <button onClick={() => setStep('phone')} style={{ color: '#059669', background: 'none', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>(change)</button>
              </p>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Enter 6-digit OTP</label>
              <input type="tel" value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••" className="input otp-input" maxLength={6} autoFocus
                style={{ width: '100%', padding: '14px', border: '1px solid #CBD5E1', borderRadius: 10, fontFamily: 'inherit', marginBottom: 12 }} />
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>
                {otpTimer > 0 ? (
                  <>Resend OTP in <span style={{ color: '#059669', fontWeight: 500 }}>{otpTimer}s</span></>
                ) : (
                  <button onClick={handleResendOtp} style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>Resend OTP</button>
                )}
              </div>
              <button onClick={handleVerifyPhoneOtp} disabled={loading || phoneOtp.length !== 6} className="cta"
                style={{ width: '100%', padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Verifying…' : 'Continue →'}
              </button>
            </>
          )}

          {/* STEP 3: PAN + DOB */}
          {step === 'pan' && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Let's get started</h1>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>We need your PAN to fetch tax info from the Income Tax Department.</p>

              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>PAN</label>
              <input type="text" value={pan} onChange={e => setPan(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F" className="input" maxLength={10}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }} />

              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Date of birth <span style={{ color: '#94A3B8', fontWeight: 400 }}>(as per PAN)</span></label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                className="input"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', marginBottom: 18 }} />

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
                <input type="checkbox" checked={kycConsent} onChange={e => setKycConsent(e.target.checked)}
                  style={{ width: 16, height: 16, marginTop: 2, accentColor: '#059669', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                  I authorise ArthVo to fetch my KYC information from the CKYC registry with my PAN.
                </span>
              </label>

              <button onClick={handleSubmitPan} disabled={loading || !isValidPAN(pan) || !dob || !kycConsent} className="cta"
                style={{ width: '100%', padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Verifying PAN…' : 'Continue →'}
              </button>
            </>
          )}

          {/* STEP 4: Aadhaar consent */}
          {step === 'aadhaar_consent' && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Aadhaar KYC</h1>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>Verify your identity via Digilocker — takes 30 seconds.</p>

              <div style={{ background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <li style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, display: 'flex', gap: 10 }}>
                    <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>•</span>
                    The Aadhaar and PAN <strong style={{ color: '#1E293B' }}>{pan}</strong> should belong to you.
                  </li>
                  <li style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, display: 'flex', gap: 10 }}>
                    <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>•</span>
                    You'll be redirected to Digilocker for Aadhaar OTP verification.
                  </li>
                  <li style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, display: 'flex', gap: 10 }}>
                    <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>•</span>
                    By proceeding, you consent to share PAN and Aadhaar info (excluding number) with ArthVo.
                  </li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('pan')}
                  style={{ padding: '14px 20px', background: '#fff', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontWeight: 500, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Back
                </button>
                <button onClick={handleAadhaarContinue} className="cta"
                  style={{ flex: 1, padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Continue to Digilocker →
                </button>
              </div>
            </>
          )}

          {/* STEP 5: Aadhaar OTP */}
          {step === 'aadhaar_otp' && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Aadhaar verification</h1>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>Enter your Aadhaar number and the OTP sent to your registered mobile.</p>

              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Aadhaar number</label>
              <input type="tel" value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="12-digit Aadhaar number" className="input" maxLength={12}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', marginBottom: 16, letterSpacing: '0.1em' }} />

              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Aadhaar OTP</label>
              <input type="tel" value={aadhaarOtp} onChange={e => setAadhaarOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••" className="input otp-input" maxLength={6}
                style={{ width: '100%', padding: '14px', border: '1px solid #CBD5E1', borderRadius: 10, fontFamily: 'inherit', marginBottom: 12 }} />

              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>
                {otpTimer > 0 ? (
                  <>Resend OTP in <span style={{ color: '#059669', fontWeight: 500 }}>{otpTimer}s</span></>
                ) : (
                  <button onClick={() => setOtpTimer(30)} style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>Resend OTP</button>
                )}
              </div>

              <button onClick={handleVerifyAadhaarOtp} disabled={loading || !isValidAadhaar(aadhaar) || aadhaarOtp.length !== 6} className="cta"
                style={{ width: '100%', padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Verifying Aadhaar…' : 'Complete KYC →'}
              </button>
            </>
          )}

          {/* STEP 6: Password */}
          {step === 'password' && (
            <>
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#065F46' }}>
                ✅ KYC verified successfully! Just one more step.
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.025em', marginBottom: 6 }}>Set your password</h1>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>
                Your User ID will be your mobile number: <strong style={{ color: '#1E293B' }}>+91 {phone}</strong>
              </p>

              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Create password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters" className="input"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', marginBottom: 16 }} />

              <label style={{ fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 6 }}>Confirm password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password" className="input"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', marginBottom: 20 }} />

              <button onClick={handleSetPassword} disabled={loading || password.length < 6 || password !== confirmPassword} className="cta"
                style={{ width: '100%', padding: '14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Creating account…' : 'Create account →'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
