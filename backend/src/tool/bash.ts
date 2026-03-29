import { z } from 'zod'
import { defineTool, type ToolInfo, type ToolResult } from './tool'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const DEFAULT_TIMEOUT = 30000
const MAX_TIMEOUT = 120000
const MAX_OUTPUT = 50000

export const BashTool: ToolInfo = defineTool('bash', {
  description: 'Execute a shell command in the project directory. Use this to run tests, build commands, inspect files, or perform system operations.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default 30000, max 120000)'),
  }),
  async execute(params, ctx) {
    const timeout = Math.min(params.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT)

    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: ctx.directory,
        timeout,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0' },
      })

      const combined = [stdout, stderr].filter(Boolean).join('\n').trim()
      const output = combined.length > MAX_OUTPUT
        ? combined.slice(0, MAX_OUTPUT) + `\n\n(Output truncated at ${MAX_OUTPUT} characters)`
        : combined || '(No output)'

      return {
        title: params.command.slice(0, 50) + (params.command.length > 50 ? '...' : ''),
        output: `$ ${params.command}\n\n${output}`,
        metadata: {
          command: params.command,
          exitCode: 0,
          hasStderr: !!stderr,
        },
      }
    } catch (error: any) {
      const stdout = error.stdout || ''
      const stderr = error.stderr || ''
      const exitCode = error.code || 1

      const combined = [stdout, stderr].filter(Boolean).join('\n').trim()
      const output = combined.length > MAX_OUTPUT
        ? combined.slice(0, MAX_OUTPUT) + `\n\n(Output truncated at ${MAX_OUTPUT} characters)`
        : combined || error.message || 'Command failed'

      return {
        title: params.command.slice(0, 50) + (params.command.length > 50 ? '...' : ''),
        output: `$ ${params.command}\nExit code: ${exitCode}\n\n${output}`,
        metadata: {
          command: params.command,
          exitCode,
          error: error.message,
        },
      }
    }
  },
})
