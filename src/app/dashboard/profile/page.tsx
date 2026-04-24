'use client'
import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/AppStore'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface IncomeSource {
  id: string
  label: string
  amount: number
  type: 'primary' | 'secondary' | 'freelance' | 'spouse' | 'other'
  spouseMode?: 'household' | 'clubbed' | 'separate'
  autoFilled?: boolean
}

interface Expense {
  id: string
  label: string
  amount: number
  category: 'housing' | 'debt' | 'bills' | 'insurance' | 'custom'
  icon: string
}

interface SavingsItem {
  id: string
  label: string
  amount: number
  icon: string
}

interface FinancialProfile {
  incomes: IncomeSource[]
  expenses: Expense[]
  savings: SavingsItem[]
  lastUpdated: string
}

// ─── Health Score ─────────────────────────────────────────────────────────────
function calcHealthScore(totalIncome: number, totalExpenses: number, totalSavings: number): { score: number; grade: string; color: string; issues: string[] } {
  if (!totalIncome) return { score: 0, grade: 'N/A', color: '#94A3B8', issues: ['Add your income to get a score'] }
  const savingsRate = totalSavings / totalIncome
  const expenseRate = totalExpenses / totalIncome
  const issues: string[] = []
  let score = 100

  if (savingsRate < 0.1) { score -= 25; issues.push('Saving less than 10% of income') }
  else if (savingsRate < 0.2) { score -= 10; issues.push('Saving less than 20% — target 20%') }

  if (expenseRate > 0.6) { score -= 20; issues.push('Fixed expenses exceed 60% of income') }
  else if (expenseRate > 0.5) { score -= 10; issues.push('Fixed expenses are 50-60% of income') }

  const freeToSpend = totalIncome - totalExpenses - totalSavings
  if (freeToSpend < 0) { score -= 30; issues.push('Expenses + savings exceed income!') }

  score = Math.max(0, Math.min(100, score))
  const grade = score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : 'Needs work'
  const color = score >= 80 ? '#00D09C' : score >= 65 ? '#FFB800' : score >= 50 ? '#FF9800' : '#FF6B6B'
  return { score, grade, color, issues }
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ expenses, savings, free, total }: { expenses: number; savings: number; free: number; total: number }) {
  if (!total) return <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94A3B8' }}>No data</div>

  const expPct = (expenses / total) * 100
  const savPct = (savings / total) * 100
  const freePct = (free / total) * 100

  // SVG donut segments
  const r = 14; const circ = 2 * Math.PI * r
  const expLen = (expPct / 100) * circ
  const savLen = (savPct / 100) * circ
  const freeLen = (freePct / 100) * circ
  const gap = 1

  return (
    <svg viewBox="0 0 36 36" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="#F1F5F9" strokeWidth="5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#FF6B6B" strokeWidth="5"
        strokeDasharray={`${expLen - gap} ${circ - expLen + gap}`} strokeDashoffset="0" strokeLinecap="round" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#FFB800" strokeWidth="5"
        strokeDasharray={`${savLen - gap} ${circ - savLen + gap}`} strokeDashoffset={-(expLen)} strokeLinecap="round" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#00D09C" strokeWidth="5"
        strokeDasharray={`${freeLen - gap} ${circ - freeLen + gap}`} strokeDashoffset={-(expLen + savLen)} strokeLinecap="round" />
    </svg>
  )
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const uid = () => Math.random().toString(36).slice(2, 8)

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { salary } = useAppStore()
  const [tab, setTab] = useState<'income' | 'expenses' | 'savings' | 'summary'>('income')
  const [profile, setProfile] = useState<FinancialProfile>({
    incomes: [],
    expenses: [
      { id: uid(), label: 'Rent / Home loan EMI', amount: 0, category: 'housing', icon: '🏠' },
      { id: uid(), label: 'Car / Vehicle EMI', amount: 0, category: 'debt', icon: '🚗' },
      { id: uid(), label: 'Groceries', amount: 0, category: 'bills', icon: '🛒' },
      { id: uid(), label: 'Electricity / Gas', amount: 0, category: 'bills', icon: '⚡' },
      { id: uid(), label: 'Internet + Phone', amount: 0, category: 'bills', icon: '📱' },
      { id: uid(), label: 'Life Insurance', amount: 0, category: 'insurance', icon: '🛡️' },
      { id: uid(), label: 'Health Insurance', amount: 0, category: 'insurance', icon: '🏥' },
    ],
    savings: [
      { id: uid(), label: 'SIP / Mutual Funds', amount: 0, icon: '📈' },
      { id: uid(), label: 'Emergency Fund', amount: 0, icon: '🆘' },
      { id: uid(), label: 'RD / FD', amount: 0, icon: '🏦' },
    ],
    lastUpdated: '',
  })

  // Auto-fill primary salary
  useEffect(() => {
    if (!salary?.netSalary) return
    setProfile(prev => {
      const hasAuto = prev.incomes.some(i => i.type === 'primary')
      if (hasAuto) return prev
      return {
        ...prev,
        incomes: [{
          id: uid(),
          label: salary.employerName || 'Primary Job',
          amount: salary.netSalary,
          type: 'primary',
          autoFilled: true,
        }, ...prev.incomes],
      }
    })
  }, [salary])

  // Load saved profile
  useEffect(() => {
    try {
      const saved = localStorage.getItem('as_profile')
      if (saved) setProfile(JSON.parse(saved))
    } catch {}
  }, [])

  const save = (p: FinancialProfile) => {
    const updated = { ...p, lastUpdated: new Date().toISOString() }
    setProfile(updated)
    localStorage.setItem('as_profile', JSON.stringify(updated))
  }

  const updateIncome = (id: string, field: string, value: any) => {
    save({ ...profile, incomes: profile.incomes.map(i => i.id === id ? { ...i, [field]: value } : i) })
  }

  const updateExpense = (id: string, amount: number) => {
    save({ ...profile, expenses: profile.expenses.map(e => e.id === id ? { ...e, amount } : e) })
  }

  const updateSavings = (id: string, amount: number) => {
    save({ ...profile, savings: profile.savings.map(s => s.id === id ? { ...s, amount } : s) })
  }

  const addIncome = (type: IncomeSource['type']) => {
    const labels: Record<string, string> = { secondary: 'Second Job', freelance: 'Freelance / Consulting', spouse: 'Spouse / Partner', other: 'Other Income' }
    save({ ...profile, incomes: [...profile.incomes, { id: uid(), label: labels[type] || 'Income', amount: 0, type, spouseMode: type === 'spouse' ? 'household' : undefined }] })
  }

  const addExpense = () => {
    save({ ...profile, expenses: [...profile.expenses, { id: uid(), label: 'Custom expense', amount: 0, category: 'custom', icon: '💸' }] })
  }

  const addSavings = () => {
    save({ ...profile, savings: [...profile.savings, { id: uid(), label: 'New savings goal', amount: 0, icon: '🎯' }] })
  }

  const removeIncome = (id: string) => save({ ...profile, incomes: profile.incomes.filter(i => i.id !== id) })
  const removeExpense = (id: string) => save({ ...profile, expenses: profile.expenses.filter(e => e.id !== id) })
  const removeSavings = (id: string) => save({ ...profile, savings: profile.savings.filter(s => s.id !== id) })

  // Calculations
  const householdIncomes = profile.incomes.filter(i => i.type !== 'spouse' || i.spouseMode === 'household' || i.spouseMode === 'clubbed')
  const totalIncome = householdIncomes.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = profile.expenses.reduce((s, e) => s + e.amount, 0)
  const totalSavings = profile.savings.reduce((s, sv) => s + sv.amount, 0)
  const freeToSpend = Math.max(0, totalIncome - totalExpenses - totalSavings)
  const health = calcHealthScore(totalIncome, totalExpenses, totalSavings)
  const burnDays = freeToSpend > 0 ? Math.round((freeToSpend / totalIncome) * 30) : 0

  const tabs: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'income', label: 'Income', icon: '💰' },
    { key: 'expenses', label: 'Expenses', icon: '📤' },
    { key: 'savings', label: 'Savings', icon: '🎯' },
    { key: 'summary', label: 'Summary', icon: '📊' },
  ]

  const s = {
    page: { fontFamily: '"Sora",-apple-system,sans-serif' } as React.CSSProperties,
    section: { background: '#fff', border: '1px solid #E8F5F0', borderRadius: 14, padding: '16px 18px', marginBottom: 12 } as React.CSSProperties,
    sectionTitle: { fontSize: 11, fontWeight: 700, color: '#00A87C', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0FDF9' } as React.CSSProperties,
    label: { fontSize: 13, color: '#334155' },
    amtInput: { display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', background: '#fff' } as React.CSSProperties,
    prefix: { padding: '7px 9px', background: '#F0FDF9', fontSize: 13, color: '#00A87C', fontWeight: 700, borderRight: '1px solid #E8F5F0' },
    inp: { padding: '7px 10px', border: 'none', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 90 } as React.CSSProperties,
    addBtn: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#00D09C', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0', marginTop: 4 } as React.CSSProperties,
  }

  const AmtInput = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <div style={s.amtInput}>
      <span style={s.prefix}>₹</span>
      <input type="number" value={value || ''} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        placeholder="0" style={s.inp} />
    </div>
  )

  return (
    <div className="fade-in" style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>My Money Profile</h2>
        <p style={{ fontSize: 13, color: '#64748B' }}>Set this up once. Every ArthVo decision uses it.</p>
      </div>

      {/* Summary strip */}
      <div style={{ background: '#fff', border: '1.5px solid #B2EFE0', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>

          {/* Donut */}
          <div style={{ position: 'relative' as const, flexShrink: 0 }}>
            <DonutChart expenses={totalExpenses} savings={totalSavings} free={freeToSpend} total={totalIncome} />
          </div>

          {/* Numbers */}
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#00D09C', letterSpacing: '-0.02em' }}>{fmt(freeToSpend)}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>free to spend / month</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B6B', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>{fmt(totalExpenses)} expenses</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFB800', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>{fmt(totalSavings)} savings</span>
              </div>
            </div>
          </div>

          {/* Health Score */}
          <div style={{ textAlign: 'center' as const, flexShrink: 0 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${health.color}18`, border: `3px solid ${health.color}`, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: health.color, lineHeight: 1 }}>{health.score}</div>
              <div style={{ fontSize: 8, color: '#94A3B8', lineHeight: 1 }}>/100</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: health.color }}>{health.grade}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>health score</div>
          </div>
        </div>

        {/* Burn rate */}
        {freeToSpend > 0 && (
          <div style={{ marginTop: 12, background: '#F0FDF9', border: '1px solid #B2EFE0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#065F46' }}>
            🔥 <strong>Burn rate:</strong> At current spending, your free money lasts <strong style={{ color: '#00A87C' }}>{burnDays} days</strong> into the month.
            {burnDays < 20 && <span style={{ color: '#D97706' }}> Consider cutting ₹{fmt(totalExpenses * 0.1)} from bills.</span>}
          </div>
        )}

        {/* Health issues */}
        {health.issues.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
            {health.issues.map((issue, i) => (
              <div key={i} style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', padding: '5px 10px', borderRadius: 6, display: 'flex', gap: 6 }}>
                <span>⚠</span><span>{issue}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F0FDF9', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: tab === t.key ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', background: tab === t.key ? '#00D09C' : 'transparent', color: tab === t.key ? '#fff' : '#64748B', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span>{t.icon}</span><span style={{ display: 'none' }}>{t.label}</span>
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#1E293B' }}>
        {tabs.find(t => t.key === tab)?.icon} {tabs.find(t => t.key === tab)?.label}
      </div>

      {/* ── INCOME TAB ── */}
      {tab === 'income' && (
        <div>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#1D4ED8' }}>
            💡 All income sources are combined to calculate what you can spend. Spouse income can be kept separate for tax purposes.
          </div>

          {profile.incomes.length === 0 && (
            <div style={{ ...s.section, textAlign: 'center' as const, color: '#94A3B8', fontSize: 13, padding: '32px' }}>
              No income added yet. Add your income sources below.
            </div>
          )}

          {profile.incomes.map(inc => (
            <div key={inc.id} style={{ ...s.section, borderColor: inc.type === 'spouse' ? '#FED7AA' : inc.type === 'primary' ? '#B2EFE0' : '#DDD6FE' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
                    {inc.type === 'primary' ? '💼' : inc.type === 'spouse' ? '👫' : inc.type === 'freelance' ? '💻' : '🏢'} {inc.label}
                  </div>
                  {inc.autoFilled && <div style={{ fontSize: 10, color: '#00A87C', marginTop: 2 }}>✓ Auto-filled from salary slip</div>}
                  {inc.type === 'secondary' && <div style={{ fontSize: 10, color: '#7C3AED', marginTop: 2 }}>⚠ Taxable — will appear in Other Income</div>}
                  {inc.type === 'freelance' && <div style={{ fontSize: 10, color: '#7C3AED', marginTop: 2 }}>⚠ Taxable — professional income</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AmtInput value={inc.amount} onChange={v => updateIncome(inc.id, 'amount', v)} />
                  {!inc.autoFilled && (
                    <button onClick={() => removeIncome(inc.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 16 }}>×</button>
                  )}
                </div>
              </div>

              {inc.type === 'spouse' && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 6 }}>How to count this income?</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                    {[
                      { val: 'household', label: '🏠 Household decisions', desc: 'For spending analysis only' },
                      { val: 'clubbed', label: '📋 Tax clubbed', desc: 'Taxed in my hands (no independent source)' },
                      { val: 'separate', label: '🔒 Fully separate', desc: 'Not counted in my budget' },
                    ].map(opt => (
                      <button key={opt.val} onClick={() => updateIncome(inc.id, 'spouseMode', opt.val)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${inc.spouseMode === opt.val ? '#F97316' : '#E2E8F0'}`, background: inc.spouseMode === opt.val ? '#FFF7ED' : '#fff', color: inc.spouseMode === opt.val ? '#C2410C' : '#64748B', fontSize: 11, fontWeight: inc.spouseMode === opt.val ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {inc.spouseMode === 'clubbed' && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#92400E', background: '#FEF3C7', padding: '6px 10px', borderRadius: 6 }}>
                      ⚠ If spouse has no independent income source, their investment returns may be taxed in your hands. Consult a CA.
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 8, fontSize: 11, color: '#64748B' }}>
                per month (take-home) · Annual: <strong>{fmt(inc.amount * 12)}</strong>
              </div>
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
            {[
              { type: 'secondary' as const, label: '+ Second job' },
              { type: 'freelance' as const, label: '+ Freelance' },
              { type: 'spouse' as const, label: '+ Spouse income' },
              { type: 'other' as const, label: '+ Other income' },
            ].map(opt => (
              <button key={opt.type} onClick={() => addIncome(opt.type)}
                style={{ padding: '10px', borderRadius: 10, border: '1.5px dashed #B2EFE0', background: '#F0FDF9', color: '#00A87C', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {opt.label}
              </button>
            ))}
          </div>

          {totalIncome > 0 && (
            <div style={{ background: '#1E293B', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#94A3B8' }}>Total household income</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#00D09C' }}>{fmt(totalIncome)}<span style={{ fontSize: 11, color: '#64748B', fontWeight: 400 }}>/mo</span></span>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {tab === 'expenses' && (
        <div>
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>
            These go out every month. Be honest — this is what makes your spending limit real.
          </div>

          {(['housing', 'debt', 'bills', 'insurance', 'custom'] as const).map(cat => {
            const items = profile.expenses.filter(e => e.category === cat)
            if (cat !== 'custom' && items.length === 0) return null
            const titles: Record<string, string> = { housing: '🏠 Housing', debt: '💳 Loans & EMIs', bills: '📃 Regular Bills', insurance: '🛡️ Insurance', custom: '💸 Other' }
            return (
              <div key={cat} style={s.section}>
                <div style={s.sectionTitle}>{titles[cat]}</div>
                {items.map(exp => (
                  <div key={exp.id} style={s.row}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{exp.icon}</span>
                      {cat === 'custom' ? (
                        <input value={exp.label} onChange={e => save({ ...profile, expenses: profile.expenses.map(x => x.id === exp.id ? { ...x, label: e.target.value } : x) })}
                          style={{ border: 'none', borderBottom: '1px solid #E2E8F0', fontSize: 13, color: '#334155', outline: 'none', fontFamily: 'inherit', background: 'transparent', width: 150 }} />
                      ) : (
                        <span style={{ fontSize: 13, color: '#334155' }}>{exp.label}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AmtInput value={exp.amount} onChange={v => updateExpense(exp.id, v)} />
                      {cat === 'custom' && <button onClick={() => removeExpense(exp.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          <button onClick={addExpense} style={s.addBtn}>+ Add custom expense</button>

          {totalExpenses > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#64748B' }}>Total fixed expenses</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#FF6B6B' }}>{fmt(totalExpenses)}/mo</span>
            </div>
          )}
        </div>
      )}

      {/* ── SAVINGS TAB ── */}
      {tab === 'savings' && (
        <div>
          <div style={{ background: '#F0FDF9', border: '1px solid #B2EFE0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#065F46' }}>
            Money set aside before you spend. ArthVo treats this as already gone. Non-negotiable.
          </div>

          <div style={s.section}>
            {profile.savings.map(sv => (
              <div key={sv.id} style={s.row}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{sv.icon}</span>
                  <input value={sv.label} onChange={e => save({ ...profile, savings: profile.savings.map(x => x.id === sv.id ? { ...x, label: e.target.value } : x) })}
                    style={{ border: 'none', borderBottom: '1px solid #E2E8F0', fontSize: 13, color: '#334155', outline: 'none', fontFamily: 'inherit', background: 'transparent', width: 160 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AmtInput value={sv.amount} onChange={v => updateSavings(sv.id, v)} />
                  <button onClick={() => removeSavings(sv.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={addSavings} style={s.addBtn}>+ Add savings goal</button>

          {totalSavings > 0 && totalIncome > 0 && (
            <div style={{ background: '#F0FDF9', border: '1px solid #B2EFE0', borderRadius: 12, padding: '12px 16px', marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#64748B' }}>Total saved per month</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#00D09C' }}>{fmt(totalSavings)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>Savings rate</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: totalSavings / totalIncome >= 0.2 ? '#00D09C' : '#D97706' }}>
                  {((totalSavings / totalIncome) * 100).toFixed(1)}% {totalSavings / totalIncome < 0.2 ? '(target: 20%)' : '✓'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY TAB ── */}
      {tab === 'summary' && (
        <div>
          {!totalIncome ? (
            <div style={{ textAlign: 'center' as const, padding: '40px 20px', color: '#94A3B8', fontSize: 14 }}>Add your income first to see the full picture.</div>
          ) : (
            <>
              <div style={{ background: '#1E293B', borderRadius: 16, padding: '20px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 14 }}>MONTHLY MONEY PICTURE</div>
                {[
                  { label: 'Total income', val: fmt(totalIncome), color: '#00D09C', sign: '+' },
                  { label: 'Fixed expenses', val: fmt(totalExpenses), color: '#FF6B6B', sign: '−' },
                  { label: 'Savings committed', val: fmt(totalSavings), color: '#FFB800', sign: '−' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                    <span style={{ color: row.color, fontWeight: 600 }}>{row.sign}{row.val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>💰 Free to spend</span>
                  <span style={{ color: '#00D09C', fontWeight: 900, fontSize: 24 }}>{fmt(freeToSpend)}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { val: `${((totalExpenses / totalIncome) * 100).toFixed(0)}%`, label: 'On expenses', color: '#FF6B6B', bg: '#FEF2F2', border: '#FECACA' },
                  { val: `${((totalSavings / totalIncome) * 100).toFixed(0)}%`, label: 'Saved', color: '#FFB800', bg: '#FFFBEB', border: '#FCD34D' },
                  { val: `${((freeToSpend / totalIncome) * 100).toFixed(0)}%`, label: 'Discretionary', color: '#00D09C', bg: '#F0FDF9', border: '#B2EFE0' },
                ].map((c, i) => (
                  <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 8px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.val}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Smart suggestions */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {totalSavings / totalIncome < 0.2 && (
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#1D4ED8', lineHeight: 1.65 }}>
                    💡 You're saving {((totalSavings / totalIncome) * 100).toFixed(0)}% — target is 20%. Increase SIP by <strong>{fmt((totalIncome * 0.2) - totalSavings)}/month</strong> to hit that.
                  </div>
                )}
                {totalExpenses / totalIncome > 0.5 && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#92400E', lineHeight: 1.65 }}>
                    ⚠ Fixed expenses are {((totalExpenses / totalIncome) * 100).toFixed(0)}% of income. Find <strong>{fmt(totalExpenses * 0.1)}</strong> to cut — start with subscriptions and bills.
                  </div>
                )}
                {freeToSpend > totalSavings * 2 && (
                  <div style={{ background: '#F0FDF9', border: '1px solid #B2EFE0', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#065F46', lineHeight: 1.65 }}>
                    🌱 You have {fmt(freeToSpend)} free — consider moving <strong>{fmt(freeToSpend * 0.3)}</strong> to an emergency fund or SIP instead of leaving it idle.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
