'use client'
import Link from 'next/link'
import { useAppStore } from '@/store/AppStore'
import { formatINR } from '@/lib/tax-engine'
import { StatCard, Card, InfoBox } from '@/components/ui'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const PIE_COLORS = ['#1A3C5E', '#E67E22', '#1E8449', '#8E44AD', '#2E86C1', '#E74C3C']

function IncomePieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={44} outerRadius={72}
          dataKey="value" paddingAngle={2} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v: any) => [`₹${v.toLocaleString('en-IN')}`, '']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E9ED', fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function TaxBarChart({ oldTax, newTax }: { oldTax: number; newTax: number }) {
  const data = [
    { name: 'Old Regime', tax: oldTax },
    { name: 'New Regime', tax: newTax },
  ]
  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} barSize={40} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5D6D7E' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip formatter={(v: any) => [`₹${v.toLocaleString('en-IN')}`, 'Annual Tax']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E9ED', fontSize: 12 }} />
        <Bar dataKey="tax" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i === 0 ? '#1A3C5E' : '#E67E22'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function QuickAction({ icon, title, desc, href, dark }: { icon: string; title: string; desc: string; href: string; dark?: boolean }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: dark ? '#0F2640' : '#fff', border: `1px solid ${dark ? '#1A3C5E' : '#E5E9ED'}`,
        borderRadius: 12, padding: '18px 20px', cursor: 'pointer',
        display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'transform 0.15s, box-shadow 0.15s',
      }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '' }}>
        <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: dark ? '#fff' : '#1C2833', marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.48)' : '#5D6D7E', lineHeight: 1.5 }}>{desc}</div>
        </div>
        <span style={{ color: dark ? 'rgba(255,255,255,0.25)' : '#CBD5E0', fontSize: 16, alignSelf: 'center', flexShrink: 0 }}>→</span>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const { salary, taxComparison } = useAppStore()

  const incomeData = salary ? [
    { name: 'Basic', value: salary.basicSalary },
    salary.hra > 0 && { name: 'HRA', value: salary.hra },
    salary.da > 0 && { name: 'DA', value: salary.da },
    salary.ta > 0 && { name: 'TA', value: salary.ta },
    salary.specialAllowance > 0 && { name: 'Special Allow.', value: salary.specialAllowance },
    salary.otherAllowances > 0 && { name: 'Others', value: salary.otherAllowances },
  ].filter(Boolean) as { name: string; value: number }[] : []

  return (
    <div className="fade-in">

      {/* ─── Welcome Banner ─────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #0F2640 0%, #1A3C5E 100%)', borderRadius: 16, padding: '26px 30px', marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(230,126,34,0.08)' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              {salary ? `Namaste, ${salary.employeeName?.split(' ')[0] || 'there'} 👋` : 'Welcome to ArthSaathi 🇮🇳'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, maxWidth: 520 }}>
              {salary
                ? `${salary.month} ${salary.year} · ${salary.employerName}${taxComparison ? ` · Save ₹${taxComparison.savings.toLocaleString('en-IN')}/yr on tax by switching to ${taxComparison.recommendation === 'new' ? 'New' : 'Old'} Regime` : ' · Run Tax Analysis to optimise'}`
                : 'Upload your salary slip to get instant take-home breakdown, tax comparison, and AI investment recommendations.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {!salary && (
              <Link href="/dashboard/salary" style={{ padding: '11px 22px', background: '#E67E22', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 13, flexShrink: 0 }}>
                Upload Salary Slip →
              </Link>
            )}
            {salary && taxComparison && (
              <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>BEST REGIME</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#E67E22' }}>{taxComparison.recommendation === 'new' ? 'New' : 'Old'}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>saves ₹{(taxComparison.savings / 1000).toFixed(0)}K/yr</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12, marginBottom: 22 }}>
        <StatCard icon="💰" label="Monthly Take-Home" color="#1E8449"
          value={salary ? `₹${salary.netSalary?.toLocaleString('en-IN')}` : '—'}
          sub={salary ? `Gross ₹${salary.grossSalary?.toLocaleString('en-IN')}` : 'Upload salary slip'} />
        <StatCard icon="📊" label="Best Annual Tax"
          value={taxComparison ? formatINR(Math.min(taxComparison.old.totalTax, taxComparison.new.totalTax)) : '—'}
          sub={taxComparison ? `₹${Math.min(taxComparison.old.monthlyTDS, taxComparison.new.monthlyTDS).toLocaleString('en-IN')}/mo TDS` : 'Run tax analysis'}
          color="#E67E22" />
        <StatCard icon="🏦" label="Annual EPF Corpus" color="#1A3C5E"
          value={salary ? formatINR((salary.employeePF + (salary.employerPF || salary.employeePF)) * 12) : '—'}
          sub={salary ? 'Employee + Employer · 8.1% p.a.' : '—'} />
        <StatCard icon="📋" label="Annual CTC"
          value={salary ? formatINR(salary.ctcAnnual || salary.grossSalary * 12) : '—'}
          sub={salary ? `${((salary.ctcAnnual || salary.grossSalary * 12) / 100000).toFixed(2)} LPA` : '—'}
          color="#5D6D7E" />
      </div>

      {/* ─── Charts Row ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 2 }}>Earnings Breakdown</div>
          <div style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 12 }}>Monthly salary composition</div>
          {salary && incomeData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: '0 0 140px' }}>
                <IncomePieChart data={incomeData} />
              </div>
              <div style={{ flex: 1 }}>
                {incomeData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#5D6D7E' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1C2833' }}>₹{d.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1C2833' }}>Gross Total</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E8449' }}>₹{salary.grossSalary?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#95A5A6', fontSize: 13 }}>
              📄 Upload salary slip to visualise
            </div>
          )}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2833', marginBottom: 2 }}>Tax Regime Comparison</div>
          <div style={{ fontSize: 12, color: '#5D6D7E', marginBottom: 12 }}>Annual tax — Old vs New</div>
          {taxComparison ? (
            <>
              <TaxBarChart oldTax={taxComparison.old.totalTax} newTax={taxComparison.new.totalTax} />
              <div style={{ marginTop: 10, background: taxComparison.recommendation === 'new' ? '#FEF3E2' : '#E8F1FA', borderRadius: 10, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: taxComparison.recommendation === 'new' ? '#78350F' : '#1A3C5E' }}>
                  ✓ <strong>{taxComparison.recommendation === 'new' ? 'New' : 'Old'} Regime</strong> saves you more
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#E67E22' }}>₹{taxComparison.savings.toLocaleString('en-IN')}/yr</span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 13, color: '#95A5A6', marginBottom: 10 }}>📊 No analysis yet</div>
              <Link href="/dashboard/tax" style={{ fontSize: 13, color: '#E67E22', fontWeight: 600, textDecoration: 'none' }}>Run Tax Analysis →</Link>
            </div>
          )}
        </Card>
      </div>

      {/* ─── Quick Actions ───────────────────────────── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: '#95A5A6', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Quick Actions</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10, marginBottom: 24 }}>
        <QuickAction dark icon="📄" title="Parse Salary Slip" desc="Upload any payslip. AI extracts every component in seconds." href="/dashboard/salary" />
        <QuickAction icon="📊" title="Optimise Your Tax" desc={salary ? 'Your personalised old vs new regime analysis is ready.' : 'Find out which tax regime saves you more.'} href="/dashboard/tax" />
        <QuickAction icon="📈" title="Build Investment Plan" desc="Personalised SIP + NPS + FD allocation for your goals." href="/dashboard/invest" />
        <QuickAction icon="💬" title="Ask AI Advisor" desc="Chat about taxes, investments, or any money question." href="/dashboard/chat" />
      </div>

      {/* ─── Did You Know ────────────────────────────── */}
      <InfoBox icon="💡" variant="warning">
        <strong>AY 2025-26 tip:</strong> Under the New Tax Regime, income up to ₹7 Lakhs is <strong>effectively zero tax</strong> thanks to the Section 87A rebate of ₹25,000. If your total income is ₹7.75L or below and you have minimal deductions, the New Regime almost certainly saves more. Use the{' '}
        <Link href="/dashboard/tax" style={{ color: '#E67E22', fontWeight: 600 }}>Tax Optimiser</Link> to verify with your exact numbers.
      </InfoBox>

      <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #E5E9ED', fontSize: 11, color: '#95A5A6', lineHeight: 1.65 }}>
        ⚠️ ArthSaathi provides indicative financial guidance. All investment advice is educational. Consult a CA for ITR filing. SEBI Registration No. [INA000000000].
      </div>
    </div>
  )
}
