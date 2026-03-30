import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModelV2 } from "@ai-sdk/provider"
import { Log } from "../util/log"
import { ModelCache } from "./model-cache"
import { NVIDIA_MODELS, type Model, type ProviderInfo, ModelsDev } from "./models"

const log = Log

interface ProviderState {
  providers: Map<string, ProviderInfo>
  models: Map<string, LanguageModelV2>
  sdk: Map<string, any>
}

const state: ProviderState = {
  providers: new Map(),
  models: new Map(),
  sdk: new Map(),
}

let initialized = false

export namespace Provider {
  export async function init(): Promise<void> {
    if (initialized) return

    log.info("initializing providers")

    const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY
    if (!apiKey) {
      log.error("no NVIDIA API key found in environment")
      throw new Error("NVIDIA_API_KEY or NVIDIA_NIM_API_KEY environment variable is required")
    }

    // Load from cache or registry
    const cached = ModelCache.get("nvidia")
    const provider = cached ?? NVIDIA_MODELS

    // Initialize SDK
    const sdk = createOpenAICompatible({
      name: "nvidia",
      baseURL: provider.api,
      apiKey,
      headers: {
        "Content-Type": "application/json",
      },
    })

    state.providers.set("nvidia", provider)
    state.sdk.set("nvidia", sdk)
    ModelCache.set("nvidia", provider)

    initialized = true
    log.info("nvidia provider initialized", { models: Object.keys(provider.models).length })
  }

  export async function list(): Promise<Map<string, ProviderInfo>> {
    await init()
    return state.providers
  }

  export async function getProvider(providerID: string): Promise<ProviderInfo | undefined> {
    await init()
    return state.providers.get(providerID)
  }

  export async function getModel(providerID: string, modelID: string): Promise<Model | undefined> {
    const provider = await getProvider(providerID)
    if (!provider) {
      log.error("provider not found", { providerID, available: Array.from(state.providers.keys()) })
      return undefined
    }

    const model = provider.models[modelID]
    if (!model) {
      const available = Object.keys(provider.models)
      log.error("model not found", { providerID, modelID, available })
      return undefined
    }

    return model
  }

  export async function getLanguageModel(providerID: string, modelID: string): Promise<LanguageModelV2> {
    const key = `${providerID}/${modelID}`

    const cached = state.models.get(key)
    if (cached) return cached

    const model = await getModel(providerID, modelID)
    if (!model) {
      const available = ModelsDev.listModelIDs()
      throw new Error(
        `Model not found: ${providerID}/${modelID}. Available models: ${available.slice(0, 5).join(", ")}...`
      )
    }

    const sdk = state.sdk.get(providerID)
    if (!sdk) {
      throw new Error(`SDK not initialized for provider: ${providerID}`)
    }

    const language = sdk.languageModel(model.api.id)
    state.models.set(key, language)

    log.info("language model created", { providerID, modelID, apiId: model.api.id })
    return language
  }

  export function validateModel(providerID: string, modelID: string): boolean {
    if (providerID !== "nvidia") return false
    return modelID in NVIDIA_MODELS.models
  }

  export function listModels(providerID: string = "nvidia"): Model[] {
    if (providerID !== "nvidia") return []
    return Object.values(NVIDIA_MODELS.models)
  }

  export function listModelIDs(providerID: string = "nvidia"): string[] {
    if (providerID !== "nvidia") return []
    return Object.keys(NVIDIA_MODELS.models)
  }

  export function getDefaultModel(): { providerID: string; modelID: string } {
    return { providerID: "nvidia", modelID: "meta/llama-3.3-70b-instruct" }
  }

  export function reset(): void {
    initialized = false
    state.providers.clear()
    state.models.clear()
    state.sdk.clear()
    ModelCache.clear()
    log.info("provider state reset")
  }
}
