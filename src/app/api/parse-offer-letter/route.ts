import { NextRequest, NextResponse } from 'next/server'
import { parseOfferLetterFromBase64 } from '@/lib/claude'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    let base64Data: string
    let mediaType: string

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // FormData approach — no base64 bloat
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      const buffer = await file.arrayBuffer()
      base64Data = Buffer.from(buffer).toString('base64')
      mediaType = file.type
    } else {
      // Legacy JSON approach
      let body: any
      try { body = await req.json() } catch {
        return NextResponse.json({ error: 'Invalid request. Please try again.' }, { status: 400 })
      }
      base64Data = body.base64Data
      mediaType = body.mediaType
    }

    if (!base64Data || !mediaType) {
      return NextResponse.json({ error: 'base64Data and mediaType are required' }, { status: 400 })
    }

    const parsed = await parseOfferLetterFromBase64(base64Data, mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf')

    if (!parsed.totalCTC && !parsed.fixedCTC) {
      return NextResponse.json(
        { error: 'Could not extract offer letter data. Please ensure the document is a clear offer letter.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ data: parsed })
  } catch (err: any) {
    console.error('Offer letter parse error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse offer letter' }, { status: 500 })
  }
}
