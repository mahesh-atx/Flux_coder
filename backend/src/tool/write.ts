import { z } from 'zod'
import { defineTool, type ToolInfo, type ToolResult } from './tool'
import fs from 'fs/promises'
import path from 'path'

export const WriteTool: ToolInfo = defineTool('write', {
  description: 'Write content to a file, creating it and any necessary directories. Use this for new files or complete rewrites.',
  parameters: z.object({
    filePath: z.string().describe('The absolute path to the file to write'),
    content: z.string().describe('The content to write to the file'),
  }),
  async execute(params, ctx) {
    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.directory, filepath)
    }

    const dir = path.dirname(filepath)
    await fs.mkdir(dir, { recursive: true })

    let existing = ''
    try {
      existing = await fs.readFile(filepath, 'utf-8')
    } catch {
      // File doesn't exist, that's fine
    }

    await fs.writeFile(filepath, params.content, 'utf-8')

    const title = path.relative(ctx.directory, filepath)
    const lines = params.content.split('\n').length
    const bytes = Buffer.byteLength(params.content, 'utf-8')
    const isNew = existing === ''

    const preview = params.content.split('\n').slice(0, 10).join('\n')

    return {
      title,
      output: `${isNew ? 'Created' : 'Overwrote'} ${title}\n${lines} lines, ${bytes} bytes\n\nPreview:\n${preview}`,
      metadata: {
        filepath,
        lines,
        bytes,
        isNew,
        preview,
      },
    }
  },
})
