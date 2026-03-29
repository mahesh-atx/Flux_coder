import { z } from 'zod'
import { defineTool, type ToolInfo, type ToolResult } from './tool'
import fs from 'fs/promises'
import path from 'path'

export const EditTool: ToolInfo = defineTool('edit', {
  description: 'Edit a file by replacing old text with new text. Read the file first to understand its contents before editing.',
  parameters: z.object({
    filePath: z.string().describe('The absolute path to the file to edit'),
    oldText: z.string().describe('The exact text to find and replace in the file'),
    newText: z.string().describe('The new text to replace oldText with'),
  }),
  async execute(params, ctx) {
    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.directory, filepath)
    }

    let content: string
    try {
      content = await fs.readFile(filepath, 'utf-8')
    } catch {
      throw new Error(`File not found: ${filepath}`)
    }

    const idx = content.indexOf(params.oldText)
    if (idx === -1) {
      throw new Error(
        `Text not found in ${filepath}. The oldText may have already been changed or does not match exactly.\n\n` +
        `Searched for:\n${params.oldText.slice(0, 200)}${params.oldText.length > 200 ? '...' : ''}`
      )
    }

    const newContent = content.replace(params.oldText, params.newText)

    const dir = path.dirname(filepath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filepath, newContent, 'utf-8')

    const title = path.relative(ctx.directory, filepath)

    const oldLines = params.oldText.split('\n').length
    const newLines = params.newText.split('\n').length
    const diff = newLines - oldLines

    const preview = params.newText.split('\n').slice(0, 10).join('\n')

    return {
      title,
      output: `Successfully edited ${title}\nReplaced ${oldLines} lines with ${newLines} lines (${diff >= 0 ? '+' : ''}${diff} lines)\n\nPreview:\n${preview}`,
      metadata: {
        filepath,
        linesChanged: Math.abs(diff),
        preview,
      },
    }
  },
})
