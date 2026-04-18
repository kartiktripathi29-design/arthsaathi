import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const maxDuration = 60

async function extractTextFromPDF(base64Data: string, password?: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  
  const tmpPath = join(tmpdir(), `ais_${Date.now()}.pdf`)
  try {
    writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))
    
    const opts: any = { url: `file://${tmpPath}`, verbosity: 0 }
    if (password) opts.password = password
    
    const parser = new PDFParse(opts)
    
    let result: any
    try {
      result = await parser.getText()
    } catch (e: any) {
      const msg = String(e?.message || e?.name || '').toLowerCase()
      if (msg.includes('password') || msg.includes('incorrect') || msg.includes('encrypted')) {
        throw new Error('incorrect_password')
      }
      throw e
    }
    
    const text = result?.text || 
      (result?.pages || []).map((p: any) => p.text || '').join('\n')
    
    return text
  } finally {
    try { if (existsSync(tmpPath)) unlinkSync(tmpPath) } catch {}
  }
}

const AIS_SYSTEM = `You are an expert Indian tax document parser for AIS and Form 26AS from incometax.gov.in.
Extract ALL financial data. Return ONLY raw JSON — no markdown, no code blocks.
Schema:
{
  "pan":"","taxpayerName":"","assessmentYear":"",
  "tdsEntries":[{"deductorName":"","deductorTAN":"","incomeType":"salary","grossAmount":0,"tdsDeducted":0,"quarter":"Full Year"}],
  "taxPayments":[{"type":"self_assessment","amount":0,"date":"","bsrCode":""}],
  "totalTDSDeducted":0,"totalTaxPaid":0,"totalTaxCredit":0,"salaryIncome":0,
  "interestIncome":[{"source":"","type":"fd","grossAmount":0,"tdsDeducted":0,"netAmount":0}],
  "capitalGains":[{"assetType":"equity","assetName":"","purchaseDate":"","saleDate":"","purchaseAmount":0,"saleAmount":0,"gain":0,"gainType":"STCG","taxRate":20,"taxPayable":0}],
  "dividendIncome":0,"rentalIncome":0,
  "otherIncome":[{"source":"","type":"other","grossAmount":0,"tdsDeducted":0}],
  "totalInterestIncome":0,"totalCapitalGains":0,"totalOtherIncome":0,"grandTotalIncome":0,
  "totalTaxOnAllIncome":0,"additionalTaxOverTDS":0,"alerts":[]
}
For Form 26AS PART-I use the Total row per deductor. Section 192=salary, 194A=interest. Numbers as integers only.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data, mediaType, password } = body

    if (!base64Data) {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 })
    }

    let content: any[]

    if (mediaType === 'application/pdf') {
      // Extract text server-side using pdf-parse (supports passwords, works on Vercel)
      let pdfText: string
      try {
        pdfText = await extractTextFromPDF(base64Data, password || undefined)
      } catch (e: any) {
        if (e.message === 'incorrect_password') {
          return NextResponse.json({ error: 'incorrect_password' }, { status: 422 })
        }
        throw e
      }
      content = [{
        type: 'text',
        text: `Extract all TDS, income, and tax payment data from this Form 26AS / AIS document text. Return only JSON.\n\n${pdfText}`
      }]
    } else {
      // Image upload — send directly
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: 'Extract all TDS and income data from this Form 26AS / AIS image. Return only JSON.' }
      ]
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
      if (parsed.totalInterestIncome > 10000) alerts.push(`Interest income of ₹${Math.round(parsed.totalInterestIncome).toLocaleString('en-IN')} taxed at slab rate — not just 10% TDS.`)
      if (parsed.totalCapitalGains > 0) alerts.push(`Capital gains of ₹${Math.round(parsed.totalCapitalGains).toLocaleString('en-IN')} taxable separately.`)
      if (parsed.dividendIncome > 0) alerts.push(`Dividend income of ₹${Math.round(parsed.dividendIncome).toLocaleString('en-IN')} fully taxable at slab rate.`)
      parsed.alerts = alerts
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('AIS parse error:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse document' }, { status: 500 })
  }
}
