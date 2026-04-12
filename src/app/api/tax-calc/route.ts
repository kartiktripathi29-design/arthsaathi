import { NextRequest, NextResponse } from 'next/server'
import { compareTaxRegimes, getDeductionSuggestions } from '@/lib/tax-engine'
import type { TaxDeductions } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { salary, deductions, rentPaidMonthly, isMetroCity } = body

    if (!salary) {
      return NextResponse.json({ error: 'Salary data is required' }, { status: 400 })
    }

    const taxDeductions: TaxDeductions = {
      section80C: deductions?.section80C ?? 0,
      section80CCD1B: deductions?.section80CCD1B ?? 0,
      section80D: deductions?.section80D ?? 0,
      section24b: deductions?.section24b ?? 0,
      hraExemption: 0, // calculated inside compareTaxRegimes
      standardDeduction: 50000,
      otherDeductions: deductions?.otherDeductions ?? 0,
    }

    const comparison = compareTaxRegimes(
      salary,
      taxDeductions,
      rentPaidMonthly ?? 0,
      isMetroCity ?? true
    )

    const suggestions = getDeductionSuggestions(salary, taxDeductions)

    return NextResponse.json({ success: true, comparison, suggestions })
  } catch (error: any) {
    console.error('Tax calc error:', error)
    return NextResponse.json({ error: error.message || 'Tax calculation failed' }, { status: 500 })
  }
}
