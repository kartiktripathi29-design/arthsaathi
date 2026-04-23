import { NextRequest, NextResponse } from 'next/server'
import { parseOfferLetterFromBase64, parseOfferLetterMultiPage } from '@/lib/claude'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { base64Data, mediaType, pages } = body

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

    const parsed = await parseOfferLetterFromBase64(
      base64Data,
      mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
    )

    if (!parsed.totalCTC && !parsed.fixedCTC) {
      return NextResponse.json({ error: 'Could not extract offer letter data. Please ensure the document is a clear offer letter.' }, { status: 422 })
    }

    return NextResponse.json({ data: parsed })
  } catch (err: any) {
    console.error('Offer letter parse error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse offer letter' }, { status: 500 })
  }
}
