import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'
import { computeSavings, isSupportedFY, type IncomeComponents, type Regime, type SeniorStatus } from '@/lib/tax-history'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const maxDuration = 60

// Mirrors the PDF text extraction used by parse-ais (incl. the Windows worker-path fix). An ITR-V
// acknowledgement is one page; a full ITR PDF a handful — cap at 8 to stay cheap.
async function extractTextFromPDF(base64Data: string, password?: string): Promise<string> {
  const req = createRequire(import.meta.url)
  const canvasModule = req('@napi-rs/canvas')
  const { DOMMatrix, DOMPoint, DOMRect } = canvasModule
  ;(global as any).DOMMatrix = DOMMatrix
  ;(global as any).DOMPoint = DOMPoint
  ;(global as any).DOMRect = DOMRect

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
  const workerPath = pathToFileURL(join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  ;(pdfjs as any).GlobalWorkerOptions.workerSrc = workerPath

  const pdfBuffer = Buffer.from(base64Data, 'base64')
  const loadOptions: any = { data: new Uint8Array(pdfBuffer), useWorkerFetch: false }
  if (password) loadOptions.password = password

  let pdf: any
  try {
    pdf = await (pdfjs as any).getDocument(loadOptions).promise
  } catch (e: any) {
    if (e?.name === 'PasswordException' || e?.code === 1 || e?.code === 2) {
      throw new Error('incorrect_password')
    }
    throw e
  }

  let fullText = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 8); i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = (textContent.items as any[]).map((item: any) => item.str || '').join(' ')
    fullText += `\n--- Page ${i} ---\n${pageText}`
  }
  return fullText
}

// The model's job is ONLY extraction → our component shape. All tax math stays in tax-history.ts.
// "missing" is load-bearing: when a source (e.g. a totals-only ITR-V) doesn't expose a component we
// need for an EXACT alternate-regime calc, the model must say so rather than invent it.
const ITR_SYSTEM = `You parse Indian Income Tax Returns. Input is either an ITR-V acknowledgement, a full ITR PDF, or a filed/prefill ITR JSON. Extract the figures below. Return ONLY raw JSON — no markdown, no prose.

Schema:
{
  "documentType": "itr_v_acknowledgement | full_itr | itr_json | unknown",
  "assessmentYear": "AY 2025-26",
  "itrForm": "ITR-1 | ITR-2 | ITR-3 | ITR-4 | unknown",
  "filedRegime": "old | new",
  "isSalaried": true,
  "grossSalary": 0,
  "exemptAllowances": 0,
  "otherSlabIncome": 0,
  "chapterVIA": 0,
  "reportedGrossTotalIncome": 0,
  "reportedTotalIncome": 0,
  "reportedTotalTax": 0,
  "reportedRefundOrPayable": 0,
  "missing": [],
  "notes": ""
}

Field rules:
- assessmentYear: as printed on the return ("AY 2024-25"). The new regime question on the form ("opting out of new regime" / "115BAC") decides filedRegime: opted OUT of new = "old"; default/opted IN = "new".
- grossSalary: salary income BEFORE the standard deduction and BEFORE any section-10 exemption (HRA/LTA). From Schedule S gross salary, or "Gross Salary" in the salary computation. If only a net "Income from Salary" (already after standard deduction/exemptions) is available, set grossSalary to 0 and add "grossSalary" to missing.
- exemptAllowances: total section-10 exemptions against salary (HRA + LTA + others). 0 if none/unknown.
- otherSlabIncome: net income from house property + other sources + business/profession (slab-rate income). EXCLUDE special-rate capital gains.
- chapterVIA: total Chapter VI-A deductions (80C/80D/80CCD(1B)/24b/80G/...).
- reported* fields: copy the totals printed on the return so we can reconcile our recompute against what was filed.
- missing: list any of ["grossSalary","exemptAllowances","filedRegime","assessmentYear"] that you could not determine from the document. An ITR-V acknowledgement usually exposes only totals — if so, you will likely add "grossSalary" and "exemptAllowances".
- All amounts are annual integer rupees. Use 0 (not null) for unknown numerics.`

