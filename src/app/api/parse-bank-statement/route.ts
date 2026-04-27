import { NextRequest, NextResponse } from 'next/server'
import { parseStatement, detectFileKind } from '@/lib/statementParser'

export const maxDuration = 30

// Render worker URL — set this in Vercel environment variables as PARSER_WORKER_URL
const WORKER_URL = process.env.PARSER_WORKER_URL || 'https://arthvo-parser.onrender.com'

function errorResponse(error: string, message?: string) {
  const responses: Record<string, { status: number; body: any }> = {
    incorrect_password: { status: 422, body: { error: 'incorrect_password' } },
    requires_password:  { status: 422, body: { error: 'incorrect_password' } },
    aes_pdf_unsupported:{ status: 415, body: { error: 'aes_pdf_unsupported', message: message || 'Try Excel format.' } },
    unsupported_format: { status: 415, body: { error: 'unsupported_format', message: message || 'File type not supported.' } },
    corrupt_file:       { status: 400, body: { error: 'corrupt_file', message: message || 'Could not read the file.' } },
    too_large:          { status: 413, body: { error: 'too_large', message: message || 'File too large.' } },
  }
  const r = responses[error] || { status: 500, body: { error } }
  return NextResponse.json(r.body, { status: r.status })
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const log = (label: string) => console.log(`[bank-parse] ${label}: ${Date.now() - t0}ms`)
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const password = (form.get('password') as string) || ''
    log('formData parsed')

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024) return errorResponse('too_large', 'Max 15MB')

    const buffer = Buffer.from(await file.arrayBuffer())
    log(`buffer ready (${file.size} bytes)`)

    // Detect file type — handle encryption checks before calling worker
    const fileKind = detectFileKind(buffer, file.name, file.type)
    log(`detected: ${fileKind}`)

    if (fileKind === 'unknown') return errorResponse('unsupported_format')

    // For PDFs — check encryption here so we can ask for password without worker round-trip
    if (fileKind === 'pdf') {
      const { parseStatement: ps } = await import('@/lib/statementParser')
      const check = await ps(buffer, file.name, file.type, password)
      if (!check.ok) return errorResponse(check.error || 'unsupported_format', check.errorMessage)
    }

    // Send to Render worker — no timeout issues there
    log('calling Render worker')
    const base64 = buffer.toString('base64')

    let workerRes: Response
    try {
      workerRes = await fetch(`${WORKER_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.name, mimeType: file.type, password, fileKind }),
        signal: AbortSignal.timeout(25000)
      })
    } catch (e: any) {
      log('worker timeout or unreachable')
      return NextResponse.json({ error: 'Parser service unavailable. Try again in a moment.' }, { status: 503 })
    }

    log(`worker responded: ${workerRes.status}`)
    const workerData = await workerRes.json()

    if (!workerRes.ok) {
      return errorResponse(workerData.error || 'corrupt_file', workerData.message)
    }

    log('done')
    return NextResponse.json(workerData)
  } catch (err: any) {
    log('caught error')
    console.error('Bank statement route error:', err)
    return NextResponse.json({ error: err.message || 'Failed to parse statement' }, { status: 500 })
  }
}
