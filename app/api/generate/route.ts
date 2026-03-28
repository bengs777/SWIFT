import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { BillingService } from "@/lib/services/billing.service"
import { ModelConfigService } from "@/lib/services/model-config.service"
import { ProviderRouter } from "@/lib/ai/provider-router"
import { enforceUserRateLimit } from "@/lib/security/rate-limit"
import { env } from "@/lib/env"
import { buildProjectFiles } from "@/lib/ai/project-scaffold"
import { enhancePromptWithAgentRouter } from "@/lib/ai/prompt-enhancer"
import type { GeneratedFile } from "@/lib/types"

export const runtime = "nodejs"

const MAX_PROMPT_LENGTH = 12000

interface GenerateRequest {
  prompt: string
  projectId: string
  selectedModel: string
}

function getFriendlyProviderErrorMessage(errorMessage: string) {
  const normalized = errorMessage.toLowerCase()

  if (
    normalized.includes("unauthorized client") ||
    normalized.includes("unauthenticated") ||
    normalized.includes("api error (401)") ||
    normalized.includes("api error (403)")
  ) {
    return "Akses provider ditolak. Token AgentRouter kemungkinan tidak valid, belum aktif, atau akun belum di-whitelist. Cek AGENT_ROUTER_TOKEN atau AGENTROUTER_API_KEY lalu pastikan token aktif di dashboard AgentRouter. Saldo kamu sudah otomatis direfund."
  }

  if (
    normalized.includes("insufficient_user_quota") ||
    normalized.includes("quota") ||
    normalized.includes("额度不足")
  ) {
    return "Kuota provider habis di sisi AgentRouter. Saldo kamu sudah otomatis direfund. Isi ulang kuota provider lalu coba lagi."
  }

  if (normalized.includes("timed out")) {
    return "Provider terlalu lama merespons. Saldo kamu sudah otomatis direfund. Saya tetap menyiapkan starter full-stack agar kamu bisa lanjut edit di Code."
  }

  return "Model provider sedang sibuk atau gagal merespons. Saldo kamu sudah otomatis direfund. Saya tetap menyiapkan starter full-stack agar kamu bisa lanjut edit di Code."
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  try {
    const body: GenerateRequest = await request.json()
    const prompt = body.prompt?.trim()
    const selectedModel = body.selectedModel?.trim()
    const projectId = body.projectId?.trim()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required", code: "PROMPT_REQUIRED" }, { status: 400 })
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        {
          error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.`,
          code: "PROMPT_TOO_LONG",
          maxLength: MAX_PROMPT_LENGTH,
          currentLength: prompt.length,
        },
        { status: 400 }
      )
    }

    if (!selectedModel) {
      return NextResponse.json({ error: "Model selection is required", code: "MODEL_REQUIRED" }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project id is required", code: "PROJECT_REQUIRED" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        balance: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Authenticated user not found" }, { status: 404 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      },
      include: {
        history: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    enforceUserRateLimit(user.id)

    const modelConfig = await ModelConfigService.getActiveModelByKey(selectedModel)

    if (!modelConfig) {
      return NextResponse.json({ error: "Selected model is not available" }, { status: 403 })
    }

    const canFallbackToOpenAi =
      modelConfig.provider === "agentrouter" &&
      env.aiFallbackProvider === "openai" &&
      Boolean(env.openAiApiKey)

    if (modelConfig.provider === "agentrouter" && !env.agentRouterApiKey && !canFallbackToOpenAi) {
      return NextResponse.json({ error: "AgentRouter provider is not configured" }, { status: 503 })
    }

    if (modelConfig.provider === "openai" && !env.openAiApiKey) {
      return NextResponse.json({ error: "OpenAI provider is not configured" }, { status: 503 })
    }

    if (user.balance < modelConfig.price) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 402 })
    }

    const usageLog = await BillingService.reserveBalance(
      user.id,
      modelConfig.id,
      modelConfig.key,
      modelConfig.provider,
      prompt,
      modelConfig.price
    )

    try {
      const promptEnhancement =
        modelConfig.provider === "agentrouter"
          ? await enhancePromptWithAgentRouter({
              prompt,
              modelName: modelConfig.modelName,
            })
          : {
              prompt,
              summary: prompt,
              sourcesUsed: [],
              usedEnhancement: false,
            }

      const effectivePrompt = promptEnhancement.prompt
      const result = await ProviderRouter.generate({
        provider: modelConfig.provider,
        modelName: modelConfig.modelName,
        prompt: effectivePrompt,
      })

      const generated = buildProjectFiles({
        prompt: effectivePrompt,
        originalPrompt: prompt,
        projectName: project.name,
        providerMessage: result.message,
        promptSummary: promptEnhancement.summary,
      })

      const sourceList = promptEnhancement.sourcesUsed
        .map((source) => source.split("@")[0])
        .join(" + ")
      const baseResponseMessage = promptEnhancement.usedEnhancement
        ? `${generated.message}\n\nPrompt user sudah diperjelas lebih dulu dengan ${sourceList}. Ringkasan brief: ${promptEnhancement.summary}`
        : generated.message
      const fallbackNote = result.usedFallback
        ? `\n\nCatatan: provider utama (${modelConfig.provider}) gagal merespons, jadi request otomatis dialihkan ke ${result.providerUsed} (${result.modelUsed}).`
        : ""
      const responseMessage = `${baseResponseMessage}${fallbackNote}`

      const historyId = await saveProjectGeneration(project.id, prompt, generated.files)

      await BillingService.markCompleted(usageLog.id, {
        provider: result.providerUsed,
        model: result.modelUsed,
        errorMessage: result.usedFallback && result.primaryError
          ? `Primary provider failed: ${result.primaryError}`
          : null,
      })

      return NextResponse.json({
        message: responseMessage,
        files: generated.files,
        code: generated.files[0]?.content || "",
        historyId,
        usage: {
          model: result.modelUsed,
          provider: result.providerUsed,
          billedModel: modelConfig.key,
          billedProvider: modelConfig.provider,
          cost: modelConfig.price,
          remainingBalance: user.balance - modelConfig.price,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "AI request failed"
      const generated = buildProjectFiles({
        prompt,
        projectName: project.name,
      })
      const friendlyMessage = getFriendlyProviderErrorMessage(errorMessage)

      await BillingService.refundReservation(
        usageLog.id,
        user.id,
        modelConfig.price,
        errorMessage
      )

      const historyId = await saveProjectGeneration(project.id, prompt, generated.files)

      return NextResponse.json({
        message: friendlyMessage,
        files: generated.files,
        code: generated.files[0]?.content || "",
        historyId,
        usage: {
          model: modelConfig.key,
          provider: modelConfig.provider,
          cost: 0,
          remainingBalance: user.balance,
        },
        refunded: true,
        warning: errorMessage,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process request"
    const status = message.toLowerCase().includes("rate limit") ? 429 : 500

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    )
  }
}

async function saveProjectGeneration(projectId: string, prompt: string, files: GeneratedFile[]) {
  const history = await prisma.$transaction(async (tx) => {
    const createdHistory = await tx.generationHistory.create({
      data: {
        projectId,
        prompt,
        result: JSON.stringify(files),
      },
    })

    await tx.projectFile.deleteMany({
      where: { projectId },
    })

    if (files.length > 0) {
      await tx.projectFile.createMany({
        data: files.map((file) => ({
          projectId,
          path: file.path,
          content: file.content,
          language: file.language,
        })),
      })
    }

    await tx.project.update({
      where: { id: projectId },
      data: { prompt },
    })

    return createdHistory
  })

  return history.id
}
