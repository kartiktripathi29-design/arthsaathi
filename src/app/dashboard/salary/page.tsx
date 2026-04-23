'use client'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useAppStore } from '@/store/AppStore'
import type { ParsedSalaryData } from '@/types'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Tax calculation ────────────────────────────────────────────────────────
function calcTax(annualIncome: number): { old: number; new: number; recommended: string; savings: number } {
  const stdDed = 75000
  const taxableNew = Math.max(0, annualIncome - stdDed)
  let newTax = 0
  const newSlabs = [[300000,0],[300000,0.05],[300000,0.10],[300000,0.15],[300000,0.20],[Infinity,0.30]]
  let remaining = taxableNew
  for (const [limit, rate] of newSlabs) {
    const chunk = Math.min(remaining, limit as number)
    newTax += chunk * (rate as number)
    remaining -= chunk
    if (remaining <= 0) break
  }
  if (taxableNew <= 700000) newTax = 0

  const taxableOld = Math.max(0, annualIncome - stdDed - 150000 - 25000)
  let oldTax = 0
  const oldSlabs = [[250000,0],[250000,0.05],[500000,0.20],[Infinity,0.30]]
  let rem2 = taxableOld
  for (const [limit, rate] of oldSlabs) {
    const chunk = Math.min(rem2, limit as number)
    oldTax += chunk * (rate as number)
    rem2 -= chunk
    if (rem2 <= 0) break
  }
  if (taxableOld <= 500000) oldTax = 0

  newTax = Math.round(newTax * 1.04)
  oldTax = Math.round(oldTax * 1.04)
  const savings = Math.abs(oldTax - newTax)
  return { old: oldTax, new: newTax, recommended: newTax <= oldTax ? 'new' : 'old', savings }
}

// ─── Component Review Step ────────────────────────────────────────────────────
type ComponentTag = 'fixed' | 'variable' | 'onetime'

interface ReviewComponent {
  label: string
  amount: number
  tag: ComponentTag
  isDeduction: boolean
}

const TAG_CONFIG: Record<ComponentTag, { label: string; color: string; bg: string; desc: string }> = {
  fixed:    { label: 'Fixed Monthly', color: '#059669', bg: '#ECFDF5', desc: 'Paid every month, same amount' },
  variable: { label: 'Variable/Bonus', color: '#7C3AED', bg: '#F5F3FF', desc: 'Depends on performance or quarter' },
  onetime:  { label: 'One-time',       color: '#D97706', bg: '#FFFBEB', desc: 'Won\'t repeat next month (joining bonus, arrears)' },
}

