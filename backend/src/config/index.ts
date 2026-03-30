import { z } from "zod"
import { Log } from "../util/log"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const log = Log

const FluxConfigSchema = z.object({
  model: z.string().optional(),
  provider: z
    .record(
      z.object({
        blacklist: z.array(z.string()).optional(),
        whitelist: z.array(z.string()).optional(),
        options: z.record(z.any()).optional(),
      })
    )
    .optional(),
  disabled_providers: z.array(z.string()).optional(),
  enabled_providers: z.array(z.string()).optional(),
})

export type FluxConfig = z.infer<typeof FluxConfigSchema>

let config: FluxConfig = {}

export namespace Config {
  export function load(configPath?: string): FluxConfig {
    const paths = [
      configPath,
      join(process.cwd(), "flux-config.json"),
      join(process.env.HOME || process.env.USERPROFILE || "~", ".config", "flux", "config.json"),
    ].filter(Boolean) as string[]

    for (const p of paths) {
      try {
        if (!existsSync(p)) continue
        const content = readFileSync(p, "utf-8")
        const parsed = JSON.parse(content)
        config = FluxConfigSchema.parse(parsed)
        log.info("config loaded", { path: p })
        return config
      } catch (e) {
        // Continue to next path
      }
    }

    log.info("no config file found, using defaults")
    return config
  }

  export function get(): FluxConfig {
    return config
  }

  export function defaultModel(): { providerID: string; modelID: string } {
    if (config.model) {
      const [providerID, ...rest] = config.model.split("/")
      return { providerID, modelID: rest.join("/") }
    }
    return { providerID: "nvidia", modelID: "meta/llama-3.3-70b-instruct" }
  }

  export function isModelAllowed(providerID: string, modelID: string): boolean {
    const providerCfg = config.provider?.[providerID]
    if (!providerCfg) return true

    if (providerCfg.blacklist?.includes(modelID)) return false
    if (providerCfg.whitelist && !providerCfg.whitelist.includes(modelID)) return false

    return true
  }
}
