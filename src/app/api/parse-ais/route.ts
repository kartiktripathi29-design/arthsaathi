import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const maxDuration = 60

// ─── AIS JSON Parser ─────────────────────────────────────────────────────
// Parses the official AIS JSON downloaded from incometax.gov.in

function parseAISJson(raw: any): any {
  try {
    // AIS JSON structure from IT portal
    const ais = raw?.aisData || raw?.AISData || raw

    const result: any = {
      pan: '',
      taxpayerName: '',
      assessmentYear: '',
      tdsEntries: [],
      taxPayments: [],
      totalTDSDeducted: 0,
      totalTaxPaid: 0,
      totalTaxCredit: 0,
      salaryIncome: 0,
      interestIncome: [],
      capitalGains: [],
      dividendIncome: 0,
      rentalIncome: 0,
      otherIncome: [],
      totalInterestIncome: 0,
      totalCapitalGains: 0,
      totalOtherIncome: 0,
      grandTotalIncome: 0,
      alerts: [],
    }

    // Extract taxpayer info
    const taxpayer = ais?.taxpayerInfo || ais?.taxPayer || ais?.assessee || {}
    result.pan = taxpayer?.pan || taxpayer?.PAN || raw?.pan || ''
    result.taxpayerName = taxpayer?.name || taxpayer?.taxpayerName || taxpayer?.fullName || raw?.taxpayerName || ''
    result.assessmentYear = ais?.assessmentYear || ais?.ay || raw?.assessmentYear || '2025-26'

    // Helper to safely parse numbers
    const n = (v: any) => parseFloat(String(v || '0').replace(/,/g, '')) || 0

    // ─── TDS Entries ───────────────────────────────────────────────
    const tdsSection = ais?.tdsInfo || ais?.TDSInfo || ais?.partATDS || []
    const tdsArray = Array.isArray(tdsSection) ? tdsSection : []

    for (const entry of tdsArray) {
      const deductorName = entry?.deductorName || entry?.employerName || entry?.name || ''
      const tdsDeducted = n(entry?.taxDeducted || entry?.tdsAmount || entry?.amountDeducted || 0)
      const grossAmount = n(entry?.grossAmount || entry?.income || entry?.totalAmount || 0)
      const section = String(entry?.section || entry?.sectionCode || '')
      let incomeType = 'other'
      if (section === '192' || section.includes('192')) incomeType = 'salary'
      else if (section === '194A' || section.includes('194A')) incomeType = 'interest'
      else if (section === '194I' || section.includes('194I')) incomeType = 'rent'
      else if (section === '194J' || section.includes('194J')) incomeType = 'professional'

      if (deductorName || tdsDeducted > 0) {
        result.tdsEntries.push({
          deductorName,
          deductorTAN: entry?.tan || entry?.deductorTAN || '',
          incomeType,
          grossAmount,
          tdsDeducted,
          quarter: entry?.quarter || 'Full Year',
        })
        result.totalTDSDeducted += tdsDeducted
        if (incomeType === 'salary') result.salaryIncome += grossAmount
      }
    }

    // ─── Interest Income ───────────────────────────────────────────
    const interestSection = ais?.interestInfo || ais?.savingsAccountInterest || ais?.interestIncome || []
    const interestArray = Array.isArray(interestSection) ? interestSection : []
    for (const item of interestArray) {
      const gross = n(item?.amount || item?.interestAmount || item?.grossAmount || 0)
      const tds = n(item?.tdsAmount || item?.taxDeducted || 0)
      if (gross > 0) {
        result.interestIncome.push({
          source: item?.bankName || item?.source || item?.name || 'Bank',
          type: item?.type === 'savings' ? 'savings' : 'fd',
          grossAmount: gross,
          tdsDeducted: tds,
          netAmount: gross - tds,
        })
        result.totalInterestIncome += gross
      }
    }

    // ─── Capital Gains ─────────────────────────────────────────────
    const cgSection = ais?.capitalGains || ais?.capitalGainsInfo || ais?.securitiesTransactions || []
    const cgArray = Array.isArray(cgSection) ? cgSection : []
    for (const item of cgSection) {
      const gain = n(item?.gain || item?.profitLoss || item?.capitalGain || 0)
      const saleAmount = n(item?.saleAmount || item?.consideration || 0)
      const purchaseAmount = n(item?.purchaseAmount || item?.cost || 0)
      const assetType = String(item?.assetType || item?.type || '').toLowerCase()
      const gainType = item?.gainType === 'LTCG' || item?.holdingPeriod === 'LONG_TERM' ? 'LTCG' : 'STCG'
      const taxRate = gainType === 'LTCG' ? 12.5 : 20
      const taxPayable = gainType === 'LTCG' ? Math.max(0, gain - 125000) * 0.125 : gain * 0.20

      if (gain !== 0) {
        result.capitalGains.push({
          assetType: assetType.includes('mutual') ? 'mutual_fund' : assetType.includes('equity') ? 'equity' : assetType.includes('property') ? 'property' : 'other',
          assetName: item?.assetName || item?.name || item?.fundName || 'Investment',
          purchaseDate: item?.purchaseDate || '',
          saleDate: item?.saleDate || item?.date || '',
          purchaseAmount,
          saleAmount,
          gain,
          gainType,
          taxRate,
          taxPayable: Math.round(taxPayable),
        })
        result.totalCapitalGains += gain
      }
    }

    // ─── Dividend Income ───────────────────────────────────────────
    const divSection = ais?.dividendIncome || ais?.dividendInfo || []
    const divArray = Array.isArray(divSection) ? divSection : []
    for (const item of divArray) {
      result.dividendIncome += n(item?.amount || item?.dividendAmount || 0)
    }

    // ─── Rental Income ─────────────────────────────────────────────
    const rentSection = ais?.rentalIncome || ais?.rentInfo || []
    const rentArray = Array.isArray(rentSection) ? rentSection : []
    for (const item of rentArray) {
      result.rentalIncome += n(item?.amount || item?.rentAmount || 0)
    }

    // ─── Tax Payments ──────────────────────────────────────────────
    const taxPmtSection = ais?.taxPayments || ais?.selfAssessmentTax || ais?.advanceTax || []
    const taxPmtArray = Array.isArray(taxPmtSection) ? taxPmtSection : []
    for (const pmt of taxPmtArray) {
      const amt = n(pmt?.amount || pmt?.taxPaid || 0)
      if (amt > 0) {
        result.taxPayments.push({
          type: pmt?.type || 'self_assessment',
          amount: amt,
          date: pmt?.date || pmt?.paymentDate || '',
          bsrCode: pmt?.bsrCode || '',
        })
        result.totalTaxPaid += amt
      }
    }

    result.totalTaxCredit = result.totalTDSDeducted + result.totalTaxPaid
    result.grandTotalIncome = result.salaryIncome + result.totalInterestIncome +
      result.totalCapitalGains + result.dividendIncome + result.rentalIncome + result.totalOtherIncome

    // Generate alerts
    if (result.totalInterestIncome > 10000)
      result.alerts.push(`FD/interest income of ₹${Math.round(result.totalInterestIncome).toLocaleString('en-IN')} is taxed at your slab rate — not just 10% TDS.`)
    if (result.totalCapitalGains > 0)
      result.alerts.push(`Capital gains of ₹${Math.round(result.totalCapitalGains).toLocaleString('en-IN')} are taxable separately — employer TDS does not cover this.`)
    if (result.dividendIncome > 0)
      result.alerts.push(`Dividend income of ₹${Math.round(result.dividendIncome).toLocaleString('en-IN')} is fully taxable at your slab rate since FY 2020-21.`)
    if (result.rentalIncome > 0)
      result.alerts.push(`Rental income of ₹${Math.round(result.rentalIncome).toLocaleString('en-IN')} must be declared in your ITR.`)

    return result
  } catch (e: any) {
    throw new Error(`Failed to parse AIS JSON: ${e.message}`)
  }
}

