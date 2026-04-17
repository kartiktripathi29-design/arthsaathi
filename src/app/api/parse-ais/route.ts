import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const maxDuration = 60

const AIS_SYSTEM = `You are an expert Indian tax document parser specialising in AIS (Annual Information Statement) and Form 26AS from incometax.gov.in.

Extract ALL financial data from the document comprehensively.

Return ONLY raw JSON — no markdown, no code blocks, no explanation.

Schema:
{
  "pan": "string",
  "taxpayerName": "string",
  "assessmentYear": "string",
  "tdsEntries": [
    {
      "deductorName": "string",
      "deductorTAN": "string",
      "incomeType": "salary|interest|rent|professional|other",
      "grossAmount": 0,
      "tdsDeducted": 0,
      "quarter": "Full Year"
    }
  ],
  "taxPayments": [
    { "type": "advance_tax|self_assessment", "amount": 0, "date": "string", "bsrCode": "string" }
  ],
  "totalTDSDeducted": 0,
  "totalTaxPaid": 0,
  "totalTaxCredit": 0,
  "salaryIncome": 0,
  "interestIncome": [
    { "source": "string", "type": "savings|fd|bonds|other", "grossAmount": 0, "tdsDeducted": 0, "netAmount": 0 }
  ],
  "capitalGains": [
    {
      "assetType": "equity|mutual_fund|property|other",
      "assetName": "string",
      "purchaseDate": "string",
      "saleDate": "string",
      "purchaseAmount": 0,
      "saleAmount": 0,
      "gain": 0,
      "gainType": "STCG|LTCG",
      "taxRate": 0,
      "taxPayable": 0
    }
  ],
  "dividendIncome": 0,
  "rentalIncome": 0,
  "otherIncome": [
    { "source": "string", "type": "dividend|rental|freelance|business|other", "grossAmount": 0, "tdsDeducted": 0 }
  ],
  "totalInterestIncome": 0,
  "totalCapitalGains": 0,
  "totalOtherIncome": 0,
  "grandTotalIncome": 0,
  "totalTaxOnAllIncome": 0,
  "additionalTaxOverTDS": 0,
  "alerts": []
}

Capital gains tax rules (AY 2025-26):
- Equity STCG (held < 12 months): 20% flat
- Equity LTCG (held > 12 months): 12.5% above ₹1.25L exemption
- Debt MF STCG: added to income, taxed at slab rate
- Debt MF LTCG: added to income, taxed at slab rate (indexation removed)
- Property LTCG: 12.5% without indexation

For alerts array, include warnings like:
- "MF gains of ₹X add to your taxable income — employer TDS may not cover this"
- "FD interest of ₹X is taxed at your slab rate, not just 10% TDS"
- "Dividend income of ₹X is fully taxable at slab rate"

All numbers must be plain integers/decimals.
If a section has no transactions, use empty array [] or 0.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data, mediaType } = body

    if (!base64Data || !mediaType) {
      return NextResponse.json({ error: 'base64Data and mediaType required' }, { status: 400 })
    }

    const isImage = mediaType.startsWith('image/')
    const content: any[] = [
      isImage
        ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
      {
        type: 'text',
        text: `Analyse this Indian tax document (AIS or Form 26AS) completely.

Extract:
1. All TDS entries (salary, interest, rent, professional fees)
2. All tax payments (advance tax, self-assessment)
3. Salary income (from Section 192 TDS)
4. Interest income (FD interest, savings account interest)
5. Capital gains (mutual fund redemptions, equity sales, property)
6. Dividend income
7. Rental income
8. Any other income

For each capital gain entry:
- Determine if STCG or LTCG based on holding period
- Apply correct tax rate: equity STCG 20%, equity LTCG 12.5% (above ₹1.25L), debt at slab

Calculate grand total income (all sources clubbed) and total tax on that income.
Calculate additional tax beyond TDS already deducted.

Generate specific alerts for any income that users commonly overlook.

Return only the JSON.`
      }
    ]

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      system: AIS_SYSTEM,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not extract data from document')

    const parsed = JSON.parse(jsonMatch[0])

    // Safety recalculations
    if (parsed.tdsEntries?.length > 0) {
      parsed.totalTDSDeducted = parsed.tdsEntries.reduce((s: number, e: any) => s + (Number(e.tdsDeducted) || 0), 0)
      parsed.salaryIncome = parsed.tdsEntries
        .filter((e: any) => e.incomeType === 'salary')
        .reduce((s: number, e: any) => s + (Number(e.grossAmount) || 0), 0)
    }

    parsed.totalInterestIncome = (parsed.interestIncome || []).reduce((s: number, i: any) => s + (Number(i.grossAmount) || 0), 0)
    parsed.totalCapitalGains = (parsed.capitalGains || []).reduce((s: number, c: any) => s + (Number(c.gain) || 0), 0)
    parsed.totalOtherIncome = (parsed.otherIncome || []).reduce((s: number, o: any) => s + (Number(o.grossAmount) || 0), 0)

    const totalTaxPaid = (parsed.taxPayments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)
    parsed.totalTaxPaid = totalTaxPaid
    parsed.totalTaxCredit = (Number(parsed.totalTDSDeducted) || 0) + totalTaxPaid

    if (!parsed.grandTotalIncome) {
      parsed.grandTotalIncome = (parsed.salaryIncome || 0) +
        (parsed.totalInterestIncome || 0) +
        (parsed.totalCapitalGains || 0) +
        (parsed.dividendIncome || 0) +
        (parsed.rentalIncome || 0) +
        (parsed.totalOtherIncome || 0)
    }

    // Generate alerts if missing
    if (!parsed.alerts || parsed.alerts.length === 0) {
      const alerts: string[] = []
      if (parsed.totalInterestIncome > 10000) {
        alerts.push(`FD/interest income of ₹${parsed.totalInterestIncome.toLocaleString('en-IN')} is taxed at your slab rate (not just 10% TDS). You may owe additional tax.`)
      }
      if (parsed.totalCapitalGains > 0) {
        alerts.push(`Capital gains of ₹${parsed.totalCapitalGains.toLocaleString('en-IN')} are taxable separately. Employer TDS does not cover this.`)
      }
      if (parsed.dividendIncome > 0) {
        alerts.push(`Dividend income of ₹${parsed.dividendIncome.toLocaleString('en-IN')} is fully taxable at your slab rate since FY 2020-21.`)
      }
      if (parsed.rentalIncome > 0) {
        alerts.push(`Rental income of ₹${parsed.rentalIncome.toLocaleString('en-IN')} must be declared. 30% standard deduction allowed on net rental income.`)
      }
      parsed.alerts = alerts
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('AIS parse error:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse document' }, { status: 500 })
  }
}
