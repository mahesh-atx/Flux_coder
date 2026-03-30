import { streamText, tool } from 'ai'
import { jsonSchema } from '@ai-sdk/provider-utils'
import { Provider } from '../provider/provider'
import { ProviderTransform } from '../provider/transform'
import { ModelsDev } from '../provider/models'
import { buildSystemPrompt } from '../agent'
import { listAllTools } from '../tool/registry'
import { disabled as getDisabledTools } from '../permission'
import type { Ruleset } from '../permission'
import { Log } from '../util/log'
import { z } from 'zod'

// ─── Zod to JSON Schema converter ──────────────────────────────

function zodToJsonSchema(schema: z.ZodTypeAny): any {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(value as z.ZodTypeAny)
      if (!(value as any).isOptional()) {
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

  if (schema instanceof z.ZodString) {
    const result: any = { type: 'string' }
    if (schema.description) result.description = schema.description
    return result
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' }
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' }
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema((schema as any)._def.type),
    }
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: (schema as any)._def.values,
    }
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema((schema as any)._def.innerType)
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema((schema as any)._def.innerType)
    inner.default = (schema as any)._def.defaultValue()
    return inner
  }

  return { type: 'string' }
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): any {
  if (field instanceof z.ZodString) {
    const result: any = { type: 'string' }
    if (field.description) result.description = field.description
    return result
  }
  if (field instanceof z.ZodNumber) return { type: 'number' }
  if (field instanceof z.ZodBoolean) return { type: 'boolean' }
  if (field instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema((field as any)._def.type) }
  }
  if (field instanceof z.ZodEnum) {
    return { type: 'string', enum: (field as any)._def.values }
  }
  if (field instanceof z.ZodOptional) {
    return zodFieldToJsonSchema((field as any)._def.innerType)
  }
  if (field instanceof z.ZodObject) {
    return zodToJsonSchema(field)
  }
  return { type: 'string' }
}

// ─── Stream function ───────────────────────────────────────────

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

  // Validate model exists in registry
  if (!Provider.validateModel(input.model.providerID, input.model.modelID)) {
    const available = ModelsDev.listModelIDs()
    throw new Error(
      `Invalid model: ${input.model.providerID}/${input.model.modelID}. ` +
      `Available models: ${available.slice(0, 5).join(', ')}...`
    )
  }

  // Get model info from registry
  const modelInfo = await Provider.getModel(input.model.providerID, input.model.modelID)
  if (!modelInfo) {
    throw new Error(`Model not found in registry: ${input.model.providerID}/${input.model.modelID}`)
  }

  const systemPrompt = buildSystemPrompt({
    directory: input.directory,
    platform: process.platform,
    agentPrompt: input.agentPrompt,
    modelId: input.model.modelID,
  })

  // Get language model through provider (handles SDK init, caching)
  const model = await Provider.getLanguageModel(input.model.providerID, input.model.modelID)

  // Apply message transforms for model-specific handling
  const transformedMessages = ProviderTransform.message(
    input.messages as any,
    modelInfo
  )

  // Get model-specific settings
  const temperature = ProviderTransform.temperature(modelInfo)
  const maxTokens = ProviderTransform.maxOutputTokens(modelInfo)

  // Build tools
  const disabledTools = getDisabledTools(
    listAllTools().map(t => t.id),
    input.ruleset
  )
  const allTools = listAllTools()

  const tools: Record<string, any> = {}
  for (const t of allTools) {
    if (disabledTools.has(t.id)) continue

    const schemaJson = zodToJsonSchema(t.parameters)
    tools[t.id] = tool({
      description: t.description,
      inputSchema: jsonSchema(schemaJson),
      execute: async (args: any) => {
        const ctx = {
          sessionID: input.sessionID,
          abort: input.abort,
          messageID: '',
          directory: input.directory,
        }
        const result = await t.execute(args, ctx)
        return result.output
      },
    })
  }

  log.info('tools available', {
    allToolIds: allTools.map(t => t.id),
    disabledSet: Array.from(disabledTools),
    enabledTools: Object.keys(tools),
  })

  const streamConfig: any = {
    model,
    system: systemPrompt,
    messages: transformedMessages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: 10,
    abortSignal: input.abort,
  }

  // Only set temperature if model supports it
  if (modelInfo.capabilities.temperature && temperature !== undefined) {
    streamConfig.temperature = temperature
  }

  // Only set maxTokens if model has a defined limit
  if (maxTokens > 0) {
    streamConfig.maxTokens = maxTokens
  }

  return streamText(streamConfig)
}