function ComponentReview({ data, onConfirm }: { data: ParsedSalaryData; onConfirm: (components: ReviewComponent[], increment: { pct: number; months: number } | null) => void }) {
  // Build initial components from parsed data
  const buildInitial = (): ReviewComponent[] => {
    const items: ReviewComponent[] = []
    const earningMap: [string, number, ComponentTag][] = [
      ['Basic Salary', data.basicSalary, 'fixed'],
      ['HRA', data.hra, 'fixed'],
      ['DA', data.da, 'fixed'],
      ['Conveyance / TA', data.ta, 'fixed'],
      ['LTA', data.lta, 'onetime'],
      ['Medical Allowance', data.medicalAllowance, 'fixed'],
      ['Special Allowance', data.specialAllowance, 'fixed'],
      ['Other Allowances', data.otherAllowances, 'fixed'],
    ]
    for (const [label, amount, tag] of earningMap) {
      if (amount > 0) items.push({ label, amount, tag, isDeduction: false })
    }
    // Add any extra components from parsed components array
    if (data.components) {
      for (const c of data.components) {
        const alreadyAdded = items.some(i => i.label.toLowerCase() === c.label.toLowerCase())
        if (!alreadyAdded && c.amount > 0 && c.type === 'earning') {
          // Guess tag based on label
          const lbl = c.label.toLowerCase()
          const tag: ComponentTag = lbl.includes('bonus') || lbl.includes('incentive') || lbl.includes('variable') ? 'variable'
            : lbl.includes('joining') || lbl.includes('one-time') || lbl.includes('arrear') || lbl.includes('lta') ? 'onetime'
            : 'fixed'
          items.push({ label: c.label, amount: c.amount, tag, isDeduction: false })
        }
      }
    }
    // Deductions
    const dedMap: [string, number][] = [
      ['PF / EPF', data.employeePF],
      ['TDS / Income Tax', data.tdsDeducted],
      ['Professional Tax', data.professionalTax],
      ['ESIC', data.esic],
      ['Other Deductions', data.otherDeductions],
    ]
    for (const [label, amount] of dedMap) {
      if (amount > 0) items.push({ label, amount, tag: 'fixed', isDeduction: true })
    }
    return items.filter(i => i.amount > 0)
  }

  const [components, setComponents] = useState<ReviewComponent[]>(buildInitial)
  const [expectIncrement, setExpectIncrement] = useState<'yes' | 'no' | null>(null)
  const [incrPct, setIncrPct] = useState('')
  const [incrMonths, setIncrMonths] = useState('')

  const setTag = (idx: number, tag: ComponentTag) => {
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, tag } : c))
  }

  const handleConfirm = () => {
    const increment = expectIncrement === 'yes' && parseFloat(incrPct) > 0
      ? { pct: parseFloat(incrPct), months: parseInt(incrMonths) || 3 }
      : null
    onConfirm(components, increment)
  }

  const earnings = components.filter(c => !c.isDeduction)
  const deductions = components.filter(c => c.isDeduction)

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>✅ Slip parsed — review your components</div>
        <div style={{ fontSize: 13, color: '#047857', lineHeight: 1.6 }}>
          Tell us which components repeat every month and which are one-time. This makes your annual tax projection accurate.
        </div>
      </div>

      {/* Earnings */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Earnings</div>
        {earnings.map((c, i) => (
          <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < earnings.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#1E293B' }}>{c.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>₹{c.amount.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(Object.keys(TAG_CONFIG) as ComponentTag[]).map(tag => (
                <button key={tag} onClick={() => setTag(components.indexOf(c), tag)}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1.5px solid ${c.tag === tag ? TAG_CONFIG[tag].color : '#E2E8F0'}`, background: c.tag === tag ? TAG_CONFIG[tag].bg : '#fff', color: c.tag === tag ? TAG_CONFIG[tag].color : '#94A3B8', fontSize: 11, fontWeight: c.tag === tag ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'center' as const }}>
                  {TAG_CONFIG[tag].label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 5 }}>{TAG_CONFIG[c.tag].desc}</div>
          </div>
        ))}
      </div>

      {/* Deductions — always fixed, just show */}
      {deductions.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Deductions <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: 10 }}>(treated as fixed monthly)</span></div>
          {deductions.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < deductions.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>{c.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>−₹{c.amount.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Increment question */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Expecting an increment?</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>We'll project your tax for the full year including the hike.</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: expectIncrement === 'yes' ? 16 : 0 }}>
          {[['yes', '🎉 Yes'], ['no', 'Not yet']].map(([val, lbl]) => (
            <button key={val} onClick={() => setExpectIncrement(val as 'yes' | 'no')}
              style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid ${expectIncrement === val ? '#059669' : '#E2E8F0'}`, background: expectIncrement === val ? '#ECFDF5' : '#fff', color: expectIncrement === val ? '#059669' : '#64748B', fontSize: 13, fontWeight: expectIncrement === val ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
              {lbl}
            </button>
          ))}
        </div>
        {expectIncrement === 'yes' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 5 }}>Increment %</label>
              <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: 8, overflow: 'hidden' }}>
                <input type="number" value={incrPct} onChange={e => setIncrPct(e.target.value)}
                  placeholder="e.g. 15" min="0" max="200"
                  style={{ flex: 1, padding: '9px 12px', border: 'none', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ padding: '9px 10px', background: '#F8FAFC', fontSize: 13, color: '#64748B', borderLeft: '1px solid #E2E8F0' }}>%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 5 }}>In how many months?</label>
              <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: 8, overflow: 'hidden' }}>
                <input type="number" value={incrMonths} onChange={e => setIncrMonths(e.target.value)}
                  placeholder="e.g. 3" min="1" max="12"
                  style={{ flex: 1, padding: '9px 12px', border: 'none', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ padding: '9px 10px', background: '#F8FAFC', fontSize: 13, color: '#64748B', borderLeft: '1px solid #E2E8F0' }}>mo</span>
              </div>
            </div>
            {incrPct && incrMonths && (
              <div style={{ gridColumn: '1/-1', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#065F46' }}>
                📊 We'll calculate tax assuming {incrMonths} months at current salary, then {12 - parseInt(incrMonths)} months at +{incrPct}% increment.
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={handleConfirm} disabled={expectIncrement === null}
        style={{ width: '100%', padding: '14px', background: expectIncrement === null ? '#E2E8F0' : '#059669', color: expectIncrement === null ? '#94A3B8' : '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: expectIncrement === null ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
        {expectIncrement === null ? 'Answer the increment question above →' : 'Confirm & Calculate Tax →'}
      </button>
    </div>
  )
}

// ─── Shared result display ──────────────────────────────────────────────────
function ResultView({ 
  data, onEdit, onReset, source, increment
}: { 
  data: ParsedSalaryData | any, 
  onEdit: () => void, 
  onReset: () => void,
  source: 'slip' | 'offer' | 'manual',
  increment: { pct: number; months: number } | null
}) {
  const annualGross = data._adjustedAnnual
    || (source === 'slip' || source === 'manual' ? (data.grossSalary || 0) * 12 : (data.totalCTC || data.fixedCTC || 0))
  const annualFixed = source === 'offer' ? (data.fixedCTC || annualGross) : annualGross
  const annualVariable = source === 'offer' ? (data.variableCTC || 0) : 0
  const tax = calcTax(annualGross)

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
  const fmtM = (n: number) => fmt(Math.round(n / 12))

  const rows = [
    { label: 'Gross / Total CTC', annual: annualGross, monthly: annualGross / 12, color: '#1E293B', bold: true },
    ...(annualVariable > 0 ? [
      { label: 'Fixed CTC', annual: annualFixed, monthly: annualFixed / 12, color: '#059669', bold: false },
      { label: 'Variable / Bonus', annual: annualVariable, monthly: annualVariable / 12, color: '#D97706', bold: false },
    ] : []),
    { label: 'Standard Deduction', annual: -75000, monthly: -75000/12, color: '#DC2626', bold: false },
    { label: 'Tax (New Regime)', annual: -tax.new, monthly: -tax.new/12, color: '#DC2626', bold: false },
    { label: 'Tax (Old Regime)', annual: -tax.old, monthly: -tax.old/12, color: '#94A3B8', bold: false },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#1E293B', borderRadius: 14, padding: '20px 24px', marginBottom: 16, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 4 }}>
              {source === 'slip' ? 'SALARY SLIP PARSED' : source === 'offer' ? 'OFFER LETTER PARSED' : 'MANUAL ENTRY'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {data.employeeName || data.designation || 'Your Salary'}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              {data.employerName || ''} 
              {source === 'slip' && data.month ? ` · ${data.month} ${data.year}` : ''}
              {source === 'offer' && data.joiningDate ? ` · Joining: ${data.joiningDate}` : ''}
            </div>
            {increment && (
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#34D399', fontWeight: 600 }}>
                🎉 +{increment.pct}% increment in {increment.months} months — projected
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✏️ Edit
            </button>
            <button onClick={onReset} style={{ padding: '7px 14px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 7, color: '#FCA5A5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              ↺ Upload new
            </button>
          </div>
        </div>

        {/* Annual vs Monthly tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4, letterSpacing: '0.06em' }}>ANNUAL TAKE-HOME (NEW)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#34D399' }}>
              {fmt(annualGross - 75000 - tax.new)}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>After tax + std. deduction</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4, letterSpacing: '0.06em' }}>MONTHLY TAKE-HOME (NEW)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#34D399' }}>
              {fmtM(annualGross - 75000 - tax.new)}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Approx. monthly equivalent</div>
          </div>
        </div>
      </div>

      {/* Tax comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: tax.recommended === 'new' ? '#F0FDF4' : '#F8FAFC', border: `1.5px solid ${tax.recommended === 'new' ? '#059669' : '#E2E8F0'}`, borderRadius: 12, padding: '16px' }}>
          {tax.recommended === 'new' && (
            <div style={{ fontSize: 9, background: '#059669', color: '#fff', fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 8, letterSpacing: '0.05em' }}>RECOMMENDED</div>
          )}
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>NEW REGIME</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{fmt(tax.new)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Annual · {fmtM(tax.new)}/mo</div>
        </div>
        <div style={{ background: tax.recommended === 'old' ? '#F0FDF4' : '#F8FAFC', border: `1.5px solid ${tax.recommended === 'old' ? '#059669' : '#E2E8F0'}`, borderRadius: 12, padding: '16px' }}>
          {tax.recommended === 'old' && (
            <div style={{ fontSize: 9, background: '#059669', color: '#fff', fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 8, letterSpacing: '0.05em' }}>RECOMMENDED</div>
          )}
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>OLD REGIME</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>{fmt(tax.old)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Annual · {fmtM(tax.old)}/mo</div>
        </div>
      </div>

      {/* Savings callout */}
      {tax.savings > 0 && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>Switch to {tax.recommended === 'new' ? 'New' : 'Old'} Regime</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Saves {fmtM(tax.savings)}/month · {fmt(tax.savings)}/year</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{fmt(tax.savings)}</div>
        </div>
      )}

      {/* Full breakdown */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Breakdown</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 0 }}>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 8 }}>COMPONENT</div>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 8, textAlign: 'right', paddingRight: 24 }}>ANNUAL</div>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 8, textAlign: 'right' }}>MONTHLY</div>
          {rows.map((row, i) => row.annual !== 0 && (
            <>
              <div key={`l${i}`} style={{ fontSize: 13, color: '#374151', padding: '6px 0', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', fontWeight: row.bold ? 700 : 400 }}>{row.label}</div>
              <div key={`a${i}`} style={{ fontSize: 13, color: row.color, fontWeight: 600, padding: '6px 24px 6px 0', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', textAlign: 'right' }}>
                {row.annual < 0 ? '−' : ''}{fmt(Math.abs(row.annual))}
              </div>
              <div key={`m${i}`} style={{ fontSize: 13, color: '#94A3B8', padding: '6px 0', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', textAlign: 'right' }}>
                {row.monthly < 0 ? '−' : ''}{fmtM(Math.abs(row.annual))}
              </div>
            </>
          ))}
        </div>
      </div>

      {/* Offer letter notes */}
      {source === 'offer' && data.notes && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
          ⚠️ <strong>Conditions:</strong> {data.notes}
        </div>
      )}

      {/* Salary components */}
      {data.components?.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>All Components</div>
          {data.components.filter((c: any) => c.amount > 0).map((c: any, i: number) => {
            const isDeduction = c.type === 'deduction'
            const isVariable = c.type === 'variable'
            const isOneTime = c.frequency === 'one-time'
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <span style={{ fontSize: 13, color: '#374151' }}>{c.label}</span>
                  {isOneTime && <span style={{ fontSize: 10, color: '#D97706', background: '#FEF3C7', padding: '1px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 600 }}>ONE-TIME</span>}
                  {isVariable && <span style={{ fontSize: 10, color: '#7C3AED', background: '#F5F3FF', padding: '1px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 600 }}>VARIABLE</span>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDeduction ? '#DC2626' : '#1E293B' }}>
                    {isDeduction ? '−' : ''}{fmt(source === 'slip' ? c.amount : (c.frequency === 'monthly' ? c.amount * 12 : c.amount))}
                    <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>yr</span>
                  </div>
                  {!isOneTime && (
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                      {fmt(source === 'slip' ? c.amount : (c.frequency === 'monthly' ? c.amount : c.amount / 12))}/mo
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: '#7F1D1D' }}>Uploaded the wrong document?</div>
        <button onClick={onReset} style={{ padding: '7px 16px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↺ Start over
        </button>
      </div>

      <Link href="/dashboard/other-income"
        style={{ display: 'block', padding: '14px', background: '#059669', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none', textAlign: 'center' }}>
        Next: Add Other Income →
      </Link>
    </div>
  )
}

// ─── Upload zone ─────────────────────────────────────────────────────────────
function UploadZone({ onFile, loading, label }: { onFile: (f: File) => void; loading: boolean; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => !loading && fileRef.current?.click()}
      style={{ border: '1.5px dashed #A7F3D0', borderRadius: 12, padding: '40px 24px', textAlign: 'center', background: '#F8FFFE', cursor: loading ? 'wait' : 'pointer' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>
        {loading ? 'Analysing…' : `Upload ${label}`}
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>PDF, JPG, PNG — any format</div>
      {!loading && (
        <div style={{ display: 'inline-flex', padding: '9px 24px', background: '#059669', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
          Browse Files
        </div>
      )}
      {loading && <div style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>AI is reading your document…</div>}
      <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  )
}

// ─── Manual entry form ────────────────────────────────────────────────────────
function ManualForm({ onSave }: { onSave: (d: ParsedSalaryData) => void }) {
  const [f, setF] = useState({ name: '', company: '', basic: '', hra: '', special: '', other: '', pf: '', tds: '', pt: '' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }))
  const n = (v: string) => parseFloat(v) || 0

  const handleSave = () => {
    const gross = n(f.basic) + n(f.hra) + n(f.special) + n(f.other)
    const totalDed = n(f.pf) + n(f.tds) + n(f.pt)
    if (!gross) { toast.error('Please enter at least basic salary'); return }
    onSave({
      employeeName: f.name, employerName: f.company,
      basicSalary: n(f.basic), hra: n(f.hra), specialAllowance: n(f.special), otherAllowances: n(f.other),
      grossSalary: gross, employeePF: n(f.pf), tdsDeducted: n(f.tds), professionalTax: n(f.pt),
      totalDeductions: totalDed, netSalary: gross - totalDed,
      ctcMonthly: gross + n(f.pf) * 0.2, ctcAnnual: (gross + n(f.pf) * 0.2) * 12,
      components: [
        { label: 'Basic Salary', amount: n(f.basic), type: 'earning' },
        { label: 'HRA', amount: n(f.hra), type: 'earning' },
        { label: 'Special Allowance', amount: n(f.special), type: 'earning' },
        { label: 'Other Allowances', amount: n(f.other), type: 'earning' },
        { label: 'Provident Fund', amount: n(f.pf), type: 'deduction' },
        { label: 'TDS', amount: n(f.tds), type: 'deduction' },
        { label: 'Professional Tax', amount: n(f.pt), type: 'deduction' },
      ].filter(c => c.amount > 0),
    } as ParsedSalaryData)
  }

  const inp = (label: string, key: string, placeholder = '0') => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>{label} <span style={{ color: '#94A3B8', fontWeight: 400 }}>(monthly ₹)</span></label>
      <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: 8, overflow: 'hidden' }}>
        <span style={{ padding: '9px 10px', background: '#F8FAFC', fontSize: 13, color: '#64748B', borderRight: '1px solid #E2E8F0' }}>₹</span>
        <input type="number" value={(f as any)[key]} onChange={set(key)} placeholder={placeholder}
          style={{ flex: 1, padding: '9px 12px', border: 'none', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Your name</label>
          <input value={f.name} onChange={set('name')} placeholder="Full name"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Company</label>
          <input value={f.company} onChange={set('company')} placeholder="Employer name"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        <div style={{ gridColumn: '1/-1', height: 1, background: '#F1F5F9', margin: '4px 0' }} />
        <div style={{ fontSize: 11, gridColumn: '1/-1', color: '#059669', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Earnings</div>
        {inp('Basic Salary', 'basic')}
        {inp('HRA', 'hra')}
        {inp('Special Allowance', 'special')}
        {inp('Other Allowances', 'other')}
        <div style={{ height: 1, background: '#F1F5F9', gridColumn: '1/-1', margin: '4px 0' }} />
        <div style={{ fontSize: 11, gridColumn: '1/-1', color: '#DC2626', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Deductions</div>
        {inp('Provident Fund (EPF)', 'pf')}
        {inp('TDS / Income Tax', 'tds')}
        {inp('Professional Tax', 'pt')}
      </div>
      <button onClick={handleSave}
        style={{ width: '100%', padding: '13px', background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
        Calculate Tax →
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SalaryPage() {
  const { salary, setSalary } = useAppStore()
  const [tab, setTab] = useState<'slip' | 'offer' | 'manual'>('slip')
  const [loading, setLoading] = useState(false)
  const [offerData, setOfferData] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)

  // Slip-specific: parsed but not yet reviewed
  const [pendingSlip, setPendingSlip] = useState<ParsedSalaryData | null>(null)
  // After review: adjusted annual gross + increment info for display
  const [adjustedData, setAdjustedData] = useState<{ annualGross: number; increment: { pct: number; months: number } | null } | null>(null)

  const showReview = !!pendingSlip && !salary
  const showResult = salary && !editMode && !pendingSlip
  const showOfferResult = offerData && !editMode

  const handleSlipFile = async (file: File) => {
    setLoading(true)
    const tid = toast.loading('Reading salary slip…')
    try {
      const base64Data = await fileToBase64(file)
      const res = await fetch('/api/parse-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType: file.type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to parse')
      setPendingSlip(json.data)
      toast.success('Slip parsed — please review components', { id: tid })
    } catch (e: any) {
      toast.error(e.message, { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const handleReviewConfirm = (components: ReviewComponent[], increment: { pct: number; months: number } | null) => {
    if (!pendingSlip) return

    // Recalculate annual gross from reviewed components
    const fixedMonthly = components
      .filter(c => !c.isDeduction && c.tag === 'fixed')
      .reduce((s, c) => s + c.amount, 0)
    const variableAnnual = components
      .filter(c => !c.isDeduction && c.tag === 'variable')
      .reduce((s, c) => s + c.amount, 0)
    const onetimeAnnual = components
      .filter(c => !c.isDeduction && c.tag === 'onetime')
      .reduce((s, c) => s + c.amount, 0)

    let annualGross = fixedMonthly * 12 + variableAnnual + onetimeAnnual

    // Apply increment: X months at current, rest at hiked
    if (increment) {
      const monthsBefore = Math.max(0, Math.min(12, increment.months))
      const monthsAfter = 12 - monthsBefore
      const hikedMonthly = fixedMonthly * (1 + increment.pct / 100)
      annualGross = fixedMonthly * monthsBefore + hikedMonthly * monthsAfter + variableAnnual + onetimeAnnual
    }

    // Update components on the saved salary for display
    const updatedComponents = components.map(c => ({
      label: c.label,
      amount: c.amount,
      type: (c.isDeduction ? 'deduction' : (c.tag === 'variable' ? 'earning' : c.tag === 'onetime' ? 'earning' : 'earning')) as 'earning' | 'deduction' | 'computed',
    }))

    setSalary({ ...pendingSlip, components: updatedComponents })
    setAdjustedData({ annualGross, increment })
    setPendingSlip(null)
    toast.success('Tax calculated with your adjustments!')
  }

  const handleOfferFile = async (file: File) => {
    setLoading(true)
    const tid = toast.loading('Reading offer letter…')
    try {
      // Use FormData — avoids base64 33% size overhead
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/parse-offer-letter', {
        method: 'POST',
        body: form,
      })
      let json: any
      const text = await res.text()
      try { json = JSON.parse(text) } catch {
        throw new Error(res.status === 413 ? 'File too large. Please try a PDF under 8MB.' : 'Server error. Please try again.')
      }
      if (!res.ok) throw new Error(json.error || 'Failed to parse')
      setOfferData(json.data)
      setEditMode(false)
      toast.success('Offer letter parsed!', { id: tid })
    } catch (e: any) {
      toast.error(e.message, { id: tid })
    } finally {
      setLoading(false)
    }
  }

  const handleManualSave = (data: ParsedSalaryData) => {
    setSalary(data)
    setAdjustedData(null)
    setEditMode(false)
    toast.success('Salary saved!')
  }

  const handleSlipReset = () => {
    setSalary(null)
    setPendingSlip(null)
    setAdjustedData(null)
    setEditMode(false)
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>Salary</h2>
        <p style={{ fontSize: 14, color: '#64748B' }}>Upload a salary slip, offer letter, or enter manually. We'll show your annual and monthly tax.</p>
      </div>

      {/* Tab switcher — hidden during review and result */}
      {(!showResult && !showOfferResult && !showReview) && (
        <div style={{ display: 'flex', gap: 2, background: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          {([
            ['slip', '📄', 'Salary Slip'],
            ['offer', '📨', 'Offer Letter'],
            ['manual', '✏️', 'Enter Manually'],
          ] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: tab === key ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#059669' : '#64748B', boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15 }}>{icon}</span> {label}
            </button>
          ))}
        </div>
      )}

      {/* Upload zones */}
      {tab === 'slip' && !showResult && !showReview && (
        <UploadZone onFile={handleSlipFile} loading={loading} label="Salary Slip" />
      )}
      {tab === 'offer' && !showOfferResult && (
        <>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#1D4ED8' }}>
            💡 Just got an offer? Upload your offer letter and see exactly how much you'll take home and what tax you'll pay — before joining.
          </div>
          <UploadZone onFile={handleOfferFile} loading={loading} label="Offer Letter" />
        </>
      )}
      {tab === 'manual' && !showResult && (
        <ManualForm onSave={handleManualSave} />
      )}

      {/* Review step — slip only */}
      {showReview && pendingSlip && (
        <ComponentReview
          data={pendingSlip}
          onConfirm={handleReviewConfirm}
        />
      )}

      {/* Results */}
      {tab === 'slip' && showResult && (
        <ResultView
          data={{ ...salary, _adjustedAnnual: adjustedData?.annualGross }}
          source="slip"
          increment={adjustedData?.increment ?? null}
          onEdit={() => { setSalary(null); setPendingSlip(salary); setEditMode(false) }}
          onReset={handleSlipReset}
        />
      )}
      {tab === 'offer' && showOfferResult && (
        <ResultView
          data={offerData}
          source="offer"
          increment={null}
          onEdit={() => setEditMode(true)}
          onReset={() => { setOfferData(null); setEditMode(false) }}
        />
      )}
      {tab === 'manual' && showResult && (
        <ResultView
          data={salary}
          source="manual"
          increment={null}
          onEdit={() => setEditMode(true)}
          onReset={() => { setSalary(null); setEditMode(false) }}
        />
      )}
    </div>
  )
}
