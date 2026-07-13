import { NextRequest, NextResponse } from 'next/server'
import { parseSalaryFromBase64, parseSalaryFromText } from '@/lib/claude'
import { PDFDocument } from 'pdf-lib'
import { normalizePdfBase64 } from '@/lib/pdfNormalize'
import type { ParsedSalaryData } from '@/types'
import { prisma } from "@/lib/db"
import { logActivity } from "@/lib/activity"
import { getUser } from "@/lib/auth"
import { isAnthropicOutage, UPSTREAM_BUSY_MESSAGE } from "@/lib/anthropic-error"

export const maxDuration = 60

// Safety cap — refuse to process more than this many pages in one upload.
// Each page = one Claude call, so this bounds cost and latency.
const MAX_PAGES = 6

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { base64Data } = body
    // Normalise: some browsers send an empty MIME for .xls/.xlsx, so we fall back to the filename
    // extension below. mediaType defaults to '' so the .includes()/.startsWith() checks stay safe.
    const mediaType: string = body.mediaType || ''
    const fileName: string = body.fileName || ''

    if (!base64Data) {
      return NextResponse.json({ error: 'base64Data is required' }, { status: 400 })
    }

    // ─── PAGES TO PARSE ─────────────────────────────────────────────
    // For images → single page (no splitting possible)
    // For PDFs → check page count; split if multi-page
    let pagesToParse: Array<{ base64: string; mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> = []
    const parsedSlips: ParsedSalaryData[] = []
    const errors: string[] = []
    // Set when ANY page's failure was an Anthropic outage (overloaded/rate-limited/5xx), so that if we
    // end up with zero slips we can say "reader is busy, retry" instead of blaming the user's document.
    let upstreamOutage = false

    // ─── EXCEL / CSV ────────────────────────────────────────────────
    // The vision model can't read spreadsheet bytes, so convert the workbook to CSV-like text
    // and parse the text. Detect by MIME OR extension — browsers often send an empty type for .xls.
    const isExcel =
      mediaType.includes('spreadsheetml') ||
      mediaType === 'application/vnd.ms-excel' ||
      mediaType === 'text/csv' ||
      /\.(xlsx|xls|csv)$/i.test(fileName || '')

    if (isExcel) {
      const buffer = Buffer.from(base64Data, 'base64')
      let sheetText = ''
      try {
        if (mediaType === 'text/csv' || /\.csv$/i.test(fileName || '')) {
          sheetText = buffer.toString('utf-8')
        } else {
          const XLSX = await import('xlsx')
          const workbook = XLSX.read(buffer, { type: 'buffer' })
          for (const name of workbook.SheetNames) {
            const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
            if (csv.trim()) sheetText += `\n=== Sheet: ${name} ===\n${csv}\n`
          }
        }
      } catch (e: any) {
        console.error('[parse-salary] Excel read failed:', e?.message || e)
        return NextResponse.json({ error: 'Could not read this spreadsheet. If it\'s password-protected, remove the password and re-upload.' }, { status: 422 })
      }

      if (!sheetText.trim()) {
        return NextResponse.json({ error: 'This spreadsheet appears to be empty.' }, { status: 422 })
      }

      try {
        parsedSlips.push(await parseSalaryFromText(sheetText))
      } catch (e: any) {
        console.error('[parse-salary] Excel parse failed:', e?.message || e)
        if (isAnthropicOutage(e)) upstreamOutage = true
        errors.push(`Spreadsheet: ${e?.message || 'parse failed'}`)
      }
    } else if (mediaType === 'application/pdf') {
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
        // Single page — re-save through pdf-lib to strip any encryption flag Anthropic rejects
        // (Zoho/Razorpay/Keka payroll PDFs set it even with no real password). This is the same
        // normalisation the multi-page split path below already applies per page.
        pagesToParse.push({ base64: await normalizePdfBase64(base64Data), mediaType: 'application/pdf' })
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
    // Skipped for Excel/CSV, which is already parsed (as text) above.
    if (!isExcel) {
      const settled = await Promise.allSettled(
        pagesToParse.map(p => parseSalaryFromBase64(p.base64, p.mediaType))
      )
      settled.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          console.log(`[parse-salary] Page ${idx + 1} parsed: gross=${r.value?.grossSalary || 0}, net=${r.value?.netSalary || 0}, month=${r.value?.month || '?'}`)
          parsedSlips.push(r.value)
        } else {
          console.error(`[parse-salary] Page ${idx + 1} REJECTED:`, r.reason?.message || r.reason)
          if (isAnthropicOutage(r.reason)) upstreamOutage = true
          errors.push(`Page ${idx + 1}: ${r.reason?.message || 'parse failed'}`)
        }
      })
    }

    // ─── VALIDATE: keep only slips with usable totals ────────────────────
    let validSlips = parsedSlips.filter(p => p && (p.grossSalary || p.netSalary))

    // ─── FALLBACK: if splitting found nothing usable AND we did split, retry as whole PDF ──
    // This handles slips where one logical slip spans multiple pages (page 1 has earnings, page 2
    // has totals) — neither page alone has the data Claude needs, so all per-page parses come back
    // with zero totals. Sending the whole PDF lets Claude see everything at once.
    if (validSlips.length === 0 && mediaType === 'application/pdf' && pagesToParse.length > 1) {
      console.log('[parse-salary] All per-page parses empty. Falling back to whole-PDF parse.')
      try {
        const wholeParsed = await parseSalaryFromBase64(await normalizePdfBase64(base64Data), 'application/pdf')
        console.log(`[parse-salary] Fallback whole-PDF parse: gross=${wholeParsed?.grossSalary || 0}, net=${wholeParsed?.netSalary || 0}`)
        if (wholeParsed && (wholeParsed.grossSalary || wholeParsed.netSalary)) {
          validSlips = [wholeParsed]
          console.log('[parse-salary] Fallback succeeded — using whole-PDF parse.')
        }
      } catch (fallbackErr: any) {
        console.error('[parse-salary] Fallback whole-PDF parse failed:', fallbackErr?.message || fallbackErr)
        if (isAnthropicOutage(fallbackErr)) upstreamOutage = true
        errors.push(`Whole-PDF fallback: ${fallbackErr?.message || 'parse failed'}`)
      }
    }

    if (validSlips.length === 0) {
      // Distinguish "the AI reader was overloaded" (transient, retryable) from "we read it fine but the
      // document isn't a usable slip" (the user needs to act). Blaming the document during an Anthropic
      // outage is the worst message — retrying is exactly what fixes it.
      if (upstreamOutage) {
        return NextResponse.json(
          { error: 'upstream_busy', message: UPSTREAM_BUSY_MESSAGE, details: errors },
          { status: 503 }
        )
      }
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

    const response = NextResponse.json({
      success: true,
      data: validSlips,
      count: validSlips.length,
      skipped: parsedSlips.length - validSlips.length,
      errors: errors.length > 0 ? errors : undefined,
    })

    // Resolve the signed-in user now (cookies are in request context here); the DB write below runs
    // fire-and-forget. Persistence is scoped to that user and skipped entirely when not signed in.
    const userP = getUser()
    Promise.resolve().then(async () => {
      try {
        const user = await userP
        if (!user) return
        for (const slip of validSlips) {
          const netPay = slip.netSalary || (slip as any).netPay || 0
          if (netPay <= 0) continue
          const period = (slip as any).payPeriod || new Date().toISOString().slice(0, 7) + '-01'
          await prisma.salarySlip.upsert({
            where: {
              userId_periodMonth: {
                userId: user.id,
                periodMonth: new Date(period),
              },
            },
            update: {
              employer: slip.employerName || null,
              netPay,
              components: JSON.parse(JSON.stringify(slip)),
            },
            create: {
              userId: user.id,
              periodMonth: new Date(period),
              employer: slip.employerName || null,
              netPay,
              components: JSON.parse(JSON.stringify(slip)),
            },
          })
        }
        await logActivity(user.id, 'SALARY_PARSE_SUCCESS', null, {
          count: validSlips.length,
          netPay: validSlips[0]?.netSalary || (validSlips[0] as any)?.netPay,
        })
      } catch (e: any) {
        console.error("[parse-salary] DB WRITE ERROR:", e); console.error("[parse-salary] Stack:", e?.stack)
      }
    })

    return response
  } catch (error: any) {
    console.error('Salary parse error:', error)
    if (isAnthropicOutage(error)) {
      return NextResponse.json({ error: 'upstream_busy', message: UPSTREAM_BUSY_MESSAGE }, { status: 503 })
    }
    return NextResponse.json(
      { error: error.message || 'Failed to parse salary slip' },
      { status: 500 }
    )
  }
}
