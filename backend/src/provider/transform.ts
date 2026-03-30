import type { ModelMessage } from "ai"
import type { Model } from "./models"
import { Log } from "../util/log"

const log = Log

export namespace ProviderTransform {
  // Apply model-specific temperature defaults based on family
  export function temperature(model: Model): number | undefined {
    const id = model.id.toLowerCase()
    if (id.includes("glm")) return 1.0
    if (id.includes("minimax-m2")) return 1.0
    if (id.includes("kimi-k2")) {
      if (["thinking", "k2.", "k2p", "k2-5"].some((s) => id.includes(s))) {
        return 1.0
      }
      return 0.6
    }
    // Default for most models - let the API decide
    return undefined
  }

  // Apply model-specific top-p defaults
  export function topP(model: Model): number | undefined {
    const id = model.id.toLowerCase()
    if (["minimax-m2", "kimi-k2.5", "kimi-k2p5", "kimi-k2-5"].some((s) => id.includes(s))) {
      return 0.95
    }
    return undefined
  }

  // Apply model-specific top-k defaults
  export function topK(model: Model): number | undefined {
    const id = model.id.toLowerCase()
    if (id.includes("minimax-m2")) {
      if (["m2.", "m25", "m21"].some((s) => id.includes(s))) return 40
      return 20
    }
    return undefined
  }

  // Normalize messages for specific model families
  export function message(msgs: ModelMessage[], model: Model): ModelMessage[] {
    // GLM models: filter empty text parts to avoid API errors
    if (model.id.includes("glm") || model.family === "glm") {
      return msgs
        .map((msg) => {
          if (Array.isArray(msg.content)) {
            const filtered = (msg.content as any[]).filter((part: any) => {
              if (part.type === "text") return part.text !== ""
              return true
            })
            if (filtered.length === 0) return undefined
            return { ...msg, content: filtered }
          }
          if (typeof msg.content === "string" && msg.content === "") return undefined
          return msg
        })
        .filter((msg): msg is ModelMessage => msg !== undefined)
    }

    // DeepSeek models: ensure proper tool call formatting
    if (model.id.includes("deepseek") || model.family === "deepseek") {
      return msgs.map((msg) => {
        if (msg.role === "assistant" && Array.isArray(msg.content)) {
          const filtered = (msg.content as any[]).filter((part: any) => {
            if (part.type === "text") return part.text !== ""
            return true
          })
          return { ...msg, content: filtered }
        }
        return msg
      })
    }

    // MiniMax models: normalize tool call IDs
    if (model.id.includes("minimax")) {
      return msgs.map((msg) => {
        if ((msg.role === "assistant" || msg.role === "tool") && Array.isArray(msg.content)) {
          const normalized = (msg.content as any[]).map((part: any) => {
            if ((part.type === "tool-call" || part.type === "tool-result") && "toolCallId" in part) {
              return {
                ...part,
                toolCallId: part.toolCallId.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 64),
              }
            }
            return part
          })
          return { ...msg, content: normalized }
        }
        return msg
      })
    }

    return msgs
  }

  // Model variants for reasoning support
  export function variants(model: Model): Record<string, Record<string, any>> {
    if (!model.capabilities.reasoning) return {}
    if (model.variants && Object.keys(model.variants).length > 0) return model.variants

    const id = model.id.toLowerCase()

    // GLM models use thinking parameter
    if (id.includes("glm")) {
      return {
        low: { thinking: { type: "enabled", budgetTokens: 4000 } },
        medium: { thinking: { type: "enabled", budgetTokens: 8000 } },
        high: { thinking: { type: "enabled", budgetTokens: 16000 } },
      }
    }

    // DeepSeek uses reasoning_effort
    if (id.includes("deepseek")) {
      return {
        low: { reasoningEffort: "low" },
        medium: { reasoningEffort: "medium" },
        high: { reasoningEffort: "high" },
      }
    }

    // Default reasoning variants
    return {
      low: { reasoningEffort: "low" },
      medium: { reasoningEffort: "medium" },
      high: { reasoningEffort: "high" },
    }
  }

  // Max output tokens based on model limits
  export function maxOutputTokens(model: Model): number {
    return model.limit.output || 4096
  }

  // Build provider options for the AI SDK
  export function options(model: Model): Record<string, any> {
    const result: Record<string, any> = {}

    // Enable thinking for reasoning models
    if (model.capabilities.reasoning) {
      const id = model.id.toLowerCase()
      if (id.includes("glm")) {
        result["thinking"] = { type: "enabled", budgetTokens: 8000 }
      }
    }

    return result
  }
}
