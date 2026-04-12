import { NextRequest, NextResponse } from 'next/server'
import { generateInvestmentPlan } from '@/lib/claude'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { monthlyInvestable, annualIncome, age, goals, riskProfile } = body

    if (!monthlyInvestable || !annualIncome) {
      return NextResponse.json({ error: 'monthlyInvestable and annualIncome are required' }, { status: 400 })
    }

    const raw = await generateInvestmentPlan(
      monthlyInvestable,
      annualIncome,
      age ?? 30,
      goals ?? ['retirement', 'emergency fund'],
      riskProfile ?? 'moderate'
    )

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid plan format')
    const plan = JSON.parse(jsonMatch[0])

    // Build 20-year corpus projection
    const projections = []
    let corpus = 0
    const avgReturn = riskProfile === 'aggressive' ? 0.14 : riskProfile === 'conservative' ? 0.08 : 0.11
    for (let yr = 1; yr <= 20; yr++) {
      corpus = (corpus + monthlyInvestable * 12) * (1 + avgReturn)
      projections.push({ year: yr, corpus: Math.round(corpus), invested: monthlyInvestable * 12 * yr })
    }
    plan.projections = projections

    return NextResponse.json({ success: true, plan })
  } catch (error: any) {
    console.error('Invest plan error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate plan' }, { status: 500 })
  }
}
