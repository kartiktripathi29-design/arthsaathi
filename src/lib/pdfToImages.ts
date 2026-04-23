/**
 * Convert a PDF file to compressed JPEG images client-side using PDF.js
 * Returns base64 JPEG strings for each page (max 3 pages — enough for offer letters)
 * This avoids Vercel's 4.5MB body limit by compressing before upload
 */
export async function pdfToCompressedImages(file: File, maxPages = 3, quality = 0.7): Promise<{ base64: string; mediaType: string }[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = Math.min(pdf.numPages, maxPages)
  const images: { base64: string; mediaType: string }[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 }) // 1.5x = good quality/size balance

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    const renderContext = { canvasContext: ctx, viewport } as any
    await page.render(renderContext).promise

    const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1]
    images.push({ base64, mediaType: 'image/jpeg' })
  }

  return images
}
