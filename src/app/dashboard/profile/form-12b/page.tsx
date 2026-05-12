'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── Inline types (mirror profile page's salary timeline shape) ─────────────
interface SlipComponent { label: string; amount: number; type: 'earning' | 'deduction'; flag: 'recurring' | 'one_time' }
interface SlipData {
  id: string; monthKey: string; uploadedAt: string; fileName: string
  parsed: any   // ParsedSalaryData — only fields we need are read with optional chaining
  components: SlipComponent[]
}
interface Employment {
  id: string; employerName: string; fromMonth: string; toMonth: string | null
  slips: SlipData[]
}
interface SalaryTimeline {
  fy: string; fyStartYear: number
  employments: Employment[]; overrides: any[]
}

// ─── Color palette (matches dashboard) ───────────────────────────────────────
const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#D85A30' }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[Number(m)]} ${y}`
}
function fmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
function findEarningSum(slips: SlipData[], pattern: RegExp): number {
  return slips.reduce((sum, s) => {
    const comp = s.components.find(c => c.type === 'earning' && pattern.test(c.label))
    return sum + (comp?.amount || 0)
  }, 0)
}
function findDeductionSum(slips: SlipData[], pattern: RegExp): number {
  return slips.reduce((sum, s) => {
    const comp = s.components.find(c => c.type === 'deduction' && pattern.test(c.label))
    return sum + (comp?.amount || 0)
  }, 0)
}
function fyEndYear(fyStartYear: number): number { return fyStartYear + 1 }

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Form12BPage() {
  return (
    <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:C.muted, fontFamily:'"Sora",sans-serif' }}>Loading…</div>}>
      <Form12BContent />
    </Suspense>
  )
}

