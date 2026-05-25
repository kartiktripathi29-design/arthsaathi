'use client'
import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

// Pick the most appropriate ITR form based on income mix + total income.
// Rules of thumb for AY 2025-26:
//  ITR-1: resident, salary + 1 house property + interest, total ≤ ₹50L, no capital gains
//         (LTCG u/s 112A up to ₹1.25L is allowed here)
//  ITR-4: presumptive freelance/business u/s 44ADA / 44AD, total ≤ ₹50L
//  ITR-3: freelance/business with actual expenses, F&O treated as business income
//  ITR-2: capital gains beyond ITR-1 threshold, total > ₹50L, multiple houses, foreign assets
function recommendITR(otherEntries: any[], totalIncome: number): { form: 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'; reasons: string[] } {
  const reasons: string[] = []
  const hasFreelance = otherEntries.some((e: any) => e.type === 'freelance')
  const presumptiveFreelance = otherEntries.some((e: any) => e.type === 'freelance' && e.declarationMethod === 'presumptive_44ada')
  const actualFreelance = otherEntries.some((e: any) => e.type === 'freelance' && e.declarationMethod !== 'presumptive_44ada')
  const hasFno = otherEntries.some((e: any) => e.type === 'fno' && Number(e.fnoNetProfit) !== 0)
  const hasEquity = otherEntries.some((e: any) => e.type === 'equity' && (Number(e.ltcgGains) > 0 || Number(e.stcgGains) > 0))
  const hasCrypto = otherEntries.some((e: any) => e.type === 'crypto' && Number(e.cryptoGains) > 0)
  const ltcgEquityTotal = otherEntries
    .filter((e: any) => e.type === 'equity')
    .reduce((s: number, e: any) => s + Number(e.ltcgGains || 0), 0)
  const above50L = totalIncome > 5000000

  // F&O is treated as business income — forces ITR-3
  if (hasFno) {
    reasons.push('F&O trading is treated as non-speculative business income.')
    return { form: 'ITR-3', reasons }
  }
  // Freelance with actual expenses → business income → ITR-3
  if (actualFreelance) {
    reasons.push('Freelance income declared with actual expenses (not presumptive) is business income.')
    return { form: 'ITR-3', reasons }
  }
  // Presumptive freelance under ITR-4, only if total ≤ ₹50L
  if (presumptiveFreelance && !above50L && !hasEquity && !hasCrypto) {
    reasons.push('Presumptive freelance under section 44ADA + salary fits ITR-4.')
    return { form: 'ITR-4', reasons }
  }
  // Capital gains / crypto / equity → ITR-2 (unless ITR-1 LTCG threshold is met)
  if (hasCrypto) {
    reasons.push('Crypto gains (VDA income) require ITR-2.')
    return { form: 'ITR-2', reasons }
  }
  if (hasEquity) {
    const stcgEquity = otherEntries.filter((e: any) => e.type === 'equity').reduce((s: number, e: any) => s + Number(e.stcgGains || 0), 0)
    if (stcgEquity > 0 || ltcgEquityTotal > 125000) {
      reasons.push(stcgEquity > 0
        ? 'STCG on equity needs ITR-2.'
        : 'LTCG on equity above the ₹1.25L exemption needs ITR-2.')
      return { form: 'ITR-2', reasons }
    }
    reasons.push('LTCG on equity within the ₹1.25L exemption — ITR-1 still valid.')
    // fall through to total-income check
  }
  // Income > ₹50L → ITR-2
  if (above50L) {
    reasons.push('Total income exceeds ₹50L — ITR-1 / ITR-4 not allowed.')
    return { form: 'ITR-2', reasons }
  }
  // Default: salary + interest only → ITR-1
  if (presumptiveFreelance) {
    // edge case: presumptive freelance > 50L falls through to ITR-3
    reasons.push('Presumptive freelance income but cross-checks placed in ITR-3 — verify with CA.')
    return { form: 'ITR-3', reasons }
  }
  reasons.push('Salary + interest income only, within ₹50L. Standard salaried filer.')
  return { form: 'ITR-1', reasons }
}