// "AY 2025-26" → "FY 2024-25". The engine is FY-keyed.
function fyFromAY(ay: string): string {
  const m = (ay || '').match(/(\d{4})-(\d{2,4})/)
  if (!m) return ''
  const ayStart = parseInt(m[1], 10)
  const fyStart = ayStart - 1
  return `FY ${fyStart}-${(fyStart + 1).toString().slice(2)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data, mediaType, password, jsonText, seniorStatus } = body

    let content: any[]

    if (jsonText || mediaType === 'application/json') {
      // Filed/prefill ITR JSON — richest source. Cap size; the schedules we need sit near the top.
      const raw = typeof jsonText === 'string' ? jsonText : Buffer.from(base64Data || '', 'base64').toString('utf-8')
      content = [{
        type: 'text',
        text: `Extract the return fields from this filed ITR JSON. Return only JSON per the schema.\n\n${raw.slice(0, 60000)}`,
      }]
    } else if (mediaType === 'application/pdf') {
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
        text: `Extract the return fields from this ITR document text. Return only JSON per the schema.\n\n${pdfText}`,
      }]
    } else if (base64Data && mediaType?.startsWith('image/')) {
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: 'Extract the return fields from this ITR image. Return only JSON per the schema.' },
      ]
    } else {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: ITR_SYSTEM,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Could not extract return data')
    const parsed = JSON.parse(jsonMatch[0])

    // ── Normalize into engine inputs ──────────────────────────────────────────
    // Only keep an assessment year that actually carries a 4-digit year — the model emits "unknown"
    // (or other junk) when it can't read it, and that must not surface as a label downstream.
    const ay = /\d{4}/.test(parsed.assessmentYear || '') ? String(parsed.assessmentYear) : ''
    const fy = fyFromAY(ay)
    const filedRegime: Regime = parsed.filedRegime === 'old' ? 'old' : 'new'
    const senior: SeniorStatus = ['senior', 'super_senior'].includes(seniorStatus) ? seniorStatus : 'normal'
    const components: IncomeComponents = {
      grossSalary: Number(parsed.grossSalary) || 0,
      exemptAllowances: Number(parsed.exemptAllowances) || 0,
      otherSlabIncome: Number(parsed.otherSlabIncome) || 0,
      chapterVIA: Number(parsed.chapterVIA) || 0,
      isSalaried: parsed.isSalaried !== false,
    }

    const missing: string[] = Array.isArray(parsed.missing) ? parsed.missing : []
    const fySupported = fy && isSupportedFY(fy)
    // Without gross salary we can't honestly recompute the alternate regime — gate the savings calc.
    const canComputeSavings = !!fySupported && components.grossSalary > 0 && !missing.includes('grossSalary')

    const savings = canComputeSavings ? computeSavings(fy, filedRegime, components, senior) : null

    return NextResponse.json({
      success: true,
      data: {
        fy,
        ay,
        fySupported: !!fySupported,
        documentType: parsed.documentType || 'unknown',
        itrForm: parsed.itrForm || 'unknown',
        filedRegime,
        components,
        reported: {
          grossTotalIncome: Number(parsed.reportedGrossTotalIncome) || 0,
          totalIncome: Number(parsed.reportedTotalIncome) || 0,
          totalTax: Number(parsed.reportedTotalTax) || 0,
          refundOrPayable: Number(parsed.reportedRefundOrPayable) || 0,
        },
        missing,
        canComputeSavings,
        savings,
        notes: parsed.notes || '',
      },
    })
  } catch (error: any) {
    console.error('ITR parse error:', error)
    return NextResponse.json({ error: error.message || 'Failed to parse return' }, { status: 500 })
  }
}
