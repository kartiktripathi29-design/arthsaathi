import { NextRequest, NextResponse } from 'next/server'
import { parseOfferLetterFromBase64 } from '@/lib/claude'

export const maxDuration = 60
export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export async function POST(req: NextRequest) {
  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Request too large or invalid. Try a smaller file (under 10MB).' }, { status: 413 })
    }

    const { base64Data, mediaType } = body

    if (!base64Data || !mediaType) {
      return NextResponse.json({ error: 'base64Data and mediaType are required' }, { status: 400 })
    }

    const parsed = await parseOfferLetterFromBase64(base64Data, mediaType)

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
