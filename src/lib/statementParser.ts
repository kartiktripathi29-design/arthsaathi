/**
 * Unified Bank Statement Parser
 *
 * Architecture:
 * 1. Detect actual file type from magic bytes (not extension — banks lie about extensions)
 * 2. Route to the right parser based on detected type
 * 3. Handle encryption transparently for each format
 * 4. Return standardised output regardless of input
 *
 * Coverage (Phase 1 — Vercel-only):
 *   ✓ PDF (no password)
 *   ✓ PDF (RC4 / 40-bit / 128-bit encryption — older banks)
 *   ✓ Excel .xlsx / .xls (no password)
 *   ✓ Excel encrypted (AES via officecrypto-tool)
 *   ✓ CSV
 *   ✓ Images (JPG/PNG of statements)
 *   ✗ PDF AES-128/256 (modern HDFC/ICICI) — Phase 2 worker
 */

export type FileKind = 'pdf' | 'excel-xlsx' | 'excel-xls' | 'csv' | 'image' | 'unknown'

export type ParseError =
  | 'incorrect_password'
  | 'requires_password'
  | 'unsupported_format'
  | 'aes_pdf_unsupported'  // needs Phase 2 worker
  | 'corrupt_file'
  | 'too_large'

export interface ParseResult {
  ok: boolean
  kind?: FileKind
  encrypted?: boolean
  encryptionAlgo?: string
  // For success — pass to Claude
  claudeContent?: any[]
  // For failure
  error?: ParseError
  errorMessage?: string
}

// ─── 1. MAGIC BYTE DETECTION ────────────────────────────────────────────────
// File extensions are unreliable. Magic bytes are the actual file signature.
export function detectFileKind(buffer: Buffer, fileName = '', mimeType = ''): FileKind {
  if (buffer.length < 4) return 'unknown'

  const bytes = buffer.subarray(0, Math.min(buffer.length, 8))

  // PDF: starts with %PDF-
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf'
  }

  // ZIP-based formats (xlsx, docx, etc.) start with PK\x03\x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // Could be xlsx — verify by checking for [Content_Types].xml in the zip
    // For now, trust the extension/mime if it says xlsx
    if (fileName.toLowerCase().endsWith('.xlsx') || mimeType.includes('spreadsheetml')) {
      return 'excel-xlsx'
    }
    return 'excel-xlsx' // assume xlsx if it's a ZIP
  }

  // OLE compound document (legacy .xls, encrypted Excel) — D0 CF 11 E0 A1 B1 1A E1
  if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
    return 'excel-xls'
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image'
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image'
  }

  // CSV — text, no clear magic. Use heuristic + extension
  if (fileName.toLowerCase().endsWith('.csv') || mimeType.includes('csv')) {
    // Verify it's plausibly text
    const sample = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8')
    const printableRatio = sample.split('').filter(c => {
      const code = c.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127)
    }).length / sample.length
    if (printableRatio > 0.9) return 'csv'
  }

  return 'unknown'
}

// ─── 2. PDF ENCRYPTION DETECTION ────────────────────────────────────────────
export function detectPdfEncryption(buffer: Buffer): { encrypted: boolean; algo?: string } {
  // Scan up to 256KB — some HDFC PDFs have the /Encrypt dict far from the start
  const scanSize = Math.min(buffer.length, 262144)
  const text = buffer.toString('latin1', 0, scanSize)

  if (!text.includes('/Encrypt')) return { encrypted: false }

  // Determine algorithm — affects whether pdf-lib can handle it
  // V1, V2 = RC4 (pdf-lib supports)
  // V4, V5 = AES-128/256 (pdf-lib does NOT support — needs qpdf worker)
  const versionMatch = text.match(/\/V\s+(\d+)/)
  const cfMatch = text.match(/\/CFM\s*\/(\w+)/)

  if (cfMatch) {
    const cfm = cfMatch[1].toUpperCase()
    if (cfm === 'AESV2' || cfm === 'AESV3') return { encrypted: true, algo: 'AES' }
    if (cfm === 'V2') return { encrypted: true, algo: 'RC4' }
  }

  if (versionMatch) {
    const v = parseInt(versionMatch[1], 10)
    if (v >= 4) return { encrypted: true, algo: 'AES' }
    return { encrypted: true, algo: 'RC4' }
  }

  return { encrypted: true, algo: 'RC4' }  // default assume older
}

