import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const maxDuration = 60

// Extract text from PDF using pdfjs — no canvas, no images needed
async function extractPDFText(base64Data: string, password?: string): Promise<string> {
  // Use require to avoid static analysis by bundler
  const pdfjsPath = 'pdfjs-dist/legacy/build/pdf.mjs'
  const pdfjs = await new Function('path', 'return import(path)')(pdfjsPath)

  pdfjs.GlobalWorkerOptions.workerSrc = ''

  const pdfBuffer = Buffer.from(base64Data, 'base64')

  const loadOptions: any = {
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  }
  if (password) loadOptions.password = password

  let pdf: any
  try {
    pdf = await pdfjs.getDocument(loadOptions).promise
  } catch (e: any) {
    const msg = String(e?.message || e?.name || '').toLowerCase()
    if (msg.includes('password') || msg.includes('incorrect') || e?.code === 1 || e?.code === 2) {
      throw new Error('incorrect_password')
    }
    throw e
  }

  let fullText = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
    fullText += `\n--- Page ${i} ---\n${pageText}`
  }

  return fullText
}

const AIS_SYSTEM = `You are an expert Indian tax document parser for AIS and Form 26AS from incometax.gov.in.

Extract ALL financial data from the document text provided.

Return ONLY raw JSON — no markdown, no code blocks, no explanation.

Schema:
{
  "pan":"","taxpayerName":"","assessmentYear":"",
  "tdsEntries":[{"deductorName":"","deductorTAN":"","incomeType":"salary","grossAmount":0,"tdsDeducted":0,"quarter":"Full Year"}],
  "taxPayments":[{"type":"self_assessment","amount":0,"date":"","bsrCode":""}],
  "totalTDSDeducted":0,"totalTaxPaid":0,"totalTaxCredit":0,
  "salaryIncome":0,
  "interestIncome":[{"source":"","type":"fd","grossAmount":0,"tdsDeducted":0,"netAmount":0}],
  "capitalGains":[{"assetType":"equity","assetName":"","purchaseDate":"","saleDate":"","purchaseAmount":0,"saleAmount":0,"gain":0,"gainType":"STCG","taxRate":20,"taxPayable":0}],
  "dividendIncome":0,"rentalIncome":0,
  "otherIncome":[{"source":"","type":"other","grossAmount":0,"tdsDeducted":0}],
  "totalInterestIncome":0,"totalCapitalGains":0,"totalOtherIncome":0,"grandTotalIncome":0,
  "totalTaxOnAllIncome":0,"additionalTaxOverTDS":0,"alerts":[]
}

Rules:
- For Form 26AS PART-I: find the Total row per deductor
- Section 192 = salary income, 194A = interest income
- All numbers as plain integers/decimals only
- Generate alerts for commonly missed income (FD interest, capital gains, dividends)`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data, mediaType, password, pageImages, isRenderedPDF } = body

    let content: any[]

    if (isRenderedPDF && pageImages?.length > 0) {
      // Pre-rendered images
      content = [
        ...pageImages.map((img: string) => ({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: img },
        })),
        { type: 'text', text: 'Extract all data from these Form 26AS / AIS pages. Return only JSON.' }
      ]
    } else if (base64Data && mediaType === 'application/pdf') {
      // Extract text from PDF server-side
      let pdfText: string
      try {
        pdfText = await extractPDFText(base64Data, password || undefined)
      } catch (e: any) {
        if (e.message === 'incorrect_password') {
          return NextResponse.json({ error: 'incorrect_password' }, { status: 422 })
        }
        throw e
      }
      content = [
        {
          type: 'text',
          text: `Here is the extracted text from a Form 26AS / AIS PDF document. Extract all TDS entries, income sources, and tax payments. Return only JSON.\n\n${pdfText}`
        }
      ]
    } else if (base64Data) {
      // Image upload
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: 'Extract all data from this Form 26AS / AIS image. Return only JSON.' }
      ]
    } else {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 })
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
    if (!jsonMatch) throw new Error('Could not extract data')
    const parsed = JSON.parse(jsonMatch[0])

    // Recalculate totals
    if (parsed.tdsEntries?.length > 0) {
      parsed.totalTDSDeducted = parsed.tdsEntries.reduce((s: number, e: any) => s + (Number(e.tdsDeducted) || 0), 0)
      parsed.salaryIncome = parsed.tdsEntries.filter((e: any) => e.incomeType === 'salary')
        .reduce((s: number, e: any) => s + (Number(e.grossAmount) || 0), 0)
    }
    parsed.totalInterestIncome = (parsed.interestIncome || []).reduce((s: number, i: any) => s + (Number(i.grossAmount) || 0), 0)
    parsed.totalCapitalGains = (parsed.capitalGains || []).reduce((s: number, c: any) => s + (Number(c.gain) || 0), 0)
    parsed.totalTaxCredit = (Number(parsed.totalTDSDeducted) || 0) + (Number(parsed.totalTaxPaid) || 0)
    if (!parsed.grandTotalIncome) {
      parsed.grandTotalIncome = (parsed.salaryIncome || 0) + (parsed.totalInterestIncome || 0) +
        (parsed.totalCapitalGains || 0) + (parsed.dividendIncome || 0) + (parsed.rentalIncome || 0)
    }
    if (!parsed.alerts?.length) {
      const alerts: string[] = []
      if (parsed.totalInterestIncome > 10000) alerts.push(`Interest income of ₹${Math.round(parsed.totalInterestIncome).toLocaleString('en-IN')} is taxed at your slab rate — not just 10% TDS.`)
      if (parsed.totalCapitalGains > 0) alerts.push(`Capital gains of ₹${Math.round(parsed.totalCapitalGains).toLocaleString('en-IN')} are taxable separately — employer TDS does not cover this.`)
      if (parsed.dividendIncome > 0) alerts.push(`Dividend income of ₹${Math.round(parsed.dividendIncome).toLocaleString('en-IN')} is fully taxable at your slab rate.`)
      parsed.alerts = alerts
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('AIS parse error:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse document' }, { status: 500 })
  }
}
