import type { ModelOption } from "@/lib/types"

export const DEFAULT_MODEL_OPTIONS: ModelOption[] = [
  {
    key: "glm-4.6",
    label: "GLM-4.6",
    provider: "agentrouter",
    modelName: "glm-4.6",
    price: 2000,
    isActive: true,
  },
  {
    key: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    provider: "agentrouter",
    modelName: "deepseek-v3.2",
    price: 2000,
    isActive: true,
  },
  {
    key: "deepseek-v3.1",
    label: "DeepSeek V3.1",
    provider: "agentrouter",
    modelName: "deepseek-v3.1",
    price: 2000,
    isActive: true,
  },
  {
    key: "deepseek-r1-0528",
    label: "DeepSeek R1 0528",
    provider: "agentrouter",
    modelName: "deepseek-r1-0528",
    price: 2000,
    isActive: true,
  },
  {
    key: "glm-4.5",
    label: "GLM-4.5",
    provider: "agentrouter",
    modelName: "glm-4.5",
    price: 2000,
    isActive: true,
  },
]

export const DEFAULT_MODEL_KEY = DEFAULT_MODEL_OPTIONS[0].key
