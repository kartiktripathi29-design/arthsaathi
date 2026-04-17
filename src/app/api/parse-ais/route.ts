import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const maxDuration = 60

const AIS_PARSE_SYSTEM = `You are an expert Indian tax document parser specializing in Form 26AS and AIS documents from the Income Tax Department of India.

Extract ALL TDS and tax payment data from the document.

Return ONLY valid JSON with no markdown formatting, no code blocks, no explanation. Just raw JSON.

Use this exact schema:
{
  "pan": "string",
  "assessmentYear": "string",
  "taxpayerName": "string",
  "tdsEntries": [
    {
      "deductorName": "string",
      "deductorTAN": "string",
      "incomeType": "salary",
      "grossAmount": 2915115,
      "tdsDeducted": 563717,
      "quarter": "Full Year"
    }
  ],
  "taxPayments": [],
  "totalTDSDeducted": 563717,
  "totalTaxPaid": 0,
  "totalTaxCredit": 563717
}

Critical rules:
- totalTDSDeducted must equal the sum of ALL tdsDeducted values across all entries
- totalTaxCredit = totalTDSDeducted + totalTaxPaid
- For Section 192 (Salary TDS), incomeType = "salary"
- For Section 194A (Interest), incomeType = "interest"
- All number values must be plain integers or decimals, never strings
- grossAmount is "Total Amount Paid/Credited" column
- tdsDeducted is "Total Tax Deducted" column
- If multiple rows exist for same deductor, sum them into one entry
- taxpayerName must be extracted exactly as shown in the document
- assessmentYear format: "2025-26" not "AY 2025-26"`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data, mediaType } = body

    if (!base64Data || !mediaType) {
      return NextResponse.json({ error: 'base64Data and mediaType are required' }, { status: 400 })
    }

    const isImage = mediaType.startsWith('image/')

    const content: any[] = [
      isImage
        ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
      {
        type: 'text',
        text: `Parse this Form 26AS / Annual Tax Statement from Income Tax Department of India.

Extract:
1. Taxpayer name and PAN
2. Assessment year
3. ALL TDS entries from PART-I (Tax Deducted at Source) - use the TOTAL row for each deductor
4. Any advance tax or self-assessment tax payments
5. Calculate total TDS deducted and total tax credit

Return ONLY the JSON object, nothing else.`
      }
    ]

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      system: AIS_PARSE_SYSTEM,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Clean up response — remove markdown if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not extract structured data from document')

    const parsed = JSON.parse(jsonMatch[0])

    // Always recalculate totals from entries as safety net
    if (parsed.tdsEntries?.length > 0) {
      const sumTDS = parsed.tdsEntries.reduce((s: number, e: any) => s + (Number(e.tdsDeducted) || 0), 0)
      if (sumTDS > 0) parsed.totalTDSDeducted = sumTDS
    }
    const totalTaxPaid = parsed.taxPayments?.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) || 0
    parsed.totalTaxPaid = totalTaxPaid
    parsed.totalTaxCredit = (Number(parsed.totalTDSDeducted) || 0) + totalTaxPaid

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('AIS parse error:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse document' }, { status: 500 })
  }
}
