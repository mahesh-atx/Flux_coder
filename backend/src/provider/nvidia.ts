import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV2 } from '@ai-sdk/provider'

export function createNVIDIAProvider() {
  return createOpenAICompatible({
    baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY || '',
    name: 'nvidia',
  })
}

export function getNVIDIAModel(modelId: string = 'meta/llama3-70b-instruct'): LanguageModelV2 {
  const provider = createNVIDIAProvider()
  return provider.languageModel(modelId)
}
