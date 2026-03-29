import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './server'
import { Log } from './util/log'

const port = parseInt(process.env.FLUX_BACKEND_PORT || '3030', 10)

Log.info('Starting FLUX backend server', { port })

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  Log.info(`FLUX backend running at http://localhost:${info.port}`)
  Log.info(`Health check: http://localhost:${info.port}/health`)
  Log.info(`NVIDIA API: ${process.env.NVIDIA_BASE_URL}`)
})
