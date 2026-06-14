'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { seedIfMissing, verifyIdentity, setStoredIdentity } from '@/lib/identity'
import { confirmDialog, passwordDialog } from '@/components/Dialog'
import { estimateAnnualTax, type SeniorStatus } from '@/lib/tax-slabs'
import {
  detectAnomalies,
  extractAnnualGross,
  extractAnnualTDS,
  extractHraBasis,
  type Anomaly,
} from '@/lib/salary-analytics'

import { tokens as T } from '@/lib/tokens'

const C = { fg:T.teal, wheat:T.taupe, wl:T.sand, wm:T.taupeLine, bg:T.paper, card:T.card, border:T.hairline, text:T.ink, muted:T.muted, green:T.green, danger:'#B94040' }
const fmt = (n:number) => n === 0 ? '₹0' : `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
// Compact Indian-notation amount (K / L / Cr) for the at-a-glance timeline cell ONLY, so a long ₹
// figure can't floor a 1fr grid track wider than its share. Full precision stays one tap away in the
// per-month preview modal and the employer subtotals — never the sole place the exact number lives.
const fmtGlance = (n:number) => {
  const a = Math.abs(Math.round(n))
  if (a === 0) return '₹0'
  const trim = (x:number, d:number) => String(Number(x.toFixed(d)))   // drops trailing .0 / .x0
  if (a >= 1e7) return `₹${trim(a / 1e7, 2)}Cr`
  if (a >= 1e5) return `₹${trim(a / 1e5, 1)}L`
  if (a >= 1e3) return `₹${trim(a / 1e3, 1)}K`
  return `₹${a}`
}

// Mobile-only layout overrides (≤767px). Desktop gets no rules here, so the inline styles rule
// untouched. Class hooks are added to the timeline grid, wizard rows, accordion headers, modal,
// and the remap/bonus/manual grids.
const SAL_MOBILE_CSS = `
.sal-emp-line { display: none; }
@media (max-width: 767px) {
  .sal-timeline-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; row-gap: 6px; }
  .sal-emp-band { display: none !important; }
  .sal-emp-line { display: block !important; }
  .sal-slip-row { flex-direction: column !important; align-items: stretch !important; }
  .sal-slip-actions { margin-top: 8px; gap: 8px !important; }
  .sal-slip-grow { flex: 1 !important; }
  .sal-acc-head { flex-wrap: wrap !important; row-gap: 4px; }
  .sal-modal { padding: 16px !important; }
  .sal-remap { grid-template-columns: 1fr !important; }
  .sal-bonus { grid-template-columns: repeat(3, 1fr) !important; }
  .sal-manual { grid-template-columns: 1fr !important; }
  .sal-month-select { min-width: 0 !important; flex-basis: 100% !important; }
  .sal-annual { grid-template-columns: 1fr !important; }
}
`

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

// Best-effort parse of an offer letter's joining date into a YYYY-MM key. Handles ISO (2026-06-01),
// "June 2026" / "1 Jun 2026", and DD/MM/YYYY. Returns '' if it can't tell.
const joiningMonthKey = (s: string): string => {
  if (!s || typeof s !== 'string') return ''
  const iso = s.match(/(\d{4})[-/](\d{1,2})/)               // 2026-06 / 2026/6
  if (iso) return `${iso[1]}-${String(+iso[2]).padStart(2, '0')}`
  const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const named = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*(\d{4})/) // June 2026
  if (named) return `${named[2]}-${String(mon.indexOf(named[1]) + 1).padStart(2, '0')}`
  const dmy = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)   // DD/MM/YYYY
  if (dmy) return `${dmy[3]}-${String(+dmy[2]).padStart(2, '0')}`
  return ''
}

// Day-aware version: returns a full YYYY-MM-DD when the joining day is present, else ''. Used to set
// the calendar value and to prorate the first month of the new employment.
const joiningDateISO = (s: string): string => {
  if (!s || typeof s !== 'string') return ''
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)         // 2026-06-04
  if (iso) return `${iso[1]}-${String(+iso[2]).padStart(2, '0')}-${String(+iso[3]).padStart(2, '0')}`
  const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const named = s.toLowerCase().match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*(\d{4})/) // 4 June 2026
  if (named) return `${named[3]}-${String(mon.indexOf(named[2]) + 1).padStart(2, '0')}-${String(+named[1]).padStart(2, '0')}`
  const dmy = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)   // DD/MM/YYYY
  if (dmy) return `${dmy[3]}-${String(+dmy[2]).padStart(2, '0')}-${String(+dmy[1]).padStart(2, '0')}`
  const mk = joiningMonthKey(s)                              // month known but not the day
  return mk ? `${mk}-01` : ''
}

// Days in a calendar month for a YYYY-MM key.
const daysInMonthOf = (mk: string): number => {
  const [y, m] = mk.split('-').map(Number)
  return new Date(y, m, 0).getDate()
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
  { id: 'half_yearly', label: 'Half-yearly' },
  { id: 'yearly',      label: 'Yearly' },
  { id: 'one_time',    label: 'One-time' },
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
  // 'actual'   = uploaded slip for this exact month
  // 'inferred' = filled in from another month's slip per the confirmed pattern (v7 ◆ marker)
  // 'edited'   = user manually changed values
  // 'projected'= forecast (Forecast intent — gets the 🔮 dashed-border render)
  source: 'actual' | 'inferred' | 'edited' | 'projected'
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

// v7 §FY Inference Logic
// A slip dated YYYY-MM belongs to FY starting Apr Y-1 (if MM ≤ 3) or Apr Y (otherwise).
// Validate uses that FY directly. Forecast uses the next FY (year after the latest slip's FY).
function slipFyStartYear(year: number, monthNum: number): number {
  return monthNum >= 4 ? year : year - 1
}
function inferFyStartYear(slipDates: { year: number; monthNum: number }[], intent: Intent): number {
  if (slipDates.length === 0) return new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1
  // Use the latest slip to anchor.
  const latest = [...slipDates].sort((a, b) => (b.year - a.year) || (b.monthNum - a.monthNum))[0]
  const slipFy = slipFyStartYear(latest.year, latest.monthNum)
  // Forecast operates within the SAME FY as the uploaded slip (e.g. Apr 2026 slip → FY 2026-27),
  // not the year after. Validate also uses the slip's FY.
  return slipFy
}

// A confirmed slip-to-month-range mapping inferred from slip dates.
// Each range covers monthFrom..monthTo (inclusive, YYYY-MM string compare) and
// uses the named source slip as the salary template.
interface PeriodMapping {
  fromMonth: string
  toMonth: string
  sourceSlipId: string  // id of the slip whose components fill these months
}

// Monthly component breakdown from an uploaded offer letter. When present on a job_switch change,
// the timeline builder creates a SECOND employment from the switch month using these figures —
// so HRA (Rule 2A) is computed on the new employer's real basic, not a scaled approximation.
interface OfferBreakdown {
  employerName: string
  grossMonthly: number
  netMonthly: number
  basicMonthly: number
  hraMonthly: number
  specialMonthly: number
  employeePfMonthly: number
  ptMonthly: number
}

interface ForecastChange {
  kind: 'increment' | 'job_switch' | 'bonus_timing' | 'other'
  monthApplies: string      // YYYY-MM — the month the change takes effect
  retroactive: boolean
  retroFromMonth: string    // YYYY-MM — only if retroactive
  amountMode: 'pct' | 'abs' // which input the user is using
  amountPct: number         // e.g. 10 for 10%
  amountAbs: number         // absolute new monthly salary in ₹
  joiningDate?: string      // YYYY-MM-DD — job switches pick a full date (calendar); drives proration
  tdsRegime?: 'new' | 'old' // regime the new employer should withhold TDS under (default 'new')
  offer?: OfferBreakdown    // set when a job switch is prefilled from an offer letter (2-employer split)
}

// Build a job-switch forecast change from already-parsed offer-letter data. Used when an offer letter
// was uploaded on the Documents page and handed off via `av_pending_offer` — mirrors applyOfferLetter's
// mapping but works from parsed data (no re-fetch). Returns null when the offer carries no usable pay.
function jobSwitchChangeFromOfferData(d: any, fyStartYear: number, slipsMeta: { monthKey: string }[]): ForecastChange | null {
  const fixed = d?.fixedCTC || d?.totalCTC || 0
  const monthlyGross = Math.max(0, Math.round((fixed - (d?.employerPF || 0)) / 12))
  if (monthlyGross <= 0) return null
  const mo = (n: number) => Math.max(0, Math.round((n || 0) / 12))
  const employeePfMonthly = mo(d.employeePF)
  const ptMonthly = mo(d.professionalTax)
  const offer: OfferBreakdown = {
    employerName: d.employerName || 'New employer',
    grossMonthly: monthlyGross,
    basicMonthly: mo(d.basicSalary),
    hraMonthly: mo(d.hra),
    specialMonthly: mo((d.specialAllowance || 0) + (d.da || 0) + (d.ta || 0) + (d.lta || 0) + (d.medicalAllowance || 0) + (d.otherAllowances || 0)),
    employeePfMonthly,
    ptMonthly,
    netMonthly: Math.max(0, monthlyGross - employeePfMonthly - ptMonthly),
  }
  const iso = joiningDateISO(d.joiningDate)
  const mk = iso ? iso.slice(0, 7) : ''
  const fullFY = fyMonths(fyStartYear)
  const latest = slipsMeta.length > 0 ? [...slipsMeta].sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0] : null
  const allFY = latest ? fullFY.filter(m => m >= latest.monthKey) : fullFY
  const inFy = !!mk && allFY.includes(mk)
  return {
    kind: 'job_switch', monthApplies: inFy ? mk : '', retroactive: false, retroFromMonth: '',
    amountMode: 'abs', amountPct: 0, amountAbs: monthlyGross, tdsRegime: 'new', offer,
    ...(inFy ? { joiningDate: iso } : {}),
  }
}

interface WizardData {
  intent: Intent | null
  // v7 Step 3: confirmation of each parsed slip (yes / no→edit). Keyed by slip id.
  slipConfirmations: Record<string, 'confirmed' | 'edit'>
  // v7 Step 3: confirmed mapping of date-range → source slip.
  periodMapping: PeriodMapping[]
  // v7 Step 3 Q4: months with bonuses or one-time payments.
  bonusMonths: string[]
  // v7 Step 3 Q5: forecast-only — expected change(s). Single change for MVP.
  forecastChanges: ForecastChange[]
}

type WizardStep =
  | 'intent-pick'
  | 'confirm-periods'   // v7 Q1 — confirm each parsed slip's period
  | 'forecast-changes'  // v8: Forecast intent — asked right after slip confirmation
  | 'confirm-pattern'   // v7 Q2 — confirm the inferred date-range → slip mapping
  | 'remap-periods'     // v7 Q3 — only when user says "No" at confirm-pattern
  | 'bonuses'           // v7 Q4
  | 'review'

export default function SalaryPageCompleteFinal() {
  const router = useRouter()
  const [slips, setSlips] = useState<any[]>([])
  const [fyStartYear, setFyStartYear] = useState(2025)
  const [wizardStep, setWizardStep] = useState<WizardStep>('intent-pick')
  const [employments, setEmployments] = useState<Employment[]>([])
  // Default-expand the first employment so users land on the timeline immediately
  // (the common single-employer case). Still collapsible by clicking the header.
  const [expandedEmployment, setExpandedEmployment] = useState<string | null>(null)
  useEffect(() => {
    if (expandedEmployment === null && employments.length > 0) {
      setExpandedEmployment(employments[0].id)
    }
  }, [employments, expandedEmployment])
  const [previewMonth, setPreviewMonth] = useState<string | null>(null)
  const [previewEmploymentId, setPreviewEmploymentId] = useState<string | null>(null)
  // Legacy simple-edit state kept only because updateMonth() clears editingMonth on save.
  // The bare gross/net modal has been replaced by the rich preview modal driven by previewMonth/previewEmploymentId.
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
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
    slipConfirmations: {},
    periodMapping: [],
    bonusMonths: [],
    forecastChanges: [],
  })
  // Per-change status for the offer-letter prefill on a job-switch forecast change.
  const [offerStatus, setOfferStatus] = useState<{ idx: number; state: 'loading' | 'done' | 'error'; msg: string } | null>(null)
  // Guards the one-time pickup of an offer letter handed off from the Documents page.
  const offerPickupDone = useRef(false)

  // Parse an uploaded offer letter and prefill a job-switch change with the new monthly gross
  // (≈ (fixedCTC − employer PF) / 12) and the switch month derived from the offer's joining date.
  const applyOfferLetter = async (idx: number, file: File) => {
    setOfferStatus({ idx, state: 'loading', msg: 'Reading offer letter…' })
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string) || '').split(',')[1])
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(file)
      })
      // One call per (optional) password attempt; reads the body once and returns a plain result so
      // we never double-consume the response stream across retries.
      const call = async (password?: string) => {
        const r = await fetch('/api/parse-offer-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: base64, mediaType: file.type || 'application/pdf', fileName: file.name, password }),
        })
        return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({} as any)) }
      }

      let res = await call()
      // Password-protected offer letters: prompt and retry until it unlocks or the user cancels.
      if (res.status === 422 && (res.json?.error === 'requires_password' || res.json?.error === 'incorrect_password')) {
        let pwd = await passwordDialog({
          title: 'Password-protected offer letter',
          message: `"${file.name}" is password-protected. Enter the password to read it, or cancel to skip.`,
          confirmLabel: 'Unlock', placeholder: 'PDF password',
        })
        while (pwd) {
          setOfferStatus({ idx, state: 'loading', msg: 'Unlocking…' })
          res = await call(pwd)
          if (!(res.status === 422 && res.json?.error === 'incorrect_password')) break
          pwd = await passwordDialog({
            title: 'Incorrect password',
            message: `That password didn't work for "${file.name}". Try again, or cancel to skip.`,
            confirmLabel: 'Unlock', placeholder: 'PDF password',
          })
        }
        if (!pwd && res.status === 422) {
          setOfferStatus({ idx, state: 'error', msg: 'Skipped — password needed to read this offer letter.' })
          return
        }
      }

      if (!res.ok) throw new Error(res.json?.error || 'Parse failed')
      const d = res.json.data || {}
      const fixed = d.fixedCTC || d.totalCTC || 0
      // No PF assumption: subtract employer PF only if the offer actually states it (offers show
      // gross, not net). The prompt no longer imputes PF/PT, so unstated values are 0.
      const monthlyGross = Math.max(0, Math.round((fixed - (d.employerPF || 0)) / 12))
      if (monthlyGross <= 0) throw new Error('No salary figure found in the offer')
      // Per-month component breakdown for the new employer (annual offer fields ÷ 12). This drives a
      // real second employment so HRA is computed on the new employer's basic, not a scaled estimate.
      const mo = (n: number) => Math.max(0, Math.round((n || 0) / 12))
      const employeePfMonthly = mo(d.employeePF)   // only if stated — no 12%-of-basic default
      const ptMonthly = mo(d.professionalTax)      // only if stated
      const offer: OfferBreakdown = {
        employerName: d.employerName || 'New employer',
        grossMonthly: monthlyGross,
        basicMonthly: mo(d.basicSalary),
        hraMonthly: mo(d.hra),
        specialMonthly: mo((d.specialAllowance || 0) + (d.da || 0) + (d.ta || 0) + (d.lta || 0) + (d.medicalAllowance || 0) + (d.otherAllowances || 0)),
        employeePfMonthly,
        ptMonthly,
        // TDS is computed by the timeline builder (Section 192) since offers don't list it.
        netMonthly: Math.max(0, monthlyGross - employeePfMonthly - ptMonthly),
      }
      const iso = joiningDateISO(d.joiningDate)
      const mk = iso ? iso.slice(0, 7) : ''
      // Same FY window the change dropdown offers: this FY, at-or-after the latest uploaded slip.
      const fullFY = fyMonths(fyStartYear)
      const latest = slipsWithMeta.length > 0 ? [...slipsWithMeta].sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0] : null
      const allFY = latest ? fullFY.filter(m => m >= latest.monthKey) : fullFY
      const inFy = !!mk && allFY.includes(mk)
      setWizard(prev => ({
        ...prev,
        forecastChanges: prev.forecastChanges.map((c, i) => i === idx
          ? { ...c, kind: 'job_switch', amountMode: 'abs', amountAbs: monthlyGross, amountPct: 0, offer, ...(inFy ? { monthApplies: mk, joiningDate: iso } : {}) }
          : c),
      }))
      setOfferStatus({ idx, state: 'done', msg: `${offer.employerName} · ${fmt(monthlyGross)}/mo${inFy ? ` · joins ${iso.split('-').reverse().join('-')}` : (mk ? ` · joins ${monthLabel(mk)} (outside this FY — pick a date)` : ' · pick the joining date')}` })
    } catch (e: any) {
      setOfferStatus({ idx, state: 'error', msg: e?.message || 'Could not read the offer letter' })
    }
  }

  useEffect(() => {
    const data = localStorage.getItem('av_salary_timeline')
    if (data) {
      try {
        const parsed = JSON.parse(data)
        const slipsArray = Array.isArray(parsed) ? parsed : []
        // Dedupe by (year, month) — keep the LAST occurrence so newer uploads override older ones.
        const seen = new Map<string, any>()
        for (const s of slipsArray) {
          const key = `${s?.year || ''}|${String(s?.month || '').toLowerCase()}`
          if (key !== '|') seen.set(key, s)
        }
        const deduped = Array.from(seen.values())
        // If we collapsed anything, write the clean version back so we don't repeat the dedupe forever.
        if (deduped.length !== slipsArray.length) {
          try { localStorage.setItem('av_salary_timeline', JSON.stringify(deduped)) } catch {}
        }
        setSlips(deduped)
        detectFY(deduped)
      } catch (e) {
        console.error('Failed to load:', e)
      }
    }
    setLoading(false)
  }, [])

  const monthToNum = (month: string): number => {
    if (!month) return 1
    const m: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6,
      jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
    }
    // Robust extraction — parsers sometimes return "April 2026", "Apr-2026", "04/2026",
    // "2026-04", or numeric strings. Try each format in order.
    const trimmed = month.trim().toLowerCase()
    // Direct word match (handles plain "April" or "apr")
    if (m[trimmed]) return m[trimmed]
    // Extract first month-word from a longer string like "april 2026" or "apr-26"
    const wordMatch = trimmed.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)/)
    if (wordMatch && m[wordMatch[1]]) return m[wordMatch[1]]
    // Numeric formats: "04", "4", "04/2026", "2026-04", "2026/04"
    const isoMatch = trimmed.match(/^\d{4}[-/](\d{1,2})/)            // "2026-04" or "2026/04"
    if (isoMatch) {
      const mm = parseInt(isoMatch[1])
      if (mm >= 1 && mm <= 12) return mm
    }
    const slashMatch = trimmed.match(/^(\d{1,2})[-/]\d{2,4}$/)        // "04/2026" or "4-26"
    if (slashMatch) {
      const mm = parseInt(slashMatch[1])
      if (mm >= 1 && mm <= 12) return mm
    }
    const numOnly = parseInt(trimmed)
    if (!isNaN(numOnly) && numOnly >= 1 && numOnly <= 12) return numOnly
    return 1
  }

  const detectFY = (slipsArray: any[]) => {
    if (slipsArray.length === 0) return
    const slip = slipsArray[0]
    const month = monthToNum(slip.month)
    // Prefer the 4-digit year embedded in the month string (the pay month is the most specific
    // signal). slip.year is sometimes contaminated by FY-style mentions on the slip
    // (e.g. "Q4 FY25-26 payout" → parser hands back year="2025" for an Apr-2026 slip).
    const yearFromMonth = (slip.month || '').match(/(\d{4})/)
    const yfm = yearFromMonth ? parseInt(yearFromMonth[1]) : NaN
    const ys = parseInt(slip.year)
    const year = Number.isFinite(yfm) ? yfm : (Number.isFinite(ys) ? ys : new Date().getFullYear())
    if (!Number.isFinite(year)) return
    const fy = month >= 4 ? year : year - 1
    setFyStartYear(fy)
  }

  // Attach a stable id + parsed date to each slip so the wizard can reference them.
  // Year resolution priority: the 4-digit year embedded in s.month (most specific — it's the
  // pay month itself) → s.year (often contaminated by FY-style mentions like "FY25-26" elsewhere
  // on the slip) → current CY (last resort).
  const slipsWithMeta = useMemo(() => slips.map((s, i) => {
    const monthNum = monthToNum(s.month)
    const yearFromMonth = (() => {
      const mm = (s.month || '').match(/(\d{4})/)
      return mm ? parseInt(mm[1]) : NaN
    })()
    const ys = parseInt(s.year)
    const year = Number.isFinite(yearFromMonth)
      ? yearFromMonth
      : (Number.isFinite(ys) ? ys : new Date().getFullYear())
    const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`
    return {
      raw: s,
      id: s.id || `slip-${i}-${monthKey}`,
      year, monthNum, monthKey,
      fyStart: slipFyStartYear(year, monthNum),
    }
  }), [slips])

  function nextMonthKey(mk: string): string {
    const [y, m] = mk.split('-').map(Number)
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  }

  // v7 default mapping: for Validate, each slip covers from (previous slip month + 1) to its own month;
  // the last slip extends through Mar. For Forecast, the latest slip covers the whole forecast FY.
  const defaultPeriodMapping = (intent: Intent, fyStart: number): PeriodMapping[] => {
    if (slipsWithMeta.length === 0) return []
    const fyEnd = `${fyStart + 1}-03`
    if (intent === 'forecast') {
      const latest = [...slipsWithMeta].sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
      return [{ fromMonth: `${fyStart}-04`, toMonth: fyEnd, sourceSlipId: latest.id }]
    }
    // Validate: only slips whose FY matches the inferred FY.
    const inFY = slipsWithMeta.filter(s => s.fyStart === fyStart).sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    if (inFY.length === 0) {
      const latest = [...slipsWithMeta].sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
      return [{ fromMonth: `${fyStart}-04`, toMonth: fyEnd, sourceSlipId: latest.id }]
    }
    const mappings: PeriodMapping[] = []
    let prev = `${fyStart}-04`
    for (let i = 0; i < inFY.length; i++) {
      const s = inFY[i]
      const isLast = i === inFY.length - 1
      const to = isLast ? fyEnd : s.monthKey
      mappings.push({ fromMonth: prev, toMonth: to, sourceSlipId: s.id })
      prev = nextMonthKey(s.monthKey)
    }
    return mappings
  }

  // One-time pickup of an offer letter handed off from the Documents page (`av_pending_offer`).
  // The user here already has slips, so the offer is staged as a mid-year job-switch change they can
  // review under "expected changes" (forecast). A brand-new joiner with no slips is bootstrapped on
  // the Documents page instead, so it never reaches here. Purely pre-fills the change list — it does
  // not drive the wizard or alter any timeline/tax computation.
  useEffect(() => {
    if (offerPickupDone.current || slips.length === 0) return
    let raw: string | null = null
    try { raw = localStorage.getItem('av_pending_offer') } catch {}
    if (!raw) return
    offerPickupDone.current = true
    try { localStorage.removeItem('av_pending_offer') } catch {}
    let d: any
    try { d = JSON.parse(raw) } catch { return }
    const change = jobSwitchChangeFromOfferData(d, fyStartYear, slipsWithMeta)
    if (!change) return
    setWizard(prev =>
      prev.forecastChanges.some(c => c.kind === 'job_switch' && c.offer)
        ? prev
        : { ...prev, forecastChanges: [change, ...prev.forecastChanges] }
    )
    toast(`Offer letter loaded — choose “Plan ahead / forecast” to add ${change.offer!.employerName} as a job switch.`, { icon: '📄', duration: 6000 })
  }, [slips, slipsWithMeta, fyStartYear])

  // v7 build: turn the confirmed period mapping into a 12-month timeline. Single employment.
  const buildEmploymentsFromMapping = (changesOverride?: ForecastChange[]) => {
    if (!wizard.intent || slipsWithMeta.length === 0) return
    // Callers can override which changes to apply (the "Skip — no change" button builds with none,
    // before React has flushed its cleared wizard.forecastChanges state).
    const forecastChanges = changesOverride ?? wizard.forecastChanges
    const dates = slipsWithMeta.map(m => ({ year: m.year, monthNum: m.monthNum }))
    const fyStart = inferFyStartYear(dates, wizard.intent)
    setFyStartYear(fyStart)

    const mapping = wizard.periodMapping.length > 0 ? wizard.periodMapping : defaultPeriodMapping(wizard.intent, fyStart)
    const allFY = fyMonths(fyStart)
    const slipById = new Map(slipsWithMeta.map(s => [s.id, s]))

    const months: MonthData[] = allFY.map(mk => {
      const range = mapping.find(r => mk >= r.fromMonth && mk <= r.toMonth)
      const src = range ? slipById.get(range.sourceSlipId) : undefined
      if (!src) {
        return { monthKey: mk, gross: 0, net: 0, deductions: 0, source: 'projected', earnings: [], deductionsList: [] }
      }
      const slip = src.raw
      const gross = slip.grossSalary || slip.basicSalary || 0
      const net = slip.netSalary || slip.basicSalary || 0
      const earnings = (slip.components || []).filter((c: any) => c.type === 'earning')
      const deductionsList = (slip.components || []).filter((c: any) => c.type === 'deduction')
      // Forecast: everything in the future FY is projected (🔮). Validate: 'actual' iff exact match, else 'inferred' (◆).
      const source: MonthData['source'] = wizard.intent === 'forecast'
        ? 'projected'
        : (mk === src.monthKey ? 'actual' : 'inferred')
      return { monthKey: mk, gross, net, deductions: gross - net, source, earnings, deductionsList }
    })

    // Forecast: apply each expected change in chronological order. Different kinds have
    // different semantics:
    //   • increment / job_switch  → scale gross from monthApplies onwards (or retroFromMonth)
    //   • bonus_timing / other    → one-shot top-up to the specific monthApplies only
    if (wizard.intent === 'forecast' && forecastChanges.length > 0) {
      const sorted = [...forecastChanges].sort((a, b) => {
        const aFrom = a.retroactive && a.retroFromMonth ? a.retroFromMonth : a.monthApplies
        const bFrom = b.retroactive && b.retroFromMonth ? b.retroFromMonth : b.monthApplies
        return aFrom.localeCompare(bFrom)
      })
      for (const fc of sorted) {
        if (!fc.monthApplies) continue
        // Offer-letter-backed job switches aren't scaled here — they split the timeline into a
        // second employment below, using the offer's real component breakdown.
        if (fc.kind === 'job_switch' && fc.offer) continue
        const isOneShot = fc.kind === 'bonus_timing' || fc.kind === 'other'
        if (isOneShot) {
          // Top-up: add the absolute amount (or % of current gross) to monthApplies only.
          const idx = months.findIndex(m => m.monthKey === fc.monthApplies)
          if (idx < 0) continue
          const baseGross = months[idx].gross
          const addAmount = fc.amountAbs > 0 ? fc.amountAbs : Math.round(baseGross * (fc.amountPct / 100))
          months[idx] = {
            ...months[idx],
            gross: baseGross + addAmount,
            net: months[idx].net + addAmount,
            earnings: [
              ...(months[idx].earnings || []),
              { label: fc.kind === 'bonus_timing' ? 'Bonus' : 'One-time payment', amount: addAmount, frequency: 'one_time' as const },
            ],
          }
        } else {
          // Recurring change: scale gross from monthApplies (or retroFromMonth) onwards.
          const factor = fc.amountPct > 0 ? 1 + fc.amountPct / 100 : 1
          const newAbs = fc.amountAbs > 0 ? fc.amountAbs : 0
          const apply = (m: MonthData): MonthData => {
            const newGross = newAbs > 0 ? newAbs : Math.round(m.gross * factor)
            const ratio = m.gross > 0 ? newGross / m.gross : 1
            return {
              ...m,
              gross: newGross,
              net: Math.round(m.net * ratio),
              deductions: Math.round((m.deductions || 0) * ratio),
              earnings: (m.earnings || []).map(e => ({ ...e, amount: Math.round((e.amount || 0) * ratio) })),
              // Scale the per-component deduction breakdown by the same ratio. Previously this was
              // left untouched, so after an increment the Income Tax / PF lines stayed at their
              // pre-raise values — the breakdown contradicted the (scaled) aggregate `deductions`
              // and net, and the modal showed a frozen TDS while every earning had grown.
              deductionsList: (m.deductionsList || []).map(d => ({ ...d, amount: Math.round((d.amount || 0) * ratio) })),
            }
          }
          const fromKey = fc.retroactive && fc.retroFromMonth ? fc.retroFromMonth : fc.monthApplies
          for (let i = 0; i < months.length; i++) {
            if (months[i].monthKey >= fromKey) months[i] = apply(months[i])
          }
        }
      }
    }

    const empName = (slipsWithMeta[0]?.raw?.employerName) || 'Employment'

    // Full job switch: if a job_switch change carries an offer breakdown, split the FY into TWO
    // employments at the join month — the old employer up to the prior month, the new employer
    // (with the offer's own basic/HRA/PF) from the join month on. extractHraBasis/extractAnnualGross
    // already sum across employments, and the optimizer applies the standard deduction once on the
    // combined total, so the two-employer split is tax-correct.
    const offerSwitch = (wizard.intent === 'forecast')
      ? forecastChanges.find(fc => fc.kind === 'job_switch' && fc.offer && fc.monthApplies)
      : undefined

    if (offerSwitch && offerSwitch.offer) {
      const o = offerSwitch.offer
      const joinKey = offerSwitch.monthApplies
      const monthBefore = (mk: string) => {
        const [y, m] = mk.split('-').map(Number)
        return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
      }
      const bKeys = allFY.filter(mk => mk >= joinKey)
      // First (joining) month is prorated for days actually worked, inclusive of the joining day:
      // paidDays = daysInMonth − joiningDay + 1.  Later months are full.
      const joinDay = offerSwitch.joiningDate ? (parseInt(offerSwitch.joiningDate.split('-')[2]) || 1) : 1
      const prorationFor = (mk: string) => {
        if (mk !== joinKey || joinDay <= 1) return 1
        const dim = daysInMonthOf(mk)
        return Math.max(0, Math.min(1, (dim - joinDay + 1) / dim))
      }
      const grossOf = (mk: string) => Math.round(o.grossMonthly * prorationFor(mk))
      // Section 192 TDS: the offer shows gross (no TDS line), so estimate the new employer's
      // withholding = annual tax (under the chosen regime) on the salary IT pays, spread across its
      // months in proportion to each month's gross (the prorated first month therefore carries less).
      // Regime follows the user's choice on the change; old regime honours the shared senior status.
      const tdsRegime: 'new' | 'old' = offerSwitch.tdsRegime === 'old' ? 'old' : 'new'
      let tdsSenior: SeniorStatus = 'normal'
      try {
        const ded = JSON.parse(localStorage.getItem('av_deductions') || '{}')
        const ss = ded?.selfSeniorStatus
        if (ss === 'senior' || ss === 'super_senior') tdsSenior = ss
      } catch { /* default normal */ }
      const annualGrossB = bKeys.reduce((s, mk) => s + grossOf(mk), 0)
      const annualTaxB = estimateAnnualTax(annualGrossB, tdsRegime, tdsSenior)
      const tdsOf = (mk: string) => annualGrossB > 0 ? Math.round(annualTaxB * grossOf(mk) / annualGrossB) : 0
      const bMonth = (mk: string): MonthData => {
        const f = prorationFor(mk)
        const gross = grossOf(mk)
        const pf = Math.round(o.employeePfMonthly * f)
        const pt = Math.round(o.ptMonthly * f)
        const tds = tdsOf(mk)
        const net = Math.max(0, gross - pf - pt - tds)
        return {
          monthKey: mk,
          gross,
          net,
          deductions: gross - net,
          source: 'projected',
          earnings: [
            { label: 'Basic', amount: Math.round(o.basicMonthly * f), frequency: 'monthly' as const },
            { label: 'HRA', amount: Math.round(o.hraMonthly * f), frequency: 'monthly' as const },
            { label: 'Special Allowance', amount: Math.round(o.specialMonthly * f), frequency: 'monthly' as const },
          ].filter(e => e.amount > 0),
          deductionsList: [
            { label: 'EPF', amount: pf, frequency: 'monthly' as const },
            { label: 'Professional Tax', amount: pt, frequency: 'monthly' as const },
            { label: 'TDS', amount: tds, frequency: 'monthly' as const },
          ].filter(d => d.amount > 0),
        }
      }
      const aMonths = months.filter(m => m.monthKey < joinKey)
      const bMonths = bKeys.map(bMonth)
      const result: Employment[] = []
      if (aMonths.length > 0) {
        result.push({ id: 'emp-a', name: empName, fromMonth: `${fyStart}-04`, toMonth: monthBefore(joinKey), months: aMonths, baseGross: aMonths[0]?.gross || 0, baseNet: aMonths[0]?.net || 0 })
      }
      result.push({ id: 'emp-b', name: o.employerName, fromMonth: joinKey, toMonth: `${fyStart + 1}-03`, months: bMonths, baseGross: bMonths[0]?.gross || 0, baseNet: bMonths[0]?.net || 0 })
      setEmployments(result)
      return
    }

    setEmployments([{
      id: 'emp-v7',
      name: empName,
      fromMonth: `${fyStart}-04`,
      toMonth: `${fyStart + 1}-03`,
      months,
      baseGross: months[0]?.gross || 0,
      baseNet: months[0]?.net || 0,
    }])
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
  const submitManualEntry = async (employmentId: string) => {
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
      if (!(await confirmDialog(`A slip already exists for ${monthLabel(manualMonthKey)}. Replace it?`))) return
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
        body: JSON.stringify({ base64Data: base64, mediaType: file.type, fileName: file.name }),
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
          const proceed = await confirmDialog({
            title: 'Possible identity mismatch',
            message:
              `This slip may belong to someone else:\n\n` +
              check.mismatches.map(m => `• ${m}`).join('\n') +
              `\n\nUpload only your own salary slips. Continue anyway?`,
            confirmLabel: 'Continue', danger: true,
          })
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
        const useParsed = await confirmDialog({
          title: 'Slip month doesn\'t match',
          message:
            `This slip looks like it's for ${monthLabel(parsedKey)}, ` +
            `but you selected ${monthLabel(selectedMonthKey)}.\n\n` +
            `Attach it to ${monthLabel(parsedKey)} instead, or cancel to abort the upload.`,
          confirmLabel: `Attach to ${monthLabel(parsedKey)}`, cancelLabel: 'Abort',
        })
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
        const ok = await confirmDialog(`A slip already exists for ${monthLabel(monthKey)}. Replace it?`)
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
        const keepBoth = await confirmDialog({
          title: 'Frequency conflict',
          message:
            `${summary}\n\n` +
            `Count both months (will un-mark as one-time), ` +
            `or ignore the new occurrence and keep the prior one-time tag.`,
          confirmLabel: 'Count both', cancelLabel: 'Keep one-time',
        })
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

  // Per-month Basic + HRA series, so the Exemptions page can compute the HRA
  // exemption month-by-month (Rule 2A) instead of single-month × 12 — which was
  // wrong whenever pay changed mid-year.
  const hraBasis = useMemo(() => extractHraBasis(employments), [employments])

  // Persist the careful month-by-month annual summary so the Tax Optimizer uses the SAME number
  // the user reviewed here — instead of re-deriving it as avg(slip) × 12, which ignored raises,
  // one-time bonuses and corrections. Guarded on annualGross > 0 so a transient empty `employments`
  // (e.g. right after reload, before the wizard rebuilds it) never clobbers a good saved summary.
  useEffect(() => {
    if (annualGross <= 0) return
    try {
      localStorage.setItem('av_salary_summary', JSON.stringify({ annualGross, annualNet, annualTDS, fyStartYear, hraBasis }))
    } catch {}
  }, [annualGross, annualNet, annualTDS, fyStartYear, hraBasis])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading...</div>

  if (slips.length === 0) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 16px' }}>No salary data uploaded yet</p>
          <button onClick={() => router.push('/dashboard/profile/documents')} style={{ padding: '10px 20px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Upload salary slip</button>
        </div>
      </div>
    )
  }

  // WIZARD STEPS
  if (wizardStep !== 'review') {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 0' }}>
        <style>{SAL_MOBILE_CSS}</style>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Salary setup</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>FY {fyStartYear}-{fyStartYear + 1}</p>

        {wizardStep === 'intent-pick' && (() => {
          const slipCount = slips.length
          const intents: { id: Intent; title: string; q: string; desc: string }[] = [
            { id: 'validate', title: 'My current year', q: 'How much tax do I owe?', desc: `Checks what you'll pay — or get back — using your ${slipCount} uploaded slip${slipCount === 1 ? '' : 's'} for this year.` },
            { id: 'forecast', title: 'Plan ahead', q: 'What if my salary changes?', desc: 'Model an increment, bonus, or job switch — and see the tax impact.' },
          ]
          const pickIntent = (id: Intent) => {
            setWizard(prev => ({ ...prev, intent: id, periodMapping: [], slipConfirmations: {} }))
            setWizardStep('confirm-periods')
          }
          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>What do you want to do?</h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>Pick one — we'll only ask what's relevant.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {intents.map(it => (
                  <button
                    key={it.id}
                    onClick={() => pickIntent(it.id)}
                    style={{ textAlign: 'left', padding: 16, background: wizard.intent === it.id ? C.wl : T.card, border: `1px solid ${wizard.intent === it.id ? C.fg : C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>{it.title}</p>
                    <p style={{ fontSize: 13, color: C.text, margin: '0 0 6px' }}>{it.q}</p>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{it.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── v7 confirm-periods: confirm each parsed slip ── */}
        {wizardStep === 'confirm-periods' && (() => {
          const inferred = wizard.intent ? inferFyStartYear(slipsWithMeta.map(m => ({ year: m.year, monthNum: m.monthNum })), wizard.intent) : null
          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>Found {slipsWithMeta.length} salary slip{slipsWithMeta.length !== 1 ? 's' : ''} — <span style={{ whiteSpace: 'nowrap' }}>confirm the months.</span></h2>
              {inferred !== null && (
                <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
                  Building timeline for <strong style={{ whiteSpace: 'nowrap' }}>FY {inferred}-{inferred + 1}</strong> <span style={{ whiteSpace: 'nowrap' }}>(Apr {inferred} – Mar {inferred + 1}){wizard.intent === 'forecast' ? ' — Forecast' : ''}.</span>
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {slipsWithMeta.map(s => {
                  const status = wizard.slipConfirmations[s.id]
                  return (
                    <div key={s.id} className="sal-slip-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{monthLabel(s.monthKey)} · {s.raw.employerName || 'Employer'}</p>
                        <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}><span style={{ whiteSpace: 'nowrap' }}>Gross {fmt(s.raw.grossSalary || s.raw.basicSalary || 0)}</span> · <span style={{ whiteSpace: 'nowrap' }}>Net {fmt(s.raw.netSalary || 0)}</span></p>
                      </div>
                      <div className="sal-slip-actions" style={{ display: 'flex', gap: 6 }}>
                        <button className="sal-slip-grow" onClick={() => setWizard(prev => ({ ...prev, slipConfirmations: { ...prev.slipConfirmations, [s.id]: 'confirmed' } }))} style={{ padding: '6px 12px', background: status === 'confirmed' ? C.green : T.card, color: status === 'confirmed' ? '#fff' : C.fg, border: `1px solid ${status === 'confirmed' ? C.green : C.border}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Yes</button>
                        <button className="sal-slip-grow" onClick={() => setWizard(prev => ({ ...prev, slipConfirmations: { ...prev.slipConfirmations, [s.id]: 'edit' } }))} style={{ padding: '6px 12px', background: status === 'edit' ? T.caution.text : T.card, color: status === 'edit' ? '#fff' : C.fg, border: `1px solid ${status === 'edit' ? T.caution.text : C.border}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                        <button
                          onClick={async () => {
                            if (!(await confirmDialog({ message: `Delete ${monthLabel(s.monthKey)} salary slip? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return
                            const nextSlips = slips.filter((raw: any, idx: number) => {
                              const k = `${raw?.year || ''}|${String(raw?.month || '').toLowerCase()}`
                              const sk = `${s.year}|${String(s.raw.month || '').toLowerCase()}`
                              return !(k === sk && (raw.id === s.raw.id || idx === slips.indexOf(s.raw)))
                            })
                            setSlips(nextSlips)
                            try { localStorage.setItem('av_salary_timeline', JSON.stringify(nextSlips)) } catch {}
                            setWizard(prev => {
                              const { [s.id]: _, ...rest } = prev.slipConfirmations
                              return {
                                ...prev,
                                slipConfirmations: rest,
                                periodMapping: prev.periodMapping.filter(r => r.sourceSlipId !== s.id),
                              }
                            })
                          }}
                          title="Delete this slip"
                          style={{ padding: '6px 10px', background: T.card, color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}
                        >×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {slipsWithMeta.some(s => wizard.slipConfirmations[s.id] === 'edit') && (
                <p style={{ fontSize: 11, color: T.caution.text, margin: '0 0 12px' }}>Slips marked "Edit" can be corrected later — tap the month, then Edit breakdown.</p>
              )}
              {slipsWithMeta.length > 0 && (
                <div style={{ marginBottom: 12, textAlign: 'right' }}>
                  <button
                    onClick={async () => {
                      if (!(await confirmDialog({ message: `Delete all ${slipsWithMeta.length} uploaded slip(s)? This will reset the timeline.`, confirmLabel: 'Delete all', danger: true }))) return
                      setSlips([])
                      setEmployments([])
                      try {
                        localStorage.removeItem('av_salary_timeline')
                        localStorage.removeItem('av_selected_fy')
                      } catch {}
                      setWizard(prev => ({ ...prev, slipConfirmations: {}, periodMapping: [], bonusMonths: [], forecastChanges: [] }))
                      router.push('/dashboard/profile/documents')
                    }}
                    style={{ background: 'transparent', border: 'none', color: C.danger, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
                  >Clear all uploaded slips</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setWizardStep('intent-pick')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                <button
                  onClick={() => {
                    // Seed the default mapping; Forecast intent asks for the expected change next, then pattern confirmation.
                    const mapping = defaultPeriodMapping(wizard.intent!, inferred ?? 0)
                    setWizard(prev => ({ ...prev, periodMapping: mapping }))
                    setWizardStep(wizard.intent === 'forecast' ? 'forecast-changes' : 'confirm-pattern')
                  }}
                  style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >Next →</button>
              </div>
            </div>
          )
        })()}

        {/* ── v8 forecast-changes: Forecast intent only, right after slip confirmation ── */}
        {wizardStep === 'forecast-changes' && (() => {
          // SINGLE source of truth: the page header's fyStartYear (set by detectFY when
          // the user uploaded slips). This guarantees the forecast dropdown CANNOT disagree
          // with the header FY label. Forecast applies WITHIN the same FY as the slip
          // (e.g. Apr 2026 slip → FY 2026-27 → months Apr 2026 … Mar 2027).
          const inferred = fyStartYear
          const fullFY = fyMonths(inferred)
          // Filter to months at-or-after the latest uploaded slip — you can't apply
          // an "increment from June" if the slip you uploaded is July of the same FY.
          const latestSlip = slipsWithMeta.length > 0
            ? [...slipsWithMeta].sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
            : null
          const allFY = latestSlip
            ? fullFY.filter(mk => mk >= latestSlip.monthKey)
            : fullFY
          const changes = wizard.forecastChanges
          const blank = (): ForecastChange => ({ kind: 'increment', monthApplies: '', retroactive: false, retroFromMonth: '', amountMode: 'pct', amountPct: 0, amountAbs: 0, tdsRegime: 'new' })
          const addChange = () => setWizard(prev => ({ ...prev, forecastChanges: [...prev.forecastChanges, blank()] }))
          const removeChange = (idx: number) => setWizard(prev => ({ ...prev, forecastChanges: prev.forecastChanges.filter((_, i) => i !== idx) }))
          const updateChange = (idx: number, patch: Partial<ForecastChange>) =>
            setWizard(prev => ({ ...prev, forecastChanges: prev.forecastChanges.map((c, i) => i === idx ? { ...c, ...patch } : c) }))
          const kindLabel = (k: ForecastChange['kind']) =>
            k === 'increment' ? 'Increment' : k === 'job_switch' ? 'Job switch' : k === 'bonus_timing' ? 'Bonus' : 'One time payment'

          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>What changes are you expecting?</h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>Add one or more expected changes (e.g. increment in Jun + bonus in Oct). Skip if no change is expected.</p>

              {/* Surface what we parsed from the slip + the FY window we're forecasting in.
                  If this is wrong, the user knows to fix it at the slip-upload step. */}
              {latestSlip && (
                <div style={{ padding: '10px 12px', background: C.wl, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 12, fontSize: 11.5, color: C.text, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    <span style={{ color: C.muted }}>Latest slip: </span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{monthLabel(latestSlip.monthKey)}</strong>
                  </div>
                  <div>
                    <span style={{ color: C.muted }}>Forecast window: </span>
                    <strong style={{ whiteSpace: 'nowrap' }}>FY {inferred}-{inferred + 1}</strong>{' '}
                    <span style={{ whiteSpace: 'nowrap' }}>({monthLabel(`${inferred}-04`)} → {monthLabel(`${inferred + 1}-03`)})</span>
                  </div>
                  {allFY.length > 0 && (
                    <div>
                      <span style={{ color: C.muted }}>Changes can apply from </span>
                      <strong style={{ whiteSpace: 'nowrap' }}>{monthLabel(allFY[0])}</strong>
                      <span style={{ color: C.muted }}> onwards.</span>
                    </div>
                  )}
                </div>
              )}

              {changes.length === 0 && (
                <div style={{ padding: 14, background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 6, textAlign: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>No changes yet. Click "+ Add a change" to add one.</p>
                </div>
              )}

              {changes.map((fc, idx) => {
                const isOneShot = fc.kind === 'bonus_timing' || fc.kind === 'other'
                return (
                  <div key={idx} style={{ marginBottom: 14, padding: 14, background: T.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Change #{idx + 1}</span>
                      <button onClick={() => removeChange(idx)} style={{ background: 'transparent', border: 'none', color: C.danger, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>× Remove</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
                      {(['increment','job_switch','bonus_timing','other'] as const).map(k => (
                        <button key={k} onClick={() => updateChange(idx, { kind: k })} style={{ padding: '8px', background: fc.kind === k ? C.wl : T.card, border: `1px solid ${fc.kind === k ? C.fg : C.border}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: C.text, textAlign: 'center' }}>
                          {kindLabel(k)}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      // Identical look for the dropdown + amount input — height, padding, border, font.
                      // `appearance: none` strips the native chevron so we draw our own.
                      const fieldStyle: React.CSSProperties = {
                        width: '100%',
                        height: 36,
                        padding: '0 10px',
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: 'inherit',
                        background: T.card,
                        color: C.text,
                        boxSizing: 'border-box',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none' as any,
                        lineHeight: '34px',
                      }
                      // Custom chevron behind the <select> via background-image.
                      const selectStyle: React.CSSProperties = {
                        ...fieldStyle,
                        paddingRight: 28,
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M0 0l5 6 5-6z' fill='%237A8A7E'/></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center',
                      }
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                          <div>
                            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>{fc.kind === 'job_switch' ? 'Joining date' : isOneShot ? 'Which month?' : 'When does it take effect?'}</label>
                            {fc.kind === 'job_switch' ? (
                              // Calendar: a job switch has an exact joining date — it drives the first
                              // month's proration. monthApplies is kept in sync (YYYY-MM) for the build.
                              <input
                                type="date"
                                value={fc.joiningDate || (fc.monthApplies ? `${fc.monthApplies}-01` : '')}
                                min={`${inferred}-04-01`}
                                max={`${inferred + 1}-03-31`}
                                onChange={e => updateChange(idx, { joiningDate: e.target.value, monthApplies: e.target.value ? e.target.value.slice(0, 7) : '' })}
                                style={fieldStyle}
                              />
                            ) : (
                              <select value={fc.monthApplies} onChange={e => updateChange(idx, { monthApplies: e.target.value })} style={selectStyle}>
                                <option value="">Month…</option>
                                {allFY.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
                              </select>
                            )}
                          </div>
                          <div>
                            {fc.kind === 'job_switch' ? (
                              // A job switch is an absolute new salary (from the offer, or typed) — no
                              // %/₹ toggle. Upload an offer below to auto-fill this.
                              <>
                                <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>New monthly salary (gross)</label>
                                <input type="number" value={fc.amountAbs || ''} onChange={e => updateChange(idx, { amountMode: 'abs', amountPct: 0, amountAbs: parseFloat(e.target.value) || 0 })} placeholder="₹ / upload offer" style={fieldStyle} />
                              </>
                            ) : (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <label style={{ fontSize: 11, color: C.muted }}>{isOneShot ? 'Amount' : 'How much?'}</label>
                                  <div style={{ display: 'flex', gap: 2 }}>
                                    <button type="button" onClick={() => updateChange(idx, { amountMode: 'pct', amountAbs: 0 })} style={{ padding: '2px 6px', background: fc.amountMode === 'abs' ? T.card : C.fg, color: fc.amountMode === 'abs' ? C.fg : T.onTeal, border: `1px solid ${C.fg}`, borderRadius: 3, fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>%</button>
                                    <button type="button" onClick={() => updateChange(idx, { amountMode: 'abs', amountPct: 0 })} style={{ padding: '2px 6px', background: fc.amountMode === 'abs' ? C.fg : T.card, color: fc.amountMode === 'abs' ? T.onTeal : C.fg, border: `1px solid ${C.fg}`, borderRadius: 3, fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>₹</button>
                                  </div>
                                </div>
                                {fc.amountMode === 'abs' ? (
                                  <input type="number" value={fc.amountAbs || ''} onChange={e => updateChange(idx, { amountAbs: parseFloat(e.target.value) || 0 })} placeholder={isOneShot ? '₹ amount' : 'New monthly ₹'} style={fieldStyle} />
                                ) : (
                                  <input type="number" value={fc.amountPct || ''} onChange={e => updateChange(idx, { amountPct: parseFloat(e.target.value) || 0 })} placeholder="e.g. 10" style={fieldStyle} />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {!isOneShot && fc.kind !== 'job_switch' && (
                      <>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: C.text, marginBottom: 6 }}>
                          <input type="checkbox" checked={fc.retroactive} onChange={e => updateChange(idx, { retroactive: e.target.checked })} />
                          Retroactive — applies from an earlier month
                        </label>
                        {fc.retroactive && (
                          <div>
                            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Retroactive from</label>
                            <select value={fc.retroFromMonth} onChange={e => updateChange(idx, { retroFromMonth: e.target.value })} style={{
                              width: '100%', height: 36, padding: '0 28px 0 10px',
                              border: `1px solid ${C.border}`, borderRadius: 4,
                              fontSize: 12, fontFamily: 'inherit', background: T.card, color: C.text,
                              boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' as any,
                              lineHeight: '34px',
                              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M0 0l5 6 5-6z' fill='%237A8A7E'/></svg>")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 10px center',
                            }}>
                              <option value="">Month…</option>
                              {allFY.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {/* Job switch: prefill the new pay + switch month from an offer letter. */}
                    {fc.kind === 'job_switch' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.wl, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: C.fg, fontFamily: 'inherit' }}>
                          📄 Upload offer letter to prefill
                          <input type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) applyOfferLetter(idx, f); e.target.value = '' }} />
                        </label>
                        {offerStatus?.idx === idx && (
                          <p style={{ fontSize: 10.5, margin: '6px 0 0', color: offerStatus.state === 'error' ? C.danger : offerStatus.state === 'done' ? C.green : C.muted }}>
                            {offerStatus.state === 'loading' ? '⏳ ' : offerStatus.state === 'done' ? '✓ ' : '⚠ '}{offerStatus.msg}
                          </p>
                        )}
                        {/* Regime the new employer should withhold TDS under (the employee declares this). */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Withhold TDS under:</span>
                          {(['new', 'old'] as const).map(r => (
                            <button key={r} type="button" onClick={() => updateChange(idx, { tdsRegime: r })} style={{ padding: '3px 10px', background: (fc.tdsRegime || 'new') === r ? C.fg : T.card, color: (fc.tdsRegime || 'new') === r ? T.onTeal : C.fg, border: `1px solid ${C.fg}`, borderRadius: 4, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {r === 'new' ? 'New regime' : 'Old regime'}
                            </button>
                          ))}
                        </div>
                        <p style={{ fontSize: 10, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                          {fc.offer
                            ? `Set up as a separate job (${fc.offer.employerName}) from the joining date — first month prorated, monthly TDS estimated under the ${(fc.tdsRegime || 'new') === 'old' ? 'old' : 'new'} regime.`
                            : `Modeled as a separate job from the joining date — first month prorated, monthly TDS estimated.`}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}

              <button onClick={addChange} style={{ width: '100%', padding: '10px', background: 'transparent', color: C.fg, border: `1px dashed ${C.fg}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>+ Add a change</button>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setWizardStep('confirm-periods')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                <button onClick={() => { buildEmploymentsFromMapping(); setWizardStep('review') }} style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Build timeline →</button>
              </div>
            </div>
          )
        })()}

        {/* ── v7 confirm-pattern: show inferred mapping, user confirms or remaps ── */}
        {wizardStep === 'confirm-pattern' && (() => {
          const slipById = new Map(slipsWithMeta.map(s => [s.id, s]))
          const inferred = wizard.intent ? inferFyStartYear(slipsWithMeta.map(m => ({ year: m.year, monthNum: m.monthNum })), wizard.intent) : 0
          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>Your timeline, built from these slips — does it look right?</h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>FY {inferred}-{inferred + 1}{wizard.intent === 'forecast' ? ' — Forecast' : ''}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {wizard.periodMapping.map((r, i) => {
                  const src = slipById.get(r.sourceSlipId)
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}>
                      <div style={{ color: C.text, fontWeight: 600 }}>{monthLabel(r.fromMonth)} → {monthLabel(r.toMonth)}</div>
                      <div style={{ marginTop: 2 }}>
                        <span style={{ color: C.muted }}>Using {src ? monthLabel(src.monthKey) : '?'} slip · </span>
                        <span style={{ color: C.text, fontWeight: 700 }}>{fmt(src?.raw?.grossSalary || src?.raw?.basicSalary || 0)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setWizardStep('confirm-periods')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                <button
                  onClick={() => {
                    // Forecast: skip the bonuses tab — bonuses are captured as a kind in forecast-changes instead.
                    if (wizard.intent === 'forecast') {
                      buildEmploymentsFromMapping()
                      setWizardStep('review')
                    } else {
                      setWizardStep('bonuses')
                    }
                  }}
                  style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >{wizard.intent === 'forecast' ? 'Build timeline →' : 'Looks right →'}</button>
              </div>
            </div>
          )
        })()}

        {/* ── v7 remap-periods: per-month dropdown to pick source slip ── */}
        {wizardStep === 'remap-periods' && (() => {
          const inferred = wizard.intent ? inferFyStartYear(slipsWithMeta.map(m => ({ year: m.year, monthNum: m.monthNum })), wizard.intent) : 0
          const allFY = fyMonths(inferred)
          // Per-month source slip currently assigned (derived from periodMapping).
          const monthSlipOf = (mk: string) => wizard.periodMapping.find(r => mk >= r.fromMonth && mk <= r.toMonth)?.sourceSlipId || ''
          const setMonthSlip = (mk: string, slipId: string) => {
            // Rewrite mapping: collapse to per-month entries, then merge adjacent same-slip ranges.
            const perMonth = allFY.map(m => ({ from: m, to: m, slip: m === mk ? slipId : monthSlipOf(m) }))
            const merged: PeriodMapping[] = []
            for (const item of perMonth) {
              if (!item.slip) continue
              const last = merged[merged.length - 1]
              if (last && last.sourceSlipId === item.slip && nextMonthKey(last.toMonth) === item.from) {
                last.toMonth = item.to
              } else {
                merged.push({ fromMonth: item.from, toMonth: item.to, sourceSlipId: item.slip })
              }
            }
            setWizard(prev => ({ ...prev, periodMapping: merged }))
          }
          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>Pick which slip applies to each month</h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>Adjacent months with the same slip are merged into a range automatically.</p>
              <div className="sal-remap" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 16 }}>
                {allFY.map(mk => (
                  <div key={mk} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 600, minWidth: 70 }}>{monthLabel(mk)}</span>
                    <select value={monthSlipOf(mk)} onChange={e => setMonthSlip(mk, e.target.value)} style={{ flex: 1, padding: '4px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', background: T.card, color: C.text }}>
                      <option value="">— None —</option>
                      {slipsWithMeta.map(s => <option key={s.id} value={s.id}>{monthLabel(s.monthKey)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setWizardStep('confirm-pattern')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                <button
                  onClick={() => {
                    if (wizard.intent === 'forecast') {
                      buildEmploymentsFromMapping()
                      setWizardStep('review')
                    } else {
                      setWizardStep('bonuses')
                    }
                  }}
                  style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >{wizard.intent === 'forecast' ? 'Build timeline →' : 'Next →'}</button>
              </div>
            </div>
          )
        })()}

        {/* ── v7 bonuses: Q4 ── */}
        {wizardStep === 'bonuses' && (() => {
          const inferred = wizard.intent ? inferFyStartYear(slipsWithMeta.map(m => ({ year: m.year, monthNum: m.monthNum })), wizard.intent) : 0
          const allFY = fyMonths(inferred)
          const toggle = (mk: string) => setWizard(prev => ({
            ...prev,
            bonusMonths: prev.bonusMonths.includes(mk) ? prev.bonusMonths.filter(m => m !== mk) : [...prev.bonusMonths, mk],
          }))
          // v8: Forecast no longer collects increment pre-build. Always build the baseline
          // timeline first; the user adds the scenario overlay from the review page.
          const finishOrForecast = () => {
            buildEmploymentsFromMapping()
            setWizardStep('review')
          }
          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>Any bonuses or one-time payments?</h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>Tick the months — you can add those slips later.</p>
              <div className="sal-bonus" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 16 }}>
                {allFY.map(mk => {
                  const on = wizard.bonusMonths.includes(mk)
                  return (
                    <button key={mk} onClick={() => toggle(mk)} style={{ padding: '8px 4px', background: on ? C.wm : T.card, color: on ? '#fff' : C.text, border: `1px solid ${on ? C.wm : C.border}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600 }}>
                      {monthLabel(mk).split(' ')[0]}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setWizardStep('confirm-pattern')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                  <button
                    onClick={() => { setWizard(prev => ({ ...prev, bonusMonths: [] })); finishOrForecast() }}
                    style={{ flex: 1, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                  >No bonuses</button>
                </div>
                <button onClick={finishOrForecast} style={{ width: '100%', padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Build timeline →
                </button>
              </div>
            </div>
          )
        })()}



      </div>
    )
  }

  // REVIEW STEP
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <style>{SAL_MOBILE_CSS}</style>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.fg, margin: '0 0 8px' }}>Salary</h1>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>
        FY {fyStartYear}-{fyStartYear + 1} (Apr {fyStartYear} – Mar {fyStartYear + 1})
        {wizard.intent === 'forecast' ? ' · Forecast' : ''}
      </p>

      {/* Preview Modal - Salary Breakup */}
      {previewMonth && previewEmploymentId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,43,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div className="sal-modal" style={{ background: C.card, borderRadius: 10, padding: 30, maxWidth: 600, width: '95%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', position: 'relative' }}>
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
                                <input type="number" value={overrideValue} onChange={ev => setOverrideValue(ev.target.value)} autoFocus style={{ width: 100, padding: '4px 8px', border: `1px solid ${C.fg}`, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', color: C.text, background: T.card }} />
                                <button onClick={saveOverride} style={{ padding: '4px 10px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
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
                                        background: freq === 'monthly' ? T.slip.fill : T.caution.fill,
                                        color: freq === 'monthly' ? C.green : T.caution.text,
                                        border: `1px solid ${freq === 'monthly' ? T.slip.border : T.caution.border}`,
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
                                    style={{ padding: '3px 8px', background: T.caution.text, color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: C.wl, fontWeight: 600, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, color: C.fg }}>Total earnings</span>
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
                                <input type="number" value={overrideValue} onChange={ev => setOverrideValue(ev.target.value)} autoFocus style={{ width: 100, padding: '4px 8px', border: `1px solid ${C.fg}`, borderRadius: 4, fontSize: 12, fontFamily: 'inherit', color: C.text, background: T.card }} />
                                <button onClick={saveOverride} style={{ padding: '4px 10px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
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
                                    style={{ padding: '3px 8px', background: T.caution.text, color: '#fff', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FBF0F0', fontWeight: 600, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, color: C.danger }}>Total deductions</span>
                        <span style={{ fontSize: 12, color: C.danger }}>−{fmt(md.deductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Salary */}
                  <div style={{ marginTop: 20, padding: '14px', background: C.wl, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Net Salary</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{fmt(md.net)}</span>
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
                style={{ flex: 1, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {/* Annual Summary */}
      <div className="sal-annual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Gross</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(annualGross)}</p>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Annual Net</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.green, margin: 0 }}>{fmt(annualNet)}</p>
        </div>
      </div>

      {/* Employment Periods */}
      <div style={{ marginBottom: 24 }}>
        {(() => {
          // One unified timeline: flatten every month across employers (chronological), tagged with
          // its employer, so the whole FY renders as a single grid with a grouped employer band below.
          const flatMonths = employments
            .flatMap(e => e.months.map(m => ({ ...m, empId: e.id, empName: e.name })))
            .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
          const empIdForMonth = (mk: string) => employments.find(e => e.months.some(m => m.monthKey === mk))?.id || ''
          const cols = flatMonths.length || 12
          if (flatMonths.length === 0) return null
          return (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              {/* Upload monthly slip — single control for the whole timeline (month picks the employer) */}
              <div style={{ marginBottom: 16, padding: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 8px', textTransform: 'uppercase' }}>Upload monthly slip</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="sal-month-select"
                    value={monthUploadKey}
                    onChange={(e) => { setMonthUploadKey(e.target.value); setMonthUploadEmpId(empIdForMonth(e.target.value)); setMonthUploadError(null) }}
                    disabled={monthUploadBusy}
                    style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: T.card, color: C.text, minWidth: 200 }}
                  >
                    <option value="">Select month…</option>
                    {flatMonths.map(m => (
                      <option key={m.monthKey} value={m.monthKey}>
                        {monthLabel(m.monthKey)} · {m.empName}{m.source === 'actual' ? ' (uploaded)' : m.source === 'edited' ? ' (edited)' : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={monthUploadBusy || !monthUploadKey}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      setMonthUploadFile(f)
                      if (f && monthUploadKey) {
                        uploadMonthlySlip(empIdForMonth(monthUploadKey), monthUploadKey, f)
                        e.target.value = ''
                      }
                    }}
                    style={{ fontSize: 12, fontFamily: 'inherit', color: C.text }}
                  />
                  {monthUploadBusy && <span style={{ fontSize: 11, color: C.muted }}>Parsing…</span>}
                </div>
                {monthUploadError && <p style={{ fontSize: 11, color: C.danger, margin: '8px 0 0' }}>{monthUploadError}</p>}

                {/* Manual entry — no slip needed */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                  <button
                    onClick={() => { setManualOpenEmpId(manualOpenEmpId === 'unified' ? null : 'unified'); setManualError(null) }}
                    style={{ background: 'transparent', border: 'none', color: C.fg, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  >
                    {manualOpenEmpId === 'unified' ? '− Hide manual entry' : '+ Add manually (no slip)'}
                  </button>
                  {manualOpenEmpId === 'unified' && (() => {
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
                            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: T.card, color: C.text }}
                          >
                            <option value="">Select month…</option>
                            {flatMonths.map(m => (
                              <option key={m.monthKey} value={m.monthKey}>
                                {monthLabel(m.monthKey)} · {m.empName}{m.source === 'actual' ? ' (uploaded)' : m.source === 'edited' ? ' (edited)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sal-manual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {/* Earnings editor */}
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Earnings</p>
                            {manualEarnings.map((row, i) => (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 4, marginBottom: 4 }}>
                                <input type="text" placeholder="Label (e.g. HRA)" value={row.label} onChange={(e) => setManualEarnings(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text, background: T.card }} />
                                <input type="number" placeholder="Amount" value={row.amount} onChange={(e) => setManualEarnings(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))} style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text, background: T.card }} />
                                <button onClick={() => setManualEarnings(prev => prev.filter((_, j) => j !== i))} title="Remove" style={{ padding: '0 8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                              </div>
                            ))}
                            <button onClick={() => setManualEarnings(prev => [...prev, { label: '', amount: '' }])} style={{ marginTop: 4, padding: '4px 8px', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4, fontSize: 10.5, color: C.fg, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>+ Add earning</button>
                          </div>
                          {/* Deductions editor */}
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Deductions</p>
                            {manualDeductions.map((row, i) => (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 4, marginBottom: 4 }}>
                                <input type="text" placeholder="Label (e.g. PF)" value={row.label} onChange={(e) => setManualDeductions(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text, background: T.card }} />
                                <input type="number" placeholder="Amount" value={row.amount} onChange={(e) => setManualDeductions(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))} style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'inherit', color: C.text, background: T.card }} />
                                <button onClick={() => setManualDeductions(prev => prev.filter((_, j) => j !== i))} title="Remove" style={{ padding: '0 8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                              </div>
                            ))}
                            <button onClick={() => setManualDeductions(prev => [...prev, { label: '', amount: '' }])} style={{ marginTop: 4, padding: '4px 8px', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4, fontSize: 10.5, color: C.fg, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>+ Add deduction</button>
                          </div>
                        </div>

                        <div style={{ marginTop: 10, padding: 10, background: C.wl, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          <div><p style={{ fontSize: 10, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Gross</p><p style={{ fontSize: 13, fontWeight: 700, color: C.fg, margin: 0 }}>{fmt(liveGross)}</p></div>
                          <div><p style={{ fontSize: 10, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Deductions</p><p style={{ fontSize: 13, fontWeight: 700, color: C.danger, margin: 0 }}>−{fmt(liveDed)}</p></div>
                          <div><p style={{ fontSize: 10, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Net</p><p style={{ fontSize: 13, fontWeight: 700, color: C.green, margin: 0 }}>{fmt(liveNet)}</p></div>
                        </div>

                        <button onClick={() => submitManualEntry(empIdForMonth(manualMonthKey))} style={{ marginTop: 10, width: '100%', padding: '10px 14px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save breakdown</button>
                      </div>
                    )
                  })()}
                  {manualError && manualOpenEmpId === 'unified' && <p style={{ fontSize: 11, color: C.danger, margin: '8px 0 0' }}>{manualError}</p>}
                </div>
              </div>

              {/* Unified timeline grid — all months across employers */}
              <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: '0 0 12px', textTransform: 'uppercase' }}>Timeline · click to view/edit</p>
              <div className="sal-timeline-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8, marginBottom: 6 }}>
                {flatMonths.map(m => {
                  const isForecastCell = wizard.intent === 'forecast' && m.source === 'projected' && m.gross > 0
                  const bg = m.source === 'actual' ? C.fg
                    : m.source === 'edited' ? C.wm
                    : m.source === 'inferred' ? '#CFE0F0'
                    : isForecastCell ? T.caution.fill
                    : C.border
                  const fg = m.source === 'actual' ? T.onTeal
                    : m.source === 'edited' ? T.ink
                    : m.source === 'inferred' ? '#1F4E7A'
                    : isForecastCell ? T.caution.text
                    : C.muted
                  const icon = isForecastCell ? '🔮'
                    : m.source === 'actual' ? '●'
                    : m.source === 'edited' ? '✎'
                    : m.source === 'inferred' ? '◆'
                    : '○'
                  const anomaly = anomalyByMonth.get(m.monthKey)
                  const cellBorder = anomaly ? `2px solid ${T.caution.text}`
                    : isForecastCell ? `2px dashed ${T.caution.text}`
                    : m.source === 'inferred' ? `1px solid #7AA8D1`
                    : 'none'
                  return (
                    <button
                      key={m.monthKey}
                      onClick={() => { setPreviewMonth(m.monthKey); setPreviewEmploymentId(m.empId) }}
                      title={anomaly?.message
                        || (isForecastCell ? 'Forecast — projected from your scenario'
                            : m.source === 'inferred' ? `Inferred from another slip's values for the same employer`
                            : undefined)}
                      style={{ position: 'relative', background: bg, color: fg, border: cellBorder, borderRadius: 4, padding: '12px 4px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}
                    >
                      {anomaly && (
                        <span style={{ position: 'absolute', top: -6, right: -4, background: T.caution.text, color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>!</span>
                      )}
                      <div style={{ fontSize: 9 }}>{monthLabel(m.monthKey).split(' ')[0]}</div>
                      <div style={{ fontSize: 11 }}>{icon}</div>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>{fmtGlance(m.gross)}</div>
                    </button>
                  )
                })}
              </div>

              {/* Employer band — one label per employer, spanning its months */}
              <div className="sal-emp-band" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 14 }}>
                {employments.map(e => (
                  <div key={e.id} title={`${e.name} · ${monthLabel(e.fromMonth)} → ${monthLabel(e.toMonth)}`} style={{ gridColumn: `span ${e.months.length}`, textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.fg, background: C.wl, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.name}</div>
                ))}
              </div>

              {/* Mobile-only employer line — replaces the hidden band on narrow screens (band → emp-line). */}
              <div className="sal-emp-line" style={{ marginBottom: 14 }}>
                {employments.map(e => (
                  <div key={e.id} style={{ display: 'flex', gap: 5, alignItems: 'baseline', fontSize: 11, color: T.nav }}>
                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 }}>{e.name}</span>
                    <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>· {monthLabel(e.fromMonth).split(' ')[0]}–{monthLabel(e.toMonth).split(' ')[0]}</span>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: C.muted, marginBottom: 14, flexWrap: 'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C.fg, marginRight: 4, verticalAlign: 'middle' }} /><strong style={{ color: C.fg }}>●</strong> Actual (from slip)</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C.wm, marginRight: 4, verticalAlign: 'middle' }} /><strong style={{ color: C.fg }}>✎</strong> Edited (you changed it)</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#CFE0F0', border: '1px solid #7AA8D1', marginRight: 4, verticalAlign: 'middle' }} /><strong style={{ color: '#1F4E7A' }}>◆</strong> Inferred (from another slip)</span>
                {wizard.intent === 'forecast' && (
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: T.caution.fill, border: `2px dashed ${T.caution.text}`, marginRight: 4, verticalAlign: 'middle' }} />🔮 Forecast</span>
                )}
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: T.caution.text, marginRight: 4, verticalAlign: 'middle' }} />! Anomaly</span>
              </div>

              {/* Employer subtotals */}
              <div style={{ marginBottom: 16 }}>
                {employments.map(e => {
                  const g = e.months.reduce((s, m) => s + m.gross, 0)
                  const n = e.months.reduce((s, m) => s + m.net, 0)
                  return (
                    <div key={e.id} style={{ padding: '8px 12px', background: C.wl, borderRadius: 6, marginBottom: 6 }}>
                      {/* Company + period — grouped on their own line; the period stays intact as a unit */}
                      <div style={{ fontSize: 11.5, marginBottom: 5 }}>
                        <span style={{ color: C.text, fontWeight: 600 }}>{e.name}</span>{' '}
                        <span style={{ color: C.muted, fontWeight: 400, whiteSpace: 'nowrap' }}>({monthLabel(e.fromMonth)} – {monthLabel(e.toMonth)})</span>
                      </div>
                      {/* Gross / Net — distinct labelled figures, each reads on its own, wraps cleanly */}
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11.5 }}>
                        <span style={{ whiteSpace: 'nowrap' }}><span style={{ color: C.fg, fontWeight: 700 }}>{fmt(g)}</span> <span style={{ color: C.muted, fontWeight: 400 }}>gross</span></span>
                        <span style={{ whiteSpace: 'nowrap' }}><span style={{ color: C.green, fontWeight: 700 }}>{fmt(n)}</span> <span style={{ color: C.muted, fontWeight: 400 }}>net</span></span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Preview · all months (across employers) */}
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                <button
                  onClick={() => setPreviewOpenEmpId(previewOpenEmpId === 'unified' ? null : 'unified')}
                  style={{ width: '100%', padding: '10px 12px', background: previewOpenEmpId === 'unified' ? C.wl : T.card, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase' }}>Preview · all months</span>
                  <span style={{ fontSize: 13, color: C.fg }}>{previewOpenEmpId === 'unified' ? '−' : '+'}</span>
                </button>
                {previewOpenEmpId === 'unified' && (
                  <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, background: C.bg }}>
                    {flatMonths.filter(m => m.gross > 0 || m.net > 0).length === 0 ? (
                      <p style={{ fontSize: 12, color: C.muted, margin: 0, textAlign: 'center' }}>No salary data yet — upload a slip or add manually.</p>
                    ) : (
                      flatMonths.filter(m => m.gross > 0 || m.net > 0).map(m => {
                        const isOpen = previewMonth === m.monthKey && previewEmploymentId === m.empId
                        return (
                          <div key={m.monthKey} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
                            <button
                              onClick={() => {
                                if (isOpen) { setPreviewMonth(null); setPreviewEmploymentId(null) }
                                else { setPreviewMonth(m.monthKey); setPreviewEmploymentId(m.empId) }
                              }}
                              className="sal-acc-head" style={{ width: '100%', padding: '10px 12px', background: isOpen ? C.wl : T.card, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{monthLabel(m.monthKey)}</span>
                                <span style={{ fontSize: 10, color: C.muted, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.empName}</span>
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: m.source === 'actual' ? C.fg : m.source === 'edited' ? C.wm : C.border, color: m.source === 'actual' ? T.onTeal : m.source === 'projected' ? C.muted : T.ink }}>{m.source}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: C.muted }}>Gross <strong style={{ color: C.fg }}>{fmt(m.gross)}</strong></span>
                                <span style={{ fontSize: 11, color: C.muted }}>Net <strong style={{ color: C.green }}>{fmt(m.net)}</strong></span>
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
            </div>
          )
        })()}
      </div>

      {/* ── Forecast scenarios — Baseline + each configured change applied in order ── */}
      {wizard.intent === 'forecast' && wizard.forecastChanges.length > 0 && annualGross > 0 && (() => {
        const baseSlip = slipsWithMeta[0]
        if (!baseSlip) return null

        // Read the built timeline directly so the math reflects the actual applied changes
        // (handles multi-change correctly: each change is layered in chronological order in the build).
        const firstEmp = employments[0]
        const builtAnnualGross = firstEmp ? firstEmp.months.reduce((s, m) => s + m.gross, 0) : 0
        const builtAnnualTDS = firstEmp
          ? firstEmp.months.reduce((sum, m) => sum + (m.deductionsList || []).filter(d => /\b(tds|income\s*tax|i\.?t)\b/i.test(d.label || '')).reduce((a, d) => a + (d.amount || 0), 0), 0)
          : 0

        const baseGross = baseSlip.raw.grossSalary || baseSlip.raw.basicSalary || 0
        const baseTDSPerMonth = (baseSlip.raw.components || []).filter((d: any) => d.type === 'deduction' && /\b(tds|income\s*tax|i\.?t)\b/i.test(d.label || '')).reduce((s: number, d: any) => s + (d.amount || 0), 0)
        const baselineAnnualGross = baseGross * 12
        const baselineAnnualTDS = baseTDSPerMonth * 12

        const kindLabel = (k: ForecastChange['kind']) =>
          k === 'increment' ? 'Increment' : k === 'job_switch' ? 'Job switch' : k === 'bonus_timing' ? 'Bonus' : 'One-time payment'

        const changeLines = wizard.forecastChanges.map((fc, i) => {
          const amount = fc.amountAbs > 0 ? `₹${fc.amountAbs.toLocaleString('en-IN')}` : `${fc.amountPct}%`
          const when = fc.monthApplies ? monthLabel(fc.monthApplies) : '—'
          const retro = fc.retroactive ? ` · retro from ${fc.retroFromMonth ? monthLabel(fc.retroFromMonth) : 'earlier'}` : ''
          return `${i + 1}. ${kindLabel(fc.kind)} · ${amount} from ${when}${retro}`
        })

        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: '0 0 14px' }}>Forecast scenarios</h3>
            <div style={{ background: C.bg, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 12px', background: C.wl, fontSize: 11, fontWeight: 700, color: C.fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Scenario</span>
                <span style={{ textAlign: 'right' }}>Annual Gross</span>
                <span style={{ textAlign: 'right' }}>Annual TDS</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 12px', fontSize: 12, color: C.text }}>
                <span>Baseline (no change)</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: C.fg }}>{fmt(baselineAnnualGross)}</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: C.fg }}>{fmt(baselineAnnualTDS)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 12px', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.text, background: T.slip.fill }}>
                <span style={{ fontWeight: 600 }}>With {wizard.forecastChanges.length} change{wizard.forecastChanges.length > 1 ? 's' : ''}</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: C.fg }}>{fmt(builtAnnualGross)}</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: C.fg }}>{fmt(builtAnnualTDS)}</span>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: C.bg, borderRadius: 4 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, margin: '0 0 6px', textTransform: 'uppercase' }}>Changes applied (in order)</p>
              {changeLines.map((line, i) => (
                <p key={i} style={{ fontSize: 11, color: C.text, margin: '2px 0' }}>{line}</p>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.muted, margin: '10px 0 0', textAlign: 'center' }}>Final tax liability is computed in Your Tax.</p>
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
          <div style={{ background: T.caution.fill, border: `1px solid ${T.caution.border}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.caution.text, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠ Please verify</p>
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
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: '0 0 14px' }}>Salary summary</h3>

            <div className="sal-annual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
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
                ? "Forecast's ready. Add Other earnings and Tax breaks to see each scenario's impact."
                : "Salary's ready. Add Other earnings and Tax breaks next — your answer is in Your Tax."}
            </p>
          </div>
        )
      })()}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setWizardStep('intent-pick')} style={{ flex: 1, minWidth: 120, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Edit timeline</button>
        <button onClick={() => router.push('/dashboard/profile/documents')} style={{ flex: 1, minWidth: 120, padding: '12px', background: 'transparent', color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Upload more slips</button>
        <button onClick={() => router.push('/dashboard/profile/other-income')} style={{ flex: 1, minWidth: 120, padding: '12px', background: C.fg, color: T.onTeal, border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Other earnings →</button>
      </div>
    </div>
  )
}
