/**
 * Pure normalization for a parsed ITR — turns the model's extracted fields (from a filed ITR JSON,
 * a full ITR PDF, or an ITR-V acknowledgement) into the response the parse-itr route returns and the
 * Past years page renders. No I/O, no model calls — so it's unit-testable in isolation (the model
 * extraction is the only non-deterministic part, and it's mocked by handing this a `parsed` object).
 */

import {
  computeSavings, computeYearTax, isSupportedFY,
  type IncomeComponents, type Regime, type SavingsResult, type SeniorStatus,
} from './tax-history.ts'

/** The shape the model is asked to emit (see ITR_SYSTEM in the route). All fields best-effort. */
export interface ParsedITR {
  documentType?: string
  assessmentYear?: string
  itrForm?: string
  filedRegime?: string
  isSalaried?: boolean
  grossSalary?: number | string
  exemptAllowances?: number | string
  otherSlabIncome?: number | string
  chapterVIA?: number | string
  reportedGrossTotalIncome?: number | string
  reportedTotalIncome?: number | string
  reportedTotalTax?: number | string
  reportedRefundOrPayable?: number | string
  missing?: string[]
  notes?: string
}

export interface NormalizedReturn {
  fy: string
  ay: string
  fySupported: boolean
  documentType: string
  itrForm: string
  filedRegime: Regime
  /** Whether the filed regime came from the document text or was inferred from the reported tax. */
  regimeSource: 'document' | 'reported_tax'
  components: IncomeComponents
  reported: { grossTotalIncome: number; totalIncome: number; totalTax: number; refundOrPayable: number }
  missing: string[]
  canComputeSavings: boolean
  savings: SavingsResult | null
  notes: string
}

/** "AY 2025-26" → "FY 2024-25". The engine is FY-keyed. '' when no 4-digit year is present. */
export function fyFromAY(ay: string): string {
  const m = (ay || '').match(/(\d{4})-(\d{2,4})/)
  if (!m) return ''
  const fyStart = parseInt(m[1], 10) - 1
  return `FY ${fyStart}-${(fyStart + 1).toString().slice(2)}`
}

export function normalizeReturn(parsed: ParsedITR, seniorStatus?: string): NormalizedReturn {
  // Only keep an assessment year that actually carries a 4-digit year — the model emits "unknown"
  // (or other junk) when it can't read it, and that must not surface as a label downstream.
  const ay = /\d{4}/.test(parsed.assessmentYear || '') ? String(parsed.assessmentYear) : ''
  const fy = fyFromAY(ay)
  const modelRegime: Regime = parsed.filedRegime === 'old' ? 'old' : 'new'
  const senior: SeniorStatus = seniorStatus === 'senior' || seniorStatus === 'super_senior' ? seniorStatus : 'normal'
  const components: IncomeComponents = {
    grossSalary: Number(parsed.grossSalary) || 0,
    exemptAllowances: Number(parsed.exemptAllowances) || 0,
    otherSlabIncome: Number(parsed.otherSlabIncome) || 0,
    chapterVIA: Number(parsed.chapterVIA) || 0,
    isSalaried: parsed.isSalaried !== false,
  }

  const missing: string[] = Array.isArray(parsed.missing) ? parsed.missing : []
  const fySupported = !!fy && isSupportedFY(fy)
  // Without gross salary we can't honestly recompute the alternate regime — gate the savings calc.
  const canComputeSavings = fySupported && (Number(components.grossSalary) || 0) > 0 && !missing.includes('grossSalary')

  // Which regime was actually filed? The A20 "opting out of 115BAC" checkbox is read by the model and
  // is easy to misread (Yes/No OCR), and it flips the entire comparison. The return's own reported
  // total tax is ground truth: recompute both regimes and, when one clearly reproduces the reported
  // tax, trust THAT as the filed regime over the checkbox. Only overrides on a clear match.
  const reportedTax = Number(parsed.reportedTotalTax) || 0
  let filedRegime: Regime = modelRegime
  let regimeSource: 'document' | 'reported_tax' = 'document'
  if (canComputeSavings && reportedTax > 0) {
    const oldT = computeYearTax(fy, 'old', components, senior)?.totalTax
    const newT = computeYearTax(fy, 'new', components, senior)?.totalTax
    if (oldT != null && newT != null) {
      const dOld = Math.abs(oldT - reportedTax)
      const dNew = Math.abs(newT - reportedTax)
      const tol = Math.max(5000, reportedTax * 0.05) // "clearly matches" the return's tax
      const inferred: Regime | null = dOld <= dNew && dOld <= tol ? 'old'
        : dNew < dOld && dNew <= tol ? 'new'
        : null
      if (inferred) { filedRegime = inferred; regimeSource = 'reported_tax' }
    }
  }

  const savings = canComputeSavings ? computeSavings(fy, filedRegime, components, senior) : null

  return {
    fy,
    ay,
    fySupported,
    documentType: parsed.documentType || 'unknown',
    itrForm: parsed.itrForm || 'unknown',
    filedRegime,
    regimeSource,
    components,
    reported: {
      grossTotalIncome: Number(parsed.reportedGrossTotalIncome) || 0,
      totalIncome: Number(parsed.reportedTotalIncome) || 0,
      totalTax: reportedTax,
      refundOrPayable: Number(parsed.reportedRefundOrPayable) || 0,
    },
    missing,
    canComputeSavings,
    savings,
    notes: parsed.notes || '',
  }
}
