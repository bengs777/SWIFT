import { env } from "@/lib/env"
import type { ModelOption } from "@/lib/types"
import { DEFAULT_MODEL_OPTIONS } from "@/lib/ai/models"

const DEFAULT_PRICE = 2000
const OPENAI_FALLBACK_KEY = "openai-fallback"

const dedupeList = (items: string[]) => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    if (!trimmed) {
      continue
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

const toLabel = (model: string) => {
  if (model.includes("/")) {
    return model
  }
  return model
    .split(/[-_]/g)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
}

const ensureDefaultFirst = (models: string[], defaultModel?: string) => {
  if (!defaultModel) {
    return models
  }
  const normalized = defaultModel.trim()
  if (!normalized) {
    return models
  }
  const existingIndex = models.findIndex((model) => model === normalized)
  if (existingIndex === -1) {
    return [normalized, ...models]
  }
  if (existingIndex === 0) {
    return models
  }
  return [normalized, ...models.filter((model) => model !== normalized)]
}

export function getRuntimeModelOptions(): ModelOption[] {
  const agentRouterCombined = dedupeList([
    ...env.agentRouterModels,
    ...env.agentRouterFallbackModels,
  ])

  const agentRouterOptions: ModelOption[] =
    agentRouterCombined.length === 0
      ? DEFAULT_MODEL_OPTIONS
      : ensureDefaultFirst(agentRouterCombined, env.agentRouterDefaultModel).map(
          (model): ModelOption => ({
            key: model,
            label: toLabel(model),
            provider: "agentrouter",
            modelName: model,
            price: DEFAULT_PRICE,
            isActive: true,
          })
        )

  const openAiCombined = dedupeList([
    env.openAiDefaultModel,
    ...env.openAiModels,
    env.openAiFallbackModel,
    ...(env.openAiApiUrl.includes("openrouter.ai") ? ["openrouter/auto"] : []),
  ])

  const openAiOptions: ModelOption[] = ensureDefaultFirst(
    openAiCombined,
    env.openAiDefaultModel
  ).map(
    (model): ModelOption => ({
      key: model,
      label: toLabel(model),
      provider: "openai",
      modelName: model,
      price: DEFAULT_PRICE,
      isActive: true,
    })
  )

  const options: ModelOption[] =
    env.aiPrimaryProvider === "openai"
      ? (openAiOptions.length > 0 ? openAiOptions : agentRouterOptions)
      : agentRouterOptions

  const fallbackModel = env.openAiFallbackModel.trim()
  if (
    env.aiPrimaryProvider !== "openai" &&
    env.aiFallbackProvider === "openai" &&
    fallbackModel
  ) {
    options.push({
      key: OPENAI_FALLBACK_KEY,
      label: `OpenAI Fallback (${toLabel(fallbackModel)})`,
      provider: "openai",
      modelName: fallbackModel,
      price: DEFAULT_PRICE,
      isActive: true,
    })
  }

  return options
}
