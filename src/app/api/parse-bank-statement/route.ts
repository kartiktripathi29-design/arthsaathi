import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const WORKER_URL = process.env.PARSER_WORKER_URL || 'https://arthvo-parser.onrender.com'

function getFileKind(buffer: Buffer, fileName: string): string {
  const b = buffer
  if (b[0]===0x25 && b[1]===0x50 && b[2]===0x44 && b[3]===0x46) return 'pdf'
  if (b[0]===0x50 && b[1]===0x4B && b[2]===0x03 && b[3]===0x04) return 'excel-xlsx'
  if (b[0]===0xD0 && b[1]===0xCF && b[2]===0x11 && b[3]===0xE0) return 'excel-xls'
  if (b[0]===0xFF && b[1]===0xD8 && b[2]===0xFF) return 'image'
  if (b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47) return 'image'
  if (fileName.toLowerCase().endsWith('.csv')) return 'csv'
  return 'unknown'
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const log = (s: string) => console.log(`[bank-parse] ${s}: ${Date.now()-t0}ms`)
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const password = (form.get('password') as string) || ''
    log('form parsed')
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.size > 15*1024*1024) return NextResponse.json({ error: 'too_large' }, { status: 413 })
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileKind = getFileKind(buffer, file.name)
    log(`kind=${fileKind} size=${file.size}`)
    if (fileKind === 'unknown') return NextResponse.json({ error: 'unsupported_format' }, { status: 415 })
    const base64 = buffer.toString('base64')
    try { await fetch(`${WORKER_URL}/`, { signal: AbortSignal.timeout(8000) }) } catch {}
    log('calling worker')
    let workerRes: Response
    try {
      workerRes = await fetch(`${WORKER_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.name, mimeType: file.type, password, fileKind }),
        signal: AbortSignal.timeout(25000)
      })
    } catch (e: any) {
      log('worker unreachable')
      return NextResponse.json({ error: 'Parser unavailable. Try again in a moment.' }, { status: 503 })
    }
    log(`worker status=${workerRes.status}`)
    const text = await workerRes.text()
    log(`worker body length=${text.length}`)
    if (!text.trim()) return NextResponse.json({ error: 'Empty response from parser. Try again.' }, { status: 500 })
    let data: any
    try { data = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid response from parser' }, { status: 500 }) }
    if (!workerRes.ok) return NextResponse.json(data, { status: workerRes.status })
    log('done')
    return NextResponse.json(data)
  } catch (err: any) {
    log('error')
    console.error('Route error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}