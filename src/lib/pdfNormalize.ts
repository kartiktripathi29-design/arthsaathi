/**
 * PDF normalisation for the Anthropic vision pipeline.
 *
 * Many Indian payroll and bank PDFs (Zoho, Razorpay, Keka, bank portals) ship with the PDF
 * /Encrypt flag set even when there is no real password — typically owner-password-only
 * encryption with an empty user password. Anthropic refuses to decode any PDF whose encryption
 * flag is set and returns:
 *
 *   "messages.0.content.0.pdf.source.base64.data: The PDF specified was not valid."
 *
 * To avoid that, we re-save every PDF through pdf-lib before sending its bytes to Claude. We copy
 * the pages into a fresh document (the same approach the multi-page salary-slip split path already
 * uses successfully), which decrypts owner-password-only files and writes a clean, unencrypted PDF.
 *
 * If pdf-lib can't load the file at all — e.g. a genuine user-password-protected PDF — we return the
 * input unchanged so the caller's existing error handling surfaces a real failure.
 */
export async function normalizePdfBuffer(input: Buffer): Promise<Buffer> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const src = await PDFDocument.load(input, { ignoreEncryption: true })
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
    const bytes = await out.save()
    return Buffer.from(bytes)
  } catch {
    // Not loadable (truly password-protected or corrupt) — let the caller hit its real error path.
    return input
  }
}

export async function normalizePdfBase64(base64Data: string): Promise<string> {
  const out = await normalizePdfBuffer(Buffer.from(base64Data, 'base64'))
  return out.toString('base64')
}
