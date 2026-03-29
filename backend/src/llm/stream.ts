import { streamText, tool, jsonSchema, type ToolSet } from 'ai'
import { getModel } from '../provider'
import { buildSystemPrompt } from '../agent'
import { listAllTools } from '../tool/registry'
import { disabled as getDisabledTools } from '../permission'
import type { Ruleset } from '../permission'
import { Log } from '../util/log'
import { z, type ZodType } from 'zod'

function zodToJsonSchema(schema: ZodType): Record<string, any> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJson(value as ZodType)
      const field = value as any
      if (!(field instanceof z.ZodOptional)) {
        required.push(key)
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    }
  }
  return { type: 'object' }
}

function zodFieldToJson(field: ZodType): Record<string, any> {
  if (field instanceof z.ZodString) {
    return { type: 'string', description: field.description ?? undefined }
  }
  if (field instanceof z.ZodNumber) {
    return { type: 'number', description: field.description ?? undefined }
  }
  if (field instanceof z.ZodBoolean) {
    return { type: 'boolean', description: field.description ?? undefined }
  }
  if (field instanceof z.ZodOptional) {
    return zodFieldToJson(field._def.innerType as ZodType)
  }
  if (field instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodFieldToJson(field._def.type as ZodType),
      description: field.description ?? undefined,
    }
  }
  if (field instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: field._def.values,
      description: field.description ?? undefined,
    }
  }
  if (field instanceof z.ZodObject) {
    return zodToJsonSchema(field)
  }
  return { type: 'string', description: field.description ?? undefined }
}

export interface StreamInput {
  sessionID: string
  model: { providerID: string; modelID: string }
  agentPrompt?: string
  directory: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  ruleset: Ruleset
  abort: AbortSignal
}

export async function stream(input: StreamInput) {
  const log = Log
  log.info('stream', { modelID: input.model.modelID, providerID: input.model.providerID })

  const systemPrompt = buildSystemPrompt({
    directory: input.directory,
    platform: process.platform,
    agentPrompt: input.agentPrompt,
    modelId: input.model.modelID,
  })

  const model = getModel(input.model)

  const allToolInfos = listAllTools()
  const allToolIds = allToolInfos.map(t => t.id)
  const disabledSet = getDisabledTools(allToolIds, input.ruleset)

  log.info('tools available', { allToolIds, disabledSet: Array.from(disabledSet) })

  const tools: Record<string, any> = {}
  for (const t of allToolInfos) {
    if (disabledSet.has(t.id)) continue

    const schema = zodToJsonSchema(t.parameters)
    log.info('registering tool', { id: t.id, description: t.description, schema })
    
    tools[t.id] = tool({
      id: t.id as any,
      description: t.description,
      inputSchema: jsonSchema(schema as any),
      async execute(args: any, options: any) {
        log.info('executing tool', { id: t.id, args })
        const ctx = {
          sessionID: input.sessionID,
          abort: options?.abortSignal ?? new AbortController().signal,
          messageID: 'msg_' + Date.now(),
          directory: input.directory,
        }
        try {
          const result = await t.execute(args, ctx)
          log.info('tool result', { id: t.id, output: result.output?.slice(0, 200) })
          return result
        } catch (error: any) {
          log.error('tool error', { id: t.id, error: error.message })
          throw error
        }
      },
    })
  }

  log.info('tools registered', { toolIds: Object.keys(tools) })

  return streamText({
    model,
    system: systemPrompt,
    messages: input.messages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: 10,
    abortSignal: input.abort,
    onError(error) {
      log.error('stream error', { error })
    },
  })
}
