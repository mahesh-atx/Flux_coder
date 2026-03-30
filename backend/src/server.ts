import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sessionRoutes } from './server/routes/session'
import { messageRoutes } from './server/routes/message'
import { modelRoutes } from './server/routes/models'
import { Log } from './util/log'

export const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }))

app.route('/api/session', sessionRoutes)
app.route('/api', messageRoutes)
app.route('/api/models', modelRoutes)

app.onError((err, c) => {
  Log.error('Server error', { error: err.message, stack: err.stack })
  return c.json({ error: err.message }, 500)
})

export type AppType = typeof app
