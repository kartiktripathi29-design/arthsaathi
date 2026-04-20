import Link from 'next/link'
import BgDemo from '@/components/BgDemo'

function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect width="120" height="120" rx="16" fill="#C9A84C"/>
      <polygon points="9,9 21,9 60,101 99,9 111,9 60,111" fill="#0F2640"/>
      <circle cx="90" cy="24" r="18" fill="#C9A84C"/>
      <circle cx="90" cy="24" r="11" fill="#0F2640"/>
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A1628', color: '#fff', fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .glow { text-shadow: 0 0 60px rgba(201,168,76,0.4); }
        .card-hover { transition: transform 0.2s, border-color 0.2s; }
        .card-hover:hover { transform: translateY(-4px); border-color: rgba(201,168,76,0.4) !important; }
        .cta-btn { transition: transform 0.15s, box-shadow 0.15s; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(201,168,76,0.4); }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.7s ease both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.25s; }
        .fade-up-3 { animation-delay: 0.4s; }
        .fade-up-4 { animation-delay: 0.55s; }
        .stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px 24px; transition: border-color 0.2s; }
        .stat-card:hover { border-color: rgba(201,168,76,0.3); }
        .noise { position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events: none; }
      `}</style>

      {/* Background glow blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 600, background: 'radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: 600, height: 600, background: 'radial-gradient(ellipse, rgba(26,60,94,0.5) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo size={36} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>Arth<span style={{ color: '#C9A84C' }}>Vo</span></div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', marginTop: -1 }}>WEALTH EVOLVED</div>
          </div>
          <span style={{ fontSize: 10, background: 'rgba(201,168,76,0.1)', color: '#C9A84C', padding: '3px 8px', borderRadius: 20, marginLeft: 4, border: '1px solid rgba(201,168,76,0.25)', fontWeight: 600 }}>SEBI RIA</span>
        </Link>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Already using ArthVo?</span>
          <Link href="/dashboard/ais" className="cta-btn" style={{ padding: '10px 22px', background: '#C9A84C', color: '#0F2640', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
            Open Dashboard →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '80px 48px 40px', textAlign: 'center' }}>

        {/* Badge */}
        <div className="fade-up fade-up-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', padding: '8px 18px', borderRadius: 100, fontSize: 13, marginBottom: 40, fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C9A84C', display: 'inline-block', boxShadow: '0 0 8px #C9A84C' }} />
          India's first SEBI-backed AI tax & wealth platform
        </div>

        {/* Main headline */}
        <h1 className="fade-up fade-up-2 glow" style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 24 }}>
          Your money works harder<br />
          <span style={{ color: '#C9A84C' }}>when you know the rules.</span>
        </h1>

        <p className="fade-up fade-up-3" style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.55)', maxWidth: 580, margin: '0 auto 48px', lineHeight: 1.75, fontWeight: 300 }}>
          Upload your AIS once. ArthVo reads your salary, capital gains, dividends, and TDS — then shows you exactly what you owe, what you save, and where to invest.
        </p>

        {/* Single CTA */}
        <div className="fade-up fade-up-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard/ais" className="cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '18px 40px', background: '#C9A84C', color: '#0F2640', borderRadius: 12, fontWeight: 800, textDecoration: 'none', fontSize: 18, letterSpacing: '-0.01em' }}>
            <span>Start with your AIS</span>
            <span style={{ fontSize: 20 }}>→</span>
          </Link>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>FREE · NO SIGNUP · TAKES 2 MINUTES</div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '40px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          {[
            { num: '₹2.3L', label: 'Avg. tax saved per user', sub: 'by switching regimes' },
            { num: '8 min', label: 'To know your full tax picture', sub: 'from AIS upload to result' },
            { num: '100%', label: 'Accuracy on salary parsing', sub: 'vs manual entry errors' },
            { num: 'SEBI', label: 'Registered RIA backing', sub: 'real advice, not generic tips' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(15,38,64,0.8)', padding: '24px 20px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#C9A84C', marginBottom: 4 }}>{s.num}</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Product Demo */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '20px 48px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 10, textTransform: 'uppercase' }}>See it in action</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>From AIS to ₹68,000 saved<br /><span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300, fontSize: 22 }}>in under 2 minutes.</span></h2>
        </div>
        <BgDemo />
      </div>

      {/* How it works */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1000, margin: '0 auto', padding: '40px 48px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 12, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 12, textTransform: 'uppercase' }}>How it works</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>From AIS to tax savings<br /><span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>in 4 steps.</span></h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { step: '01', icon: '📑', title: 'Upload AIS / 26AS', desc: 'Password-protected PDF from incometax.gov.in. ArthVo decrypts and reads everything.' },
            { step: '02', icon: '🔍', title: 'AI reads your income', desc: 'Salary TDS, capital gains, dividends, FD interest — all extracted and verified automatically.' },
            { step: '03', icon: '📊', title: 'See your tax picture', desc: 'Old vs New regime compared. See exactly which saves more — down to the last rupee.' },
            { step: '04', icon: '💡', title: 'Get smart advice', desc: 'Where to invest, what deductions to claim, and how to legally reduce your tax bill.' },
          ].map((f, i) => (
            <div key={i} className="card-hover" style={{ position: 'relative', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 22px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 11, fontWeight: 800, color: 'rgba(201,168,76,0.2)', letterSpacing: '0.1em' }}>{f.step}</div>
              <div style={{ fontSize: 30, marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain points — Zomato style "relatable" section */}
      <div style={{ position: 'relative', zIndex: 1, background: 'rgba(201,168,76,0.04)', borderTop: '1px solid rgba(201,168,76,0.1)', borderBottom: '1px solid rgba(201,168,76,0.1)', padding: '60px 48px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: 'center', marginBottom: 40, letterSpacing: '-0.02em' }}>
            Sounds familiar? <span style={{ color: '#C9A84C' }}>We fix this.</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { pain: '"I got an IT notice for unreported FD interest."', fix: 'AIS shows every interest income. ArthVo flags it before the taxman does.' },
              { pain: '"My CA charges ₹5,000 just to tell me which regime to pick."', fix: 'ArthVo compares both regimes in seconds. Free. No appointment needed.' },
              { pain: '"I had capital gains but forgot to report them in ITR."', fix: 'AIS has all your capital gains. ArthVo pulls them automatically — nothing missed.' },
            ].map((p, i) => (
              <div key={i} style={{ background: 'rgba(15,38,64,0.6)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '24px' }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: 16, lineHeight: 1.65, borderLeft: '3px solid rgba(201,168,76,0.3)', paddingLeft: 14 }}>{p.pain}</div>
                <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 600, lineHeight: 1.6 }}>✓ {p.fix}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '80px 48px' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', marginBottom: 16, textTransform: 'uppercase' }}>Ready?</div>
        <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>
          Know your taxes.<br /><span style={{ color: '#C9A84C' }}>Own your wealth.</span>
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginBottom: 36, maxWidth: 400, margin: '0 auto 36px' }}>
          Upload your AIS and get your complete financial picture in under 10 minutes.
        </p>
        <Link href="/dashboard/ais" className="cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '18px 44px', background: '#C9A84C', color: '#0F2640', borderRadius: 12, fontWeight: 800, textDecoration: 'none', fontSize: 18 }}>
          Get Started — It's Free →
        </Link>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {['No credit card', 'No signup required', 'Data never stored', 'SEBI RIA backed'].map(t => (
            <div key={t} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#C9A84C' }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
        ⚠️ ArthVo provides general financial guidance. All investment advice is educational. Consult a CA for ITR filing. © 2025 ArthVo.
        {' · '}
        <a href="/privacy" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}>Privacy Policy</a>
      </div>
    </div>
  )
}