// ─── 3. PDF UNLOCK (RC4 only — AES needs Phase 2 worker) ────────────────────
async function unlockPdf(buffer: Buffer, password: string): Promise<Buffer> {
  const { PDFDocument } = await import('pdf-lib')
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: false, password } as any)
    const saved = await pdfDoc.save()
    return Buffer.from(saved.buffer, saved.byteOffset, saved.byteLength) as Buffer
  } catch (e: any) {
    const msg = (e.message || '').toLowerCase()
    // pdf-lib fails on AES PDFs with various messages — detect and report properly
    if (msg.includes('aes') || msg.includes('unsupported encryption') || msg.includes('unknown crypto')) {
      throw new Error('aes_pdf_unsupported')
    }
    if (msg.includes('encrypted') || msg.includes('password') || msg.includes('protect') || msg.includes('decrypt')) {
      // Double-check: re-scan the buffer for AES markers in case detectPdfEncryption missed it
      const recheck = detectPdfEncryption(buffer)
      if (recheck.algo === 'AES') {
        throw new Error('aes_pdf_unsupported')
      }
      throw new Error('incorrect_password')
    }
    throw e
  }
}

// ─── 4. EXCEL PARSING (with optional password) ──────────────────────────────
async function parseExcel(buffer: Buffer, password = '', isOle2 = false): Promise<string> {
  const XLSX = await import('xlsx')
  let workbook: any

  // First try directly — works for unencrypted xlsx and the special VelvetSweatshop case
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', password: password || undefined } as any)
  } catch (e: any) {
    const msg = (e.message || '').toLowerCase()

    // Detect ANY encryption-like error. xlsx library is inconsistent — it can throw:
    //   "File is password-protected"
    //   "Encrypted file"
    //   "Bad checksum: ..." (for some encrypted OLE2)
    //   "Cannot read property of undefined" (when struct is encrypted)
    // Plus, OLE2 files (D0 CF 11 E0) are almost always encrypted Excel for banks.
    // So: if it's OLE2, OR the message hints at encryption, treat as encrypted.
    const isLikelyEncrypted = isOle2 ||
      msg.includes('password') ||
      msg.includes('encrypted') ||
      msg.includes('protect') ||
      msg.includes('checksum') ||
      msg.includes('cannot read') ||
      msg.includes('unsupported') ||
      msg.includes('cfb')

    if (!isLikelyEncrypted) throw e

    // Encrypted — need decryption first
    if (!password) throw new Error('requires_password')

    try {
      // @ts-ignore — officecrypto-tool ships without type declarations
      const officeCrypto = await import('officecrypto-tool')
      const decrypted = await (officeCrypto as any).decrypt(buffer, { password })
      workbook = XLSX.read(decrypted, { type: 'buffer' })
    } catch (decryptErr: any) {
      const dmsg = (decryptErr.message || '').toLowerCase()
      // officecrypto-tool throws specific messages on wrong password
      if (dmsg.includes('password') || dmsg.includes('decrypt') || dmsg.includes('hash') || dmsg.includes('verifier') || dmsg.includes('integrity')) {
        throw new Error('incorrect_password')
      }
      // If decryption fails for unknown reason on an OLE2 file, still treat as wrong password
      if (isOle2) throw new Error('incorrect_password')
      throw decryptErr
    }
  }

  // Convert all sheets to CSV-like text
  let allText = ''
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) {
      allText += `\n=== Sheet: ${name} ===\n${csv}\n`
    }
  }
  return allText
}

// ─── 5. CSV PARSING ─────────────────────────────────────────────────────────
function parseCsv(buffer: Buffer): string {
  // Try UTF-8 first, fall back to latin1
  let text = buffer.toString('utf8')
  if (text.includes('\uFFFD')) {
    text = buffer.toString('latin1')
  }
  return text
}

