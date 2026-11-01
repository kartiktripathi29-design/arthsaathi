import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { PHASE_2_ENABLED } from '@/lib/phase'

export async function POST(request: Request): Promise<NextResponse> {
  // Only bank statements use this route. Their parser is off in Phase 1 and it's what deletes the file,
  // so an upload now would never be deleted.
  if (!PHASE_2_ENABLED) return new NextResponse(null, { status: 404 })

  const body = (await request.json()) as HandleUploadBody

  // Asking to upload needs a login. Vercel's completion callback has no session, but handleUpload
  // checks its signature instead.
  if (body.type === 'blob.generate-client-token' && !(await getUser())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'image/jpeg',
            'image/png',
            'image/webp',
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {},
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
