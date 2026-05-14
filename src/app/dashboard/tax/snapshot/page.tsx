'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Inline types (must match Tax Optimiser's local state) ─────────────────
interface Deductions {
  rentPaid: number; hraReceived: number; isMetro: boolean
  basic: number
  ppf: number; elss: number; lic: number; homeLoanPrincipal: number; tuition: number; nsc: number; epf: number
  selfFamily: number; parents: number; parentsSenior: boolean; selfSenior: boolean
  nps: number
  savingsInterest: number
  donations100: number; donations50: number
  homeLoanInterest: number
  eduLoanInterest: number
}
const defaultDed: Deductions = { rentPaid:0, hraReceived:0, isMetro:true, basic:0, ppf:0, elss:0, lic:0, homeLoanPrincipal:0, tuition:0, nsc:0, epf:0, selfFamily:0, parents:0, parentsSenior:false, selfSenior:false, nps:0, savingsInterest:0, donations100:0, donations50:0, homeLoanInterest:0, eduLoanInterest:0 }

// ─── Colour palette (matches the rest of the app) ──────────────────────────
const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#D85A30' }

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
function clamp(n: number, max: number): number { return Math.min(Math.max(0, n), max) }
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[Number(m)]} ${y.slice(2)}`
}

// ─── HRA exemption (must match tax page math) ──────────────────────────────
function calcHRAExempt(d: Deductions, annualGross: number): number {
  if (d.rentPaid === 0 || d.hraReceived === 0) return 0
  const rentAnnual = d.rentPaid * 12
  const hraAnnual = d.hraReceived * 12
  const basicAnnual = (d.basic > 0 ? d.basic : annualGross * 0.4) * (d.basic > 0 ? 12 : 1)
  const rule1 = hraAnnual
  const rule2 = rentAnnual - 0.1 * basicAnnual
  const rule3 = d.isMetro ? 0.5 * basicAnnual : 0.4 * basicAnnual
  return Math.max(0, Math.min(rule1, Math.max(0, rule2), rule3))
}

// ─── Tax computation — duplicated from tax-page.tsx for the snapshot ────────
function calcTax(income: number, d: Deductions) {
  const annual = income
  const stdDed = 75000
  const newTaxable = Math.max(0, annual - stdDed)
  let newTax = 0, rem = newTaxable
  for (const [l, r] of [[300000, 0], [300000, 0.05], [300000, 0.10], [300000, 0.15], [300000, 0.20], [Infinity, 0.30]] as [number, number][]) {
    const c = Math.min(rem, l); newTax += c * r; rem -= c; if (rem <= 0) break
  }
  if (newTaxable <= 700000) newTax = 0
  newTax = Math.round(newTax * 1.04)

  const c80 = clamp(d.ppf + d.elss + d.lic + d.homeLoanPrincipal + d.tuition + d.nsc + d.epf, 150000)
  const hraExempt = calcHRAExempt(d, annual)
  const c80D = clamp(d.selfFamily, d.selfSenior ? 50000 : 25000) + clamp(d.parents, d.parentsSenior ? 50000 : 25000)
  const c80CCD = clamp(d.nps, 50000)
  const c80TTA = clamp(d.savingsInterest, d.selfSenior ? 50000 : 10000)
  const c80G = d.donations100 + d.donations50 * 0.5
  const c24B = clamp(d.homeLoanInterest, 200000)
  const c80E = d.eduLoanInterest
  const totalOldDed = stdDed + c80 + hraExempt + c80D + c80CCD + c80TTA + c80G + c24B + c80E
  const oldTaxable = Math.max(0, annual - totalOldDed)
  let oldTax = 0, rem2 = oldTaxable
  for (const [l, r] of [[250000, 0], [250000, 0.05], [500000, 0.20], [Infinity, 0.30]] as [number, number][]) {
    const c = Math.min(rem2, l); oldTax += c * r; rem2 -= c; if (rem2 <= 0) break
  }
  if (oldTaxable <= 500000) oldTax = 0
  oldTax = Math.round(oldTax * 1.04)

  return {
    newTax, oldTax,
    recommended: newTax <= oldTax ? 'new' as const : 'old' as const,
    deductions: { stdDed, c80, hraExempt, c80D, c80CCD, c80TTA, c80G, c24B, c80E, total: totalOldDed },
    newTaxable, oldTaxable,
  }
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function TaxSnapshotPage() {
  return (
    <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:C.muted, fontFamily:'"Sora",sans-serif' }}>Loading…</div>}>
      <SnapshotContent />
    </Suspense>
  )
}

function SnapshotContent() {
  const router = useRouter()
  const [ded, setDed] = useState<Deductions>(defaultDed)
  const [annualGross, setAnnualGross] = useState(0)
  const [annualNet, setAnnualNet] = useState(0)
  const [totalTDS, setTotalTDS] = useState(0)
  const [employerNames, setEmployerNames] = useState<string[]>([])
  const [employeeName, setEmployeeName] = useState('')
  const [fyLabel, setFyLabel] = useState('FY ?')
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    try {
      // Tax deductions
      const tp = localStorage.getItem('av_tax_progress')
      if (tp) {
        const d = JSON.parse(tp)
        if (d.ded) setDed({ ...defaultDed, ...d.ded })
      }

      // Salary timeline (canonical) — preferred
      const stl = localStorage.getItem('av_salary_timeline')
      if (stl) {
        const t = JSON.parse(stl)
        setFyLabel(t.fy || 'FY ?')
        // Compute annual gross by summing each FY month using the rollup math
        // We don't have rollupMonth here, so we'll approximate from slips:
        // For each employment, average its slips' gross × months covered (closed end → toMonth; open → projected to FY end)
        // Easier path: sum of slip grosses + project recurring to remaining months under same employment
        // Simplest honest path: derive from `av_salary_breakdown` if available (Tax Optimiser feeds from it)
        // Otherwise approximate naively here
        let gross = 0, net = 0, tds = 0
        const employers = new Set<string>()
        let empName = ''
        for (const emp of (t.employments || [])) {
          employers.add(emp.employerName)
          // Find emp's date range in months
          const [fy, fm] = emp.fromMonth.split('-').map(Number)
          const toMonth = emp.toMonth || `${t.fyStartYear + 1}-03`   // assume current employment runs to end of FY
          const [ty, tm] = toMonth.split('-').map(Number)
          const monthsCovered = (ty - fy) * 12 + (tm - fm) + 1
          // Use the most recent slip as recurring baseline
          const sortedSlips = (emp.slips || []).slice().sort((a:any,b:any) => a.monthKey.localeCompare(b.monthKey))
          if (sortedSlips.length === 0) continue
          const latest = sortedSlips[sortedSlips.length - 1]
          if (!empName) empName = (latest?.parsed as any)?.employeeName || ''
          const slipGross = latest?.parsed?.grossSalary || 0
          const slipNet = latest?.parsed?.netSalary || 0
          const slipTDS = latest?.parsed?.tdsDeducted || 0
          // Use ACTUAL slip data where we have it; project for the rest
          const slipMonthSet = new Set(sortedSlips.map((s:any) => s.monthKey))
          // sum actual slips
          for (const s of sortedSlips) {
            gross += s.parsed?.grossSalary || 0
            net += s.parsed?.netSalary || 0
            tds += s.parsed?.tdsDeducted || 0
          }
          // remaining projected months
          const remaining = Math.max(0, monthsCovered - sortedSlips.length)
          gross += remaining * slipGross
          net += remaining * slipNet
          tds += remaining * slipTDS
        }
        setAnnualGross(gross)
        setAnnualNet(net)
        setTotalTDS(tds)
        setEmployerNames(Array.from(employers))
        setEmployeeName(empName)
        return
      }

      // Fallback to old salary breakdown
      const sb = localStorage.getItem('av_salary_breakdown')
      if (sb) {
        const b = JSON.parse(sb)
        const monthlyGross = b.netSalary + b.employeePF + (b.employerPF || 0) + (b.bonus || 0) + (b.otherBenefits || 0)
        setAnnualGross(monthlyGross * 12)
        setAnnualNet(b.netSalary * 12)
        setEmployerNames(b.employerName ? [b.employerName] : [])
        // FY label derived from current date
        const d = new Date()
        const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
        setFyLabel(`FY ${fyStart}-${String(fyStart + 1).slice(-2)}`)
        return
      }

      setLoadFailed(true)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  if (loadFailed) {
    return <ErrorState message="No salary data found. Visit the Tax Optimiser first to enter your details." onBack={() => router.push('/dashboard/tax')} />
  }
  if (annualGross === 0) {
    return <div style={{ padding:40, textAlign:'center', color:C.muted, fontFamily:'"Sora",sans-serif' }}>Loading…</div>
  }

  const tax = calcTax(annualGross, ded)
  const recommendedTax = tax.recommended === 'new' ? tax.newTax : tax.oldTax
  const balance = recommendedTax - totalTDS

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media print {
          body { background: #fff !important; padding: 0 !important; }
          .page-header, .legend-bar, .no-print { display: none !important; }
          .form-container { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: #fff !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <div style={{ minHeight:'100vh', background:'#FDFAF6', fontFamily:'"Sora",-apple-system,sans-serif', padding:24, color:C.text }}>

        {/* Header — hidden in print */}
        <div className="page-header" style={{ maxWidth:820, margin:'0 auto 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:15, color:C.fg }}>📄 Tax Computation Snapshot · {fyLabel}</h2>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => router.push('/dashboard/tax')} style={{ padding:'8px 14px', borderRadius:5, border:`1px solid ${C.border}`, background:'#fff', fontSize:12, fontFamily:'inherit', cursor:'pointer', color:C.fg }}>← Back to Tax Optimiser</button>
            <button onClick={() => window.print()} style={{ padding:'8px 14px', borderRadius:5, border:`1px solid ${C.fg}`, background:C.fg, color:C.wheat, fontSize:12, fontFamily:'inherit', cursor:'pointer', fontWeight:600 }}>🖨️ Print / Save as PDF</button>
          </div>
        </div>

        {/* The form */}
        <div className="form-container" style={{ maxWidth:820, margin:'0 auto', background:'#fff', padding:'40px 48px', border:`1px solid ${C.border}`, borderRadius:6, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>

          <div style={{ textAlign:'center', borderBottom:'2px solid #1C2B22', paddingBottom:16, marginBottom:24 }}>
            <h1 style={{ fontSize:18, margin:'0 0 4px', letterSpacing:'0.05em' }}>TAX COMPUTATION SNAPSHOT</h1>
            <div style={{ fontSize:12, color:C.muted }}>Self-computed estimate · {fyLabel}</div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:6, fontStyle:'italic' as const }}>Not an Income Tax Return. For personal reference only.</div>
          </div>

          {/* Section 1: Person */}
          <Section title="1 · Personal Details">
            <RowGrid>
              <Label>Employee name</Label><Value>{employeeName || '—'}</Value>
              <Label>Financial Year</Label><Value>{fyLabel}</Value>
              <Label>Employer{employerNames.length > 1 ? 's' : ''} during FY</Label><Value>{employerNames.length > 0 ? employerNames.join(' · ') : '—'}</Value>
            </RowGrid>
          </Section>

          {/* Section 2: Income */}
          <Section title="2 · Income from Salary">
            <table style={tableStyle}>
              <tbody>
                <Tr><Td>Gross annual salary</Td><Td num>{fmt(annualGross)}</Td></Tr>
                <Tr><Td>Net annual take-home</Td><Td num>{fmt(annualNet)}</Td></Tr>
              </tbody>
            </table>
          </Section>

          {/* Section 3: Deductions claimed */}
          <Section title="3 · Deductions Claimed (Old Regime)">
            <table style={tableStyle}>
              <tbody>
                <Tr><Td>Standard deduction</Td><Td num>{fmt(tax.deductions.stdDed)}</Td><Td muted>both regimes</Td></Tr>
                {tax.deductions.hraExempt > 0 && <Tr><Td>HRA exemption (rent)</Td><Td num>{fmt(tax.deductions.hraExempt)}</Td><Td muted>Section 10(13A)</Td></Tr>}
                {tax.deductions.c80 > 0 && <Tr><Td>Tax-saving investments</Td><Td num>{fmt(tax.deductions.c80)}</Td><Td muted>Section 80C</Td></Tr>}
                {tax.deductions.c80D > 0 && <Tr><Td>Health insurance premiums</Td><Td num>{fmt(tax.deductions.c80D)}</Td><Td muted>Section 80D</Td></Tr>}
                {tax.deductions.c80CCD > 0 && <Tr><Td>NPS additional</Td><Td num>{fmt(tax.deductions.c80CCD)}</Td><Td muted>Section 80CCD(1B)</Td></Tr>}
                {tax.deductions.c80TTA > 0 && <Tr><Td>Savings interest exempt</Td><Td num>{fmt(tax.deductions.c80TTA)}</Td><Td muted>{ded.selfSenior ? 'Section 80TTB' : 'Section 80TTA'}</Td></Tr>}
                {tax.deductions.c24B > 0 && <Tr><Td>Home loan interest</Td><Td num>{fmt(tax.deductions.c24B)}</Td><Td muted>Section 24(b)</Td></Tr>}
                {tax.deductions.c80E > 0 && <Tr><Td>Education loan interest</Td><Td num>{fmt(tax.deductions.c80E)}</Td><Td muted>Section 80E</Td></Tr>}
                {tax.deductions.c80G > 0 && <Tr><Td>Donations</Td><Td num>{fmt(tax.deductions.c80G)}</Td><Td muted>Section 80G</Td></Tr>}
                <Tr total><Td>Total deductions (Old Regime)</Td><Td num>{fmt(tax.deductions.total)}</Td><Td></Td></Tr>
              </tbody>
            </table>
          </Section>

          {/* Section 4: Regime comparison */}
          <Section title="4 · Regime Comparison">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Particulars</Th>
                  <Th style={{ textAlign:'right', width:150 }}>New Regime</Th>
                  <Th style={{ textAlign:'right', width:150 }}>Old Regime</Th>
                </tr>
              </thead>
              <tbody>
                <Tr><Td>Gross annual income</Td><Td num>{fmt(annualGross)}</Td><Td num>{fmt(annualGross)}</Td></Tr>
                <Tr><Td>Less: Total deductions</Td><Td num>{fmt(75000)}</Td><Td num>{fmt(tax.deductions.total)}</Td></Tr>
                <Tr><Td>Taxable income</Td><Td num>{fmt(tax.newTaxable)}</Td><Td num>{fmt(tax.oldTaxable)}</Td></Tr>
                <Tr total>
                  <Td>Tax liability (incl. 4% cess)</Td>
                  <Td num style={{ background: tax.recommended === 'new' ? C.fg : 'inherit', color: tax.recommended === 'new' ? C.wheat : 'inherit' }}>{fmt(tax.newTax)}</Td>
                  <Td num style={{ background: tax.recommended === 'old' ? C.fg : 'inherit', color: tax.recommended === 'old' ? C.wheat : 'inherit' }}>{fmt(tax.oldTax)}</Td>
                </Tr>
              </tbody>
            </table>
            <div style={{ marginTop:10, padding:'10px 14px', background:C.wl, border:`1px solid ${C.wm}`, borderRadius:5, fontSize:12, color:C.fg }}>
              <strong>Recommendation:</strong> {tax.recommended === 'new' ? 'New Regime' : 'Old Regime'} — saves you {fmt(Math.abs(tax.newTax - tax.oldTax))} this year.
            </div>
          </Section>

          {/* Section 5: TDS reconciliation */}
          <Section title="5 · TDS Reconciliation">
            <table style={tableStyle}>
              <tbody>
                <Tr><Td>Tax liability ({tax.recommended === 'new' ? 'New' : 'Old'} Regime — recommended)</Td><Td num>{fmt(recommendedTax)}</Td></Tr>
                <Tr><Td>Less: TDS deducted by employer(s) so far</Td><Td num>{fmt(totalTDS)}</Td></Tr>
                <Tr total>
                  <Td>{balance > 0 ? 'Balance tax payable' : balance < 0 ? 'Tax refund expected' : 'Settled (no balance)'}</Td>
                  <Td num style={{ color: balance > 0 ? C.danger : C.fg }}>{fmt(Math.abs(balance))}</Td>
                </Tr>
              </tbody>
            </table>
            {balance > 0 && (
              <p style={{ fontSize:11, color:C.muted, margin:'10px 0 0', lineHeight:1.5 }}>
                You owe {fmt(balance)} more in tax. To avoid Section 234B/234C interest, pay via self-assessment before 31 July of the assessment year, ideally in advance tax installments.
              </p>
            )}
            {balance < 0 && (
              <p style={{ fontSize:11, color:C.muted, margin:'10px 0 0', lineHeight:1.5 }}>
                You'll likely receive a refund of {fmt(Math.abs(balance))} after filing your ITR.
              </p>
            )}
          </Section>

          {/* Footer disclaimer */}
          <div style={{ marginTop:28, padding:'14px 16px', background:'#FAF7F2', borderLeft:`3px solid ${C.fg}`, fontSize:11, lineHeight:1.6, color:C.fg }}>
            <strong>Important:</strong> This is a self-computed tax estimate by ArthVo based on the salary data and deductions you've entered. It is <strong>not an official Income Tax Return</strong>. Please verify all figures and consult a chartered accountant before filing your return on the Income Tax e-filing portal.
          </div>

          <div style={{ marginTop:32, display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, fontSize:11 }}>
            <div>
              <div style={{ borderBottom:'1px solid #1C2B22', height:38, marginBottom:4 }}></div>
              <div style={{ color:C.muted, fontSize:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Signature</div>
            </div>
            <div>
              <div style={{ borderBottom:'1px solid #1C2B22', height:38, marginBottom:4 }}></div>
              <div style={{ color:C.muted, fontSize:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Place & Date</div>
            </div>
          </div>
        </div>

        {/* Bottom note — hidden in print */}
        <div className="legend-bar" style={{ maxWidth:820, margin:'16px auto 0', padding:'12px 16px', background:'#FAF7F2', border:`1px solid ${C.border}`, borderRadius:5, fontSize:11, color:C.muted, lineHeight:1.6 }}>
          <strong style={{ color:C.fg }}>How to use this:</strong> Click "Print / Save as PDF" to save a clean copy for your records or to share with your CA. The page header and this note won't appear in the printed version.
        </div>
      </div>
    </>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', fontFamily:'"Sora",-apple-system,sans-serif', padding:40, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ maxWidth:420, padding:24, background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, textAlign:'center' as const }}>
        <p style={{ fontSize:14, color:C.text, margin:'0 0 16px' }}>{message}</p>
        <button onClick={onBack} style={{ padding:'9px 18px', borderRadius:5, border:`1px solid ${C.fg}`, background:C.fg, color:C.wheat, fontSize:12.5, fontFamily:'inherit', cursor:'pointer', fontWeight:600 }}>← Back to Tax Optimiser</button>
      </div>
    </div>
  )
}
function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.fg, marginBottom:8, paddingBottom:4, borderBottom:`1px solid ${C.border}` }}>{title}</div>
      {children}
    </div>
  )
}
function RowGrid({ children }: { children?: React.ReactNode }) {
  return <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:'6px 12px', fontSize:12 }}>{children}</div>
}
function Label({ children }: { children?: React.ReactNode }) {
  return <div style={{ color:C.muted, padding:'4px 0' }}>{children}</div>
}
function Value({ children }: { children?: React.ReactNode }) {
  return <div style={{ color:C.text, fontWeight:500, padding:'4px 8px', background:C.wl, borderRadius:3, border:`1px solid ${C.border}` }}>{children}</div>
}

const tableStyle: React.CSSProperties = { width:'100%', borderCollapse:'collapse' as const, fontSize:12, marginTop:4 }
function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding:'7px 10px', border:`1px solid ${C.border}`, textAlign:'left' as const, background:C.wl, color:C.fg, fontSize:10, textTransform:'uppercase' as const, letterSpacing:'0.06em', fontWeight:700, ...style }}>{children}</th>
}
function Tr({ children, total }: { children?: React.ReactNode; total?: boolean }) {
  const style: React.CSSProperties = total ? { background:'#FAF7F2', fontWeight:700 } : {}
  return <tr style={style}>{children}</tr>
}
function Td({ children, num, muted, style }: { children?: React.ReactNode; num?: boolean; muted?: boolean; style?: React.CSSProperties }) {
  return <td style={{ padding:'7px 10px', border:`1px solid ${C.border}`, textAlign: num ? 'right' as const : 'left' as const, fontVariantNumeric:'tabular-nums' as const, fontWeight: num ? 500 : 400, color: muted ? C.muted : 'inherit', fontSize: muted ? 11 : 12, ...style }}>{children}</td>
}