// ─── 6. MAIN PARSER ──────────────────────────────────────────────────────────
export async function parseStatement(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  password = ''
): Promise<ParseResult> {
  const kind = detectFileKind(buffer, fileName, mimeType)

  if (kind === 'unknown') {
    return { ok: false, error: 'unsupported_format', errorMessage: 'File type not recognised. Try PDF, Excel, CSV, or an image of your statement.' }
  }

  // ── PDF ──
  if (kind === 'pdf') {
    const { encrypted, algo } = detectPdfEncryption(buffer)

    if (!encrypted) {
      // Re-save through pdf-lib to strip any residual encryption flag Anthropic rejects, then
      // send the clean PDF to Claude.
      const { normalizePdfBuffer } = await import('@/lib/pdfNormalize')
      const clean = await normalizePdfBuffer(buffer)
      return {
        ok: true,
        kind: 'pdf',
        encrypted: false,
        claudeContent: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: clean.toString('base64') } },
          { type: 'text', text: 'Parse this Indian bank statement and return the complete JSON.' }
        ]
      }
    }

    // Encrypted PDF
    if (!password) {
      return { ok: false, kind: 'pdf', encrypted: true, encryptionAlgo: algo, error: 'requires_password' }
    }

    // AES PDFs need the Phase 2 worker — pdf-lib can't unlock them
    if (algo === 'AES') {
      return {
        ok: false,
        kind: 'pdf',
        encrypted: true,
        encryptionAlgo: 'AES',
        error: 'aes_pdf_unsupported',
        errorMessage: 'This PDF uses AES encryption which we don\'t support yet. Workaround: open it in Acrobat/Chrome with your password, then Save As a new PDF (unprotected) and upload that. Or download the Excel version from your bank app.'
      }
    }

    // RC4 — try to unlock
    try {
      const unlocked = await unlockPdf(buffer, password)
      return {
        ok: true,
        kind: 'pdf',
        encrypted: true,
        encryptionAlgo: 'RC4',
        claudeContent: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: unlocked.toString('base64') } },
          { type: 'text', text: 'Parse this Indian bank statement and return the complete JSON.' }
        ]
      }
    } catch (e: any) {
      if (e.message === 'aes_pdf_unsupported') {
        return { ok: false, kind: 'pdf', encrypted: true, encryptionAlgo: 'AES', error: 'aes_pdf_unsupported', errorMessage: 'This PDF uses AES encryption which we don\'t support yet. Workaround: open it in Acrobat/Chrome with your password, then Save As a new PDF (unprotected) and upload that. Or download the Excel version from your bank app.' }
      }
      if (e.message === 'incorrect_password') {
        return { ok: false, kind: 'pdf', encrypted: true, error: 'incorrect_password' }
      }
      return { ok: false, kind: 'pdf', error: 'corrupt_file', errorMessage: e.message }
    }
  }

  // ── EXCEL ──
  if (kind === 'excel-xlsx' || kind === 'excel-xls') {
    try {
      const isOle2 = kind === 'excel-xls'  // OLE2 magic bytes — usually encrypted
      const csvText = await parseExcel(buffer, password, isOle2)
      if (csvText.length > 500_000) {
        return { ok: false, error: 'too_large', errorMessage: 'Statement has too many rows to process. Try a shorter date range.' }
      }
      return {
        ok: true,
        kind,
        encrypted: false,
        claudeContent: [{ type: 'text', text: `Parse this Indian bank statement Excel data and return the complete JSON:\n\n${csvText}` }]
      }
    } catch (e: any) {
      if (e.message === 'requires_password') return { ok: false, kind, encrypted: true, error: 'requires_password' }
      if (e.message === 'incorrect_password') return { ok: false, kind, encrypted: true, error: 'incorrect_password' }
      return { ok: false, kind, error: 'corrupt_file', errorMessage: e.message }
    }
  }

  // ── CSV ──
  if (kind === 'csv') {
    const text = parseCsv(buffer)
    if (text.length > 500_000) {
      return { ok: false, error: 'too_large' }
    }
    return {
      ok: true,
      kind: 'csv',
      encrypted: false,
      claudeContent: [{ type: 'text', text: `Parse this Indian bank statement CSV and return the complete JSON:\n\n${text}` }]
    }
  }

  // ── IMAGE ──
  if (kind === 'image') {
    const mediaType = buffer[0] === 0xFF ? 'image/jpeg' : 'image/png'
    return {
      ok: true,
      kind: 'image',
      encrypted: false,
      claudeContent: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        { type: 'text', text: 'This is a photo or scan of an Indian bank statement. Read all transactions visible and return the complete JSON.' }
      ]
    }
  }

  return { ok: false, error: 'unsupported_format' }
}
