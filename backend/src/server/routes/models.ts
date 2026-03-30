import { Hono } from "hono"
import { NVIDIA_MODELS, ModelsDev } from "../../provider/models"
import { Provider } from "../../provider/provider"
import { ModelCache } from "../../provider/model-cache"
import { Log } from "../../util/log"

const log = Log
export const modelRoutes = new Hono()

// List all available models
modelRoutes.get("/", async (c) => {
  try {
    await Provider.init()
    const models = Object.values(NVIDIA_MODELS.models)
    return c.json({
      provider: "nvidia",
      models: models.map((m) => ({
        id: `${m.providerID}/${m.id}`,
        name: m.name,
        providerID: m.providerID,
        family: m.family,
        speed: m.speed,
        role: m.role,
        status: m.status,
        capabilities: {
          toolcall: m.capabilities.toolcall,
          temperature: m.capabilities.temperature,
          reasoning: m.capabilities.reasoning,
          attachment: m.capabilities.attachment,
        },
        limit: m.limit,
      })),
    })
  } catch (e: any) {
    log.error("failed to list models", { error: e.message })
    return c.json({ error: e.message }, 500)
  }
})

// Get specific model info
modelRoutes.get("/:providerID/:modelID", async (c) => {
  try {
    const providerID = c.req.param("providerID")
    const modelID = c.req.param("modelID")
    const model = await Provider.getModel(providerID, modelID)

    if (!model) {
      return c.json({ error: "Model not found", available: ModelsDev.listModelIDs() }, 404)
    }

    return c.json(model)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// Validate a model exists
modelRoutes.post("/validate", async (c) => {
  try {
    const body = await c.req.json()
    const { providerID, modelID } = body

    if (!providerID || !modelID) {
      return c.json({ error: "providerID and modelID are required" }, 400)
    }

    const valid = Provider.validateModel(providerID, modelID)
    return c.json({
      valid,
      providerID,
      modelID,
      ...(!valid && { available: ModelsDev.listModelIDs() }),
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

// Get model cache stats
modelRoutes.get("/cache/stats", async (c) => {
  return c.json(ModelCache.stats())
})

// Clear model cache
modelRoutes.post("/cache/clear", async (c) => {
  ModelCache.clear()
  return c.json({ status: "ok", message: "Cache cleared" })
})
