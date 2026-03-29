import { ReadTool } from './read'
import { GlobTool } from './glob'
import { GrepTool } from './grep'
import { ListTool } from './list'
import { EditTool } from './edit'
import { WriteTool } from './write'
import { BashTool } from './bash'
import type { ToolInfo } from './tool'

const ALL_TOOLS: Record<string, ToolInfo> = {
  read: ReadTool,
  glob: GlobTool,
  grep: GrepTool,
  list: ListTool,
  edit: EditTool,
  write: WriteTool,
  bash: BashTool,
}

export function getTool(id: string): ToolInfo | undefined {
  return ALL_TOOLS[id]
}

export function listAllTools(): ToolInfo[] {
  return Object.values(ALL_TOOLS)
}

export function getToolIds(): string[] {
  return Object.keys(ALL_TOOLS)
}

export function filterToolsByPermission(tools: string[], disabled: Set<string>): string[] {
  return tools.filter(t => !disabled.has(t))
}
