import { getNVIDIAModel, createNVIDIAProvider } from './nvidia'
import type { LanguageModelV2 } from '@ai-sdk/provider'

export type ProviderType = 'nvidia'

export interface ModelConfig {
  providerID: string
  modelID: string
}

export function getProvider(providerId: string) {
  switch (providerId) {
    case 'nvidia':
      return createNVIDIAProvider()
    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}

export function getModel(config: ModelConfig): LanguageModelV2 {
  switch (config.providerID) {
    case 'nvidia':
      return getNVIDIAModel(config.modelID)
    default:
      throw new Error(`Unknown provider: ${config.providerID}`)
  }
}

export function defaultModel(): ModelConfig {
  return {
    providerID: 'nvidia',
    modelID: 'meta/llama3-70b-instruct',
  }
}
