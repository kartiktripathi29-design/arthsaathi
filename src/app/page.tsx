import Link from 'next/link'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F2640', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#E67E22', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>₹</div>
          <span style={{ fontWeight: 700, fontSize: 20 }}>ArthSaathi</span>
          <span style={{ fontSize: 11, background: 'rgba(230,126,34,0.2)', color: '#E67E22', padding: '2px 8px', borderRadius: 20, marginLeft: 4 }}>SEBI RIA</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard" style={{ padding: '10px 24px', background: '#E67E22', color: '#fff', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>Open Dashboard →</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '100px 48px 60px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(230,126,34,0.1)', border: '1px solid rgba(230,126,34,0.3)', color: '#E67E22', padding: '6px 16px', borderRadius: 20, fontSize: 13, marginBottom: 32 }}>
          🇮🇳 Built for India's Working Class
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.15, marginBottom: 24, letterSpacing: '-0.02em' }}>
          Your Personal<br />
          <span style={{ color: '#E67E22' }}>Financial Companion</span>
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7 }}>
          Upload any salary slip. Instantly know your take-home, tax liability, and exactly how much you can save — powered by SEBI-registered AI advice.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/salary" style={{ padding: '14px 32px', background: '#E67E22', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 16 }}>
            Upload Salary Slip →
          </Link>
          <Link href="/dashboard" style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 16, border: '1px solid rgba(255,255,255,0.15)' }}>
            Explore Dashboard
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div style={{ maxWidth: 1100, margin: '0 auto 80px', padding: '0 48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          { icon: '📄', title: 'Smart Salary Parser', desc: 'Any format. Any employer. AI extracts every component in seconds.' },
          { icon: '📊', title: 'Tax Optimiser', desc: 'Old vs New regime comparison. Know exactly which saves you more.' },
          { icon: '💬', title: 'AI Financial Chat', desc: 'Ask anything about your money. Real answers, not generic advice.' },
          { icon: '📈', title: 'Investment Planner', desc: 'Direct MF, NPS, SGB — personalised to your income and goals.' },
        ].map(f => (
          <div key={f.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '28px 24px' }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 48px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
        ⚠️ ArthSaathi is registered with SEBI as an Investment Adviser. All investment advice is for informational purposes only. Consult a CA/CFP for tax filing. © 2025 ArthSaathi.
      </div>
    </div>
  )
}
