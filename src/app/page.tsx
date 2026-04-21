import Link from 'next/link'
import BgDemo from '@/components/BgDemo'

function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="16" fill="#059669"/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#FFFFFF"/>
      <circle cx="90" cy="24" r="18" fill="#FFFFFF"/>
      <circle cx="90" cy="24" r="11" fill="#059669"/>
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', color: '#1E293B', fontFamily: '"Sora", -apple-system, BlinkMacSystemFont, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cta { transition: opacity 0.15s, transform 0.15s; }
        .cta:hover { opacity: 0.9; transform: translateY(-1px); }
        .ghost { transition: background 0.15s; }
        .ghost:hover { background: #F0FDF4 !important; }
        .pain-card { transition: border-color 0.2s, transform 0.2s; }
        .pain-card:hover { border-color: #6EE7B7 !important; transform: translateY(-2px); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fu { animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.2s; }
        .d3 { animation-delay: 0.35s; }
      `}</style>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 52px', borderBottom: '1px solid #F0FDF4', position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 50 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Logo size={32} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, color: '#1E293B', letterSpacing: '-0.025em' }}>Arth<span style={{ color: '#059669' }}>Vo</span></div>
            <div style={{ fontSize: 8, color: '#94A3B8', letterSpacing: '0.18em', marginTop: -1 }}>WEALTH EVOLVED</div>
          </div>
          <span style={{ fontSize: 9, background: '#ECFDF5', color: '#065F46', padding: '3px 8px', borderRadius: 20, marginLeft: 4, border: '1px solid #A7F3D0', fontWeight: 600, letterSpacing: '0.04em' }}>SEBI RIA</span>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/login" className="ghost" style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #D1FAE5', borderRadius: 8, color: '#475569', fontWeight: 500, textDecoration: 'none', fontSize: 13 }}>
            Sign in
          </Link>
          <Link href="/dashboard/ais" className="cta" style={{ padding: '8px 20px', background: '#059669', color: '#fff', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>
            Sign up →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '72px 48px 24px', textAlign: 'center' }}>
        <div className="fu d1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '6px 16px', borderRadius: 100, fontSize: 12, marginBottom: 32, fontWeight: 500 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
          India's first SEBI-backed AI tax & wealth platform
        </div>
        <h1 className="fu d2" style={{ fontSize: 'clamp(34px, 5.5vw, 62px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#1E293B' }}>
          Your money works harder<br />
          <span style={{ color: '#059669' }}>when you know the rules.</span>
        </h1>
      </div>

      {/* Demo */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 48px 48px' }}>
        <div className="fu d3" style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>See it in action</span>
        </div>
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #D1FAE5', boxShadow: '0 4px 24px rgba(5,150,105,0.08)' }}>
          <BgDemo />
        </div>
      </div>

      {/* Divider */}
      <div style={{ maxWidth: 760, margin: '0 auto 0', padding: '0 48px' }}>
        <div style={{ height: 1, background: '#F0FDF4' }} />
      </div>

      {/* Sounds familiar */}
      <div style={{ padding: '72px 52px', background: '#F8FFFE' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 48, letterSpacing: '-0.025em', color: '#1E293B' }}>
            Sounds familiar?{'  '}<span style={{ color: '#059669', fontWeight: 400 }}>We fix this.</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { pain: '"Got an IT notice for FD interest I never reported."', fix: 'AIS shows every rupee of interest income. ArthVo flags it before the taxman does.' },
              { pain: '"My CA charges ₹5,000 just to tell me which regime to pick."', fix: 'ArthVo compares Old vs New regime in seconds — personalised to your exact numbers.' },
              { pain: '"I had capital gains last year and no idea how to report them."', fix: 'AIS has all your capital gains. ArthVo reads them and calculates tax automatically.' },
            ].map((p, i) => (
              <div key={i} className="pain-card" style={{ background: '#FFFFFF', border: '1px solid #D1FAE5', borderRadius: 14, padding: '24px 20px' }}>
                <div style={{ fontSize: 14, color: '#475569', fontStyle: 'italic', marginBottom: 14, lineHeight: 1.72, paddingLeft: 14, borderLeft: '2px solid #6EE7B7' }}>{p.pain}</div>
                <div style={{ fontSize: 13, color: '#059669', fontWeight: 600, lineHeight: 1.68 }}>✓ {p.fix}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ textAlign: 'center', padding: '80px 48px 100px', background: '#FFFFFF' }}>
        <p style={{ fontSize: 10, color: '#94A3B8', letterSpacing: '0.22em', marginBottom: 20, textTransform: 'uppercase', fontWeight: 500 }}>Ready?</p>
        <h2 style={{ fontSize: 'clamp(26px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 40, color: '#1E293B', lineHeight: 1.1 }}>
          Know your taxes.<br />
          <span style={{ color: '#059669', fontWeight: 400 }}>Own your wealth.</span>
        </h2>
        <Link href="/dashboard/ais" className="cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 36px', background: '#059669', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 16 }}>
          Get Started →
        </Link>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '18px 48px', borderTop: '1px solid #F0FDF4', fontSize: 11, color: '#CBD5E1' }}>
        ArthVo provides general financial guidance. Consult a CA for ITR filing. © 2025 ArthVo
        {' · '}
        <a href="/privacy" style={{ color: '#94A3B8', textDecoration: 'underline' }}>Privacy</a>
      </div>
    </div>
  )
}
