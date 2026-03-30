import { z } from "zod"
import { Log } from "../util/log"

const log = Log

// ─── Zod Schemas ───────────────────────────────────────────────

export const ModelCapabilities = z.object({
  toolcall: z.boolean(),
  temperature: z.boolean(),
  reasoning: z.boolean(),
  attachment: z.boolean(),
  input: z.object({
    text: z.boolean(),
    image: z.boolean().default(false),
    audio: z.boolean().default(false),
    video: z.boolean().default(false),
  }),
  output: z.object({
    text: z.boolean(),
  }),
})

export const ModelCost = z.object({
  input: z.number(),
  output: z.number(),
  cache: z.object({
    read: z.number(),
    write: z.number(),
  }),
})

export const ModelLimit = z.object({
  context: z.number(),
  output: z.number(),
})

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerID: z.string(),
  family: z.string().optional(),
  release_date: z.string().optional(),
  api: z.object({
    id: z.string(),
    url: z.string(),
    npm: z.string(),
  }),
  capabilities: ModelCapabilities,
  cost: ModelCost,
  limit: ModelLimit,
  options: z.record(z.any()).optional(),
  headers: z.record(z.string()).optional(),
  status: z.enum(["active", "alpha", "beta", "deprecated"]).default("active"),
  speed: z.enum(["fastest", "fast", "medium", "slow"]).optional(),
  role: z.enum(["general", "reasoning", "agent"]).optional(),
  variants: z.record(z.record(z.any())).optional(),
})

export type Model = z.infer<typeof ModelSchema>

export const ProviderInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  api: z.string(),
  npm: z.string(),
  env: z.array(z.string()),
  models: z.record(ModelSchema),
})

export type ProviderInfo = z.infer<typeof ProviderInfoSchema>

// ─── NVIDIA Model Registry ─────────────────────────────────────
// Single source of truth for all NVIDIA NIM models.
// Model IDs must match exactly what the NVIDIA API expects.

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1"

