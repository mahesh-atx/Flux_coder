import { Hono } from 'hono'
import { createSession, getSession, listSessions, deleteSession } from '../../session'

export const sessionRoutes = new Hono()

sessionRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const session = createSession({
    directory: body.directory || process.cwd(),
    title: body.title,
  })
  return c.json(session)
})

sessionRoutes.get('/', async (c) => {
  const sessions = listSessions()
  return c.json(sessions)
})

sessionRoutes.get('/:id', async (c) => {
  const session = getSession(c.req.param('id'))
  if (!session) return c.json({ error: 'Session not found' }, 404)
  return c.json(session)
})

sessionRoutes.delete('/:id', async (c) => {
  const ok = deleteSession(c.req.param('id'))
  if (!ok) return c.json({ error: 'Session not found' }, 404)
  return c.json({ success: true })
})
