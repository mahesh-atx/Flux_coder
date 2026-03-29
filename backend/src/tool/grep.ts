import { z } from 'zod'
import { defineTool, type ToolInfo } from './tool'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export const GrepTool: ToolInfo = defineTool('grep', {
  description: 'Search file contents using a regex pattern',
  parameters: z.object({
    pattern: z.string().describe('The regex pattern to search for in file contents'),
    path: z.string().optional().describe('The directory to search in. Defaults to the current working directory.'),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params, ctx) {
    if (!params.pattern) throw new Error('pattern is required')

    let searchPath = params.path
      ? (path.isAbsolute(params.path) ? params.path : path.resolve(ctx.directory, params.path))
      : ctx.directory

    const cmdParts = ['grep', '-rnH', '--include-dir=*']
    if (params.include) {
      cmdParts.push(`--include=${params.include}`)
    }
    cmdParts.push(`"${params.pattern.replace(/"/g, '\\"')}"`)
    cmdParts.push(`"${searchPath}"`)

    try {
      const { stdout, stderr } = await execAsync(cmdParts.join(' '), {
        maxBuffer: 1024 * 1024,
        cwd: ctx.directory,
      }).catch(() => ({ stdout: '', stderr: '' }))

      if (!stdout.trim()) {
        return {
          title: params.pattern,
          metadata: { matches: 0, truncated: false },
          output: 'No files found',
        }
      }

      const lines = stdout.trim().split(/\r?\n/)
      const matches: { path: string; lineNum: number; lineText: string }[] = []

      for (const line of lines) {
        if (!line) continue
        const firstColon = line.indexOf(':')
        if (firstColon === -1) continue
        const filePath = line.substring(0, firstColon)
        const rest = line.substring(firstColon + 1)
        const secondColon = rest.indexOf(':')
        if (secondColon === -1) continue
        const lineNumStr = rest.substring(0, secondColon)
        const lineText = rest.substring(secondColon + 1)
        const lineNum = parseInt(lineNumStr, 10)
        if (isNaN(lineNum)) continue
        matches.push({ path: filePath, lineNum, lineText })
      }

      const limit = 100
      const truncated = matches.length > limit
      const finalMatches = truncated ? matches.slice(0, limit) : matches

      if (finalMatches.length === 0) {
        return {
          title: params.pattern,
          metadata: { matches: 0, truncated: false },
          output: 'No files found',
        }
      }

      const outputLines = [`Found ${matches.length} matches${truncated ? ` (showing first ${limit})` : ''}`]
      let currentFile = ''
      for (const match of finalMatches) {
        if (currentFile !== match.path) {
          if (currentFile !== '') outputLines.push('')
          currentFile = match.path
          outputLines.push(`${match.path}:`)
        }
        const text = match.lineText.length > 2000
          ? match.lineText.substring(0, 2000) + '...'
          : match.lineText
        outputLines.push(`  Line ${match.lineNum}: ${text}`)
      }

      if (truncated) {
        outputLines.push('')
        outputLines.push(`(Results truncated: showing ${limit} of ${matches.length} matches)`)
      }

      return {
        title: params.pattern,
        output: outputLines.join('\n'),
        metadata: { matches: matches.length, truncated },
      }
    } catch {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: 'No files found',
      }
    }
  },
})
