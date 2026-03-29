import { z } from 'zod'
import { defineTool, type ToolInfo, type ToolContext } from './tool'
import fs from 'fs/promises'
import path from 'path'

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`
const MAX_BYTES = 50 * 1024
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`

const BINARY_EXTENSIONS = new Set([
  '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.class', '.jar', '.war',
  '.7z', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods',
  '.odp', '.bin', '.dat', '.obj', '.o', '.a', '.lib', '.wasm', '.pyc', '.pyo',
])

async function isBinaryFile(filepath: string, fileSize: number): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase()
  if (BINARY_EXTENSIONS.has(ext)) return true
  if (fileSize === 0) return false

  try {
    const fh = await fs.open(filepath, 'r')
    try {
      const sampleSize = Math.min(4096, fileSize)
      const bytes = Buffer.alloc(sampleSize)
      const result = await fh.read(bytes, 0, sampleSize, 0)
      if (result.bytesRead === 0) return false

      let nonPrintableCount = 0
      for (let i = 0; i < result.bytesRead; i++) {
        if (bytes[i] === 0) return true
        if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
          nonPrintableCount++
        }
      }
      return nonPrintableCount / result.bytesRead > 0.3
    } finally {
      await fh.close()
    }
  } catch {
    return true
  }
}

export const ReadTool: ToolInfo = defineTool('read', {
  description: 'Read contents of a file or list contents of a directory',
  parameters: z.object({
    filePath: z.string().describe('The absolute path to the file or directory to read'),
    offset: z.coerce.number().optional().describe('The line number to start reading from (1-indexed)'),
    limit: z.coerce.number().optional().describe('The maximum number of lines to read (defaults to 2000)'),
  }),
  async execute(params, ctx) {
    if (params.offset !== undefined && params.offset < 1) {
      throw new Error('offset must be greater than or equal to 1')
    }

    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.directory, filepath)
    }

    let stat
    try {
      stat = await fs.stat(filepath)
    } catch {
      throw new Error(`File not found: ${filepath}`)
    }

    if (stat.isDirectory()) {
      const dirents = await fs.readdir(filepath, { withFileTypes: true })
      const entries = await Promise.all(
        dirents.map(async (dirent) => {
          if (dirent.isDirectory()) return dirent.name + '/'
          return dirent.name
        })
      )
      entries.sort((a, b) => a.localeCompare(b))

      const limit = params.limit ?? DEFAULT_READ_LIMIT
      const offset = params.offset ?? 1
      const start = offset - 1
      const sliced = entries.slice(start, start + limit)
      const truncated = start + sliced.length < entries.length

      const output = [
        `<path>${filepath}</path>`,
        `<type>directory</type>`,
        `<entries>`,
        sliced.join('\n'),
        truncated
          ? `\n(Showing ${sliced.length} of ${entries.length} entries)`
          : `\n(${entries.length} entries)`,
        `</entries>`,
      ].join('\n')

      return {
        title: path.relative(ctx.directory, filepath),
        output,
        metadata: { preview: sliced.slice(0, 20).join('\n'), truncated },
      }
    }

    const isBinary = await isBinaryFile(filepath, stat.size)
    if (isBinary) throw new Error(`Cannot read binary file: ${filepath}`)

    const content = await fs.readFile(filepath, 'utf-8')
    const lines = content.split('\n')

    const limit = params.limit ?? DEFAULT_READ_LIMIT
    const offset = params.offset ?? 1
    const start = offset - 1
    const raw: string[] = []
    let bytes = 0
    let truncatedByBytes = false
    let hasMoreLines = false

    for (let i = start; i < lines.length; i++) {
      if (raw.length >= limit) {
        hasMoreLines = true
        break
      }

      const line = lines[i].length > MAX_LINE_LENGTH
        ? lines[i].substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX
        : lines[i]

      const size = Buffer.byteLength(line, 'utf-8') + (raw.length > 0 ? 1 : 0)
      if (bytes + size > MAX_BYTES) {
        truncatedByBytes = true
        hasMoreLines = true
        break
      }

      raw.push(line)
      bytes += size
    }

    const numberedContent = raw.map((line, index) => `${index + offset}: ${line}`)
    const totalLines = lines.length
    const lastReadLine = offset + raw.length - 1
    const nextOffset = lastReadLine + 1
    const truncated = hasMoreLines || truncatedByBytes

    let output = [`<path>${filepath}</path>`, `<type>file</type>`, '<content>'].join('\n')
    output += numberedContent.join('\n')

    if (truncatedByBytes) {
      output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${offset}-${lastReadLine}. Use offset=${nextOffset} to continue.)`
    } else if (hasMoreLines) {
      output += `\n\n(Showing lines ${offset}-${lastReadLine} of ${totalLines}. Use offset=${nextOffset} to continue.)`
    } else {
      output += `\n\n(End of file - total ${totalLines} lines)`
    }
    output += '\n</content>'

    return {
      title: path.relative(ctx.directory, filepath),
      output,
      metadata: { preview: raw.slice(0, 20).join('\n'), truncated },
    }
  },
})
