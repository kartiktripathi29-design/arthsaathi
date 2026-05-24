// Pure helpers for salary-page analytics — confidence scoring, anomaly detection,
// TDS aggregation. No side effects, no React. Safe to memoize.

export type SourceKind = 'actual' | 'edited' | 'projected'

export interface MonthLike {
  monthKey: string
  gross: number
  net: number
  source: SourceKind
  deductionsList?: { label: string; amount: number }[]
}

export interface EmploymentLike {
  id: string
  fromMonth: string
  toMonth: string
  months: MonthLike[]
}

// ─── Confidence ───────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ConfidenceResult {
  level: ConfidenceLevel
  score: number               // 0–100
  actualCount: number         // months backed by uploaded slip or manual entry
  totalInRange: number        // months across all employment ranges
  factors: string[]
  hint: string                // actionable suggestion to bump score
  caveat: string
}

export function computeConfidence(employments: EmploymentLike[]): ConfidenceResult {
  let actualCount = 0
  let totalInRange = 0
  for (const emp of employments) {
    for (const m of emp.months) {
      if (m.monthKey < emp.fromMonth || m.monthKey > emp.toMonth) continue
      totalInRange += 1
      if (m.source === 'actual' || m.source === 'edited') actualCount += 1
    }
  }

  const factors: string[] = []
  let score: number
  let level: ConfidenceLevel

  if (totalInRange === 0) {
    return {
      level: 'low', score: 0, actualCount: 0, totalInRange: 0,
      factors: ['No salary data yet'],
      hint: 'Upload at least one salary slip to begin.',
      caveat: 'This is a forecast/scenario. Actual liability will differ when actual data is available.',
    }
  }

  if (actualCount >= 12) { score = 95; level = 'high' }
  else if (actualCount >= 9) { score = 88; level = 'high' }
  else if (actualCount >= 6) { score = 78; level = 'medium' }
  else if (actualCount >= 3) { score = 72; level = 'medium' }
  else { score = 55; level = 'low' }

  factors.push(`${actualCount} of ${totalInRange} month${totalInRange === 1 ? '' : 's'} from uploaded slips or manual entry`)
  if (totalInRange - actualCount > 0) factors.push(`${totalInRange - actualCount} month(s) projected from base salary`)

  let hint = ''
  if (actualCount < 12 && actualCount >= 9) hint = `Upload the remaining ${12 - actualCount} month(s) to bump confidence to ~95%.`
  else if (actualCount < 9 && actualCount >= 6) hint = `Add 3 more actual slips to reach HIGH confidence.`
  else if (actualCount < 6) hint = `Upload more monthly slips to improve accuracy.`

  let caveat: string
  if (level === 'high') caveat = 'Based on complete salary data. This number is reliable for filing.'
  else if (level === 'medium') caveat = 'Based on assumptions for some months. Verify when you have all slips.'
  else caveat = 'Limited actual data. Treat the result as a scenario, not a final number.'

  return { level, score, actualCount, totalInRange, factors, hint, caveat }
}

// ─── Anomaly detection ────────────────────────────────────────────────────

export type AnomalyKind = 'drop' | 'jump' | 'zero'
export interface Anomaly {
  monthKey: string
  kind: AnomalyKind
  delta: number     // signed pct change vs prior month, or 0 for 'zero'
  message: string
}

export function detectAnomalies(emp: EmploymentLike): Anomaly[] {
  const monthsAsc = [...emp.months]
    .filter(m => m.monthKey >= emp.fromMonth && m.monthKey <= emp.toMonth)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  const out: Anomaly[] = []
  for (let i = 0; i < monthsAsc.length; i++) {
    const m = monthsAsc[i]
    // Salary = 0 inside the employment range: prompt user
    if (m.gross === 0 && (m.source === 'actual' || m.source === 'edited')) {
      out.push({ monthKey: m.monthKey, kind: 'zero', delta: 0, message: `${m.monthKey}: salary is ₹0 — confirm if this is unpaid leave.` })
      continue
    }
    if (i === 0) continue
    const prev = monthsAsc[i - 1]
    if (prev.gross <= 0) continue
    const delta = (m.gross - prev.gross) / prev.gross
    if (delta <= -0.5) {
      out.push({ monthKey: m.monthKey, kind: 'drop', delta, message: `Salary dropped ${Math.round(Math.abs(delta) * 100)}% in ${m.monthKey}.` })
    } else if (delta >= 0.3) {
      out.push({ monthKey: m.monthKey, kind: 'jump', delta, message: `Salary jumped ${Math.round(delta * 100)}% in ${m.monthKey} — confirm if this is an increment.` })
    }
  }
  return out
}

// ─── TDS aggregation ──────────────────────────────────────────────────────

const TDS_PATTERN = /\b(tds|income\s*tax|i\.?t|tax\s*deducted)\b/i

export function extractAnnualTDS(employments: EmploymentLike[]): number {
  let total = 0
  for (const emp of employments) {
    for (const m of emp.months) {
      if (m.monthKey < emp.fromMonth || m.monthKey > emp.toMonth) continue
      for (const d of m.deductionsList || []) {
        if (TDS_PATTERN.test(d.label || '')) total += d.amount || 0
      }
    }
  }
  return total
}

export function extractAnnualGross(employments: EmploymentLike[]): number {
  let total = 0
  for (const emp of employments) {
    for (const m of emp.months) {
      if (m.monthKey < emp.fromMonth || m.monthKey > emp.toMonth) continue
      total += m.gross || 0
    }
  }
  return total
}
