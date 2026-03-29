import { z } from 'zod'

export interface ToolContext {
  sessionID: string
  abort: AbortSignal
  messageID: string
  directory: string
}

export interface ToolResult {
  title: string
  metadata: Record<string, any>
  output: string
}

export interface ToolInfo<P extends z.ZodType = z.ZodType> {
  id: string
  description: string
  parameters: P
  execute(args: z.infer<P>, ctx: ToolContext): Promise<ToolResult>
}

export function defineTool<P extends z.ZodType>(
  id: string,
  config: {
    description: string
    parameters: P
    execute(args: z.infer<P>, ctx: ToolContext): Promise<ToolResult>
  }
): ToolInfo<P> {
  return {
    id,
    description: config.description,
    parameters: config.parameters,
    execute: async (args, ctx) => {
      const parsed = config.parameters.parse(args)
      return config.execute(parsed, ctx)
    },
  }
}
