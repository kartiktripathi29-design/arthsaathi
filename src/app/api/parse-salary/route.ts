import { NextRequest, NextResponse } from 'next/server'
import { parseSalaryFromBase64 } from '@/lib/claude'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data, mediaType, fileName } = body

    if (!base64Data || !mediaType) {
      return NextResponse.json({ error: 'base64Data and mediaType are required' }, { status: 400 })
    }

    const slips = await parseSalaryFromBase64(base64Data, mediaType)

    if (!Array.isArray(slips) || slips.length === 0) {
      return NextResponse.json(
        { error: 'Could not extract salary data. Please ensure the document is a clear salary slip.' },
        { status: 422 }
      )
    }

    // Filter out any slip that has neither gross nor net (likely a parse miss)
    const validSlips = slips.filter(p => p && (p.grossSalary || p.netSalary))
    if (validSlips.length === 0) {
      return NextResponse.json(
        { error: 'Could not extract salary data from any page. Please ensure the document is a clear salary slip.' },
        { status: 422 }
      )
    }

    // Fill in computed fields per slip
    for (const parsed of validSlips) {
      if (!parsed.ctcMonthly && parsed.grossSalary) {
        parsed.ctcMonthly = parsed.grossSalary + (parsed.employerPF || 0)
        parsed.ctcAnnual = parsed.ctcMonthly * 12
      }
      if (!parsed.netSalary && parsed.grossSalary) {
        parsed.netSalary = parsed.grossSalary - (parsed.totalDeductions || 0)
      }
    }

    return NextResponse.json({
      success: true,
      data: validSlips,
      count: validSlips.length,
      skipped: slips.length - validSlips.length,
    })
  } catch (error: any) {
    console.error('Salary parse error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse salary slip' },
      { status: 500 }
    )
  }
}
