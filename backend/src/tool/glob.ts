import { z } from 'zod'
import { defineTool, type ToolInfo } from './tool'
import fs from 'fs/promises'
import path from 'path'

const IGNORE_PATTERNS = [
  'node_modules', '__pycache__', '.git', 'dist', 'build', 'target', 'vendor',
  '.idea', '.vscode', '.cache', 'cache', 'logs', '.venv', 'venv', 'env',
  'tmp', 'temp', '.coverage', 'coverage', 'bin', 'obj',
]

export const GlobTool: ToolInfo = defineTool('glob', {
  description: 'Find files matching a glob pattern',
  parameters: z.object({
    pattern: z.string().describe('The glob pattern to match files against (e.g. "**/*.ts", "src/**/*.tsx")'),
    path: z.string().optional().describe('The directory to search in. Defaults to the current working directory.'),
  }),
  async execute(params, ctx) {
    let searchPath = params.path
      ? (path.isAbsolute(params.path) ? params.path : path.resolve(ctx.directory, params.path))
      : ctx.directory

    const limit = 100
    const results: { path: string; mtime: number }[] = []

    const globToRegex = (pattern: string): RegExp => {
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '<<GLOBSTAR>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<GLOBSTAR>>/g, '.*')
        .replace(/\?/g, '.')
      return new RegExp(`^${escaped}$`)
    }

    const regex = globToRegex(params.pattern)

    async function walkDir(dir: string) {
      if (results.length >= limit) return

      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        if (results.length >= limit) break

        if (IGNORE_PATTERNS.some(p => entry.name === p)) continue
        if (entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '..') continue

        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(searchPath, fullPath)

        if (entry.isDirectory()) {
          await walkDir(fullPath)
        } else if (entry.isFile()) {
          if (regex.test(relativePath) || regex.test(fullPath)) {
            const stat = await fs.stat(fullPath).catch(() => null)
            results.push({
              path: fullPath,
              mtime: stat?.mtimeMs ?? 0,
            })
          }
        }
      }
    }

    await walkDir(searchPath)
    results.sort((a, b) => b.mtime - a.mtime)

    const output: string[] = []
    if (results.length === 0) {
      output.push('No files found')
    } else {
      output.push(...results.map(f => f.path))
      if (results.length >= limit) {
        output.push('')
        output.push(`(Results are truncated: showing first ${limit} results. Consider using a more specific path or pattern.)`)
      }
    }

    return {
      title: path.relative(ctx.directory, searchPath),
      output: output.join('\n'),
      metadata: { count: results.length, truncated: results.length >= limit },
    }
  },
})
