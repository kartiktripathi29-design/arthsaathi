'use client'
import { useState } from 'react'
import { useAppStore } from '@/store/AppStore'

type Step = 'input' | 'questions' | 'verdict'

interface EMIOption {
  label: string
  months: number
  rate: number
  tag: 'recommended' | 'watchout' | 'avoid'
  tagLabel: string
  tagColor: string
  tagBg: string
  borderColor: string
  bg: string
}

function calcEMI(principal: number, months: number, annualRate: number) {
  if (annualRate === 0) return principal / months
  const r = annualRate / 12 / 100
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)
}

export default function DecidePage() {
  const { salary, goals } = useAppStore()
  const [step, setStep] = useState<Step>('input')
  const [itemName, setItemName] = useState('')
  const [price, setPrice] = useState('')
  const [extraIncome, setExtraIncome] = useState<'yes' | 'no' | null>(null)
  const [extraAmount, setExtraAmount] = useState('')
  const [bigExpense, setBigExpense] = useState<'yes' | 'no' | null>(null)
  const [bigAmount, setBigAmount] = useState('')

  const monthlyIncome = salary?.netSalary || 0
  const priceNum = parseFloat(price.replace(/,/g, '')) || 0
  const extraNum = parseFloat(extraAmount.replace(/,/g, '')) || 0
  const bigNum = parseFloat(bigAmount.replace(/,/g, '')) || 0

  const effectiveIncome = monthlyIncome + (extraIncome === 'yes' ? extraNum : 0)
  const availableAfterExpenses = effectiveIncome - (bigExpense === 'yes' ? bigNum : 0)
  const pctOfIncome = effectiveIncome > 0 ? (priceNum / effectiveIncome) * 100 : 0

  const canAfford = availableAfterExpenses >= priceNum
  const comfortable = pctOfIncome <= 5
  const tight = pctOfIncome > 5 && pctOfIncome <= 15
  const risky = pctOfIncome > 15

  const verdict = canAfford && comfortable ? 'yes' : canAfford && tight ? 'maybe' : 'no'

  const verdictConfig = {
    yes: { emoji: '✅', title: 'Yes, go for it', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', sub: `₹${priceNum.toLocaleString('en-IN')} is ${pctOfIncome.toFixed(1)}% of your monthly income. Comfortable.` },
    maybe: { emoji: '🤔', title: 'You can, but think twice', color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', sub: `This is ${pctOfIncome.toFixed(1)}% of your income. Not dangerous, but not small either.` },
    no: { emoji: '❌', title: 'Not the best time', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', sub: `After your expenses, you'd have ₹${Math.max(0, availableAfterExpenses).toLocaleString('en-IN')} left. This cuts too deep.` },
  }[verdict]

  // EMI options
  const emiOptions: EMIOption[] = [
    { label: 'Pay in full', months: 0, rate: 0, tag: 'recommended', tagLabel: 'BEST', tagColor: '#059669', tagBg: '#ECFDF5', borderColor: '#A7F3D0', bg: '#F0FDF4' },
    { label: 'No-cost EMI (3 months)', months: 3, rate: 0, tag: 'watchout', tagLabel: 'WATCH OUT', tagColor: '#D97706', tagBg: '#FEF3C7', borderColor: '#FCD34D', bg: '#FFFBEB' },
    { label: '6-month EMI @ 18%', months: 6, rate: 18, tag: 'watchout', tagLabel: 'OK IF NEEDED', tagColor: '#7C3AED', tagBg: '#F5F3FF', borderColor: '#DDD6FE', bg: '#F5F3FF' },
    { label: '12-month EMI @ 24%', months: 12, rate: 24, tag: 'avoid', tagLabel: 'AVOID', tagColor: '#DC2626', tagBg: '#FEE2E2', borderColor: '#FECACA', bg: '#FEF2F2' },
  ]

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  const s = {
    label: { fontSize: 13, fontWeight: 500, color: '#334155', display: 'block', marginBottom: 5 } as React.CSSProperties,
    input: { width: '100%', padding: '11px 14px', border: '1px solid #CBD5E1', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', outline: 'none' } as React.CSSProperties,
    btn: { width: '100%', padding: '13px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 } as React.CSSProperties,
    choiceRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 } as React.CSSProperties,
  }

  const ChoiceBtn = ({ val, current, onClick, children, activeColor = '#059669', activeBg = '#ECFDF5' }: any) => (
    <button onClick={() => onClick(val)} style={{ padding: '10px', borderRadius: 9, border: `1.5px solid ${current === val ? activeColor : '#E2E8F0'}`, background: current === val ? activeBg : '#fff', color: current === val ? activeColor : '#64748B', fontSize: 13, fontWeight: current === val ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
      {children}
    </button>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 560 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>Can I buy this?</h2>
        <p style={{ fontSize: 14, color: '#64748B' }}>Enter what you want to buy. ArthVo will tell you if it makes sense — and exactly how to pay.</p>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#E2E8F0', borderRadius: 10, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#059669', borderRadius: 10, width: step === 'input' ? '33%' : step === 'questions' ? '66%' : '100%', transition: 'width 0.4s ease' }} />
      </div>

      {/* STEP 1: Input */}
      {step === 'input' && (
        <div>
          {!monthlyIncome && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
              ⚠ Add your salary slip first for a personalised answer. We'll use a rough estimate for now.
            </div>
          )}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>What do you want to buy?</label>
              <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Titan Fastrack Watch, iPhone 15, Nike shoes…" style={s.input} />
            </div>
            <div>
              <label style={s.label}>Price (₹)</label>
              <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: 10, overflow: 'hidden' }}>
                <span style={{ padding: '11px 12px', background: '#F8FAFC', fontSize: 15, color: '#059669', fontWeight: 700, borderRight: '1px solid #E2E8F0' }}>₹</span>
                <input type="tel" value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="e.g. 4,999" style={{ ...s.input, border: 'none', borderRadius: 0 }} />
              </div>
            </div>
          </div>
          <button onClick={() => priceNum > 0 && setStep('questions')} disabled={!priceNum}
            style={{ ...s.btn, opacity: priceNum > 0 ? 1 : 0.5, cursor: priceNum > 0 ? 'pointer' : 'not-allowed' }}>
            Analyse this purchase →
          </button>
        </div>
      )}

      {/* STEP 2: Questions */}
      {step === 'questions' && (
        <div>
          <div style={{ background: '#1E293B', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>Analysing</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{itemName || 'Your item'}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#34D399' }}>{fmt(priceNum)}</div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Quick — two questions</div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 1.6 }}>This helps me give you a real answer, not a generic one.</div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 10 }}>1. Expecting extra income this month?</div>
              <div style={s.choiceRow}>
                <ChoiceBtn val="yes" current={extraIncome} onClick={setExtraIncome}>🎉 Yes</ChoiceBtn>
                <ChoiceBtn val="no" current={extraIncome} onClick={setExtraIncome} activeColor="#64748B" activeBg="#F1F5F9">Nope</ChoiceBtn>
              </div>
              {extraIncome === 'yes' && (
                <div>
                  <label style={{ ...s.label, fontSize: 12, color: '#64748B' }}>How much extra? (approx.)</label>
                  <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: 8, overflow: 'hidden' }}>
                    <span style={{ padding: '9px 10px', background: '#F8FAFC', fontSize: 13, color: '#059669', fontWeight: 700, borderRight: '1px solid #E2E8F0' }}>₹</span>
                    <input type="tel" value={extraAmount} onChange={e => setExtraAmount(e.target.value)} placeholder="e.g. 20,000" style={{ ...s.input, border: 'none', borderRadius: 0, padding: '9px 12px', fontSize: 13 }} />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 10 }}>2. Any big expense coming this month?</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>Rent, EMI, school fees, anything ₹5,000+</div>
              <div style={s.choiceRow}>
                <ChoiceBtn val="yes" current={bigExpense} onClick={setBigExpense} activeColor="#DC2626" activeBg="#FEF2F2">Yes, something big</ChoiceBtn>
                <ChoiceBtn val="no" current={bigExpense} onClick={setBigExpense} activeColor="#64748B" activeBg="#F1F5F9">Nothing major</ChoiceBtn>
              </div>
              {bigExpense === 'yes' && (
                <div>
                  <label style={{ ...s.label, fontSize: 12, color: '#64748B' }}>Roughly how much?</label>
                  <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: 8, overflow: 'hidden' }}>
                    <span style={{ padding: '9px 10px', background: '#F8FAFC', fontSize: 13, color: '#DC2626', fontWeight: 700, borderRight: '1px solid #E2E8F0' }}>₹</span>
                    <input type="tel" value={bigAmount} onChange={e => setBigAmount(e.target.value)} placeholder="e.g. 15,000" style={{ ...s.input, border: 'none', borderRadius: 0, padding: '9px 12px', fontSize: 13 }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep('input')} style={{ ...s.btn, background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', marginTop: 0, flex: 0, padding: '13px 20px', width: 'auto' }}>←</button>
            <button onClick={() => extraIncome && bigExpense && setStep('verdict')}
              disabled={!extraIncome || !bigExpense}
              style={{ ...s.btn, flex: 1, marginTop: 0, opacity: extraIncome && bigExpense ? 1 : 0.5, cursor: extraIncome && bigExpense ? 'pointer' : 'not-allowed' }}>
              Show me the answer →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Verdict */}
      {step === 'verdict' && (
        <div>
          {/* Main verdict card */}
          <div style={{ background: verdictConfig.bg, border: `1.5px solid ${verdictConfig.border}`, borderRadius: 16, padding: '20px 22px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{verdictConfig.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: verdictConfig.color, letterSpacing: '-0.02em', marginBottom: 6 }}>{verdictConfig.title}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.65 }}>{verdictConfig.sub}</div>
            {monthlyIncome > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                {[
                  { label: 'Your income', val: fmt(effectiveIncome) },
                  { label: 'Item cost', val: fmt(priceNum) },
                  { label: '% of income', val: `${pctOfIncome.toFixed(1)}%` },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EMI breakdown */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>How should you pay?</div>
          {emiOptions.map((opt, i) => {
            const monthly = opt.months === 0 ? 0 : calcEMI(priceNum, opt.months, opt.rate)
            const total = opt.months === 0 ? priceNum : monthly * opt.months + (opt.rate === 0 ? 149 : 0)
            const extra = total - priceNum + (opt.rate === 0 && opt.months > 0 ? 149 : 0)
            return (
              <div key={i} style={{ background: opt.bg, border: `1.5px solid ${opt.borderColor}`, borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{opt.label}</div>
                  <span style={{ fontSize: 9, fontWeight: 800, color: opt.tagColor, background: opt.tagBg, padding: '2px 8px', borderRadius: 20 }}>{opt.tagLabel}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {opt.months === 0 ? (
                    <>
                      <div><div style={{ fontSize: 10, color: '#64748B' }}>You pay</div><div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{fmt(priceNum)}</div></div>
                      <div><div style={{ fontSize: 10, color: '#64748B' }}>Extra cost</div><div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>₹0</div></div>
                      <div><div style={{ fontSize: 10, color: '#64748B' }}>Liquidity hit</div><div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{fmt(priceNum)}</div></div>
                    </>
                  ) : (
                    <>
                      <div><div style={{ fontSize: 10, color: '#64748B' }}>Per month</div><div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{fmt(monthly)}</div></div>
                      <div><div style={{ fontSize: 10, color: '#64748B' }}>Total paid</div><div style={{ fontSize: 13, fontWeight: 700, color: opt.rate > 0 ? '#DC2626' : '#D97706' }}>{fmt(total)}</div></div>
                      <div><div style={{ fontSize: 10, color: '#64748B' }}>Extra cost</div><div style={{ fontSize: 13, fontWeight: 700, color: extra > 0 ? '#DC2626' : '#059669' }}>{extra > 0 ? `+${fmt(extra)}` : '₹0'}</div></div>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {/* Goal impact */}
          {goals && goals.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px', marginBottom: 16, marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>Impact on your goals</div>
              {goals.slice(0, 2).map((g: any, i: number) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Minimal impact ✓</div>
                  </div>
                  <div style={{ height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#059669', borderRadius: 3, width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom line */}
          <div style={{ background: '#1E293B', borderRadius: 12, padding: '16px 18px', marginBottom: 14, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            💡 <strong style={{ color: '#34D399' }}>Bottom line:</strong>{' '}
            {verdict === 'yes' ? `Buy it. Pay in full — you save ₹${Math.round(calcEMI(priceNum, 3, 0) * 3 - priceNum + 149).toLocaleString('en-IN')} vs No-cost EMI and ₹${Math.round(calcEMI(priceNum, 12, 24) * 12 - priceNum).toLocaleString('en-IN')} vs 12-month EMI. Enjoy it guilt-free.` : verdict === 'maybe' ? `Possible, but consider waiting 2 weeks to see how your expenses pan out. If you must buy, pay in full — avoid the EMI trap.` : `Not the right time. Wait until next month when expenses ease. Or consider a lower-priced alternative.`}
          </div>

          <button onClick={() => { setStep('input'); setItemName(''); setPrice(''); setExtraIncome(null); setBigExpense(null); setExtraAmount(''); setBigAmount('') }}
            style={{ ...s.btn, background: '#fff', color: '#1E293B', border: '1px solid #E2E8F0' }}>
            Check another item ↺
          </button>
        </div>
      )}
    </div>
  )
}
