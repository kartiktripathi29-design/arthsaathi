import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const maxDuration = 60

const AIS_SYSTEM = `You are an expert Indian tax document parser specialising in AIS (Annual Information Statement) and Form 26AS from incometax.gov.in.

Extract ALL financial data from the document pages provided.

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

Rules:
- For Form 26AS PART-I: use the TOTAL row per deductor for tdsEntries
- Section 192 = salary income
- Section 194A = interest income
- All numbers as plain integers/decimals
- For alerts: warn about FD interest taxed at slab, MF gains, dividend income
- If no transactions in a section, use empty array or 0`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pageImages, base64Data, mediaType, isRenderedPDF } = body

    let content: any[]

    if (isRenderedPDF && pageImages?.length > 0) {
      // Multiple page images rendered from PDF client-side
      content = [
        ...pageImages.map((img: string) => ({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: img },
        })),
        {
          type: 'text',
          text: `These are rendered pages from an Indian tax document (AIS or Form 26AS). 
Extract all TDS entries, tax payments, income sources, and capital gains.
For PART-I of Form 26AS, use the Total row for each deductor.
Calculate grand total income and total tax credit.
Return only the JSON.`,
        }
      ]
    } else if (base64Data) {
      // Direct file upload (image or unencrypted PDF)
      const isImage = mediaType?.startsWith('image/')
      content = [
        isImage
          ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }
          : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } },
        { type: 'text', text: 'Parse this Form 26AS / AIS and return only the JSON.' }
      ]
    } else {
      return NextResponse.json({ error: 'No document data provided' }, { status: 400 })
    }

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
      parsed.grandTotalIncome = (parsed.salaryIncome || 0) + (parsed.totalInterestIncome || 0) +
        (parsed.totalCapitalGains || 0) + (parsed.dividendIncome || 0) +
        (parsed.rentalIncome || 0) + (parsed.totalOtherIncome || 0)
    }
    if (!parsed.alerts || parsed.alerts.length === 0) {
      const alerts: string[] = []
      if (parsed.totalInterestIncome > 10000) alerts.push(`FD/interest income of ₹${Math.round(parsed.totalInterestIncome).toLocaleString('en-IN')} is taxed at your slab rate, not just 10% TDS.`)
      if (parsed.totalCapitalGains > 0) alerts.push(`Capital gains of ₹${Math.round(parsed.totalCapitalGains).toLocaleString('en-IN')} are taxable separately — employer TDS does not cover this.`)
      if (parsed.dividendIncome > 0) alerts.push(`Dividend income of ₹${Math.round(parsed.dividendIncome).toLocaleString('en-IN')} is fully taxable at your slab rate.`)
      if (parsed.rentalIncome > 0) alerts.push(`Rental income of ₹${Math.round(parsed.rentalIncome).toLocaleString('en-IN')} must be declared in your ITR.`)
      parsed.alerts = alerts
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('AIS parse error:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse document' }, { status: 500 })
  }
}
