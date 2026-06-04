/**
 * Server-side PDF text extraction via pdfjs (legacy build).
 *
 * Why pdfjs and not pdf-lib: many Indian payroll/offer/bank PDFs are encrypted. pdf-lib can strip
 * the encryption *flag* but cannot decrypt AES-encrypted content — it copies the still-scrambled
 * bytes, so Claude receives blank pages. pdfjs actually decrypts RC4 and AES owner/empty-password
 * PDFs, so it reliably recovers the text. This mirrors the proven logic in /api/parse-ais.
 *
 * Throws Error('incorrect_password') when the PDF needs a real open-password we don't have.
 */
import { join } from 'path'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'

export async function extractPdfText(base64Data: string, password?: string): Promise<string> {
  // Polyfill DOMMatrix/DOMPoint/DOMRect from @napi-rs/canvas (a pdfjs-dist dependency) so pdfjs
  // runs under Node. Use ??= so we never clobber a polyfill another route already installed.
  const req = createRequire(import.meta.url)
  const canvasModule = req('@napi-rs/canvas')
  const { DOMMatrix, DOMPoint, DOMRect } = canvasModule
  ;(global as any).DOMMatrix ??= DOMMatrix
  ;(global as any).DOMPoint ??= DOMPoint
  ;(global as any).DOMRect ??= DOMRect

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)

  // pathToFileURL handles Windows drive letters correctly — `new URL(absPath, 'file://')` parses
  // the leading "C:" as a URL scheme and yields a broken worker URL in local dev.
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
  for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = (textContent.items as any[]).map((item: any) => item.str || '').join(' ')
    fullText += `\n--- Page ${i} ---\n${pageText}`
  }
  return fullText
}
