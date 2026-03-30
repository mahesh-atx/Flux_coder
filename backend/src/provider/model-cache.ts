import { Log } from "../util/log"
import type { ProviderInfo } from "./models"

const log = Log

interface CacheEntry {
  data: ProviderInfo
  timestamp: number
  ttl: number
}

const cache = new Map<string, CacheEntry>()
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export namespace ModelCache {
  export function get(providerID: string): ProviderInfo | undefined {
    const entry = cache.get(providerID)
    if (!entry) return undefined

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(providerID)
      log.info("model cache expired", { providerID })
      return undefined
    }

    return entry.data
  }

  export function set(providerID: string, data: ProviderInfo, ttl?: number): void {
    cache.set(providerID, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? DEFAULT_TTL,
    })
    log.info("model cache set", { providerID, models: Object.keys(data.models).length })
  }

  export function clear(providerID?: string): void {
    if (providerID) {
      cache.delete(providerID)
      log.info("model cache cleared", { providerID })
    } else {
      cache.clear()
      log.info("model cache cleared all")
    }
  }

  export function has(providerID: string): boolean {
    return cache.has(providerID)
  }

  export function stats(): { size: number; entries: string[] } {
    return {
      size: cache.size,
      entries: Array.from(cache.keys()),
    }
  }
}
