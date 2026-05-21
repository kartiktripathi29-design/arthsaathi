'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const C = { fg:'#3A4B41', wheat:'#E6CFA7', wl:'#F5ECD8', wm:'#D4B98A', bg:'#FDFAF6', card:'#fff', border:'#E4DDD1', text:'#1C2B22', muted:'#7A8A7E', danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`

const monthLabel = (mk: string) => {
  const [y, m] = mk.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${y}`
}

const fyMonths = (fyStartYear: number) => {
  const months: string[] = []
  for (let m = 4; m <= 12; m++) months.push(`${fyStartYear}-${String(m).padStart(2, '0')}`)
  for (let m = 1; m <= 3; m++) months.push(`${fyStartYear + 1}-${String(m).padStart(2, '0')}`)
  return months
}

interface Earning {
  label: string
  amount: number
}

interface MonthData {
  monthKey: string
  gross: number
  net: number
  deductions: number
  source: 'actual' | 'projected' | 'edited'
  earnings?: Earning[]
  deductionsList?: Earning[]
}

interface Employment {
  id: string
  name: string
  fromMonth: string
  toMonth: string
  months: MonthData[]
  baseGross?: number
  baseNet?: number
}

interface WizardData {
  employmentChanges: number | null
  changeMonth: string
  employer1HasSlips: string
  employer1IncrementMonth: string
  employer1IncrementPercent: number
  employer1Retroactive: boolean
  employer2UseBase: boolean | null
}

type WizardStep = 'step1' | 'step2a' | 'step2b-employer1' | 'step2b-employer2' | 'step3' | 'review'

export default function SalaryPageCompleteFinal() {
  const router = useRouter()
  const [slips, setSlips] = useState<any[]>([])
  const [fyStartYear, setFyStartYear] = useState(2025)
  const [wizardStep, setWizardStep] = useState<WizardStep>('step1')
  const [employments, setEmployments] = useState<Employment[]>([])
  const [expandedEmployment, setExpandedEmployment] = useState<string | null>(null)
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)
  const [previewEmploymentId, setPreviewEmploymentId] = useState<string | null>(null)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [editEmploymentId, setEditEmploymentId] = useState<string | null>(null)
  const [editGross, setEditGross] = useState(0)
  const [editNet, setEditNet] = useState(0)
  const [loading, setLoading] = useState(true)

  const [wizard, setWizard] = useState<WizardData>({
    employmentChanges: null,
    changeMonth: '',
    employer1HasSlips: '',
    employer1IncrementMonth: '',
    employer1IncrementPercent: 0,
    employer1Retroactive: false,
    employer2UseBase: null,
  })

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        const slipsArray = Array.isArray(parsed) ? parsed : []
        setSlips(slipsArray)
        detectFY(slipsArray)
      } catch (e) {
        console.error('Failed to load:', e)
      }
    }
    setLoading(false)
  }, [])

  const monthToNum = (month: string): number => {
    const m: Record<string, number> = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
      Jan: 1, Feb: 2, Mar: 3, Apr: 4, Jun: 6,
      Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
    }
    return m[month] || 1
  }

  const detectFY = (slipsArray: any[]) => {
    if (slipsArray.length === 0) return
    const slip = slipsArray[0]
    const month = monthToNum(slip.month)
    const year = parseInt(slip.year)
    const fy = month >= 4 ? year : year - 1
    setFyStartYear(fy)
  }

  const buildEmploymentsFromWizard = () => {
    if (!slips || slips.length === 0) return

    const changeMonthNum = parseInt(wizard.changeMonth.split('-')[1])
    const allFYMonths = fyMonths(fyStartYear)

    // Separate slips by employment period
    const employer1Slips = slips.filter(s => monthToNum(s.month) < changeMonthNum)
    const employer2Slips = slips.filter(s => monthToNum(s.month) >= changeMonthNum)

    const newEmployments: Employment[] = []

    // EMPLOYER 1 (Apr - before change month)
    const e1From = `${fyStartYear}-04`
    const e1To = `${fyStartYear}-${String(changeMonthNum - 1).padStart(2, '0')}`
    const e1Name = employer1Slips.length > 0 ? (employer1Slips[0].employerName || 'Employer 1') : 'Employer 1'

    const e1BaseSlip = employer1Slips.length > 0 ? employer1Slips[0] : null
    const e1BaseGross = e1BaseSlip?.grossSalary || e1BaseSlip?.basicSalary || 0
    const e1BaseNet = e1BaseSlip?.netSalary || e1BaseSlip?.basicSalary || 0
    const e1BaseEarnings = e1BaseSlip?.components?.filter((c: any) => c.type === 'earning') || []
    const e1BaseDeductions = e1BaseSlip?.components?.filter((c: any) => c.type === 'deduction') || []

    const e1Months: MonthData[] = allFYMonths.map(mk => {
      const mkNum = parseInt(mk.split('-')[1])

      if (mkNum >= changeMonthNum) {
        return {
          monthKey: mk,
          gross: 0,
          net: 0,
          deductions: 0,
          source: 'projected',
          earnings: [],
          deductionsList: [],
        }
      }

      const slip = employer1Slips.find(s => {
        const slipKey = `${s.year}-${String(monthToNum(s.month)).padStart(2, '0')}`
        return slipKey === mk
      })

      if (slip) {
        return {
          monthKey: mk,
          gross: slip.grossSalary || slip.basicSalary || 0,
          net: slip.netSalary || slip.basicSalary || 0,
          deductions: (slip.grossSalary || 0) - (slip.netSalary || 0),
          source: 'actual',
          earnings: slip.components?.filter((c: any) => c.type === 'earning') || [],
          deductionsList: slip.components?.filter((c: any) => c.type === 'deduction') || [],
        }
      }

      // Project for missing months with increment logic
      if (e1BaseGross > 0) {
        const incrementMonthNum = wizard.employer1IncrementMonth ? parseInt(wizard.employer1IncrementMonth.split('-')[1]) : null
        const incrementFactor = 1 + (wizard.employer1IncrementPercent / 100)

        let grossSalary = e1BaseGross
        let netSalary = e1BaseNet

        if (incrementMonthNum) {
          if (wizard.employer1Retroactive) {
            // Retroactive: applies from Apr onwards
            grossSalary = Math.round(e1BaseGross * incrementFactor)
            netSalary = Math.round(e1BaseNet * (incrementFactor))
          } else if (mkNum >= incrementMonthNum) {
            // Non-retroactive: applies from increment month onwards
            grossSalary = Math.round(e1BaseGross * incrementFactor)
            netSalary = Math.round(e1BaseNet * (incrementFactor))
          }
        }

        return {
          monthKey: mk,
          gross: grossSalary,
          net: netSalary,
          deductions: grossSalary - netSalary,
          source: 'projected',
          earnings: e1BaseEarnings,
          deductionsList: e1BaseDeductions,
        }
      }

      return {
        monthKey: mk,
        gross: 0,
        net: 0,
        deductions: 0,
        source: 'projected',
        earnings: [],
        deductionsList: [],
      }
    })

    if (changeMonthNum > 4 || employer1Slips.length > 0) {
      newEmployments.push({
        id: 'emp-1',
        name: e1Name,
        fromMonth: e1From,
        toMonth: e1To,
        months: e1Months,
        baseGross: e1BaseGross,
        baseNet: e1BaseNet,
      })
    }

    // EMPLOYER 2 (from change month to Mar)
    const e2From = wizard.changeMonth
    const e2To = `${fyStartYear + 1}-03`
    const e2Name = employer2Slips.length > 0 ? (employer2Slips[0].employerName || 'Employer 2') : 'Employer 2'

    const e2BaseSlip = employer2Slips[employer2Slips.length - 1]
    const e2BaseGross = e2BaseSlip?.grossSalary || e2BaseSlip?.basicSalary || 0
    const e2BaseNet = e2BaseSlip?.netSalary || e2BaseSlip?.basicSalary || 0
    const e2BaseEarnings = e2BaseSlip?.components?.filter((c: any) => c.type === 'earning') || []
    const e2BaseDeductions = e2BaseSlip?.components?.filter((c: any) => c.type === 'deduction') || []

    const e2Months: MonthData[] = allFYMonths.map(mk => {
      const mkNum = parseInt(mk.split('-')[1])

      if (mkNum < changeMonthNum) {
        return {
          monthKey: mk,
          gross: 0,
          net: 0,
          deductions: 0,
          source: 'projected',
          earnings: [],
          deductionsList: [],
        }
      }

      const slip = employer2Slips.find(s => {
        const slipKey = `${s.year}-${String(monthToNum(s.month)).padStart(2, '0')}`
        return slipKey === mk
      })

      if (slip) {
        return {
          monthKey: mk,
          gross: slip.grossSalary || slip.basicSalary || 0,
          net: slip.netSalary || slip.basicSalary || 0,
          deductions: (slip.grossSalary || 0) - (slip.netSalary || 0),
          source: 'actual',
          earnings: slip.components?.filter((c: any) => c.type === 'earning') || [],
          deductionsList: slip.components?.filter((c: any) => c.type === 'deduction') || [],
        }
      }

      // Project using base salary
      if (wizard.employer2UseBase && e2BaseGross > 0) {
        return {
          monthKey: mk,
          gross: e2BaseGross,
          net: e2BaseNet,
          deductions: e2BaseGross - e2BaseNet,
          source: 'projected',
          earnings: e2BaseEarnings,
          deductionsList: e2BaseDeductions,
        }
      }

      return {
        monthKey: mk,
        gross: 0,
        net: 0,
        deductions: 0,
        source: 'projected',
        earnings: [],
        deductionsList: [],
      }
    })

    newEmployments.push({
      id: 'emp-2',
      name: e2Name,
      fromMonth: e2From,
      toMonth: e2To,
      months: e2Months,
      baseGross: e2BaseGross,
      baseNet: e2BaseNet,
    })

    setEmployments(newEmployments)
  }

  const updateMonth = (employmentId: string, monthKey: string, gross: number, net: number) => {
    setEmployments(prev =>
      prev.map(emp => {
        if (emp.id === employmentId) {
          return {
            ...emp,
            months: emp.months.map(m =>
              m.monthKey === monthKey
                ? { ...m, gross, net, deductions: gross - net, source: 'edited' as const }
                : m
            ),
          }
        }
        return emp
      })
    )
    setEditingMonth(null)
  }

  const getMonthData = (employmentId: string, monthKey: string): MonthData | undefined => {
    return employments.find(e => e.id === employmentId)?.months.find(m => m.monthKey === monthKey)
  }

  const annualGross = employments.reduce((total, emp) => {
    return total + emp.months.reduce((sum, m) => sum + m.gross, 0)
  }, 0)

  const annualNet = employments.reduce((total, emp) => {
    return total + emp.months.reduce((sum, m) => sum + m.net, 0)
  }, 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading...</div>

  if (slips.length === 0) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 16px' }}>No salary data uploaded yet</p>
          <button onClick={() => router.push('/dashboard/profile/documents')} style={{ padding: '10px 20px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Upload Salary Slip</button>
        </div>
      </div>
    )
  }

  // WIZARD STEPS
  if (wizardStep !== 'review') {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Salary Setup</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>FY {fyStartYear}-{fyStartYear + 1}</p>

        {wizardStep === 'step1' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>Did you have employment changes?</h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Between Apr {fyStartYear} and Mar {fyStartYear + 1}, did you change jobs?</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <button onClick={() => { setWizard({ ...wizard, employmentChanges: 0 }); setWizardStep('step3') }} style={{ padding: 16, background: wizard.employmentChanges === 0 ? C.wl : '#fff', border: `1px solid ${wizard.employmentChanges === 0 ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>No, same employer</button>
              <button onClick={() => { setWizard({ ...wizard, employmentChanges: 1 }); setWizardStep('step2a') }} style={{ padding: 16, background: wizard.employmentChanges === 1 ? C.wl : '#fff', border: `1px solid ${wizard.employmentChanges === 1 ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>Yes, 1 change (2 employers)</button>
              <button onClick={() => { setWizard({ ...wizard, employmentChanges: 2 }); setWizardStep('step2a') }} style={{ padding: 16, background: wizard.employmentChanges === 2 ? C.wl : '#fff', border: `1px solid ${wizard.employmentChanges === 2 ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>Yes, 2+ changes (3+ employers)</button>
            </div>
          </div>
        )}

        {wizardStep === 'step2a' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>When did you change employers?</h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Select the month when you switched.</p>
            
            <select value={wizard.changeMonth} onChange={(e) => setWizard({ ...wizard, changeMonth: e.target.value })} style={{ width: '100%', padding: '12px', fontSize: 13, borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'inherit', marginBottom: 24 }}>
              <option value="">-- Select month --</option>
              {['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb'].map((m, i) => (
                <option key={i} value={`${fyStartYear}-${String((i + 4) % 12 || 12).padStart(2, '0')}`}>{m.charAt(0).toUpperCase() + m.slice(1)} {i < 9 ? fyStartYear : fyStartYear + 1}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setWizardStep('step1')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
              <button onClick={() => setWizardStep('step2b-employer1')} disabled={!wizard.changeMonth} style={{ flex: 1, padding: '12px', background: wizard.changeMonth ? C.fg : '#ccc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: wizard.changeMonth ? 'pointer' : 'default', fontFamily: 'inherit', opacity: wizard.changeMonth ? 1 : 0.5 }}>Next →</button>
            </div>
          </div>
        )}

        {wizardStep === 'step2b-employer1' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>Employer 1: Do you have salary slips?</h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>For Apr {fyStartYear} to {monthLabel(wizard.changeMonth).split(' ')[0]} {fyStartYear}, which months do you have slips for?</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <button onClick={() => setWizard({ ...wizard, employer1HasSlips: 'all' })} style={{ padding: 16, background: wizard.employer1HasSlips === 'all' ? C.wl : '#fff', border: `1px solid ${wizard.employer1HasSlips === 'all' ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>All months</button>
              <button onClick={() => setWizard({ ...wizard, employer1HasSlips: 'some' })} style={{ padding: 16, background: wizard.employer1HasSlips === 'some' ? C.wl : '#fff', border: `1px solid ${wizard.employer1HasSlips === 'some' ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>Only some months</button>
            </div>

            {wizard.employer1HasSlips === 'some' && (
              <div style={{ marginBottom: 24, padding: 16, background: C.wl, borderRadius: 6 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 12 }}>For months without slips, did you get an increment?</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6 }}>Increment month</label>
                    <select value={wizard.employer1IncrementMonth} onChange={(e) => setWizard({ ...wizard, employer1IncrementMonth: e.target.value })} style={{ width: '100%', padding: '8px', fontSize: 12, borderRadius: 4, border: `1px solid ${C.border}`, fontFamily: 'inherit' }}>
                      <option value="">No increment</option>
                      {['apr', 'may', 'jun', 'jul', 'aug', 'sep'].map((m, i) => (
                        <option key={i} value={`${fyStartYear}-${String((i + 4) % 12 || 12).padStart(2, '0')}`}>{m}</option>
                      ))}
                    </select>
                  </div>
                  {wizard.employer1IncrementMonth && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6 }}>Increment % ({wizard.employer1IncrementPercent}%)</label>
                        <input type="range" min="0" max="50" step="1" value={wizard.employer1IncrementPercent} onChange={(e) => setWizard({ ...wizard, employer1IncrementPercent: parseInt(e.target.value) })} style={{ width: '100%' }} />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: C.text, gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={wizard.employer1Retroactive} onChange={(e) => setWizard({ ...wizard, employer1Retroactive: e.target.checked })} />
                        Retroactive (applies to earlier months)
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setWizardStep('step2a')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
              <button onClick={() => setWizardStep('step2b-employer2')} disabled={!wizard.employer1HasSlips} style={{ flex: 1, padding: '12px', background: wizard.employer1HasSlips ? C.fg : '#ccc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: wizard.employer1HasSlips ? 'pointer' : 'default', fontFamily: 'inherit', opacity: wizard.employer1HasSlips ? 1 : 0.5 }}>Next →</button>
            </div>
          </div>
        )}

        {wizardStep === 'step2b-employer2' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>Employer 2: Use base salary?</h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>For {monthLabel(wizard.changeMonth)} to Mar {fyStartYear + 1}, should I use your latest slip as base for all months?</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <button onClick={() => setWizard({ ...wizard, employer2UseBase: true })} style={{ padding: 16, background: wizard.employer2UseBase === true ? C.wl : '#fff', border: `1px solid ${wizard.employer2UseBase === true ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>Yes, use latest slip as base</button>
              <button onClick={() => setWizard({ ...wizard, employer2UseBase: false })} style={{ padding: 16, background: wizard.employer2UseBase === false ? C.wl : '#fff', border: `1px solid ${wizard.employer2UseBase === false ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>No, I'll enter each month</button>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setWizardStep('step2b-employer1')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
              <button onClick={() => setWizardStep('step3')} disabled={wizard.employer2UseBase === null} style={{ flex: 1, padding: '12px', background: wizard.employer2UseBase !== null ? C.fg : '#ccc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: wizard.employer2UseBase !== null ? 'pointer' : 'default', fontFamily: 'inherit', opacity: wizard.employer2UseBase !== null ? 1 : 0.5 }}>Next →</button>
            </div>
          </div>
        )}

        {wizardStep === 'step3' && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>Any other increments?</h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Did you get salary increments with Employer 2 (after {monthLabel(wizard.changeMonth)})?</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <button onClick={() => { buildEmploymentsFromWizard(); setWizardStep('review') }} style={{ padding: 16, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>No, no more increments</button>
              <button onClick={() => { buildEmploymentsFromWizard(); setWizardStep('review') }} style={{ padding: 16, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textAlign: 'left', fontWeight: 500, color: C.text }}>Yes, but I'll add them in review</button>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setWizardStep('step2b-employer2')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
              <button onClick={() => { buildEmploymentsFromWizard(); setWizardStep('review') }} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Review →</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // REVIEW STEP
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Salary</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>FY {fyStartYear}-{fyStartYear + 1}</p>

      {/* Preview Modal - Salary Breakup */}
      {previewMonth && previewEmploymentId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 30, maxWidth: 600, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', position: 'relative' }}>
            <button onClick={() => setPreviewMonth(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 28, color: C.muted, cursor: 'pointer', padding: 0 }}>×</button>

            {previewMonth && getMonthData(previewEmploymentId, previewMonth) && (() => {
              const md = getMonthData(previewEmploymentId, previewMonth)!
              return (
                <>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>{monthLabel(previewMonth)}</h2>
                  <p style={{ fontSize: 12, color: C.muted, margin: '0 0 20px' }}>{md.source === 'actual' ? 'From salary slip' : md.source === 'edited' ? 'Your edit' : 'Calculated from base'}</p>

                  {/* Earnings */}
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Earnings</h3>
                    <div style={{ background: C.wl, borderRadius: 6, overflow: 'hidden' }}>
                      {md.earnings && md.earnings.length > 0 ? (
                        md.earnings.map((e, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < md.earnings!.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                            <span style={{ fontSize: 12, color: C.text }}>{e.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(e.amount)}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px' }}>
                          <span style={{ fontSize: 12, color: C.text }}>Gross Salary</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(md.gross)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.wl, fontWeight: 600, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, color: C.fg }}>Total Earnings</span>
                        <span style={{ fontSize: 12, color: C.fg }}>{fmt(md.gross)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Deductions</h3>
                    <div style={{ background: '#FBF0F0', borderRadius: 6, overflow: 'hidden' }}>
                      {md.deductionsList && md.deductionsList.length > 0 ? (
                        md.deductionsList.map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < md.deductionsList!.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                            <span style={{ fontSize: 12, color: C.text }}>{d.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.danger }}>−{fmt(d.amount)}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px' }}>
                          <span style={{ fontSize: 12, color: C.text }}>Deductions</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.danger }}>−{fmt(md.deductions)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FBF0F0', fontWeight: 600, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, color: C.danger }}>Total Deductions</span>
                        <span style={{ fontSize: 12, color: C.danger }}>−{fmt(md.deductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Salary */}
                  <div style={{ marginTop: 20, padding: '14px', background: C.wl, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Net Salary</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#2A7A4A' }}>{fmt(md.net)}</span>
                  </div>
                </>
              )
            })()}

            <button onClick={() => setPreviewMonth(null)} style={{ width: '100%', marginTop: 20, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMonth && editEmploymentId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 30, maxWidth: 500, width: '95%', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', position: 'relative' }}>
            <button onClick={() => setEditingMonth(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 28, color: C.muted, cursor: 'pointer', padding: 0 }}>×</button>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 20px' }}>Edit {monthLabel(editingMonth)}</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6 }}>Gross Salary</label>
              <input type="number" value={editGross} onChange={(e) => setEditGross(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px', fontSize: 14, borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6 }}>Net Salary</label>
              <input type="number" value={editNet} onChange={(e) => setEditNet(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px', fontSize: 14, borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEditingMonth(null)} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => updateMonth(editEmploymentId, editingMonth, editGross, editNet)} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Annual Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Gross</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(annualGross)}</p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Net</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#2A7A4A', margin: 0 }}>{fmt(annualNet)}</p>
        </div>
      </div>

      {/* Employment Periods */}
      <div style={{ marginBottom: 24 }}>
        {employments.map((emp, idx) => (
          <div key={emp.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedEmployment(expandedEmployment === emp.id ? null : emp.id)}
              style={{ width: '100%', padding: '16px', background: expandedEmployment === emp.id ? C.wl : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Employment #{idx + 1}: {emp.name}</h3>
                <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{monthLabel(emp.fromMonth)} → {monthLabel(emp.toMonth)}</p>
              </div>
              <span style={{ fontSize: 14, color: C.fg }}>{expandedEmployment === emp.id ? '−' : '+'}</span>
            </button>

            {expandedEmployment === emp.id && (
              <div style={{ padding: '16px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 12px', textTransform: 'uppercase' }}>Timeline · click to view/edit</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 8, marginBottom: 12 }}>
                    {emp.months.map(m => {
                      const bg = m.source === 'actual' ? C.fg : m.source === 'edited' ? C.wm : C.border
                      const fg = m.source === 'actual' || m.source === 'edited' ? '#fff' : C.muted
                      const icon = m.source === 'actual' ? '●' : m.source === 'edited' ? '✎' : '○'

                      return (
                        <button
                          key={m.monthKey}
                          onClick={() => {
                            setPreviewMonth(m.monthKey)
                            setPreviewEmploymentId(emp.id)
                          }}
                          style={{ background: bg, color: fg, border: 'none', borderRadius: 4, padding: '12px 4px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        >
                          <div style={{ fontSize: 9 }}>{monthLabel(m.monthKey).split(' ')[0]}</div>
                          <div style={{ fontSize: 11 }}>{icon}</div>
                          <div style={{ fontSize: 8, opacity: 0.8 }}>{fmt(m.gross)}</div>
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: C.muted, marginBottom: 12 }}>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.fg, marginRight: 4 }} />Actual</span>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.wm, marginRight: 4 }} />Edited</span>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.border, marginRight: 4 }} />Projected</span>
                  </div>

                  <button onClick={() => { setEditEmploymentId(emp.id); setEditingMonth(emp.months[0].monthKey); setEditGross(emp.months[0].gross); setEditNet(emp.months[0].net) }} style={{ width: '100%', padding: '10px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Edit any month</button>
                </div>

                <div style={{ padding: '12px', background: C.wl, borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Period Gross:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(emp.months.reduce((s, m) => s + m.gross, 0))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Period Net:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2A7A4A' }}>{fmt(emp.months.reduce((s, m) => s + m.net, 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => setWizardStep('step3')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Edit</button>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Next: Other Income →</button>
      </div>
    </div>
  )
}
