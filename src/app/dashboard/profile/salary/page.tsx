'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { seedIfMissing, verifyIdentity, setStoredIdentity } from '@/lib/identity'
import {
  detectAnomalies,
  extractAnnualGross,
  extractAnnualTDS,
  type Anomaly,
} from '@/lib/salary-analytics'

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

type Frequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'one_time'

interface Earning {
  label: string
  amount: number
  // Cadence — drives whether/how this component projects forward.
  // 'monthly' carries forward every month; the others don't repeat by adjacent month.
  frequency?: Frequency
  // Legacy field (binary recurring/one-time) kept for migration of older saved data.
  flag?: 'recurring' | 'one_time'
}

const FREQUENCY_OPTIONS: { id: Frequency; label: string }[] = [
  { id: 'monthly',     label: 'Monthly' },
  { id: 'quarterly',   label: 'Quarterly' },
  { id: 'half_yearly', label: 'Half-Yearly' },
  { id: 'yearly',      label: 'Yearly' },
  { id: 'one_time',    label: 'One-Time' },
]

// Heuristic for first-load defaulting: bonus/joining/etc → one_time; everything else → monthly.
const ONE_TIME_PATTERN = /\b(bonus|joining|sign[- ]?on|incentive|arrear|reimbursement|gift|gratuity|leave\s*encash)/i
function defaultFrequency(label: string): Frequency {
  return ONE_TIME_PATTERN.test(label || '') ? 'one_time' : 'monthly'
}

// Read frequency with legacy-fallback (old `flag` field → new `frequency`).
function resolveFrequency(e: Earning): Frequency {
  if (e.frequency) return e.frequency
  if (e.flag === 'recurring') return 'monthly'
  if (e.flag === 'one_time') return 'one_time'
  return defaultFrequency(e.label)
}

