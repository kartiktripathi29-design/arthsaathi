'use client'
// Dashboard — a visual, at-a-glance view of the user's tax picture. It renders from a compact
// snapshot (av_tax_overview) that the "Your Tax" page persists when it computes, so the numbers here
// always match Your Tax without re-deriving the tax engine. Users with no salary data are sent to the
// upload flow; users with data but no computed tax see a CTA to finish Your Tax.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { tokens as T } from '@/lib/tokens'

const C = { fg: T.teal, bg: T.paper, card: T.card, border: T.hairline, ink: T.ink, muted: T.muted, green: T.green, sand: T.sand, tint: T.tint, onTeal: T.onTeal, taupe: T.taupe, wheatLine: T.taupeLine }
const fmt = (n: number) => `₹${Math.abs(Math.round(n || 0)).toLocaleString('en-IN')}`
const INCOME_COLORS = [T.teal, T.green, T.taupe]

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, ...style }}>{children}</div>
}

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: color || C.fg, margin: 0, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [ov, setOv] = useState<any>(null)
  const [view, setView] = useState<'loading' | 'no-tax' | 'ready'>('loading')

  useEffect(() => {
    let hasSalary = false
    try { const t = JSON.parse(localStorage.getItem('av_salary_timeline') || '[]'); hasSalary = Array.isArray(t) && t.length > 0 } catch {}
    if (!hasSalary) { router.replace('/dashboard/profile/documents'); return }   // onboarding: no data → upload
    let snap: any = null
    try { snap = JSON.parse(localStorage.getItem('av_tax_overview') || 'null') } catch {}
    if (!snap || typeof snap.totalTax !== 'number') { setView('no-tax'); return }
    setOv(snap); setView('ready')
  }, [router])

  if (view === 'loading') return null

  if (view === 'no-tax') {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Dashboard</h1>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 14, color: C.ink, margin: '0 0 6px', fontWeight: 600 }}>Your dashboard is almost ready.</p>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Open <strong>Your Tax</strong> once to compute your tax picture — then this page fills in with your numbers and charts.</p>
          <button onClick={() => router.push('/dashboard/tax/optimizer')} style={{ padding: '12px 24px', background: C.fg, color: C.onTeal, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Go to Your Tax →</button>
        </Card>
      </div>
    )
  }

  const rec = ov.recommendation === 'new'
  const refund = ov.balance < 0
  const asOf = ov.computedAt ? new Date(ov.computedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  const incomeData = [
    { name: 'Salary', value: Math.max(0, ov.grossSalary) },
    { name: 'Other income', value: Math.max(0, ov.slabOtherIncome) },
    { name: 'Capital gains / crypto', value: Math.max(0, ov.specialIncome) },
  ].filter(d => d.value > 0)
  const totalIncome = incomeData.reduce((s, d) => s + d.value, 0)

  const regimeData = [
    { name: 'New', tax: Math.round(ov.newTotal), me: rec ? 0 : 1 },   // me===0 → recommended (green)
    { name: 'Old', tax: Math.round(ov.oldTotal), me: rec ? 1 : 0 },
  ]
  const billData = [
    { name: 'Total tax', amount: Math.round(ov.totalTax) },
    { name: 'TDS paid', amount: Math.round(ov.tdsPaid) },
    { name: refund ? 'Refund due' : 'Balance', amount: Math.round(Math.abs(ov.balance)) },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 4px' }}>Dashboard</h1>
        {asOf && <span style={{ fontSize: 11, color: C.muted }}>As of your last Your Tax visit · {asOf}</span>}
      </div>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>Your tax picture for FY 2025-26 at a glance.</p>

      {/* Verdict strip */}
      <Card style={{ marginBottom: 16, border: `2px solid ${C.fg}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 180px' }}><Stat label="File under" value={rec ? 'New regime' : 'Old regime'} sub={`Saves ${fmt(ov.savings)} vs the ${rec ? 'old' : 'new'} regime`} /></div>
          <div style={{ flex: '1 1 160px' }}><Stat label="Total tax" value={fmt(ov.totalTax)} /></div>
          <div style={{ flex: '1 1 160px' }}><Stat label={refund ? 'Refund due' : 'Balance payable'} value={fmt(Math.abs(ov.balance))} color={refund ? C.green : C.fg} sub={`Tax ${fmt(ov.totalTax)} − TDS ${fmt(ov.tdsPaid)}`} /></div>
          <div style={{ flex: '1 1 120px' }}><Stat label="File form" value={ov.itrForm} /></div>
        </div>
      </Card>

      {/* Hand-off to CA */}
      <Card style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: '0 0 2px' }}>Handing this to a tax consultant?</p>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Download a clean Computation of Income statement they can verify and file from.</p>
        </div>
        <Link href="/dashboard/tax/computation" style={{ padding: '10px 18px', background: C.fg, color: C.onTeal, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Computation for your CA →</Link>
      </Card>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Income composition */}
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income composition</h3>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>Total {fmt(totalIncome)}</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={incomeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {incomeData.map((_, i) => <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {incomeData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: C.ink }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: INCOME_COLORS[i % INCOME_COLORS.length], flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ fontWeight: 600 }}>{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Regime comparison */}
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New vs Old regime</h3>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>Total tax under each · lower is better</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regimeData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.muted }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tickFormatter={(v: any) => `₹${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Bar dataKey="tax" radius={[6, 6, 0, 0]}>
                  {regimeData.map((d, i) => <Cell key={i} fill={d.me === 0 ? C.green : C.taupe} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>The <strong style={{ color: C.green }}>{rec ? 'New' : 'Old'}</strong> regime is recommended — you save <strong style={{ color: C.fg }}>{fmt(ov.savings)}</strong>.</p>
        </Card>

        {/* Tax vs TDS vs balance */}
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What's left to pay</h3>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>Total tax, TDS already paid, and the {refund ? 'refund' : 'balance'}</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={billData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={(v: any) => `₹${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11.5, fill: C.ink }} axisLine={false} tickLine={false} width={84} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {billData.map((d, i) => <Cell key={i} fill={i === 0 ? C.fg : i === 1 ? C.taupe : (refund ? C.green : C.fg)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Savings opportunities — unused deduction headroom (only when the snapshot carries usage). */}
      {typeof ov.sec80C === 'number' && (() => {
        const items = [
          { label: 'Home-loan interest · 24(b)', limit: 200000, used: Math.max(0, ov.sec24b || 0) },
          { label: '80C investments', limit: 150000, used: Math.max(0, ov.sec80C || 0) },
          { label: 'Health insurance · 80D', limit: 100000, used: Math.max(0, ov.sec80D || 0) },
          { label: 'NPS · 80CCD(1B)', limit: 50000, used: Math.max(0, ov.nps || 0) },
        ]
        const open = items.filter(i => i.limit - i.used > 0)
        const taxSaveable = open.reduce((s, i) => s + (i.limit - i.used) * 0.30, 0)
        return (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Where you can save more</h3>
              {taxSaveable > 0 && <span style={{ fontSize: 12, color: C.muted }}>Up to <strong style={{ color: C.green }}>~{fmt(taxSaveable)}</strong> more in tax</span>}
            </div>
            {open.length === 0 ? (
              <div style={{ padding: '12px', background: C.tint, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <p style={{ fontSize: 12.5, color: C.green, margin: 0, fontWeight: 600 }}>✓ You’ve used all the major deduction limits (80C, 80D, NPS, home-loan interest).</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {open.map(i => {
                  const gap = i.limit - i.used
                  const pct = Math.round((i.used / i.limit) * 100)
                  return (
                    <div key={i.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>{i.label}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{fmt(i.used)} / {fmt(i.limit)}</span>
                      </div>
                      <div style={{ height: 8, background: C.sand, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.green }} />
                      </div>
                      <p style={{ fontSize: 11, color: C.muted, margin: '5px 0 0' }}><strong style={{ color: C.fg }}>{fmt(gap)}</strong> unused · save ~{fmt(gap * 0.30)} in tax</p>
                    </div>
                  )
                })}
              </div>
            )}
            <Link href="/dashboard/profile/deductions" style={{ display: 'inline-block', marginTop: 14, fontSize: 12, fontWeight: 700, color: C.fg, textDecoration: 'underline' }}>Add deductions →</Link>
          </Card>
        )
      })()}

      {/* Quick links */}
      <Card>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jump back in</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { href: '/dashboard/tax/optimizer', label: 'Your Tax', desc: 'Full breakdown & ITR' },
            { href: '/dashboard/profile/salary', label: 'Salary', desc: 'Edit your timeline' },
            { href: '/dashboard/profile/exemptions', label: 'Allowances', desc: 'Claim Section 10' },
            { href: '/dashboard/profile/deductions', label: 'Deductions', desc: 'Save more under 80C/80D' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ display: 'block', padding: '12px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, textDecoration: 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.fg }}>{l.label} →</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{l.desc}</div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
