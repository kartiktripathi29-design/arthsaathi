'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/AppStore'
import { formatINR } from '@/lib/tax-engine'
import { Card, SectionHeader, InfoBox, Badge, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

const RISK_OPTIONS = [
  { key: 'conservative', label: 'Conservative', emoji: '🛡️', color: '#1E8449', desc: '~8% p.a. · FD, debt MF, liquid funds' },
  { key: 'moderate', label: 'Moderate', emoji: '⚖️', color: '#E67E22', desc: '~11% p.a. · Balanced MF, ELSS, NPS' },
  { key: 'aggressive', label: 'Aggressive', emoji: '🚀', color: '#C0392B', desc: '~14% p.a. · Equity MF, small cap, ETF' },
]

const GOAL_OPTIONS = [
  { key: 'retirement', label: 'Retirement', icon: '🏖️' },
  { key: 'education', label: 'Child Education', icon: '🎓' },
  { key: 'home', label: 'Home Purchase', icon: '🏠' },
  { key: 'emergency', label: 'Emergency Fund', icon: '🆘' },
  { key: 'travel', label: 'Travel / Sabbatical', icon: '✈️' },
  { key: 'other', label: 'Wealth Building', icon: '📈' },
]

const PIE_COLORS = ['#1A3C5E', '#E67E22', '#1E8449', '#8E44AD', '#2E86C1', '#E74C3C', '#F39C12']

function HealthRing({ score }: { score: number }) {
  const color = score >= 70 ? '#1E8449' : score >= 45 ? '#E67E22' : '#C0392B'
  const label = score >= 70 ? 'Healthy 💚' : score >= 45 ? 'Needs Work ⚠️' : 'At Risk 🔴'
  const r = 42, cx = 54, cy = 54
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={108} height={108}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0F0F0" strokeWidth={10} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={800} fill={color}>{score}</text>
      </svg>
      <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: -4 }}>{label}</div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E9ED', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#1C2833' }}>Year {label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span style={{ color: '#5D6D7E' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: '#1C2833' }}>₹{Number(p.value).toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  )
}

