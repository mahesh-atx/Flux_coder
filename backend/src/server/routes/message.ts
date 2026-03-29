import { Hono } from 'hono'
import { agentLoop } from '../../agent/loop'
import { getSession, getMessages } from '../../session'

export const messageRoutes = new Hono()

messageRoutes.get('/:sessionId/messages', async (c) => {
  const sessionId = c.req.param('sessionId')
  const messages = getMessages(sessionId)
  return c.json(messages)
})

messageRoutes.post('/:sessionId/message', async (c) => {
  const sessionId = c.req.param('sessionId')
  const body = await c.req.json()

  const session = getSession(sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const abort = new AbortController()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const writer = (event: string, data: any) => {
        const encoded = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        controller.enqueue(encoded)
      }

      try {
        await agentLoop({
          sessionID: sessionId,
          userContent: body.content,
          mode: body.mode,
          model: body.model ? { providerID: body.model.providerID, modelID: body.model.modelID } : undefined,
          write: writer,
          abort: abort.signal,
        })
      } catch (error: any) {
        writer('error', { type: 'error', message: error.message })
      } finally {
        controller.close()
      }
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