// ─── Claude-based parsing for PDF images ─────────────────────────────────
const AIS_SYSTEM = `You are an expert Indian tax document parser for AIS and Form 26AS.
Return ONLY raw JSON — no markdown, no code blocks.
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
}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pageImages, base64Data, mediaType, isRenderedPDF, jsonData } = body

    // ─── Path 1: AIS JSON file ────────────────────────────────────
    if (jsonData) {
      const parsed = parseAISJson(jsonData)
      return NextResponse.json({ success: true, data: parsed })
    }

    // ─── Path 2: Rendered PDF pages (images) ─────────────────────
    let content: any[]
    if (isRenderedPDF && pageImages?.length > 0) {
      content = [
        ...pageImages.map((img: string) => ({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: img },
        })),
        { type: 'text', text: 'Extract all TDS, income, and capital gains data from these Form 26AS / AIS pages. Return only JSON.' }
      ]
    } else if (base64Data) {
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
      parsed.salaryIncome = parsed.tdsEntries.filter((e: any) => e.incomeType === 'salary').reduce((s: number, e: any) => s + (Number(e.grossAmount) || 0), 0)
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
      if (parsed.totalInterestIncome > 10000) alerts.push(`Interest income of ₹${Math.round(parsed.totalInterestIncome).toLocaleString('en-IN')} taxed at slab rate.`)
      if (parsed.totalCapitalGains > 0) alerts.push(`Capital gains of ₹${Math.round(parsed.totalCapitalGains).toLocaleString('en-IN')} need separate tax calculation.`)
      parsed.alerts = alerts
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error: any) {
    console.error('AIS parse error:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse document' }, { status: 500 })
  }
}