export const NVIDIA_MODELS: ProviderInfo = {
  id: "nvidia",
  name: "NVIDIA",
  api: NVIDIA_API_URL,
  npm: "@ai-sdk/openai-compatible",
  env: ["NVIDIA_API_KEY", "NVIDIA_NIM_API_KEY"],
  models: {
    // ── GLM Models (Zhipu AI) ──
    "z-ai/glm-4.6": {
      id: "z-ai/glm-4.6",
      name: "GLM-4.6",
      providerID: "nvidia",
      family: "glm",
      release_date: "2025-11-28",
      api: { id: "z-ai/glm-4.6", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "reasoning",
    },
    "z-ai/glm-4.7": {
      id: "z-ai/glm-4.7",
      name: "GLM-4.7",
      providerID: "nvidia",
      family: "glm",
      release_date: "2025-12-07",
      api: { id: "z-ai/glm-4.7", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "reasoning",
    },
    "z-ai/glm-5": {
      id: "z-ai/glm-5",
      name: "GLM-5",
      providerID: "nvidia",
      family: "glm",
      release_date: "2026-03-01",
      api: { id: "z-ai/glm-5", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "reasoning",
    },

    // ── Kimi (Moonshot AI) Models ──
    "moonshotai/kimi-k2-instruct": {
      id: "moonshotai/kimi-k2-instruct",
      name: "Kimi K2 Instruct",
      providerID: "nvidia",
      family: "kimi",
      release_date: "2025-06-01",
      api: { id: "moonshotai/kimi-k2-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "general",
    },
    "moonshotai/kimi-k2-instruct-0905": {
      id: "moonshotai/kimi-k2-instruct-0905",
      name: "Kimi K2 Instruct 0905",
      providerID: "nvidia",
      family: "kimi",
      release_date: "2025-09-05",
      api: { id: "moonshotai/kimi-k2-instruct-0905", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "general",
    },

    // ── Qwen Models ──
    "qwen/qwen3-next-80b-a3b-instruct": {
      id: "qwen/qwen3-next-80b-a3b-instruct",
      name: "Qwen3 Next 80B",
      providerID: "nvidia",
      family: "qwen",
      release_date: "2025-11-01",
      api: { id: "qwen/qwen3-next-80b-a3b-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "reasoning",
    },

    // ── DeepSeek Models ──
    "deepseek-ai/deepseek-v3.1": {
      id: "deepseek-ai/deepseek-v3.1",
      name: "DeepSeek V3.1",
      providerID: "nvidia",
      family: "deepseek",
      release_date: "2025-08-01",
      api: { id: "deepseek-ai/deepseek-v3.1", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "reasoning",
    },
    "deepseek-ai/deepseek-v3.1-terminus": {
      id: "deepseek-ai/deepseek-v3.1-terminus",
      name: "DeepSeek V3.1 Terminus",
      providerID: "nvidia",
      family: "deepseek",
      release_date: "2025-10-01",
      api: { id: "deepseek-ai/deepseek-v3.1-terminus", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "reasoning",
    },
    "deepseek-ai/deepseek-v3.2": {
      id: "deepseek-ai/deepseek-v3.2",
      name: "DeepSeek V3.2",
      providerID: "nvidia",
      family: "deepseek",
      release_date: "2026-01-01",
      api: { id: "deepseek-ai/deepseek-v3.2", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "reasoning",
    },

    // ── NVIDIA / Nemotron Models ──
    "nvidia/nemotron-3-super-120b-a12b": {
      id: "nvidia/nemotron-3-super-120b-a12b",
      name: "Nemotron 120B Super",
      providerID: "nvidia",
      family: "nemotron",
      release_date: "2024-06-01",
      api: { id: "nvidia/nemotron-3-super-120b-a12b", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 8192 },
      status: "active",
      speed: "slow",
      role: "agent",
    },
    "nvidia/nemotron-3-nano-30b-a3b": {
      id: "nvidia/nemotron-3-nano-30b-a3b",
      name: "Nemotron 30B Nano",
      providerID: "nvidia",
      family: "nemotron",
      release_date: "2024-06-01",
      api: { id: "nvidia/nemotron-3-nano-30b-a3b", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 32768, output: 4096 },
      status: "active",
      speed: "fast",
      role: "agent",
    },
    "nvidia/llama-3.1-nemotron-ultra-253b-v1": {
      id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      name: "Llama Nemotron Ultra 253B",
      providerID: "nvidia",
      family: "nemotron",
      release_date: "2025-04-01",
      api: { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "agent",
    },
    "nvidia/llama-3.1-nemotron-70b-instruct": {
      id: "nvidia/llama-3.1-nemotron-70b-instruct",
      name: "Llama Nemotron 70B",
      providerID: "nvidia",
      family: "nemotron",
      release_date: "2024-10-01",
      api: { id: "nvidia/llama-3.1-nemotron-70b-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 4096 },
      status: "active",
      speed: "slow",
      role: "agent",
    },
    "nvidia/llama-3.1-nemotron-70b-reward": {
      id: "nvidia/llama-3.1-nemotron-70b-reward",
      name: "Llama Nemotron 70B Reward",
      providerID: "nvidia",
      family: "nemotron",
      release_date: "2024-10-01",
      api: { id: "nvidia/llama-3.1-nemotron-70b-reward", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: false, temperature: false, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 4096 },
      status: "active",
      speed: "slow",
      role: "general",
    },
    "nvidia/nemotron-mini-4b-instruct": {
      id: "nvidia/nemotron-mini-4b-instruct",
      name: "Nemotron Mini 4B",
      providerID: "nvidia",
      family: "nemotron",
      release_date: "2024-06-01",
      api: { id: "nvidia/nemotron-mini-4b-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 32768, output: 4096 },
      status: "active",
      speed: "fastest",
      role: "agent",
    },

    // ── Meta (Llama) Models ──
    "meta/llama-3.3-70b-instruct": {
      id: "meta/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B",
      providerID: "nvidia",
      family: "llama",
      release_date: "2024-12-06",
      api: { id: "meta/llama-3.3-70b-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0.00023, output: 0.00040, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 4096 },
      status: "active",
      speed: "fast",
      role: "general",
    },
    "meta/llama-3.1-70b-instruct": {
      id: "meta/llama-3.1-70b-instruct",
      name: "Llama 3.1 70B",
      providerID: "nvidia",
      family: "llama",
      release_date: "2024-07-23",
      api: { id: "meta/llama-3.1-70b-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0.00023, output: 0.00040, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 4096 },
      status: "active",
      speed: "fast",
      role: "general",
    },
    "meta/llama-3.1-8b-instruct": {
      id: "meta/llama-3.1-8b-instruct",
      name: "Llama 3.1 8B",
      providerID: "nvidia",
      family: "llama",
      release_date: "2024-07-23",
      api: { id: "meta/llama-3.1-8b-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0.00002, output: 0.00004, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 4096 },
      status: "active",
      speed: "fastest",
      role: "general",
    },

    // ── OpenAI OSS Models ──
    "openai/gpt-oss-120b": {
      id: "openai/gpt-oss-120b",
      name: "GPT-OSS 120B",
      providerID: "nvidia",
      family: "gpt-oss",
      release_date: "2025-03-01",
      api: { id: "openai/gpt-oss-120b", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "slow",
      role: "general",
    },
    "openai/gpt-oss-20b": {
      id: "openai/gpt-oss-20b",
      name: "GPT-OSS 20B",
      providerID: "nvidia",
      family: "gpt-oss",
      release_date: "2025-03-01",
      api: { id: "openai/gpt-oss-20b", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 16384 },
      status: "active",
      speed: "fast",
      role: "general",
    },

    // ── MiniMax Models ──
    "minimaxai/minimax-m2.5": {
      id: "minimaxai/minimax-m2.5",
      name: "MiniMax M2.5",
      providerID: "nvidia",
      family: "minimax",
      release_date: "2025-12-01",
      api: { id: "minimaxai/minimax-m2.5", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: true, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 65536, output: 8192 },
      status: "active",
      speed: "fast",
      role: "general",
    },

    // ── StepFun Models ──
    "stepfun-ai/step-3.5-flash": {
      id: "stepfun-ai/step-3.5-flash",
      name: "StepFun 3.5 Flash",
      providerID: "nvidia",
      family: "stepfun",
      release_date: "2025-10-01",
      api: { id: "stepfun-ai/step-3.5-flash", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 65536, output: 8192 },
      status: "active",
      speed: "fast",
      role: "general",
    },

    // ── Microsoft Models ──
    "microsoft/phi-3.5-mini": {
      id: "microsoft/phi-3.5-mini",
      name: "Phi 3.5 Mini",
      providerID: "nvidia",
      family: "phi",
      release_date: "2024-08-01",
      api: { id: "microsoft/phi-3.5-mini", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 4096 },
      status: "active",
      speed: "fastest",
      role: "general",
    },
    "microsoft/phi-3-medium-128k-instruct": {
      id: "microsoft/phi-3-medium-128k-instruct",
      name: "Phi 3 Medium 128K",
      providerID: "nvidia",
      family: "phi",
      release_date: "2024-05-01",
      api: { id: "microsoft/phi-3-medium-128k-instruct", url: NVIDIA_API_URL, npm: "@ai-sdk/openai-compatible" },
      capabilities: { toolcall: true, temperature: true, reasoning: false, attachment: false, input: { text: true, image: false, audio: false, video: false }, output: { text: true } },
      cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
      limit: { context: 131072, output: 4096 },
      status: "active",
      speed: "fast",
      role: "general",
    },
  },
}

// ─── Utility Functions ──────────────────────────────────────────

export namespace ModelsDev {
  export async function get(): Promise<ProviderInfo> {
    return NVIDIA_MODELS
  }

  export async function getModel(modelID: string): Promise<Model | undefined> {
    return NVIDIA_MODELS.models[modelID]
  }

  export async function listModels(): Promise<Model[]> {
    return Object.values(NVIDIA_MODELS.models)
  }

  export function listModelIDs(): string[] {
    return Object.keys(NVIDIA_MODELS.models)
  }

  export function parseModel(fullID: string): { providerID: string; modelID: string } {
    const [providerID, ...rest] = fullID.split("/")
    return { providerID, modelID: rest.join("/") }
  }

  export function formatModel(providerID: string, modelID: string): string {
    return `${providerID}/${modelID}`
  }

  export function validateModel(providerID: string, modelID: string): boolean {
    if (providerID !== "nvidia") return false
    return modelID in NVIDIA_MODELS.models
  }

  export function getProviderInfo(): ProviderInfo {
    return NVIDIA_MODELS
  }
}
