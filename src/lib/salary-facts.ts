// The single source of truth for "what does this person earn in a year".
//
// Every tax-facing page (Tax Optimizer, Deductions, Exemptions) needs the same annual salary
// figures. When each page derived them its own way they disagreed — which is what caused the
// HRA-on-one-month and rough-AGTI bugs. This module centralises the read so there is exactly
// one careful figure, computed one way.
//
// Source of truth = the Salary page's month-by-month summary (av_salary_summary), which already
// accounts for mid-year raises, bonuses, corrections and job switches, and is the number the user
// actually reviewed. We fall back to avg(slip) × 12 from the raw timeline only when that summary
// isn't present (legacy data, or the user hasn't re-saved the salary wizard).
//
// Reads localStorage, so this is intentionally kept out of the pure salary-analytics.ts module.

import type { HraMonth } from './salary-analytics'

export type SalaryFactsSource = 'summary' | 'slip-average' | 'none'

export interface SalaryFacts {
  annualGross: number
  annualNet: number
  annualTDS: number
  fyStartYear: number | null
  hraBasis: HraMonth[]          // per-month Basic + HRA series (only available from the summary)
  source: SalaryFactsSource     // where the numbers came from — useful for "verify your data" hints
  synthetic: boolean            // true when the figures are the /try estimate, not a real slip/summary
}

const EMPTY: SalaryFacts = {
  annualGross: 0, annualNet: 0, annualTDS: 0, fyStartYear: null, hraBasis: [], source: 'none', synthetic: false,
}

// Only the numeric fields this module averages; raw slips carry many more we don't touch here.
interface RawSlip {
  grossSalary?: number
  netSalary?: number
  basicSalary?: number
  tdsDeducted?: number
}

// Raw monthly slips, handling both the flat-array and {employments:[{slips}]} shapes the app stores.
// Synthetic /try placeholder slips are excluded — annual figures must never derive from fabricated
// per-line data.
function readSlips(): RawSlip[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('av_salary_timeline') || 'null')
    const slips: any[] = Array.isArray(parsed) ? parsed : (parsed?.employments?.[0]?.slips || [])
    return slips.filter((s: any) => s && !s._synthetic)
  } catch {
    return []
  }
}

export function getSalaryFacts(): SalaryFacts {
  if (typeof window === 'undefined') return EMPTY

  // Preferred: the careful month-by-month summary. The Salary page only writes this when
  // annualGross > 0, so its presence already implies usable figures.
  try {
    const summary = JSON.parse(localStorage.getItem('av_salary_summary') || 'null')
    if (summary && (summary.annualGross || 0) > 0) {
      return {
        annualGross: Math.round(summary.annualGross || 0),
        annualNet: Math.round(summary.annualNet || 0),
        annualTDS: Math.round(summary.annualTDS || 0),
        fyStartYear: summary.fyStartYear ?? null,
        hraBasis: Array.isArray(summary.hraBasis) ? summary.hraBasis : [],
        source: 'summary',
        synthetic: !!summary._synthetic,
      }
    }
  } catch {
    /* fall through to the slip-average fallback */
  }

  // Fallback: average the raw slips and annualise. Mirrors the per-page logic this module replaces
  // (gross from grossSalary; net from netSalary, else basicSalary).
  const slips = readSlips()
  if (slips.length > 0) {
    const avg = (pick: (s: RawSlip) => number | undefined) =>
      slips.reduce((t, s) => t + (pick(s) || 0), 0) / slips.length
    return {
      annualGross: Math.round(avg(s => s.grossSalary) * 12),
      annualNet: Math.round(avg(s => s.netSalary || s.basicSalary) * 12),
      annualTDS: Math.round(avg(s => s.tdsDeducted) * 12),
      fyStartYear: null,
      hraBasis: [],
      source: 'slip-average',
      synthetic: false,
    }
  }

  return EMPTY
}
