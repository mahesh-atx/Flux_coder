import { z } from 'zod'
import { defineTool, type ToolInfo } from './tool'
import fs from 'fs/promises'
import path from 'path'

const IGNORE_PATTERNS = [
  'node_modules/', '__pycache__/', '.git/', 'dist/', 'build/', 'target/',
  'vendor/', '.idea/', '.vscode/', '.cache/', 'cache/', 'logs/',
  '.venv/', 'venv/', 'env/', 'tmp/', 'temp/', '.coverage', 'coverage/',
  'bin/', 'obj/',
]

const LIMIT = 100

export const ListTool: ToolInfo = defineTool('list', {
  description: 'List files in a directory with a tree-like structure, ignoring common build/dependency directories',
  parameters: z.object({
    path: z.string().optional().describe('The absolute path to the directory to list. Defaults to current directory.'),
    ignore: z.array(z.string()).optional().describe('Additional glob patterns to ignore'),
  }),
  async execute(params, ctx) {
    const searchPath = path.resolve(ctx.directory, params.path || '.')

    const allIgnore = IGNORE_PATTERNS.concat(params.ignore ?? [])
    const files: string[] = []

    async function walk(dir: string, prefix: string = '') {
      if (files.length >= LIMIT) return

      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }

      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

      for (const entry of entries) {
        if (files.length >= LIMIT) break
        if (entry.name.startsWith('.')) continue

        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
        const shouldIgnore = allIgnore.some(pattern =>
          relPath.endsWith(pattern.replace(/\/$/, '')) ||
          `${entry.name}/` === pattern ||
          entry.name === pattern.replace(/\/$/, '')
        )
        if (shouldIgnore) continue

        if (entry.isDirectory()) {
          files.push(`${relPath}/`)
          await walk(path.join(dir, entry.name), relPath)
        } else {
          files.push(relPath)
        }
      }
    }

    await walk(searchPath)

    const output = files.length === 0
      ? 'No files found'
      : files.join('\n')

    return {
      title: path.relative(ctx.directory, searchPath),
      output: `${searchPath}/\n${output}`,
      metadata: {
        count: files.length,
        truncated: files.length >= LIMIT,
      },
    }
  },
})