// Slab-wise calculator that returns a breakdown for display.
interface SlabRow { label: string; rate: number; inSlab: number; tax: number }
function slabBreakdown(taxable: number, regime: 'new' | 'old'): { rows: SlabRow[]; basicTax: number; rebate: number; cess: number; total: number } {
  const slabs: [number, number, number, string][] = regime === 'new'
    ? [
        [0, 400000, 0,     '₹0 – ₹4L'],
        [400000, 800000, 0.05, '₹4L – ₹8L'],
        [800000, 1200000, 0.10, '₹8L – ₹12L'],
        [1200000, 1600000, 0.15, '₹12L – ₹16L'],
        [1600000, 2000000, 0.20, '₹16L – ₹20L'],
        [2000000, 2400000, 0.25, '₹20L – ₹24L'],
        [2400000, Number.POSITIVE_INFINITY, 0.30, '₹24L+'],
      ]
    : [
        [0, 250000, 0,     '₹0 – ₹2.5L'],
        [250000, 500000, 0.05, '₹2.5L – ₹5L'],
        [500000, 1000000, 0.20, '₹5L – ₹10L'],
        [1000000, Number.POSITIVE_INFINITY, 0.30, '₹10L+'],
      ]
  const rows: SlabRow[] = []
  let basicTax = 0
  for (const [min, max, rate, label] of slabs) {
    const inSlab = Math.max(0, Math.min(taxable, max) - min)
    const tax = inSlab * rate
    rows.push({ label, rate, inSlab, tax })
    basicTax += tax
  }
  // 87A rebate
  const rebate = regime === 'new'
    ? (taxable <= 700000 ? Math.min(basicTax, 25000) : 0)
    : (taxable <= 500000 ? Math.min(basicTax, 12500) : 0)
  const taxAfterRebate = Math.max(0, basicTax - rebate)
  const cess = taxAfterRebate * 0.04
  const total = Math.round(taxAfterRebate + cess)
  return { rows, basicTax: Math.round(basicTax), rebate: Math.round(rebate), cess: Math.round(cess), total }
}

