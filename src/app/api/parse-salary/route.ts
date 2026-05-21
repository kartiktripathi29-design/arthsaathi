import { NextRequest, NextResponse } from 'next/server'
import { parseSalaryFromBase64 } from '@/lib/claude'
import { PDFDocument } from 'pdf-lib'
import type { ParsedSalaryData } from '@/types'

export const maxDuration = 60

// Safety cap — refuse to process more than this many pages in one upload.
// Each page = one Claude call, so this bounds cost and latency.
const MAX_PAGES = 6

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data, mediaType, fileName } = body

    if (!base64Data || !mediaType) {
      return NextResponse.json({ error: 'base64Data and mediaType are required' }, { status: 400 })
    }

    // ─── PAGES TO PARSE ─────────────────────────────────────────────
    // For images → single page (no splitting possible)
    // For PDFs → check page count; split if multi-page
    let pagesToParse: Array<{ base64: string; mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> = []

    if (mediaType === 'application/pdf') {
      // Decode PDF and check page count
      let doc: PDFDocument | null = null
      const pdfBytes = Buffer.from(base64Data, 'base64')
      try {
        // Always ignore encryption flag. Many payroll PDFs (Zoho, Razorpay, Keka, etc.)
        // ship with an encryption flag set but no actual password. pdf-lib refuses to load these
        // by default. We accept them — if there's a true password, downstream parsing will fail
        // and Claude API will surface a real error.
        doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
      } catch (e: any) {
        console.error('[parse-salary] PDF load failed:', e?.message || e)
        return NextResponse.json({ error: 'Could not read this PDF. If it\'s password-protected, remove the password and re-upload.' }, { status: 422 })
      }

      const pageCount = doc.getPageCount()
      if (pageCount === 0) {
        return NextResponse.json({ error: 'PDF has no pages.' }, { status: 422 })
      }
      if (pageCount > MAX_PAGES) {
        return NextResponse.json({ error: `PDF has ${pageCount} pages. Multi-slip uploads support up to ${MAX_PAGES} pages. Please split this PDF and upload separately.` }, { status: 422 })
      }

      if (pageCount === 1) {
        // Single page — parse as-is
        pagesToParse.push({ base64: base64Data, mediaType: 'application/pdf' })
      } else {
        // Multi-page — split into N single-page PDFs.
        // If splitting fails (rare; happens with some non-standard PDFs), fall back to
        // sending the whole PDF — we get one slip out of it instead of none.
        try {
          for (let i = 0; i < pageCount; i++) {
            const newDoc = await PDFDocument.create()
            const [copiedPage] = await newDoc.copyPages(doc, [i])
            newDoc.addPage(copiedPage)
            const pageBytes = await newDoc.save()
            const pageB64 = Buffer.from(pageBytes).toString('base64')
            pagesToParse.push({ base64: pageB64, mediaType: 'application/pdf' })
          }
        } catch (splitErr: any) {
          console.error('[parse-salary] page split failed, falling back to whole-PDF parse:', splitErr?.message || splitErr)
          pagesToParse = [{ base64: base64Data, mediaType: 'application/pdf' }]
        }
      }
    } else if (mediaType.startsWith('image/')) {
      // Image — single slip, no splitting
      pagesToParse.push({ base64: base64Data, mediaType: mediaType as any })
    } else {
      return NextResponse.json({ error: `Unsupported file type: ${mediaType}` }, { status: 400 })
    }

    // ─── PARSE EACH PAGE IN PARALLEL ─────────────────────────────────
    // Each Claude call uses the original (proven) single-slip prompt — no regression risk.
    const settled = await Promise.allSettled(
      pagesToParse.map(p => parseSalaryFromBase64(p.base64, p.mediaType))
    )

    const parsedSlips: ParsedSalaryData[] = []
    const errors: string[] = []
    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        console.log(`[parse-salary] Page ${idx + 1} parsed: gross=${r.value?.grossSalary || 0}, net=${r.value?.netSalary || 0}, month=${r.value?.month || '?'}`)
        parsedSlips.push(r.value)
      } else {
        console.error(`[parse-salary] Page ${idx + 1} REJECTED:`, r.reason?.message || r.reason)
        errors.push(`Page ${idx + 1}: ${r.reason?.message || 'parse failed'}`)
      }
    })

    // ─── VALIDATE: keep only slips with usable totals ────────────────────
    let validSlips = parsedSlips.filter(p => p && (p.grossSalary || p.netSalary))

    // ─── FALLBACK: if splitting found nothing usable AND we did split, retry as whole PDF ──
    // This handles slips where one logical slip spans multiple pages (page 1 has earnings, page 2
    // has totals) — neither page alone has the data Claude needs, so all per-page parses come back
    // with zero totals. Sending the whole PDF lets Claude see everything at once.
    if (validSlips.length === 0 && mediaType === 'application/pdf' && pagesToParse.length > 1) {
      console.log('[parse-salary] All per-page parses empty. Falling back to whole-PDF parse.')
      try {
        const wholeParsed = await parseSalaryFromBase64(base64Data, 'application/pdf')
        console.log(`[parse-salary] Fallback whole-PDF parse: gross=${wholeParsed?.grossSalary || 0}, net=${wholeParsed?.netSalary || 0}`)
        if (wholeParsed && (wholeParsed.grossSalary || wholeParsed.netSalary)) {
          validSlips = [wholeParsed]
          console.log('[parse-salary] Fallback succeeded — using whole-PDF parse.')
        }
      } catch (fallbackErr: any) {
        console.error('[parse-salary] Fallback whole-PDF parse failed:', fallbackErr?.message || fallbackErr)
        errors.push(`Whole-PDF fallback: ${fallbackErr?.message || 'parse failed'}`)
      }
    }

    if (validSlips.length === 0) {
      return NextResponse.json(
        { error: 'Could not extract salary data from any page. Please ensure the document is a clear salary slip.', details: errors },
        { status: 422 }
      )
    }

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
      skipped: parsedSlips.length - validSlips.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Salary parse error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse salary slip' },
      { status: 500 }
    )
  }
}
