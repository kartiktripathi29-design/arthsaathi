/**
 * Server-side .docx text extraction via mammoth.
 *
 * Offer/appointment letters are often shared as Word .docx files. mammoth reads the OOXML (the
 * modern ZIP-based format) and returns the raw text — paragraphs and tables — which we then parse
 * with the same offer-letter prompt as the PDF/text path.
 *
 * Only modern .docx is supported. Legacy binary .doc (OLE2) is NOT — callers should detect that by
 * extension/MIME and ask the user to save as .docx or PDF instead.
 */
export async function extractDocxText(base64Data: string): Promise<string> {
  const mod: any = await import('mammoth')
  const mammoth = mod.default ?? mod
  const buffer = Buffer.from(base64Data, 'base64')
  const result = await mammoth.extractRawText({ buffer })
  return (result?.value || '').trim()
}
