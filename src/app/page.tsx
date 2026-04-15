import Link from 'next/link'

function Logo({ size = 36 }: { size?: number }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="16" fill="#C9A84C"/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#0F2640"/>
      <circle cx="90" cy="24" r="18" fill="#C9A84C"/>
      <circle cx="90" cy="24" r="11" fill="#0F2640"/>
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F2640', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo size={38} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>
              Arth<span style={{ color: '#C9A84C' }}>Vo</span>
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', marginTop: -1 }}>WEALTH EVOLVED</div>
          </div>
          <span style={{ fontSize: 11, background: 'rgba(201,168,76,0.15)', color: '#C9A84C', padding: '2px 8px', borderRadius: 20, marginLeft: 4, border: '1px solid rgba(201,168,76,0.3)' }}>SEBI RIA</span>
        </Link>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/dashboard" style={{ padding: '10px 24px', background: '#C9A84C', color: '#0F2640', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>Open Dashboard →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '90px 48px 60px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', padding: '6px 16px', borderRadius: 20, fontSize: 13, marginBottom: 36 }}>
          🇮🇳 Built for India's Working Class
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logo size={80} />
        </div>
        <h1 style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, marginBottom: 12, letterSpacing: '-0.03em' }}>
          Arth<span style={{ color: '#C9A84C' }}>Vo</span>
        </h1>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', marginBottom: 28, textTransform: 'uppercase', fontWeight: 500 }}>
          Wealth Evolved
        </div>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.75 }}>
          Upload any salary slip. Instantly know your take-home, tax liability, and exactly how much you can save — powered by SEBI-registered AI advice.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/salary" style={{ padding: '14px 32px', background: '#C9A84C', color: '#0F2640', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 16 }}>
            Upload Salary Slip →
          </Link>
          <Link href="/dashboard" style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.07)', color: '#fff', borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 16, border: '1px solid rgba(255,255,255,0.12)' }}>
            Explore Dashboard
          </Link>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 1100, margin: '0 auto 80px', padding: '0 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          { icon: '📄', title: 'Smart Salary Parser', desc: 'Any format. Any employer. AI extracts every component in seconds.' },
          { icon: '📊', title: 'Tax Optimiser', desc: 'Old vs New regime comparison. Know exactly which saves you more.' },
          { icon: '💬', title: 'AI Financial Advisor', desc: 'Ask anything about your money. Real answers, not generic advice.' },
          { icon: '📈', title: 'Investment Planner', desc: 'Direct MF, NPS, SGB — personalised to your income and goals.' },
        ].map(f => (
          <div key={f.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '28px 24px', transition: 'border-color 0.2s' }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: '#fff' }}>{f.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 48px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
        ⚠️ ArthVo provides general financial guidance. All investment advice is educational. Consult a CA for ITR filing. © 2025 ArthVo.
        {' · '}
        <a href="/privacy" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Privacy Policy</a>
      </div>
    </div>
  )
}
