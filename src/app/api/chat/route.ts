import { NextRequest } from 'next/server'
import { streamChatResponse } from '@/lib/claude'
import { logActivity } from '@/lib/activity'
import { getUser } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, userContext } = body

    // Fire-and-forget: log chat activity under the signed-in user (skipped if not signed in).
    // getUser() is called synchronously here so cookies() resolves within the request context.
    getUser()
      .then(u => { if (u) return logActivity(u.id, 'CHAT_MESSAGE_SENT', null, { messageCount: messages?.length || 0 }) })
      .catch(() => {})

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChatResponse(messages, userContext ?? '')) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
