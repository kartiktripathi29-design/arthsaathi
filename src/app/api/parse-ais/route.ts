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

    const parsed = await parseSalaryFromBase64(base64Data, mediaType)

    // Basic validation
    if (!parsed.grossSalary && !parsed.netSalary) {
      return NextResponse.json(
        { error: 'Could not extract salary data. Please ensure the document is a clear salary slip.' },
        { status: 422 }
      )
    }

    // Fill in computed fields if missing
    if (!parsed.ctcMonthly && parsed.grossSalary) {
      parsed.ctcMonthly = parsed.grossSalary + parsed.employerPF
      parsed.ctcAnnual = parsed.ctcMonthly * 12
    }
    if (!parsed.netSalary && parsed.grossSalary) {
      parsed.netSalary = parsed.grossSalary - parsed.totalDeductions
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('Salary parse error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse salary slip' },
      { status: 500 }
    )
  }
}
