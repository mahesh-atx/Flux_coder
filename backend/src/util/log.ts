import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, `${new Date().toISOString().split('T')[0]}.log`)

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function writeLog(level: string, message: string, data?: any) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: data ? JSON.stringify(data) : undefined,
  }
  console.log(`[${entry.timestamp}] [${level}] ${message}`, data ?? '')
  ensureLogDir()
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n')
}

export const Log = {
  info: (message: string, data?: any) => writeLog('INFO', message, data),
  warn: (message: string, data?: any) => writeLog('WARN', message, data),
  error: (message: string, data?: any) => writeLog('ERROR', message, data),
  debug: (message: string, data?: any) => writeLog('DEBUG', message, data),
}
