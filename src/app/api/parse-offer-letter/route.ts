import { NextRequest, NextResponse } from 'next/server'
import { parseOfferLetterFromBase64, parseOfferLetterFromText, parseOfferLetterMultiPage } from '@/lib/claude'
import { normalizePdfBase64 } from '@/lib/pdfNormalize'
import { extractPdfText } from '@/lib/pdfText'
import { extractDocxText } from '@/lib/docxText'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { base64Data, mediaType, pages, password, fileName } = body

    // Multi-page mode: array of { base64, mediaType } objects
    if (pages && Array.isArray(pages) && pages.length > 0) {
      const parsed = await parseOfferLetterMultiPage(pages)
      if (!parsed.totalCTC && !parsed.fixedCTC) {
        return NextResponse.json({ error: 'Could not extract offer letter data. Please ensure the document is a clear offer letter.' }, { status: 422 })
      }
      return NextResponse.json({ data: parsed })
    }

    // Single image/page mode
    if (!base64Data || !mediaType) {
      return NextResponse.json({ error: 'base64Data and mediaType are required' }, { status: 400 })
    }

    const lowerName = (fileName || '').toLowerCase()
    const isDocx = (mediaType || '').includes('wordprocessingml') || lowerName.endsWith('.docx')
    const isLegacyDoc = mediaType === 'application/msword' || (lowerName.endsWith('.doc') && !lowerName.endsWith('.docx'))

    let parsed: any
    if (isLegacyDoc) {
      // mammoth can't read the old binary .doc (OLE2) format.
      return NextResponse.json(
        { error: 'Old .doc files aren\'t supported. Open it in Word and use "Save As" → PDF or .docx, then upload that.' },
        { status: 422 }
      )
    } else if (isDocx) {
      // Word .docx — extract the text and parse it like any other offer letter.
      let text = ''
      try {
        text = await extractDocxText(base64Data)
      } catch (e: any) {
        console.error('[parse-offer-letter] docx extraction failed:', e?.message || e)
      }
      if (text.trim().length < 30) {
        return NextResponse.json(
          { error: 'Could not read any text from this Word document. If it\'s password-protected or scanned, save it as PDF and upload that.' },
          { status: 422 }
        )
      }
      parsed = await parseOfferLetterFromText(text)
    } else if (mediaType === 'application/pdf') {
      // PDFs: extract text with pdfjs first. pdfjs decrypts RC4/AES owner-encrypted offer letters
      // that pdf-lib can't — those otherwise reach Claude as blank pages. Only true scanned/image
      // PDFs come back with no text; for those we fall back to Claude vision on the normalised PDF.
      let text = ''
      try {
        text = await extractPdfText(base64Data, password || undefined)
      } catch (e: any) {
        if (e?.message === 'incorrect_password') {
          // Structured codes so the client can prompt for the password and retry:
          // 'requires_password' = none supplied yet; 'incorrect_password' = the one tried was wrong.
          return NextResponse.json(
            { error: password ? 'incorrect_password' : 'requires_password' },
            { status: 422 }
          )
        }
        console.error('[parse-offer-letter] pdfjs text extraction failed, falling back to vision:', e?.message || e)
      }

      if (text.trim().length > 50) {
        parsed = await parseOfferLetterFromText(text)
      } else {
        parsed = await parseOfferLetterFromBase64(await normalizePdfBase64(base64Data), 'application/pdf')
      }
    } else {
      // Images go straight to Claude vision.
      parsed = await parseOfferLetterFromBase64(
        base64Data,
        mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
      )
    }

    if (!parsed.totalCTC && !parsed.fixedCTC) {
      return NextResponse.json({ error: 'Could not extract offer letter data. Please ensure the document is a clear offer letter.' }, { status: 422 })
    }

    return NextResponse.json({ data: parsed })
  } catch (err: any) {
    console.error('Offer letter parse error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse offer letter' }, { status: 500 })
  }
}