// Kept as alias so existing call sites compile; semantics: 'monthly' === recurring.
function defaultFlag(label: string): 'recurring' | 'one_time' {
  return defaultFrequency(label) === 'monthly' ? 'recurring' : 'one_time'
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

// Intent (PRD v6) — two options only. Drives which questions the wizard asks.
type Intent = 'validate' | 'forecast'

interface WizardData {
  intent: Intent | null
  employmentChanges: number | null
  changeMonth: string
  employer1HasSlips: string
  employer1IncrementMonth: string
  employer1IncrementPercent: number
  employer1Retroactive: boolean
  employer2UseBase: boolean | null
  // Validate intent Q1–Q6 (v6 §Intent A)
  validateCompleteData: boolean | null      // Q1
  validateSameAllYear: 'yes' | 'no' | 'partial' | null  // Q2
  validateChangedEmployer: boolean | null   // Q3
  validateHadIncrement: boolean | null      // Q4
  validateFreelanceMonths: string[]         // Q5 — months user freelanced (gap or alongside)
  validateBonusMonths: string[]             // Q6 — months with bonus / one-time payments
}

type WizardStep =
  | 'intent-pick'
  // Validate intent — 6 sequential questions per v6 §Intent A
  | 'validate-q1' | 'validate-q2' | 'validate-q3' | 'validate-q4' | 'validate-q5' | 'validate-q6'
  // Forecast intent reuses these existing steps
  | 'step1' | 'step2a' | 'step2b-employer1' | 'step2b-employer2' | 'step3'
  | 'review'

export default function SalaryPageCompleteFinal() {
  const router = useRouter()
  const [slips, setSlips] = useState<any[]>([])
  const [fyStartYear, setFyStartYear] = useState(2025)
  const [wizardStep, setWizardStep] = useState<WizardStep>('intent-pick')
  const [employments, setEmployments] = useState<Employment[]>([])
  const [expandedEmployment, setExpandedEmployment] = useState<string | null>(null)
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)
  const [previewEmploymentId, setPreviewEmploymentId] = useState<string | null>(null)
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [editEmploymentId, setEditEmploymentId] = useState<string | null>(null)
  const [editGross, setEditGross] = useState(0)
  const [editNet, setEditNet] = useState(0)
  const [loading, setLoading] = useState(true)

  // Per-month upload state — one form per expanded employment.
  const [monthUploadEmpId, setMonthUploadEmpId] = useState<string | null>(null)
  const [monthUploadKey, setMonthUploadKey] = useState<string>('')
  const [monthUploadFile, setMonthUploadFile] = useState<File | null>(null)
  const [monthUploadBusy, setMonthUploadBusy] = useState(false)
  const [monthUploadError, setMonthUploadError] = useState<string | null>(null)

  // Manual-entry state — separate from upload, so user can type numbers directly.
  const [manualOpenEmpId, setManualOpenEmpId] = useState<string | null>(null)
  const [manualMonthKey, setManualMonthKey] = useState<string>('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualEarnings, setManualEarnings] = useState<{ label: string; amount: string }[]>([
    { label: 'Basic', amount: '' },
    { label: 'HRA', amount: '' },
  ])
  const [manualDeductions, setManualDeductions] = useState<{ label: string; amount: string }[]>([
    { label: 'PF', amount: '' },
    { label: 'TDS', amount: '' },
  ])

  // Inline preview panel — collapsible under each employment's timeline.
  const [previewOpenEmpId, setPreviewOpenEmpId] = useState<string | null>(null)

  // Per-line override editor: which component (in which month/employment) is currently being edited inline.
  const [overrideKey, setOverrideKey] = useState<{ empId: string; monthKey: string; kind: 'earning' | 'deduction'; index: number } | null>(null)
  const [overrideValue, setOverrideValue] = useState<string>('')

  // Memoized analytics — kept for cell anomaly badges and the summary box. No tax math here (per v6).
  const annualGross = useMemo(() => extractAnnualGross(employments), [employments])
  const annualTDS = useMemo(() => extractAnnualTDS(employments), [employments])
  const anomaliesByEmp = useMemo(() => {
    const map = new Map<string, Anomaly[]>()
    for (const emp of employments) map.set(emp.id, detectAnomalies(emp))
    return map
  }, [employments])
  const anomalyByMonth = useMemo(() => {
    const map = new Map<string, Anomaly>()
    for (const list of anomaliesByEmp.values()) for (const a of list) map.set(a.monthKey, a)
    return map
  }, [anomaliesByEmp])

  const [wizard, setWizard] = useState<WizardData>({
    intent: null,
    employmentChanges: null,
    changeMonth: '',
    employer1HasSlips: '',
    employer1IncrementMonth: '',
    employer1IncrementPercent: 0,
    employer1Retroactive: false,
    employer2UseBase: null,
    validateCompleteData: null,
    validateSameAllYear: null,
    validateChangedEmployer: null,
    validateHadIncrement: null,
    validateFreelanceMonths: [],
    validateBonusMonths: [],
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

    // Separate slips by employment period.
    // Compare on full YYYY-MM keys (lexicographic) so the FY wrap (Jan-Mar belongs after Dec) is correct.
    const slipKeyOf = (s: any) => `${s.year}-${String(monthToNum(s.month)).padStart(2, '0')}`
    const employer1Slips = slips.filter(s => slipKeyOf(s) < wizard.changeMonth)
    const employer2Slips = slips.filter(s => slipKeyOf(s) >= wizard.changeMonth)

    const newEmployments: Employment[] = []

    // EMPLOYER 1 (Apr - before change month)
    const e1From = `${fyStartYear}-04`
    const e1To = `${fyStartYear}-${String(changeMonthNum - 1).padStart(2, '0')}`
    const e1Name = employer1Slips.length > 0 ? (employer1Slips[0].employerName || 'Employer 1') : 'Employer 1'

    // Helper: from a base slip, split earnings into recurring vs one-time.
    // Projections only carry recurring earnings forward (e.g. Bonus paid in Apr
    // should NOT repeat May–Sep).
    const splitRecurring = (baseSlip: any) => {
      const earnings = (baseSlip?.components || []).filter((c: any) => c.type === 'earning')
      const deductions = (baseSlip?.components || []).filter((c: any) => c.type === 'deduction')
      const flagged = earnings.map((e: any) => ({ ...e, frequency: e.frequency || (e.flag === 'recurring' ? 'monthly' : e.flag === 'one_time' ? 'one_time' : defaultFrequency(e.label)) }))
      // Only monthly carries forward into adjacent months.
      const recurringEarnings = flagged.filter((e: any) => e.frequency === 'monthly')
      const recurringGross = recurringEarnings.reduce((s: number, e: any) => s + (e.amount || 0), 0)
      const totalDed = deductions.reduce((s: number, d: any) => s + (d.amount || 0), 0)
      const recurringNet = recurringGross - totalDed
      return { recurringEarnings, deductions, recurringGross, recurringNet, allEarnings: flagged }
    }

    const e1BaseSlip = employer1Slips.length > 0 ? employer1Slips[0] : null
    const e1Split = splitRecurring(e1BaseSlip)
    // Actual-slip total for the base month itself (preserved as-is); projections use the recurring-only totals.
    const e1BaseGross = e1BaseSlip?.grossSalary || e1BaseSlip?.basicSalary || 0
    const e1BaseNet = e1BaseSlip?.netSalary || e1BaseSlip?.basicSalary || 0
    const e1ProjGross = e1Split.recurringGross > 0 ? e1Split.recurringGross : e1BaseGross
    const e1ProjNet = e1Split.recurringGross > 0 ? e1Split.recurringNet : e1BaseNet
    const e1BaseEarnings = e1Split.recurringEarnings
    const e1BaseDeductions = e1Split.deductions

    const e1Months: MonthData[] = allFYMonths.map(mk => {
      // FY-correct comparison: Jan-Mar of the next year are AFTER Dec, not before Apr.
      if (mk >= wizard.changeMonth) {
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

      // Project for missing months with increment logic.
      // Use the recurring-only totals so one-time components (bonus, joining, etc.) don't carry forward.
      if (e1ProjGross > 0) {
        const incrementFactor = 1 + (wizard.employer1IncrementPercent / 100)

        let grossSalary = e1ProjGross
        let netSalary = e1ProjNet

        if (wizard.employer1IncrementMonth) {
          if (wizard.employer1Retroactive) {
            grossSalary = Math.round(e1ProjGross * incrementFactor)
            netSalary = Math.round(e1ProjNet * (incrementFactor))
          } else if (mk >= wizard.employer1IncrementMonth) {
            grossSalary = Math.round(e1ProjGross * incrementFactor)
            netSalary = Math.round(e1ProjNet * (incrementFactor))
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
    const e2Split = splitRecurring(e2BaseSlip)
    const e2BaseGross = e2BaseSlip?.grossSalary || e2BaseSlip?.basicSalary || 0
    const e2BaseNet = e2BaseSlip?.netSalary || e2BaseSlip?.basicSalary || 0
    const e2ProjGross = e2Split.recurringGross > 0 ? e2Split.recurringGross : e2BaseGross
    const e2ProjNet = e2Split.recurringGross > 0 ? e2Split.recurringNet : e2BaseNet
    const e2BaseEarnings = e2Split.recurringEarnings
    const e2BaseDeductions = e2Split.deductions

    const e2Months: MonthData[] = allFYMonths.map(mk => {
      // FY-correct comparison: months before the change-month belong to Employment #1.
      if (mk < wizard.changeMonth) {
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

      // Project using base salary — recurring only, so one-time components don't repeat.
      if (wizard.employer2UseBase && e2ProjGross > 0) {
        return {
          monthKey: mk,
          gross: e2ProjGross,
          net: e2ProjNet,
          deductions: e2ProjGross - e2ProjNet,
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

  // Re-project all 'projected' months in an employment based on its latest actual/edited month.
  // Honors recurring/one-time flags so one-time components don't carry forward.
  const reprojectEmployment = (emps: Employment[], employmentId: string): Employment[] => {
    return emps.map(emp => {
      if (emp.id !== employmentId) return emp
      // Find the latest non-projected month within the employment's range.
      const baseMonth = [...emp.months]
        .filter(m => m.monthKey >= emp.fromMonth && m.monthKey <= emp.toMonth)
        .filter(m => m.source === 'actual' || m.source === 'edited')
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
      if (!baseMonth) return emp

      const flaggedEarnings = (baseMonth.earnings || []).map(e => ({
        ...e,
        frequency: resolveFrequency(e),
      }))
      const recurringEarnings = flaggedEarnings.filter(e => e.frequency === 'monthly')
      const recurringGross = recurringEarnings.reduce((s, e) => s + (e.amount || 0), 0)
      const totalDed = (baseMonth.deductionsList || []).reduce((s, d) => s + (d.amount || 0), 0)
      const recurringNet = recurringGross - totalDed

      return {
        ...emp,
        months: emp.months.map(m => {
          if (m.source !== 'projected') return m
          if (m.monthKey < emp.fromMonth || m.monthKey > emp.toMonth) return m
          return {
            ...m,
            gross: recurringGross,
            net: recurringNet,
            deductions: totalDed,
            earnings: recurringEarnings,
            deductionsList: baseMonth.deductionsList || [],
          }
        }),
      }
    })
  }

  // Set the frequency (Monthly/Quarterly/Half-Yearly/Yearly/One-Time) for a single earning, then re-project.
  const setEarningFrequency = (employmentId: string, monthKey: string, index: number, frequency: Frequency) => {
    setEmployments(prev => {
      const updated = prev.map(emp => {
        if (emp.id !== employmentId) return emp
        return {
          ...emp,
          months: emp.months.map(m => {
            if (m.monthKey !== monthKey) return m
            const earnings = (m.earnings || []).map((e, i) => {
              if (i !== index) return e
              const next: Earning = { ...e, frequency }
              return next
            })
            return { ...m, earnings, source: 'edited' as const }
          }),
        }
      })
      return reprojectEmployment(updated, employmentId)
    })
  }

  // Save an inline override for a single earning or deduction component within a month.
  // Recomputes the month's gross/net, then re-projects forward months in the same employment.
  const saveOverride = () => {
    if (!overrideKey) return
    const amount = Math.round(parseFloat(overrideValue) || 0)
    if (amount < 0) return
    const empId = overrideKey.empId
    setEmployments(prev => {
      const updated = prev.map(emp => {
        if (emp.id !== empId) return emp
        return {
          ...emp,
          months: emp.months.map(m => {
            if (m.monthKey !== overrideKey.monthKey) return m
            const earnings = (m.earnings || []).slice()
            const deductionsList = (m.deductionsList || []).slice()
            if (overrideKey.kind === 'earning') {
              if (earnings[overrideKey.index]) earnings[overrideKey.index] = { ...earnings[overrideKey.index], amount }
            } else {
              if (deductionsList[overrideKey.index]) deductionsList[overrideKey.index] = { ...deductionsList[overrideKey.index], amount }
            }
            const gross = earnings.reduce((s, e) => s + e.amount, 0) || m.gross
            const totalDed = deductionsList.reduce((s, d) => s + d.amount, 0)
            const net = gross - totalDed
            return { ...m, earnings, deductionsList, gross, deductions: totalDed, net, source: 'edited' as const }
          }),
        }
      })
      return reprojectEmployment(updated, empId)
    })
    setOverrideKey(null)
    setOverrideValue('')
  }

  // Open the manual entry form pre-filled with the month's current breakdown so the user can edit it.
  const startEditBreakdown = (employmentId: string, monthKey: string) => {
    const md = getMonthData(employmentId, monthKey)
    if (!md) return
    const earningsRows = (md.earnings && md.earnings.length > 0)
      ? md.earnings.map(e => ({ label: e.label, amount: String(e.amount) }))
      : [{ label: 'Gross Salary', amount: String(md.gross) }]
    const dedRows = (md.deductionsList && md.deductionsList.length > 0)
      ? md.deductionsList.map(d => ({ label: d.label, amount: String(d.amount) }))
      : [{ label: 'Deductions', amount: String(md.deductions) }]
    setManualEarnings(earningsRows)
    setManualDeductions(dedRows)
    setManualMonthKey(monthKey)
    setManualOpenEmpId(employmentId)
    setExpandedEmployment(employmentId)
    setPreviewMonth(null)
    setPreviewEmploymentId(null)
    setManualError(null)
  }

  // Manually enter a salary breakdown for a month — no slip needed.
  // Gross = sum of earnings, Net = gross - sum of deductions. Persisted as 'edited'.
  const submitManualEntry = (employmentId: string) => {
    setManualError(null)
    if (!manualMonthKey) { setManualError('Pick a month'); return }

    const earnings = manualEarnings
      .map(r => ({ label: r.label.trim(), amount: Math.round(parseFloat(r.amount) || 0) }))
      .filter(r => r.label && r.amount > 0)
    const deductionsList = manualDeductions
      .map(r => ({ label: r.label.trim(), amount: Math.round(parseFloat(r.amount) || 0) }))
      .filter(r => r.label && r.amount > 0)

    if (earnings.length === 0) { setManualError('Add at least one earning'); return }

    const gross = earnings.reduce((s, e) => s + e.amount, 0)
    const totalDed = deductionsList.reduce((s, d) => s + d.amount, 0)
    if (totalDed > gross) { setManualError('Deductions exceed gross — check the amounts'); return }
    const net = gross - totalDed

    const emp = employments.find(e => e.id === employmentId)
    if (!emp) return
    const existing = emp.months.find(m => m.monthKey === manualMonthKey)
    if (existing && (existing.source === 'actual' || existing.source === 'edited')) {
      if (!window.confirm(`A slip already exists for ${monthLabel(manualMonthKey)}. Replace it?`)) return
    }

    setEmployments(prev => prev.map(e => {
      if (e.id !== employmentId) return e
      return {
        ...e,
        months: e.months.map(m => m.monthKey === manualMonthKey
          ? { ...m, gross, net, deductions: totalDed, source: 'edited' as const, earnings, deductionsList }
          : m),
      }
    }))

    const savedMonth = manualMonthKey
    setManualMonthKey('')
    setManualEarnings([{ label: 'Basic', amount: '' }, { label: 'HRA', amount: '' }])
    setManualDeductions([{ label: 'PF', amount: '' }, { label: 'TDS', amount: '' }])
    setManualOpenEmpId(null)

    // Auto-open the breakdown for the just-saved month.
    setPreviewEmploymentId(employmentId)
    setPreviewMonth(savedMonth)
    setPreviewOpenEmpId(employmentId)
  }

  // Parse a slip file and apply it to a specific month within an employment.
  // Confirms before overwriting an existing 'actual' or 'edited' month, and
  // catches mismatches where the slip's printed month/year doesn't match the
  // selected timeline cell — offers to re-target to the slip's actual month.
  const uploadMonthlySlip = async (employmentId: string, selectedMonthKey: string, file: File) => {
    setMonthUploadError(null)
    const emp = employments.find(e => e.id === employmentId)
    if (!emp) return

    setMonthUploadBusy(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string) || '').split(',')[1])
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/parse-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: base64, mediaType: file.type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Parse failed')
      const parsed = Array.isArray(json?.data) ? json.data[0] : null
      if (!parsed) throw new Error('No slip data returned')

      // Identity check: warn if this slip doesn't look like the same person who uploaded earlier.
      const seeded = seedIfMissing(parsed)
      if (!seeded) {
        const check = verifyIdentity(parsed)
        if (!check.ok) {
          const proceed = window.confirm(
            `This slip may belong to someone else:\n\n` +
            check.mismatches.map(m => `• ${m}`).join('\n') +
            `\n\nUpload only your own salary slips. Continue anyway?`
          )
          if (!proceed) {
            setMonthUploadError('Upload cancelled — identity mismatch.')
            return
          }
        } else if (check.enriched) {
          setStoredIdentity(check.enriched)
        }
      }

      // Detect the slip's printed month/year and compare with the user's selection.
      const parsedMonthNum = parsed.month ? monthToNum(parsed.month) : 0
      const parsedYearNum = parsed.year ? parseInt(String(parsed.year)) : 0
      const parsedKey = parsedMonthNum && parsedYearNum
        ? `${parsedYearNum}-${String(parsedMonthNum).padStart(2, '0')}`
        : null

      let monthKey = selectedMonthKey
      if (parsedKey && parsedKey !== selectedMonthKey) {
        const useParsed = window.confirm(
          `This slip looks like it's for ${monthLabel(parsedKey)}, ` +
          `but you selected ${monthLabel(selectedMonthKey)}.\n\n` +
          `Click OK to attach it to ${monthLabel(parsedKey)} instead, ` +
          `or Cancel to abort the upload.`
        )
        if (!useParsed) {
          setMonthUploadError(`Upload cancelled — slip month did not match selection.`)
          return
        }
        if (parsedKey < emp.fromMonth || parsedKey > emp.toMonth) {
          setMonthUploadError(
            `Slip is for ${monthLabel(parsedKey)}, which is outside this employment's range ` +
            `(${monthLabel(emp.fromMonth)} → ${monthLabel(emp.toMonth)}). ` +
            `Use the correct employment, or pick a month inside this range.`
          )
          return
        }
        monthKey = parsedKey
      }

      // Now confirm overwrite of an actual/edited month (using the resolved monthKey).
      const existing = emp.months.find(m => m.monthKey === monthKey)
      if (existing && (existing.source === 'actual' || existing.source === 'edited')) {
        const ok = window.confirm(`A slip already exists for ${monthLabel(monthKey)}. Replace it?`)
        if (!ok) return
      }

      const gross = parsed.grossSalary || parsed.basicSalary || 0
      const net = parsed.netSalary || parsed.basicSalary || 0
      const earnings = (parsed.components || []).filter((c: any) => c.type === 'earning')
      const deductionsList = (parsed.components || []).filter((c: any) => c.type === 'deduction')

      // Frequency conflict check (v6 §5.4): if an incoming earning matches a label
      // already marked one-time in another month of this employment, prompt the user.
      const conflicts: { label: string; otherMonth: string }[] = []
      for (const ne of earnings) {
        if (!ne.label) continue
        for (const m of emp.months) {
          if (m.monthKey === monthKey) continue
          for (const oe of m.earnings || []) {
            if (oe.label?.toLowerCase() === ne.label.toLowerCase() && resolveFrequency(oe) === 'one_time') {
              conflicts.push({ label: ne.label, otherMonth: m.monthKey })
            }
          }
        }
      }
      if (conflicts.length > 0) {
        const summary = conflicts.slice(0, 3).map(c => `• "${c.label}" was marked One-Time in ${monthLabel(c.otherMonth)}`).join('\n')
        const keepBoth = window.confirm(
          `Frequency conflict:\n\n${summary}\n\n` +
          `OK = count both months (will un-mark as one-time).\n` +
          `Cancel = ignore the new occurrence, keep the prior one-time tag.`
        )
        if (!keepBoth) {
          // Drop the conflicting earnings from this slip's incoming list.
          const drop = new Set(conflicts.map(c => c.label.toLowerCase()))
          for (let i = earnings.length - 1; i >= 0; i--) {
            if (drop.has(earnings[i].label?.toLowerCase())) earnings.splice(i, 1)
          }
        } else {
          // Promote prior one-time entries with the same label to monthly.
          const labels = new Set(conflicts.map(c => c.label.toLowerCase()))
          setEmployments(prev => prev.map(e2 => e2.id !== employmentId ? e2 : {
            ...e2,
            months: e2.months.map(m => ({
              ...m,
              earnings: (m.earnings || []).map(oe =>
                labels.has(oe.label?.toLowerCase() || '') ? { ...oe, frequency: 'monthly' as Frequency } : oe
              ),
            })),
          }))
        }
      }

      setEmployments(prev => prev.map(e => {
        if (e.id !== employmentId) return e
        return {
          ...e,
          months: e.months.map(m => m.monthKey === monthKey
            ? { ...m, gross, net, deductions: gross - net, source: 'actual' as const, earnings, deductionsList }
            : m),
        }
      }))

      // Persist into the slips list with the slip's true month/year (resolved monthKey).
      const [y, mm] = monthKey.split('-')
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const slipShape = { ...parsed, month: monthNames[parseInt(mm) - 1], year: y }
      setSlips(prev => {
        const filtered = prev.filter(s => `${s.year}-${String(monthToNum(s.month)).padStart(2, '0')}` !== monthKey)
        const next = [...filtered, slipShape]
        try { localStorage.setItem('av_salary_timeline', JSON.stringify(next)) } catch {}
        return next
      })

      setMonthUploadFile(null)
      setMonthUploadKey('')
      setMonthUploadEmpId(null)

      // Auto-open the breakdown for the just-uploaded month so user can verify.
      setPreviewEmploymentId(employmentId)
      setPreviewMonth(monthKey)
      setPreviewOpenEmpId(employmentId)
    } catch (e: any) {
      setMonthUploadError(e?.message || 'Upload failed')
    } finally {
      setMonthUploadBusy(false)
    }
  }

  // annualGross is memoized at the top via extractAnnualGross(employments).
  const annualNet = useMemo(
    () => employments.reduce((total, emp) => total + emp.months.reduce((sum, m) => sum + m.net, 0), 0),
    [employments],
  )

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

        {wizardStep === 'intent-pick' && (() => {
          const slipCount = slips.length
          const intents: { id: Intent; title: string; desc: string }[] = [
            { id: 'validate', title: 'Validate — I want to understand my full-year tax liability', desc: `I uploaded ${slipCount} slip(s). Show me how much tax I paid/owe given my complete salary + other income + deductions.` },
            { id: 'forecast', title: 'Forecast — I expect salary changes (increment / job switch)', desc: 'Show me the impact if my salary changes (increment, bonus timing, new employer).' },
          ]
          const pickIntent = (id: Intent) => {
            setWizard(prev => ({ ...prev, intent: id }))
            if (id === 'validate') setWizardStep('validate-q1')
            else setWizardStep('step1')   // existing increment wizard powers Forecast
          }
          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>What do you want to do?</h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Pick the path that matches your situation. We'll only ask the questions relevant to it.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {intents.map(it => (
                  <button
                    key={it.id}
                    onClick={() => pickIntent(it.id)}
                    style={{ textAlign: 'left', padding: 16, background: wizard.intent === it.id ? C.wl : '#fff', border: `1px solid ${wizard.intent === it.id ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>{it.title}</p>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{it.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── Validate flow (Q1–Q6 per v6) — small reusable building blocks ── */}
        {(['validate-q1','validate-q2','validate-q3','validate-q4','validate-q5','validate-q6'] as const).includes(wizardStep as any) && (() => {
          const yes = (v: any) => v === true || v === 'yes'
          const no  = (v: any) => v === false || v === 'no'

          const PrevBack = (toStep: WizardStep) => (
            <button onClick={() => setWizardStep(toStep)} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
          )
          const NextBtn = (disabled: boolean, onClick: () => void, label = 'Next →') => (
            <button disabled={disabled} onClick={onClick} style={{ flex: 1, padding: '12px', background: disabled ? '#ccc' : C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit' }}>{label}</button>
          )
          const StepShell = ({ qNum, title, sub, children, footer }: { qNum: number; title: string; sub?: string; children: React.ReactNode; footer: React.ReactNode }) => (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <p style={{ fontSize: 11, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Validate · Q{qNum} of 6</p>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>{title}</h2>
              {sub ? <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>{sub}</p> : null}
              <div style={{ marginBottom: 16 }}>{children}</div>
              <div style={{ display: 'flex', gap: 12 }}>{footer}</div>
            </div>
          )

          const YesNo = (val: boolean | null, set: (v: boolean) => void) => (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => set(true)} style={{ padding: 14, background: val === true ? C.wl : '#fff', border: `1px solid ${val === true ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: C.text }}>Yes</button>
              <button onClick={() => set(false)} style={{ padding: 14, background: val === false ? C.wl : '#fff', border: `1px solid ${val === false ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: C.text }}>No</button>
            </div>
          )

          if (wizardStep === 'validate-q1') {
            return (
              <StepShell
                qNum={1}
                title="Do you have complete salary data for the full FY?"
                sub={`Apr ${fyStartYear} – Mar ${fyStartYear + 1}. You've uploaded ${slips.length} slip(s).`}
                footer={<>
                  {PrevBack('intent-pick')}
                  {NextBtn(wizard.validateCompleteData === null, () => {
                    if (wizard.validateCompleteData) {
                      // Complete data: skip remaining questions, build directly
                      setWizard(prev => ({ ...prev, employmentChanges: 0 }))
                      buildEmploymentsFromWizard()
                      setWizardStep('review')
                    } else {
                      setWizardStep('validate-q2')
                    }
                  }, wizard.validateCompleteData ? 'Build timeline →' : 'Next →')}
                </>}
              >
                {YesNo(wizard.validateCompleteData, v => setWizard(prev => ({ ...prev, validateCompleteData: v })))}
              </StepShell>
            )
          }

          if (wizardStep === 'validate-q2') {
            return (
              <StepShell
                qNum={2}
                title="Did your salary stay the same throughout the year?"
                sub="If yes, we'll use your uploaded slip as the representative month and repeat it for the full FY."
                footer={<>
                  {PrevBack('validate-q1')}
                  {NextBtn(!wizard.validateSameAllYear, () => setWizardStep('validate-q3'))}
                </>}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(['yes','no','partial'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setWizard(prev => ({ ...prev, validateSameAllYear: opt }))}
                      style={{ textAlign: 'left', padding: 14, background: wizard.validateSameAllYear === opt ? C.wl : '#fff', border: `1px solid ${wizard.validateSameAllYear === opt ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                    >
                      {opt === 'yes' ? 'Yes — same all 12 months' : opt === 'no' ? 'No — salary changed mid-year' : 'Partial — same most months, a few exceptions'}
                    </button>
                  ))}
                </div>
              </StepShell>
            )
          }

          if (wizardStep === 'validate-q3') {
            const allFY = fyMonths(fyStartYear)
            return (
              <StepShell
                qNum={3}
                title="Did you change employers during this FY?"
                footer={<>
                  {PrevBack('validate-q2')}
                  {NextBtn(wizard.validateChangedEmployer === null || (yes(wizard.validateChangedEmployer) && !wizard.changeMonth), () => {
                    setWizard(prev => ({ ...prev, employmentChanges: wizard.validateChangedEmployer ? 1 : 0 }))
                    setWizardStep('validate-q4')
                  })}
                </>}
              >
                {YesNo(wizard.validateChangedEmployer, v => setWizard(prev => ({ ...prev, validateChangedEmployer: v, changeMonth: v ? prev.changeMonth : '' })))}
                {yes(wizard.validateChangedEmployer) && (
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>Which month did you join the new employer?</label>
                    <select value={wizard.changeMonth} onChange={e => setWizard(prev => ({ ...prev, changeMonth: e.target.value }))} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: C.text }}>
                      <option value="">Select month…</option>
                      {allFY.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
                    </select>
                  </div>
                )}
              </StepShell>
            )
          }

          if (wizardStep === 'validate-q4') {
            const allFY = fyMonths(fyStartYear)
            return (
              <StepShell
                qNum={4}
                title="Did you receive a salary increment?"
                footer={<>
                  {PrevBack('validate-q3')}
                  {NextBtn(wizard.validateHadIncrement === null, () => setWizardStep('validate-q5'))}
                </>}
              >
                {YesNo(wizard.validateHadIncrement, v => setWizard(prev => ({ ...prev, validateHadIncrement: v, employer1IncrementMonth: v ? prev.employer1IncrementMonth : '', employer1IncrementPercent: v ? prev.employer1IncrementPercent : 0 })))}
                {yes(wizard.validateHadIncrement) && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>From which month?</label>
                      <select value={wizard.employer1IncrementMonth} onChange={e => setWizard(prev => ({ ...prev, employer1IncrementMonth: e.target.value }))} style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: C.text }}>
                        <option value="">Month…</option>
                        {allFY.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>By how much (%)?</label>
                      <input type="number" value={wizard.employer1IncrementPercent || ''} onChange={e => setWizard(prev => ({ ...prev, employer1IncrementPercent: parseFloat(e.target.value) || 0 }))} placeholder="e.g. 10" style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: C.text }} />
                    </div>
                    <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.text }}>
                      <input type="checkbox" checked={wizard.employer1Retroactive} onChange={e => setWizard(prev => ({ ...prev, employer1Retroactive: e.target.checked }))} />
                      Retroactive — applies from Apr onwards (arrears paid in increment month)
                    </label>
                  </div>
                )}
              </StepShell>
            )
          }

          if (wizardStep === 'validate-q5') {
            const allFY = fyMonths(fyStartYear)
            const toggleMonth = (mk: string) => setWizard(prev => ({
              ...prev,
              validateFreelanceMonths: prev.validateFreelanceMonths.includes(mk) ? prev.validateFreelanceMonths.filter(m => m !== mk) : [...prev.validateFreelanceMonths, mk]
            }))
            return (
              <StepShell
                qNum={5}
                title="Were you freelancing or had a gap before/during employment?"
                sub="Tick the months. Freelance income belongs in the Other Income tab — we'll note these months for you."
                footer={<>
                  {PrevBack('validate-q4')}
                  {NextBtn(false, () => setWizardStep('validate-q6'))}
                </>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                  {allFY.map(mk => {
                    const on = wizard.validateFreelanceMonths.includes(mk)
                    return (
                      <button key={mk} onClick={() => toggleMonth(mk)} style={{ padding: '8px 4px', background: on ? C.wm : '#fff', color: on ? '#fff' : C.text, border: `1px solid ${on ? C.wm : C.border}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>
                        {monthLabel(mk).split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: 'center' }}>None selected = continuous salaried employment.</p>
              </StepShell>
            )
          }

          if (wizardStep === 'validate-q6') {
            const allFY = fyMonths(fyStartYear)
            const toggleMonth = (mk: string) => setWizard(prev => ({
              ...prev,
              validateBonusMonths: prev.validateBonusMonths.includes(mk) ? prev.validateBonusMonths.filter(m => m !== mk) : [...prev.validateBonusMonths, mk]
            }))
            return (
              <StepShell
                qNum={6}
                title="Any bonuses or one-time payments?"
                sub="Tick the months with bonuses. You can upload those specific slips after we build the timeline."
                footer={<>
                  {PrevBack('validate-q5')}
                  {NextBtn(false, () => {
                    buildEmploymentsFromWizard()
                    setWizardStep('review')
                  }, 'Build timeline →')}
                </>}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                  {allFY.map(mk => {
                    const on = wizard.validateBonusMonths.includes(mk)
                    return (
                      <button key={mk} onClick={() => toggleMonth(mk)} style={{ padding: '8px 4px', background: on ? C.wm : '#fff', color: on ? '#fff' : C.text, border: `1px solid ${on ? C.wm : C.border}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>
                        {monthLabel(mk).split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
              </StepShell>
            )
          }

          return null
        })()}

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

                  {/* Earnings — each row has an inline Override */}
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Earnings</h3>
                    <div style={{ background: C.wl, borderRadius: 6, overflow: 'hidden' }}>
                      {(md.earnings && md.earnings.length > 0 ? md.earnings : [{ label: 'Gross Salary', amount: md.gross }]).map((e, i, arr) => {
                        const isEditing = overrideKey?.empId === previewEmploymentId && overrideKey?.monthKey === previewMonth && overrideKey?.kind === 'earning' && overrideKey?.index === i
                        const canOverride = !!(md.earnings && md.earnings.length > 0)
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', gap: 10 }}>
                            <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{e.label}</span>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input type="number" value={overrideValue} onChange={ev => setOverrideValue(ev.target.value)} autoFocus style={{ width: 100, padding: '4px 8px', border: `1px solid ${C.fg}`, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', color: C.text }} />
                                <button onClick={saveOverride} style={{ padding: '4px 10px', background: C.fg, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                                <button onClick={() => { setOverrideKey(null); setOverrideValue('') }} style={{ padding: '4px 8px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{fmt(e.amount)}</span>
                                {canOverride && (() => {
                                  const freq: Frequency = resolveFrequency(e)
                                  return (
                                    <select
                                      value={freq}
                                      onChange={ev => setEarningFrequency(previewEmploymentId!, previewMonth!, i, ev.target.value as Frequency)}
                                      title={`Frequency: ${freq}. Monthly carries forward to all months; others apply only when paid.`}
                                      style={{
                                        padding: '3px 6px',
                                        background: freq === 'monthly' ? '#E8F2EC' : '#FFF1E0',
                                        color: freq === 'monthly' ? '#2A7A4A' : '#A14B12',
                                        border: `1px solid ${freq === 'monthly' ? '#B8D9C4' : '#F0C18A'}`,
                                        borderRadius: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                                      }}
                                    >
                                      {FREQUENCY_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                    </select>
                                  )
                                })()}
                                {canOverride && (
                                  <button
                                    onClick={() => {
                                      setOverrideKey({ empId: previewEmploymentId!, monthKey: previewMonth!, kind: 'earning', index: i })
                                      setOverrideValue(String(e.amount))
                                    }}
                                    style={{ padding: '3px 8px', background: '#E07B3A', color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                                  >
                                    Override
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.wl, fontWeight: 600, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, color: C.fg }}>Total Earnings</span>
                        <span style={{ fontSize: 12, color: C.fg }}>{fmt(md.gross)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions — each row has an inline Override */}
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: '0 0 12px' }}>Deductions</h3>
                    <div style={{ background: '#FBF0F0', borderRadius: 6, overflow: 'hidden' }}>
                      {(md.deductionsList && md.deductionsList.length > 0 ? md.deductionsList : [{ label: 'Deductions', amount: md.deductions }]).map((d, i, arr) => {
                        const isEditing = overrideKey?.empId === previewEmploymentId && overrideKey?.monthKey === previewMonth && overrideKey?.kind === 'deduction' && overrideKey?.index === i
                        const canOverride = !!(md.deductionsList && md.deductionsList.length > 0)
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', gap: 10 }}>
                            <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{d.label}</span>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input type="number" value={overrideValue} onChange={ev => setOverrideValue(ev.target.value)} autoFocus style={{ width: 100, padding: '4px 8px', border: `1px solid ${C.fg}`, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', color: C.text }} />
                                <button onClick={saveOverride} style={{ padding: '4px 10px', background: C.fg, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                                <button onClick={() => { setOverrideKey(null); setOverrideValue('') }} style={{ padding: '4px 8px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.danger }}>−{fmt(d.amount)}</span>
                                {canOverride && (
                                  <button
                                    onClick={() => {
                                      setOverrideKey({ empId: previewEmploymentId!, monthKey: previewMonth!, kind: 'deduction', index: i })
                                      setOverrideValue(String(d.amount))
                                    }}
                                    style={{ padding: '3px 8px', background: '#E07B3A', color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                                  >
                                    Override
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
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

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => previewEmploymentId && previewMonth && startEditBreakdown(previewEmploymentId, previewMonth)}
                style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.fg}`, borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Edit breakdown
              </button>
              <button
                onClick={() => setPreviewMonth(null)}
                style={{ flex: 1, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Close
              </button>
            </div>
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
                {/* Per-month slip upload */}
                <div style={{ marginBottom: 16, padding: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 8px', textTransform: 'uppercase' }}>Upload monthly slip</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={monthUploadEmpId === emp.id ? monthUploadKey : ''}
                      onChange={(e) => { setMonthUploadEmpId(emp.id); setMonthUploadKey(e.target.value); setMonthUploadError(null) }}
                      disabled={monthUploadBusy}
                      style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fff', color: C.text, minWidth: 140 }}
                    >
                      <option value="">Select month…</option>
                      {emp.months
                        .filter(m => m.monthKey >= emp.fromMonth && m.monthKey <= emp.toMonth)
                        .map(m => (
                          <option key={m.monthKey} value={m.monthKey}>
                            {monthLabel(m.monthKey)}{m.source === 'actual' ? ' (uploaded)' : m.source === 'edited' ? ' (edited)' : ''}
                          </option>
                        ))}
                    </select>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      disabled={monthUploadBusy || (monthUploadEmpId === emp.id ? !monthUploadKey : true)}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        setMonthUploadFile(f)
                        if (f && monthUploadEmpId === emp.id && monthUploadKey) {
                          uploadMonthlySlip(emp.id, monthUploadKey, f)
                          e.target.value = ''
                        }
                      }}
                      style={{ fontSize: 12, fontFamily: 'inherit', color: C.text }}
                    />
                    {monthUploadBusy && monthUploadEmpId === emp.id && (
                      <span style={{ fontSize: 11, color: C.muted }}>Parsing…</span>
                    )}
                  </div>
                  {monthUploadError && monthUploadEmpId === emp.id && (
                    <p style={{ fontSize: 11, color: C.danger, margin: '8px 0 0' }}>{monthUploadError}</p>
                  )}

                  {/* Manual entry — no slip needed */}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                    <button
                      onClick={() => {
                        setManualOpenEmpId(manualOpenEmpId === emp.id ? null : emp.id)
                        setManualError(null)
                      }}
                      style={{ background: 'transparent', border: 'none', color: C.fg, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                    >
                      {manualOpenEmpId === emp.id ? '− Hide manual entry' : '+ Add manually (no slip)'}
                    </button>
                    {manualOpenEmpId === emp.id && (() => {
                      // Live totals from current row state
                      const liveGross = manualEarnings.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                      const liveDed = manualDeductions.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                      const liveNet = liveGross - liveDed
                      return (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Month</label>
                            <select
                              value={manualMonthKey}
                              onChange={(e) => { setManualMonthKey(e.target.value); setManualError(null) }}
                              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fff', color: C.text }}
                            >
                              <option value="">Select month…</option>
                              {emp.months
                                .filter(m => m.monthKey >= emp.fromMonth && m.monthKey <= emp.toMonth)
                                .map(m => (
                                  <option key={m.monthKey} value={m.monthKey}>
                                    {monthLabel(m.monthKey)}{m.source === 'actual' ? ' (uploaded)' : m.source === 'edited' ? ' (edited)' : ''}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {/* Earnings editor */}
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Earnings</p>
                              {manualEarnings.map((row, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 4, marginBottom: 4 }}>
                                  <input
                                    type="text"
                                    placeholder="Label (e.g. HRA)"
                                    value={row.label}
                                    onChange={(e) => setManualEarnings(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                                    style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text }}
                                  />
                                  <input
                                    type="number"
                                    placeholder="Amount"
                                    value={row.amount}
                                    onChange={(e) => setManualEarnings(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                                    style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text }}
                                  />
                                  <button
                                    onClick={() => setManualEarnings(prev => prev.filter((_, j) => j !== i))}
                                    title="Remove"
                                    style={{ padding: '0 8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}
                                  >×</button>
                                </div>
                              ))}
                              <button
                                onClick={() => setManualEarnings(prev => [...prev, { label: '', amount: '' }])}
                                style={{ marginTop: 4, padding: '4px 8px', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4, fontSize: 10.5, color: C.fg, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                              >+ Add earning</button>
                            </div>

                            {/* Deductions editor */}
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Deductions</p>
                              {manualDeductions.map((row, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 4, marginBottom: 4 }}>
                                  <input
                                    type="text"
                                    placeholder="Label (e.g. PF)"
                                    value={row.label}
                                    onChange={(e) => setManualDeductions(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                                    style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text }}
                                  />
                                  <input
                                    type="number"
                                    placeholder="Amount"
                                    value={row.amount}
                                    onChange={(e) => setManualDeductions(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                                    style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text }}
                                  />
                                  <button
                                    onClick={() => setManualDeductions(prev => prev.filter((_, j) => j !== i))}
                                    title="Remove"
                                    style={{ padding: '0 8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}
                                  >×</button>
                                </div>
                              ))}
                              <button
                                onClick={() => setManualDeductions(prev => [...prev, { label: '', amount: '' }])}
                                style={{ marginTop: 4, padding: '4px 8px', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4, fontSize: 10.5, color: C.fg, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
                              >+ Add deduction</button>
                            </div>
                          </div>

                          {/* Live preview totals */}
                          <div style={{ marginTop: 10, padding: 10, background: C.wl, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            <div>
                              <p style={{ fontSize: 10, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Gross</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(liveGross)}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Deductions</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: C.danger, margin: 0 }}>−{fmt(liveDed)}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Net</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: '#2A7A4A', margin: 0 }}>{fmt(liveNet)}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => submitManualEntry(emp.id)}
                            style={{ marginTop: 10, width: '100%', padding: '10px 14px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Save breakdown
                          </button>
                        </div>
                      )
                    })()}
                    {manualError && manualOpenEmpId === emp.id && (
                      <p style={{ fontSize: 11, color: C.danger, margin: '8px 0 0' }}>{manualError}</p>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 12px', textTransform: 'uppercase' }}>Timeline · click to view/edit</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 8, marginBottom: 12 }}>
                    {emp.months.map(m => {
                      // Forecast intent: projected cells get the dashed-border 🔮 treatment per v6.
                      const isForecastCell = wizard.intent === 'forecast' && m.source === 'projected' && m.gross > 0
                      const bg = m.source === 'actual' ? C.fg : m.source === 'edited' ? C.wm : C.border
                      const fg = m.source === 'actual' || m.source === 'edited' ? '#fff' : C.muted
                      const icon = isForecastCell ? '🔮' : m.source === 'actual' ? '●' : m.source === 'edited' ? '✎' : '○'
                      const anomaly = anomalyByMonth.get(m.monthKey)
                      const cellBorder = anomaly
                        ? `2px solid #E07B3A`
                        : isForecastCell ? `2px dashed ${C.fg}` : 'none'

                      return (
                        <button
                          key={m.monthKey}
                          onClick={() => {
                            setPreviewMonth(m.monthKey)
                            setPreviewEmploymentId(emp.id)
                          }}
                          title={anomaly?.message || (isForecastCell ? 'Forecast — based on your scenario' : undefined)}
                          style={{ position: 'relative', background: bg, color: fg, border: cellBorder, borderRadius: 4, padding: '12px 4px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        >
                          {anomaly && (
                            <span style={{ position: 'absolute', top: -6, right: -4, background: '#E07B3A', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>!</span>
                          )}
                          <div style={{ fontSize: 9 }}>{monthLabel(m.monthKey).split(' ')[0]}</div>
                          <div style={{ fontSize: 11 }}>{icon}</div>
                          <div style={{ fontSize: 8, opacity: 0.8 }}>{fmt(m.gross)}</div>
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: C.muted, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.fg, marginRight: 4 }} />Actual</span>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.wm, marginRight: 4 }} />Edited</span>
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.border, marginRight: 4 }} />Assumed</span>
                    {wizard.intent === 'forecast' && (
                      <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, border: `1px dashed ${C.fg}`, marginRight: 4 }} />Forecast</span>
                    )}
                    <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#E07B3A', marginRight: 4 }} />Anomaly</span>
                  </div>

                  <button onClick={() => { setEditEmploymentId(emp.id); setEditingMonth(emp.months[0].monthKey); setEditGross(emp.months[0].gross); setEditNet(emp.months[0].net) }} style={{ width: '100%', padding: '10px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Edit any month</button>
                </div>

                {/* Inline preview panel — collapsible, mirrors the click-modal but in-page */}
                <div style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                  <button
                    onClick={() => setPreviewOpenEmpId(previewOpenEmpId === emp.id ? null : emp.id)}
                    style={{ width: '100%', padding: '10px 12px', background: previewOpenEmpId === emp.id ? C.wl : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase' }}>Preview · all months</span>
                    <span style={{ fontSize: 13, color: C.fg }}>{previewOpenEmpId === emp.id ? '−' : '+'}</span>
                  </button>
                  {previewOpenEmpId === emp.id && (
                    <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, background: C.bg }}>
                      {emp.months.filter(m => m.gross > 0 || m.net > 0).length === 0 ? (
                        <p style={{ fontSize: 12, color: C.muted, margin: 0, textAlign: 'center' }}>No salary data yet — upload a slip or add manually.</p>
                      ) : (
                        emp.months.filter(m => m.gross > 0 || m.net > 0).map(m => {
                          const isOpen = previewMonth === m.monthKey && previewEmploymentId === emp.id
                          return (
                            <div key={m.monthKey} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
                              <button
                                onClick={() => {
                                  if (isOpen) { setPreviewMonth(null); setPreviewEmploymentId(null) }
                                  else { setPreviewMonth(m.monthKey); setPreviewEmploymentId(emp.id) }
                                }}
                                style={{ width: '100%', padding: '10px 12px', background: isOpen ? C.wl : '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{monthLabel(m.monthKey)}</span>
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: m.source === 'actual' ? C.fg : m.source === 'edited' ? C.wm : C.border, color: m.source === 'projected' ? C.muted : '#fff' }}>{m.source}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, color: C.muted }}>Gross <strong style={{ color: C.fg }}>{fmt(m.gross)}</strong></span>
                                  <span style={{ fontSize: 11, color: C.muted }}>Net <strong style={{ color: '#2A7A4A' }}>{fmt(m.net)}</strong></span>
                                  <span style={{ fontSize: 13, color: C.fg }}>{isOpen ? '−' : '+'}</span>
                                </div>
                              </button>
                              {isOpen && (
                                <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                  <div>
                                    <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Earnings</p>
                                    <div style={{ background: C.wl, borderRadius: 4 }}>
                                      {(m.earnings && m.earnings.length > 0 ? m.earnings : [{ label: 'Gross', amount: m.gross }]).map((e, i, arr) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 11 }}>
                                          <span style={{ color: C.text }}>{e.label}</span>
                                          <span style={{ fontWeight: 600, color: C.fg }}>{fmt(e.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Deductions</p>
                                    <div style={{ background: '#FBF0F0', borderRadius: 4 }}>
                                      {(m.deductionsList && m.deductionsList.length > 0 ? m.deductionsList : [{ label: 'Deductions', amount: m.deductions }]).map((d, i, arr) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 11 }}>
                                          <span style={{ color: C.text }}>{d.label}</span>
                                          <span style={{ fontWeight: 600, color: C.danger }}>−{fmt(d.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
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

      {/* ── Forecast scenarios (v6 §Intent B) — Baseline / Non-retro / Retro side by side. */}
      {wizard.intent === 'forecast' && annualGross > 0 && (() => {
        // Use the first actual/edited month in the first employment as the "current" baseline.
        const firstEmp = employments[0]
        if (!firstEmp) return null
        const baseMonth = firstEmp.months.find(m => m.source === 'actual' || m.source === 'edited')
        if (!baseMonth) return null
        const baseGross = baseMonth.gross
        const baseTDSPerMonth = (baseMonth.deductionsList || []).filter(d => /\b(tds|income\s*tax|i\.?t)\b/i.test(d.label)).reduce((s, d) => s + (d.amount || 0), 0)
        const pct = wizard.employer1IncrementPercent || 0
        const incrementMonth = wizard.employer1IncrementMonth
        const allFY = fyMonths(fyStartYear)
        // Find N = number of months before the increment month
        const incrementIdx = incrementMonth ? allFY.indexOf(incrementMonth) : -1
        const monthsBefore = incrementIdx > 0 ? incrementIdx : 0
        const monthsAfter = incrementIdx > 0 ? (12 - incrementIdx) : 12
        const newGross = Math.round(baseGross * (1 + pct / 100))
        const newTDS = Math.round(baseTDSPerMonth * (1 + pct / 100))

        const scenarios = [
          {
            id: 'baseline',
            name: 'Baseline (no change)',
            annualGross: baseGross * 12,
            annualTDS: baseTDSPerMonth * 12,
          },
          {
            id: 'non_retro',
            name: incrementMonth ? `Non-retro · from ${monthLabel(incrementMonth)}` : 'Non-retroactive change',
            annualGross: (baseGross * monthsBefore) + (newGross * monthsAfter),
            annualTDS: (baseTDSPerMonth * monthsBefore) + (newTDS * monthsAfter),
          },
          ...(wizard.employer1Retroactive ? [{
            id: 'retro',
            name: `Retroactive · from Apr (arrears in ${incrementMonth ? monthLabel(incrementMonth) : 'increment month'})`,
            annualGross: newGross * 12,
            annualTDS: newTDS * 12,
          }] : []),
        ]

        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: '0 0 14px' }}>Forecast scenarios</h3>
            <div style={{ background: C.bg, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 12px', background: C.wl, fontSize: 11, fontWeight: 700, color: C.fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Scenario</span>
                <span style={{ textAlign: 'right' }}>Annual Gross</span>
                <span style={{ textAlign: 'right' }}>Annual TDS</span>
              </div>
              {scenarios.map((s, i) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 12px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`, fontSize: 12, color: C.text }}>
                  <span>{s.name}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: C.fg }}>{fmt(s.annualGross)}</span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: C.fg }}>{fmt(s.annualTDS)}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.muted, margin: '12px 0 0', textAlign: 'center' }}>
              Scenarios derived from baseline slip × increment of {pct}%. Final tax liability is computed in Tax Summary.
            </p>
          </div>
        )
      })()}

      {/* ── Validation guards (v6 §4.1 / §9) ──────────────────────────────── */}
      {annualGross > 0 && (() => {
        const warnings: string[] = []
        // 1) Identical-all-months check
        const monthlyTotals = employments.flatMap(e => e.months.filter(m => m.monthKey >= e.fromMonth && m.monthKey <= e.toMonth).map(m => m.gross))
        if (monthlyTotals.length >= 12 && new Set(monthlyTotals).size === 1 && monthlyTotals[0] > 0) {
          warnings.push('All 12 months show the same gross — is this actual data or an estimate?')
        }
        // 2) TDS reasonableness
        if (annualGross > 0) {
          const tdsRate = annualTDS / annualGross
          if (tdsRate > 0 && (tdsRate < 0.08 || tdsRate > 0.30)) {
            warnings.push(`TDS is ${Math.round(tdsRate * 100)}% of gross — outside the typical 8–30% range. Please verify the slips.`)
          }
        }
        // 3) <3 months actual data
        let actualCount = 0
        for (const emp of employments) for (const m of emp.months) {
          if (m.monthKey >= emp.fromMonth && m.monthKey <= emp.toMonth && (m.source === 'actual' || m.source === 'edited')) actualCount++
        }
        if (actualCount < 3) warnings.push(`Only ${actualCount} month(s) of actual data — projections may be less accurate. Consider uploading more slips.`)
        if (warnings.length === 0) return null
        return (
          <div style={{ background: '#FFF1E0', border: `1px solid #F0C18A`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#A14B12', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ Please verify</p>
            {warnings.map((w, i) => (
              <p key={i} style={{ fontSize: 12, color: C.text, margin: i === 0 ? 0 : '4px 0 0', lineHeight: 1.4 }}>• {w}</p>
            ))}
          </div>
        )
      })()}

      {/* ── Salary Summary (PRD v6) — NO tax math, NO confidence. Just totals + routing message. */}
      {annualGross > 0 && (() => {
        // Aggregate components across all months for the breakdown table.
        const compTotals = new Map<string, number>()
        for (const emp of employments) {
          for (const m of emp.months) {
            if (m.monthKey < emp.fromMonth || m.monthKey > emp.toMonth) continue
            for (const e of m.earnings || []) {
              compTotals.set(e.label, (compTotals.get(e.label) || 0) + (e.amount || 0))
            }
          }
        }
        const topComponents = Array.from(compTotals.entries())
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)

        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: '0 0 14px' }}>Salary Summary</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ padding: 12, background: C.bg, borderRadius: 6 }}>
                <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase' }}>Annual Gross</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(annualGross)}</p>
              </div>
              <div style={{ padding: 12, background: C.bg, borderRadius: 6 }}>
                <p style={{ fontSize: 10, color: C.muted, margin: '0 0 4px', textTransform: 'uppercase' }}>TDS Paid (from slips)</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(annualTDS)}</p>
              </div>
            </div>

            {topComponents.length > 0 && (
              <div style={{ background: C.bg, borderRadius: 6, padding: 12, marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 8px', textTransform: 'uppercase' }}>Components · annual</p>
                {topComponents.map(([label, total], i) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < topComponents.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 11 }}>
                    <span style={{ color: C.text }}>{label}</span>
                    <span style={{ fontWeight: 600, color: C.fg }}>{fmt(total)}</span>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 12, color: C.muted, margin: 0, padding: 12, background: C.wl, borderRadius: 6 }}>
              {wizard.intent === 'forecast'
                ? 'Your salary forecast is ready. Add your other income and deductions to see the tax impact of each scenario.'
                : 'Your salary data is ready. Now add your other income and deductions to calculate your complete tax liability in Tax Summary.'}
            </p>
          </div>
        )
      })()}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setWizardStep('intent-pick')} style={{ flex: 1, minWidth: 120, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Edit timeline</button>
        <button onClick={() => router.push('/dashboard/profile/documents')} style={{ flex: 1, minWidth: 120, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Upload more slips</button>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, minWidth: 120, padding: '12px', background: C.fg, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add Other Income →</button>
      </div>
    </div>
  )
}