function Form12BContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const empId = searchParams.get('empId')
  const [timeline, setTimeline] = useState<SalaryTimeline | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    try {
      const stl = localStorage.getItem('av_salary_timeline')
      if (stl) setTimeline(JSON.parse(stl))
      else setLoadFailed(true)
    } catch { setLoadFailed(true) }
  }, [])

  if (loadFailed) {
    return <ErrorState message="No salary data found. Upload a slip first." onBack={() => router.push('/dashboard/profile?tab=salary')} />
  }
  if (!timeline) {
    return <div style={{ padding:40, textAlign:'center', color:C.muted, fontFamily:'"Sora",sans-serif' }}>Loading…</div>
  }
  if (!empId) {
    return <ErrorState message="No employment selected. Pick a previous employer from the Salary tab." onBack={() => router.push('/dashboard/profile?tab=salary')} />
  }

  const employment = timeline.employments.find(e => e.id === empId)
  if (!employment) {
    return <ErrorState message="Employment not found. It may have been removed." onBack={() => router.push('/dashboard/profile?tab=salary')} />
  }
  if (employment.slips.length === 0) {
    return <ErrorState message="This employment has no slips uploaded yet." onBack={() => router.push('/dashboard/profile?tab=salary')} />
  }

  // ─── Compute all sums from this employment's slips ──────────────────────
  const slips = employment.slips
  const slipCount = slips.length

  const totalBasic     = findEarningSum(slips, /^BASIC|BASIC\s*(SALARY|PAY)/i) ||
                         slips.reduce((s, sl) => s + (sl.parsed?.basicSalary || 0), 0)
  const totalHRA       = findEarningSum(slips, /HRA|HOUSE RENT/i) ||
                         slips.reduce((s, sl) => s + (sl.parsed?.hra || 0), 0)
  const totalOther     = (() => {
    // All other earnings minus Basic + HRA already counted
    const totalEarnings = slips.reduce((s, sl) =>
      s + sl.components.filter(c => c.type === 'earning').reduce((x, c) => x + c.amount, 0), 0)
    return Math.max(0, totalEarnings - totalBasic - totalHRA)
  })()
  const grossSalary    = totalBasic + totalHRA + totalOther

  const totalEPF       = findDeductionSum(slips, /EMPLOYEE PF|^EPF$|PROVIDENT FUND/i) ||
                         slips.reduce((s, sl) => s + (sl.parsed?.employeePF || 0), 0)
  const totalPT        = findDeductionSum(slips, /PROFESSIONAL TAX|^PT$/i) ||
                         slips.reduce((s, sl) => s + (sl.parsed?.professionalTax || 0), 0)
  const totalTDS       = findDeductionSum(slips, /^TDS|TAX DEDUCTED/i) ||
                         slips.reduce((s, sl) => s + (sl.parsed?.tdsDeducted || 0), 0)

  // Standard deduction — pro-rated estimate: ₹50,000 × (months at this employer / 12)
  const fromKey = employment.fromMonth
  const toKey = employment.toMonth || slips[slips.length - 1].monthKey
  // Rough month-count from from→to (inclusive)
  const [fY, fM] = fromKey.split('-').map(Number)
  const [tY, tM] = toKey.split('-').map(Number)
  const monthsAtEmp = Math.max(1, (tY - fY) * 12 + (tM - fM) + 1)
  const standardDeduction = Math.round(50000 * monthsAtEmp / 12)

  const fyLabel = `${employment.fromMonth ? new Date(fromKey + '-01').getFullYear() : timeline.fyStartYear}`

  // ─── Render the form ─────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .page-header, .legend-bar { display: block; }
        @media print {
          body { background: #fff !important; padding: 0 !important; }
          .page-header, .legend-bar, .no-print { display: none !important; }
          .form-container { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          .value-prefilled { background: transparent !important; border: none !important; padding: 0 !important; }
          .form-container { background: #fff !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      <div style={{ minHeight:'100vh', background:'#FDFAF6', fontFamily:'"Sora",-apple-system,sans-serif', padding:24, color:C.text }}>

        {/* Page header — hidden in print */}
        <div className="page-header" style={{ maxWidth:800, margin:'0 auto 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:15, color:C.fg }}>📄 Form 12B · {employment.employerName}</h2>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => router.push('/dashboard/profile?tab=salary')} style={{ padding:'8px 14px', borderRadius:5, border:`1px solid ${C.border}`, background:'#fff', fontSize:12, fontFamily:'inherit', cursor:'pointer', color:C.fg }}>← Back to Profile</button>
            <button onClick={() => window.print()} style={{ padding:'8px 14px', borderRadius:5, border:`1px solid ${C.fg}`, background:C.fg, color:C.wheat, fontSize:12, fontFamily:'inherit', cursor:'pointer', fontWeight:600 }}>🖨️ Print Form 12B</button>
          </div>
        </div>

        {/* The actual form */}
        <div className="form-container" style={{ maxWidth:800, margin:'0 auto', background:'#fff', padding:'40px 48px', border:`1px solid ${C.border}`, borderRadius:6, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>

          <div style={{ textAlign:'center', borderBottom:'2px solid #1C2B22', paddingBottom:16, marginBottom:24 }}>
            <h1 style={{ fontSize:18, margin:'0 0 4px', letterSpacing:'0.05em' }}>FORM NO. 12B</h1>
            <div style={{ fontSize:11, color:C.muted, fontStyle:'italic' as const }}>[See rule 26A]</div>
            <div style={{ fontSize:12, marginTop:8, color:C.fg, lineHeight:1.5 }}>
              Form for furnishing details of income under section 192(2)<br/>
              for the year ending 31st March, <strong>{fyEndYear(timeline.fyStartYear)}</strong>
            </div>
          </div>

          {/* Section 1: Employee */}
          <Section title="1 · Employee Particulars">
            <RowGrid>
              <Label>Name of the employee</Label><Blank>(fill in by hand)</Blank>
              <Label>PAN of the employee</Label><Blank>_ _ _ _ _ _ _ _ _ _</Blank>
              <Label>Aadhaar no. (last 4)</Label><Blank>_ _ _ _</Blank>
              <Label>Residential address</Label><Blank>(fill in by hand)</Blank>
            </RowGrid>
          </Section>

          {/* Section 2: Previous Employer */}
          <Section title="2 · Previous Employer">
            <RowGrid>
              <Label>Name of the employer</Label><Prefilled>{employment.employerName}</Prefilled>
              <Label>TAN of employer</Label><Blank>_ _ _ _ _ _ _ _ _ _ (from Form 16 Part A)</Blank>
              <Label>PAN of employer</Label><Blank>_ _ _ _ _ _ _ _ _ _</Blank>
              <Label>Address of employer</Label><Blank>(fill in by hand)</Blank>
              <Label>Period of employment</Label><Prefilled>{monthLabel(employment.fromMonth)} — {employment.toMonth ? monthLabel(employment.toMonth) : 'present'}</Prefilled>
            </RowGrid>
          </Section>

          {/* Section 3: Salary breakup */}
          <Section title="3 · Income from Salary u/s 17(1)">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Particulars</Th>
                  <Th style={{ textAlign:'right', width:150 }}>Amount (₹)</Th>
                  <Th style={{ width:240 }}>Notes</Th>
                </tr>
              </thead>
              <tbody>
                <Tr><Td>(a) Salary as per provisions</Td><Td num>{fmt(totalBasic)}</Td><Td>Basic × {slipCount} slips</Td></Tr>
                <Tr><Td>(b) House Rent Allowance</Td><Td num>{fmt(totalHRA)}</Td><Td>HRA × {slipCount} slips</Td></Tr>
                <Tr><Td>(c) Other allowances</Td><Td num>{fmt(totalOther)}</Td><Td>Special, DA, LTA, etc.</Td></Tr>
                <Tr subtotal><Td>Gross Salary (a + b + c)</Td><Td num>{fmt(grossSalary)}</Td><Td></Td></Tr>
                <Tr><Td>Less: HRA exemption u/s 10(13A)</Td><Td num blank>_____</Td><Td>(compute in Tax Optimiser or via CA)</Td></Tr>
                <Tr><Td>Less: Standard deduction u/s 16(ia)</Td><Td num>{fmt(standardDeduction)}</Td><Td>Pro-rated for {monthsAtEmp} months — verify</Td></Tr>
                <Tr><Td>Less: Professional tax u/s 16(iii)</Td><Td num>{fmt(totalPT)}</Td><Td>Sum across slips</Td></Tr>
                <Tr total><Td>Income chargeable under "Salaries"</Td><Td num>_____</Td><Td>(After HRA exemption)</Td></Tr>
              </tbody>
            </table>
          </Section>

          {/* Section 4: Deductions */}
          <Section title="4 · Deductions u/s 80 (declared to previous employer)">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th style={{ width:90 }}>Section</Th>
                  <Th>Particulars</Th>
                  <Th style={{ textAlign:'right', width:130 }}>Amount (₹)</Th>
                </tr>
              </thead>
              <tbody>
                <Tr><Td>80C</Td><Td>Employee Provident Fund</Td><Td num>{fmt(totalEPF)}</Td></Tr>
                <Tr><Td>80C</Td><Td>Other (PPF, ELSS, LIC etc.)</Td><Td num blank>_____</Td></Tr>
                <Tr><Td>80D</Td><Td>Health insurance premium</Td><Td num blank>_____</Td></Tr>
                <Tr><Td>80CCD(1B)</Td><Td>NPS contribution</Td><Td num blank>_____</Td></Tr>
                <Tr><Td>24(b)</Td><Td>Home loan interest</Td><Td num blank>_____</Td></Tr>
              </tbody>
            </table>
          </Section>

          {/* Section 5: TDS */}
          <Section title="5 · Tax Deducted at Source by Previous Employer">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th>Particulars</Th>
                  <Th style={{ textAlign:'right', width:150 }}>Amount (₹)</Th>
                </tr>
              </thead>
              <tbody>
                <Tr><Td>TDS deducted across employment period</Td><Td num>{fmt(totalTDS)}</Td></Tr>
                <Tr subtotal><Td>Total tax credit available</Td><Td num>{fmt(totalTDS)}</Td></Tr>
              </tbody>
            </table>
          </Section>

          {/* Declaration */}
          <div style={{ marginTop:28, padding:'14px 16px', background:'#FAF7F2', borderLeft:`3px solid ${C.fg}`, fontSize:11.5, lineHeight:1.6, color:C.fg }}>
            <strong>Declaration:</strong> I, the undersigned, do hereby declare that the particulars given above are true, correct, and complete to the best of my knowledge and belief. I undertake to inform the present employer of any change in the above particulars.
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:36, fontSize:11 }}>
            <div>
              <div style={{ borderBottom:'1px solid #1C2B22', height:38, marginBottom:4 }}></div>
              <div style={{ color:C.muted, fontSize:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Signature of Employee</div>
            </div>
            <div>
              <div style={{ borderBottom:'1px solid #1C2B22', height:38, marginBottom:4 }}></div>
              <div style={{ color:C.muted, fontSize:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Place and Date</div>
            </div>
          </div>
        </div>

        {/* Legend — hidden in print */}
        <div className="legend-bar" style={{ maxWidth:800, margin:'16px auto 0', padding:'12px 16px', background:'#FAF7F2', border:`1px solid ${C.border}`, borderRadius:5, fontSize:11, color:C.muted, lineHeight:1.6 }}>
          <strong style={{ color:C.fg }}>How to read this preview:</strong><br/>
          <span style={{ display:'inline-block', width:12, height:12, borderRadius:2, verticalAlign:'middle', marginRight:5, background:C.wl, border:`1px solid ${C.border}` }}></span> <strong>Cream-shaded fields</strong> — pre-filled from your uploaded salary slips · no action needed<br/>
          <span style={{ display:'inline-block', width:12, height:12, borderRadius:2, verticalAlign:'middle', marginRight:5, background:'transparent', borderBottom:'1px solid #A09080' }}></span> <strong>Underlined fields</strong> — fill in by hand on the printed form (data we don't have)<br/>
          <em>Click "Print Form 12B" above to print or save as PDF. Cream backgrounds and this legend won't print.</em>
        </div>
      </div>
    </>
  )
}

// ─── Inline sub-components ───────────────────────────────────────────────────
function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{ minHeight:'100vh', background:'#FDFAF6', fontFamily:'"Sora",-apple-system,sans-serif', padding:40, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ maxWidth:420, padding:24, background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, textAlign:'center' as const }}>
        <p style={{ fontSize:14, color:C.text, margin:'0 0 16px' }}>{message}</p>
        <button onClick={onBack} style={{ padding:'9px 18px', borderRadius:5, border:`1px solid ${C.fg}`, background:C.fg, color:C.wheat, fontSize:12.5, fontFamily:'inherit', cursor:'pointer', fontWeight:600 }}>← Back to Salary tab</button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:C.fg, marginBottom:8, paddingBottom:4, borderBottom:`1px solid ${C.border}` }}>{title}</div>
      {children}
    </div>
  )
}
function RowGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:'6px 12px', fontSize:12 }}>{children}</div>
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color:C.muted, padding:'4px 0' }}>{children}</div>
}
function Prefilled({ children }: { children: React.ReactNode }) {
  return <div className="value-prefilled" style={{ color:C.text, fontWeight:500, padding:'4px 8px', background:C.wl, borderRadius:3, border:`1px solid ${C.border}` }}>{children}</div>
}
function Blank({ children }: { children: React.ReactNode }) {
  return <div style={{ color:'#A09080', padding:'4px 8px', borderBottom:'1px solid #A09080', minHeight:22, fontStyle:'italic' as const, fontSize:11 }}>{children}</div>
}

const tableStyle: React.CSSProperties = { width:'100%', borderCollapse:'collapse' as const, fontSize:12, marginTop:4 }
function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding:'7px 10px', border:`1px solid ${C.border}`, textAlign:'left' as const, background:C.wl, color:C.fg, fontSize:10, textTransform:'uppercase' as const, letterSpacing:'0.06em', fontWeight:700, ...style }}>{children}</th>
}
function Tr({ children, subtotal, total }: { children: React.ReactNode; subtotal?: boolean; total?: boolean }) {
  const style: React.CSSProperties = total
    ? { background:C.fg, color:C.wheat }
    : subtotal
    ? { background:'#FAF7F2' }
    : {}
  return <tr style={style}>{children}</tr>
}
function Td({ children, num, blank, style }: { children?: React.ReactNode; num?: boolean; blank?: boolean; style?: React.CSSProperties }) {
  return <td style={{ padding:'7px 10px', border:`1px solid ${C.border}`, textAlign: num ? 'right' as const : 'left' as const, fontVariantNumeric:'tabular-nums', fontWeight: num ? 500 : 400, fontStyle: blank ? 'italic' as const : 'normal' as const, color: blank ? '#A09080' : 'inherit', ...style }}>{children}</td>
}
