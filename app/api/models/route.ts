import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { ModelConfigService } from "@/lib/services/model-config.service"
import { env } from "@/lib/env"

const toLabel = (value: string) => {
  const cleanedValue = value.replace(/:free\b/gi, "").trim()

  if (value.includes("/")) {
    return cleanedValue
  }

  return cleanedValue
    .split(/[-_]/g)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
}

export async function GET() {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const models = await ModelConfigService.getActiveModels()

  const availableModels = models.filter((model) => {
    if (model.provider === "agentrouter") {
      return Boolean(env.agentRouterApiKey) || (env.aiFallbackProvider === "openai" && Boolean(env.openAiApiKey))
    }

    if (model.provider === "openai") {
      return Boolean(env.openAiApiKey)
    }

    return false
  })

  return NextResponse.json({
    models: availableModels.map((model) => ({
      ...model,
      label:
        model.key === "openai-fallback"
          ? `OpenAI Fallback (${toLabel(model.modelName)})`
          : toLabel(model.modelName),
    })),
  })
}