export default function InvestPage() {
  const { salary, investPlan, setInvestPlan } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [age, setAge] = useState(28)
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate')
  const [selectedGoals, setSelectedGoals] = useState(['retirement', 'emergency'])
  const [monthly, setMonthly] = useState(() => salary ? Math.round(salary.netSalary * 0.25) : 10000)

  const toggleGoal = (g: string) =>
    setSelectedGoals(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])

  const generate = async () => {
    const income = salary?.grossSalary ? salary.grossSalary * 12 : 600000
    setLoading(true)
    const tid = toast.loading('Building your personalised plan…')
    try {
      const res = await fetch('/api/invest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyInvestable: monthly, annualIncome: income, age, goals: selectedGoals, riskProfile }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setInvestPlan(json.plan)
      toast.success(`Plan ready! Health score: ${json.plan.financialHealthScore}/100`, { id: tid })
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate plan', { id: tid })
    } finally {
      setLoading(false)
    }
  }

  if (!salary) {
    return <EmptyState icon="📈" title="Upload salary slip first" desc="Your investment plan is personalised to your actual take-home income."
      action={<Link href="/dashboard/salary" style={{ padding: '11px 24px', background: '#E67E22', color: '#fff', borderRadius: 9, textDecoration: 'none', fontWeight: 600 }}>Upload Salary Slip →</Link>} />
  }

  const riskInfo = RISK_OPTIONS.find(r => r.key === riskProfile)!
  const savingsPct = salary.netSalary > 0 ? Math.round((monthly / salary.netSalary) * 100) : 0

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: 22, alignItems: 'start' }}>

        {/* ─── Input Panel ────────────────────────────── */}
        <Card style={{ position: 'sticky', top: 80 }}>
          <SectionHeader title="Investment Profile" />

          {/* Monthly amount */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1C2833', display: 'block', marginBottom: 6 }}>Monthly Investment Amount</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E9ED', borderRadius: 9, overflow: 'hidden', transition: 'border-color 0.15s' }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = '#1A3C5E')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = '#E5E9ED')}>
              <span style={{ padding: '9px 12px', background: '#F8FAFB', color: '#5D6D7E', fontSize: 14, fontWeight: 600, borderRight: '1px solid #E5E9ED' }}>₹</span>
              <input type="number" value={monthly} onChange={e => setMonthly(Number(e.target.value) || 0)}
                style={{ flex: 1, padding: '9px 12px', border: 'none', outline: 'none', fontSize: 14, color: '#1C2833' }} />
            </div>
            <div style={{ fontSize: 11, marginTop: 5, color: savingsPct >= 20 ? '#1E8449' : '#E67E22', fontWeight: 500 }}>
              {savingsPct}% of take-home · {savingsPct >= 20 ? '✓ Great savings rate' : 'Recommended: 20%+'}
            </div>
            <input type="range" min={1000} max={salary.netSalary * 0.7} step={500} value={monthly}
              onChange={e => setMonthly(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#1A3C5E', marginTop: 6 }} />
          </div>

          {/* Age */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1C2833', display: 'block', marginBottom: 6 }}>Your Age</label>
            <input type="number" value={age} onChange={e => setAge(Number(e.target.value))} min={18} max={65}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E9ED', borderRadius: 9, fontSize: 14, color: '#1C2833', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = '#1A3C5E')} onBlur={e => (e.target.style.borderColor = '#E5E9ED')} />
            <div style={{ fontSize: 11, color: '#95A5A6', marginTop: 4 }}>{65 - age} years to retirement · Time horizon matters most</div>
          </div>

          {/* Risk */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Risk Profile</div>
            {RISK_OPTIONS.map(r => (
              <div key={r.key} onClick={() => setRiskProfile(r.key as any)}
                style={{ padding: '9px 12px', borderRadius: 9, marginBottom: 6, cursor: 'pointer', border: `1.5px solid ${riskProfile === r.key ? r.color : '#E5E9ED'}`, background: riskProfile === r.key ? `${r.color}0F` : '#fff', transition: 'all 0.15s', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>{r.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: riskProfile === r.key ? 600 : 400, color: riskProfile === r.key ? r.color : '#1C2833' }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: '#95A5A6' }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Goals */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Financial Goals</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {GOAL_OPTIONS.map(g => {
                const active = selectedGoals.includes(g.key)
                return (
                  <div key={g.key} onClick={() => toggleGoal(g.key)}
                    style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${active ? '#1A3C5E' : '#E5E9ED'}`, background: active ? '#E8F1FA' : '#fff', display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s' }}>
                    <span style={{ fontSize: 14 }}>{g.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? '#1A3C5E' : '#5D6D7E' }}>{g.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <button onClick={generate} disabled={loading}
            style={{ width: '100%', padding: '13px', background: loading ? '#ccc' : '#1A3C5E', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', transition: 'background 0.15s' }}>
            {loading ? '⟳ Generating…' : '📈 Generate My Plan'}
          </button>
        </Card>

        {/* ─── Results ────────────────────────────────── */}
        <div>
          {!investPlan && !loading && (
            <div style={{ textAlign: 'center', padding: '70px 20px', background: '#fff', borderRadius: 14, border: '1px solid #E5E9ED' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📈</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1C2833', marginBottom: 8 }}>Configure your profile and generate a plan</div>
              <div style={{ fontSize: 13, color: '#5D6D7E', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
                AI will allocate your ₹{monthly.toLocaleString('en-IN')}/mo across SEBI-regulated products — optimised for your age, goals, and risk tolerance.
              </div>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '70px 20px', background: '#fff', borderRadius: 14, border: '1px solid #E5E9ED' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🤔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1C2833', marginBottom: 6 }}>Building your personalised plan…</div>
              <div style={{ fontSize: 13, color: '#5D6D7E' }}>Analysing income, risk profile, goals, and Indian market options</div>
            </div>
          )}

          {investPlan && !loading && (
            <div className="fade-in">
              {/* Health Score */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <HealthRing score={investPlan.financialHealthScore} />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2833', marginBottom: 4 }}>Financial Health Score</div>
                    {(investPlan as any).topInsight && (
                      <div style={{ fontSize: 13, color: '#5D6D7E', lineHeight: 1.6, marginBottom: 12 }}>{(investPlan as any).topInsight}</div>
                    )}
                    {investPlan.healthBreakdown && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                        {Object.entries(investPlan.healthBreakdown).map(([k, v]) => {
                          const pct = v as number
                          const color = pct >= 70 ? '#1E8449' : pct >= 45 ? '#E67E22' : '#C0392B'
                          return (
                            <div key={k}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5D6D7E', marginBottom: 3 }}>
                                <span style={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span style={{ fontWeight: 600, color }}>{pct}/100</span>
                              </div>
                              <div style={{ height: 4, background: '#F0F0F0', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Allocation */}
              <Card style={{ marginBottom: 16 }}>
                <SectionHeader
                  title={`Monthly Plan — ₹${monthly.toLocaleString('en-IN')}`}
                  sub="AI-recommended across SEBI-regulated instruments · No undisclosed commissions" />
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Pie */}
                  <div style={{ flex: '0 0 160px' }}>
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={investPlan.recommendations} dataKey="monthlyAmount" cx="50%" cy="50%"
                          innerRadius={40} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                          {investPlan.recommendations.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`₹${v.toLocaleString('en-IN')}`, '/mo']}
                          contentStyle={{ borderRadius: 8, border: '1px solid #E5E9ED', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Allocation list */}
                  <div style={{ flex: 1 }}>
                    {investPlan.recommendations.map((rec: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1C2833' }}>{rec.product}</div>
                              <div style={{ fontSize: 11, color: '#5D6D7E', marginTop: 1 }}>{rec.category} · {rec.expectedReturn} · <span style={{ color: rec.riskLevel === 'high' ? '#C0392B' : rec.riskLevel === 'medium' ? '#E67E22' : '#1E8449' }}>{rec.riskLevel} risk</span></div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A3C5E' }}>₹{rec.monthlyAmount?.toLocaleString('en-IN')}</div>
                              <div style={{ fontSize: 10, color: '#95A5A6' }}>{rec.allocationPercent}%</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#5D6D7E', marginTop: 4, lineHeight: 1.5 }}>{rec.rationale}</div>
                          {rec.taxBenefit && (
                            <div style={{ fontSize: 11, color: '#1E8449', marginTop: 3, fontWeight: 500 }}>🏷 {rec.taxBenefit}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Corpus projection chart */}
              {investPlan.projections?.length > 0 && (
                <Card style={{ marginBottom: 16 }}>
                  <SectionHeader
                    title="20-Year Corpus Projection"
                    sub={`${riskInfo.emoji} ${riskInfo.label} profile · ${riskInfo.desc.split('·')[0].trim()} avg return`} />
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={investPlan.projections} margin={{ top: 8, right: 0, bottom: 0, left: 10 }}>
                      <defs>
                        <linearGradient id="corpusGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1A3C5E" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1A3C5E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E67E22" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#E67E22" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#5D6D7E' }} axisLine={false} tickLine={false}
                        tickFormatter={v => `Y${v}`} interval={3} />
                      <YAxis tick={{ fontSize: 10, fill: '#5D6D7E' }} axisLine={false} tickLine={false}
                        tickFormatter={v => v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(0)}L` : `${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="invested" name="Amount Invested" stroke="#E67E22" strokeWidth={2} fill="url(#investGrad)" />
                      <Area type="monotone" dataKey="corpus" name="Total Corpus" stroke="#1A3C5E" strokeWidth={2.5} fill="url(#corpusGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Year milestones */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 16 }}>
                    {[5, 10, 15, 20].map(yr => {
                      const p = investPlan.projections.find((x: any) => x.year === yr)
                      if (!p) return null
                      const gain = p.corpus - p.invested
                      return (
                        <div key={yr} style={{ background: '#F8FAFB', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#5D6D7E', marginBottom: 4 }}>Year {yr}</div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: '#1A3C5E' }}>{formatINR(p.corpus)}</div>
                          <div style={{ fontSize: 10, color: '#1E8449', marginTop: 2, fontWeight: 500 }}>
                            +{formatINR(gain)} gain
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* SEBI Disclaimer */}
              <InfoBox variant="warning">
                <strong>SEBI Disclaimer:</strong> This is illustrative AI-generated investment guidance based on your income profile. Returns are projected estimates — not guaranteed. Equity investments are subject to market risks. Read all scheme-related documents carefully. Past performance is not indicative of future returns. Please consult a SEBI-registered investment adviser (RIA) before investing large amounts.
              </InfoBox>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