export default function TaxOptimizerPage() {
  const router = useRouter()
  const [calc, setCalc] = useState<any>(null)

  useEffect(() => {
    const salary = localStorage.getItem('av_salary_timeline')
    const other = localStorage.getItem('av_other_income')
    const exemptions = localStorage.getItem('av_exemptions')
    const deductions = localStorage.getItem('av_deductions')

    if (!salary) { setCalc(null); return }

    try {
      const salaryData = JSON.parse(salary)
      const otherData = other ? JSON.parse(other) : []
      const exemptionsData = exemptions ? JSON.parse(exemptions) : {}
      const deductionsData = deductions ? JSON.parse(deductions) : {}

      const slipsArr = Array.isArray(salaryData) ? salaryData : (salaryData.employments?.[0]?.slips || [])
      const monthlyAvgGross = slipsArr.length > 0
        ? slipsArr.reduce((s: number, slip: any) => s + (slip.grossSalary || 0), 0) / slipsArr.length
        : 0
      const monthlyAvgNet = slipsArr.length > 0
        ? slipsArr.reduce((s: number, slip: any) => s + (slip.netSalary || slip.basicSalary || 0), 0) / slipsArr.length
        : 0
      const grossSalary = Math.round(monthlyAvgGross * 12)
      const netSalary = Math.round(monthlyAvgNet * 12)

      const otherIncome = Array.isArray(otherData) ? otherData.reduce((s: number, inc: any) => s + (inc.amount || 0), 0) : 0

      const hra = exemptionsData.hra || {}
      const basicSalary = (slipsArr[0]?.basicSalary || 0)
      const hraExemptMonthly = hra.rentPaid ? Math.max(0, Math.min(
        hra.hraReceived || 0,
        (hra.rentPaid || 0) - basicSalary * 0.1,
        hra.isMetro ? basicSalary * 0.5 : basicSalary * 0.4
      )) : 0
      const hraExempt = Math.round(hraExemptMonthly * 12)
      const otherExempts = Number(exemptionsData.lta || 0) + Number(exemptionsData.medical || 0) + Number(exemptionsData.other || 0)
      const totalExemptions = hraExempt + otherExempts

      const sec80C = Math.min((deductionsData.ppf || 0) + (deductionsData.elss || 0) + (deductionsData.lic || 0) + (deductionsData.tuition || 0) + (deductionsData.nsc || 0), 150000)
      const sec80D = Math.min((deductionsData.selfFamily || 0) + (deductionsData.parents || 0), 100000)
      const sec24b = Math.min(deductionsData.homeLoanInterest || 0, 200000)
      const nps = Math.min(deductionsData.nps || 0, 50000)
      const totalDeductions = sec80C + sec80D + sec24b + nps

      const stdDedNew = 75000
      const stdDedOld = 50000

      const subTotalNew = grossSalary + otherIncome
      const taxableNew = Math.max(0, subTotalNew - stdDedNew - totalExemptions)
      const subTotalOld = grossSalary + otherIncome
      const taxableOld = Math.max(0, subTotalOld - stdDedOld - totalExemptions - totalDeductions)

      const newBreak = slabBreakdown(taxableNew, 'new')
      const oldBreak = slabBreakdown(taxableOld, 'old')
      const itr = recommendITR(Array.isArray(otherData) ? otherData : [], grossSalary + otherIncome)

      setCalc({
        grossSalary, netSalary, otherIncome,
        hraExempt, otherExempts, totalExemptions,
        sec80C, sec80D, sec24b, nps, totalDeductions,
        stdDedNew, stdDedOld,
        subTotalNew, subTotalOld,
        taxableNew, taxableOld,
        newBreak, oldBreak,
        recommendation: newBreak.total <= oldBreak.total ? 'new' : 'old',
        savings: Math.abs(newBreak.total - oldBreak.total),
        hraFilled: hra.rentPaid > 0,
        itrForm: itr.form,
        itrReasons: itr.reasons,
      })
    } catch (e) {
      console.error('Calc failed:', e)
    }
  }, [])

  if (!calc) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: C.danger, margin: 0 }}>Upload a salary slip first to see your tax calculation.</p>
        <button onClick={() => router.push('/dashboard/profile/salary')} style={{ marginTop: 20, padding: '10px 20px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Go to Salary</button>
      </div>
    )
  }

  // Re-usable row renderer with optional link to source tab.
  const Row = ({ label, value, href, strong = false, color, indent = 0, sub }: { label: string; value: string; href?: string; strong?: boolean; color?: string; indent?: number; sub?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${C.border}`, paddingLeft: indent }}>
      <div>
        {href ? (
          <Link href={href} style={{ fontSize: strong ? 13 : 12, color: color || (strong ? C.fg : C.text), textDecoration: 'underline', fontWeight: strong ? 700 : 500 }}>{label} →</Link>
        ) : (
          <span style={{ fontSize: strong ? 13 : 12, color: color || (strong ? C.fg : C.text), fontWeight: strong ? 700 : 400 }}>{label}</span>
        )}
        {sub && <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>{sub}</span>}
      </div>
      <span style={{ fontSize: strong ? 13 : 12, color: color || C.fg, fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Tax Optimization</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Your tax picture for FY 2025-26</p>

      {/* ── Income (linked to their respective heads) ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income & components</h3>
        <Row label="Gross salary" value={fmt(calc.grossSalary)} href="/dashboard/profile/salary" />
        <Row label="Net salary" value={fmt(calc.netSalary)} href="/dashboard/profile/salary" />
        <Row label="Total other income" value={fmt(calc.otherIncome)} href="/dashboard/profile/other-income" />
        <Row label="Total exemptions" value={fmt(calc.totalExemptions)} href="/dashboard/profile/exemptions" sub={`HRA ${fmt(calc.hraExempt)} · Other ${fmt(calc.otherExempts)}`} />
        <Row label="Total deductions" value={fmt(calc.totalDeductions)} href="/dashboard/profile/deductions" sub={`80C ${fmt(calc.sec80C)} · 80D ${fmt(calc.sec80D)} · 24(b) ${fmt(calc.sec24b)} · NPS ${fmt(calc.nps)}`} />
      </div>

      {/* ── How taxable income was computed ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>How taxable income is computed</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 0, fontSize: 12 }}>
          <div style={{ padding: '6px 8px', background: C.wl, fontWeight: 700, color: C.fg, borderBottom: `1px solid ${C.border}` }}></div>
          <div style={{ padding: '6px 8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>New regime</div>
          <div style={{ padding: '6px 8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Old regime</div>

          {[
            ['Gross salary', calc.grossSalary, calc.grossSalary],
            ['+ Other income', calc.otherIncome, calc.otherIncome],
            ['= Sub-total', calc.subTotalNew, calc.subTotalOld],
            ['− Standard deduction', -calc.stdDedNew, -calc.stdDedOld],
            ['− Exemptions (HRA, LTA, etc.)', -calc.totalExemptions, -calc.totalExemptions],
            ['− Chapter VI-A deductions', 0, -calc.totalDeductions],
          ].map((row, i) => (
            <Fragment key={i}>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: C.text }}>{row[0] as string}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: (row[1] as number) < 0 ? C.danger : C.fg }}>
                {(row[1] as number) === 0 && (row[0] as string).startsWith('− Chapter') ? '—' : fmt(Math.abs(row[1] as number))}
              </div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: (row[2] as number) < 0 ? C.danger : C.fg }}>
                {fmt(Math.abs(row[2] as number))}
              </div>
            </Fragment>
          ))}

          <div style={{ padding: '8px', background: C.wl, fontWeight: 700, color: C.fg }}>Taxable income</div>
          <div style={{ padding: '8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right' }}>{fmt(calc.taxableNew)}</div>
          <div style={{ padding: '8px', background: C.wl, fontWeight: 700, color: C.fg, textAlign: 'right' }}>{fmt(calc.taxableOld)}</div>
        </div>
      </div>

      {/* ── Slab-wise breakup — side-by-side comparison ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      <div style={{ background: calc.recommendation === 'new' ? '#F0F9F7' : C.card, border: `2px solid ${calc.recommendation === 'new' ? C.fg : C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New regime · slab-wise</h3>
          {calc.recommendation === 'new' && <span style={{ fontSize: 9, fontWeight: 700, background: C.fg, color: '#fff', padding: '3px 8px', borderRadius: 3 }}>✓ RECOMMENDED</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11.5 }}>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Rate</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Amount in slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Tax</div>
          {calc.newBreak.rows.map((r: any, i: number) => (
            <Fragment key={i}>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: r.tax > 0 ? C.text : C.muted }}>{r.label}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{Math.round(r.rate * 100)}%</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{fmt(r.inSlab)}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', fontWeight: r.tax > 0 ? 600 : 400, color: r.tax > 0 ? C.fg : C.muted }}>{fmt(r.tax)}</div>
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 4 }}>
          <Row label="Basic tax" value={fmt(calc.newBreak.basicTax)} />
          {calc.newBreak.rebate > 0 && <Row label="− 87A rebate" value={fmt(calc.newBreak.rebate)} color={C.danger} />}
          <Row label="Health & Edu cess (4%)" value={fmt(calc.newBreak.cess)} />
          <Row label="Total tax" value={fmt(calc.newBreak.total)} strong />
        </div>
      </div>

      {/* ── Slab-wise breakup — Old regime ── */}
      <div style={{ background: calc.recommendation === 'old' ? '#FEF4E8' : C.card, border: `2px solid ${calc.recommendation === 'old' ? C.wm : C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Old regime · slab-wise</h3>
          {calc.recommendation === 'old' && <span style={{ fontSize: 9, fontWeight: 700, background: C.wm, color: '#fff', padding: '3px 8px', borderRadius: 3 }}>✓ RECOMMENDED</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', fontSize: 11.5 }}>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>Slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Rate</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Amount in slab</div>
          <div style={{ padding: '6px 8px', background: C.bg, fontWeight: 700, color: C.muted, textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>Tax</div>
          {calc.oldBreak.rows.map((r: any, i: number) => (
            <Fragment key={i}>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: r.tax > 0 ? C.text : C.muted }}>{r.label}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{Math.round(r.rate * 100)}%</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', color: r.tax > 0 ? C.text : C.muted }}>{fmt(r.inSlab)}</div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', fontWeight: r.tax > 0 ? 600 : 400, color: r.tax > 0 ? C.fg : C.muted }}>{fmt(r.tax)}</div>
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 4 }}>
          <Row label="Basic tax" value={fmt(calc.oldBreak.basicTax)} />
          {calc.oldBreak.rebate > 0 && <Row label="− 87A rebate" value={fmt(calc.oldBreak.rebate)} color={C.danger} />}
          <Row label="Health & Edu cess (4%)" value={fmt(calc.oldBreak.cess)} />
          <Row label="Total tax" value={fmt(calc.oldBreak.total)} strong />
        </div>
      </div>
      </div>

      {/* ── Savings ── */}
      <div style={{ background: '#F0F9F7', border: `1px solid #D1E8E4`, borderRadius: 8, padding: 20, marginBottom: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase' as const }}>Tax savings by choosing {calc.recommendation === 'new' ? 'New' : 'Old'} Regime</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(calc.savings)}</p>
      </div>

      {/* ── Which ITR form to file ── */}
      <div style={{ background: C.card, border: `2px solid ${C.fg}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Which ITR form to file</h3>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.fg, letterSpacing: '0.02em' }}>{calc.itrForm}</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          {calc.itrReasons.map((r: string, i: number) => (
            <p key={i} style={{ fontSize: 12, color: C.text, margin: '4px 0', lineHeight: 1.5 }}>• {r}</p>
          ))}
        </div>
        <div style={{ padding: 10, background: C.bg, borderRadius: 4, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          <strong style={{ color: C.fg }}>Quick reference:</strong>{' '}
          <strong>ITR-1</strong> = salary + 1 house + interest, ≤ ₹50L, no capital gains beyond ₹1.25L LTCG;{' '}
          <strong>ITR-2</strong> = capital gains, crypto, ESOPs, multiple houses, foreign assets, or income &gt; ₹50L;{' '}
          <strong>ITR-3</strong> = freelance with actual expenses, business income, F&O;{' '}
          <strong>ITR-4</strong> = presumptive freelance / small business u/s 44ADA / 44AD, ≤ ₹50L.
        </div>
      </div>

      {/* ── Where you can save more ── */}
      <div style={{ background: C.wl, border: `1px solid ${C.wm}`, borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 16px' }}>Where You Can Save More</h3>

        {!calc.hraFilled && calc.grossSalary > 0 && (
          <div style={{ padding: '12px', background: '#FFF3DD', border: `1px solid ${C.wm}`, borderRadius: 6, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#856404', margin: 0, fontWeight: 500 }}>💡 You haven't entered rent details. If you pay rent, fill <Link href="/dashboard/profile/exemptions" style={{ color: '#856404', textDecoration: 'underline' }}>Exemptions</Link> to claim HRA and save more.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Home Loan Interest', limit: 200000, used: calc.sec24b },
            { label: '80C Investments', limit: 150000, used: calc.sec80C },
            { label: 'Health Insurance (80D)', limit: 100000, used: calc.sec80D },
            { label: 'NPS (80CCD(1B))', limit: 50000, used: calc.nps },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px', background: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>{fmt(s.limit - s.used)} unused</p>
              <p style={{ fontSize: 9, color: C.muted, margin: '4px 0 0' }}>You'd save ~{fmt((s.limit - s.used) * 0.2)}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: C.muted, margin: '12px 0 0', fontStyle: 'italic' }}>Only invest if it makes financial sense. Tax saving is a bonus, not the goal.</p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => router.push('/dashboard/profile/deductions')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Edit Deductions</button>
        <button onClick={() => router.push('/dashboard')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
      </div>
    </div>
  )
}
