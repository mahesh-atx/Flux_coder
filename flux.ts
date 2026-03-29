#!/usr/bin/env node
import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const FLUX_DIR = __dirname
const BACKEND_DIR = resolve(FLUX_DIR, 'backend')

const cwd = process.cwd()

console.log(`\x1b[36mFlux Agent\x1b[0m — Working in: \x1b[33m${cwd}\x1b[0m`)

// Check if backend is already running on port 3030
const checkBackend = () => {
  return fetch('http://localhost:3030/health')
    .then(res => res.ok)
    .catch(() => false)
}

const startBackend = () => {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: BACKEND_DIR,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        FLUX_CWD: cwd,
      },
    })

    proc.stdout?.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('running at')) {
        resolve()
      }
    })

    proc.stderr?.on('data', (data) => {
      console.error(`\x1b[31m[backend]\x1b[0m ${data.toString()}`)
    })

    proc.on('error', (err) => {
      reject(err)
    })

    // Timeout after 10 seconds
    setTimeout(() => resolve(), 5000)
  })
}

const startTUI = () => {
  const proc = spawn('bun', ['run', '--conditions=browser', 'index.tsx'], {
    cwd: FLUX_DIR,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      FLUX_CWD: cwd,
    },
  })

  proc.on('close', () => {
    process.exit(0)
  })
}

async function main() {
  // Check if backend is already running
  const isRunning = await checkBackend()
  
  if (!isRunning) {
    console.log('\x1b[36mStarting backend server...\x1b[0m')
    await startBackend()
    console.log('\x1b[32mBackend server started\x1b[0m')
  }

  startTUI()
}

main().catch(err => {
  console.error('\x1b[31mFailed to start Flux:\x1b[0m', err.message)
  process.exit(1)
})
