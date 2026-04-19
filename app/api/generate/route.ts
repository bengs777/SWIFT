import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { BillingService } from "@/lib/services/billing.service"
import { ModelConfigService } from "@/lib/services/model-config.service"
import { enforceUserRateLimit } from "@/lib/security/rate-limit"
import { env } from "@/lib/env"
import { buildProjectFiles } from "@/lib/ai/project-scaffold"
import { extractGeneratedFilesFromProviderMessage, mergeGeneratedFiles } from "@/lib/ai/provider-output"
import { enhancePromptWithAgentRouter } from "@/lib/ai/prompt-enhancer"
import { autoRepairFullStackFiles, validateFullStackFiles } from "@/lib/ai/fullstack-validator"
import type { GeneratedFile } from "@/lib/types"
import { z } from "zod"
import { orchestrateGeneration } from "@/lib/ai/orchestrator"
import { log } from "@/lib/logging"

export const runtime = "nodejs"

class StrictFullStackValidationError extends Error {
  details: {
    missingBeforeRepair: string[]
    missingAfterRepair: string[]
    addedFiles: string[]
    parseMode: string
    providerFileCount: number
    finalFileCount: number
  }

  constructor(details: StrictFullStackValidationError["details"]) {
    super("STRICT_FULLSTACK_FAILSAFE_TRIGGERED")
    this.name = "StrictFullStackValidationError"
    this.details = details
  }
}

const MAX_PROMPT_LENGTH = 12000
const CONTEXT_FILE_CHAR_LIMIT = 2200
const CONTEXT_TOTAL_CHAR_LIMIT = 20000
const CONTEXT_MAX_FILE_COUNT = 18

const GenerateSchema = z.object({
  prompt: z.string().min(1),
  projectId: z.string().min(1),
  selectedModel: z.string().min(1),
  idempotencyKey: z.string().optional(),
})

function getProviderDisplayName(provider: string) {
  if (provider === "agentrouter") {
    return "AgentRouter"
  }

  if (provider === "openai") {
    return env.openAiApiUrl.includes("openrouter.ai") ? "OpenAI-compatible (OpenRouter)" : "OpenAI"
  }

  return "AI provider"
}

function getFriendlyProviderErrorMessage(errorMessage: string, provider: string) {
  const normalized = errorMessage.toLowerCase()
  const providerName = getProviderDisplayName(provider)

  if (
    normalized.includes("unauthorized client") ||
    normalized.includes("unauthenticated") ||
    normalized.includes("api error (401)") ||
    normalized.includes("api error (403)")
  ) {
    return `Akses ${providerName} ditolak. Periksa kredensial provider aktif (OPENAI_API_KEY atau AGENT_ROUTER_TOKEN), izin model, dan endpoint API. Saldo kamu sudah otomatis direfund.`
  }

  if (
    normalized.includes("insufficient_user_quota") ||
    normalized.includes("quota") ||
    normalized.includes("额度不足") ||
    normalized.includes("temporarily rate-limited") ||
    normalized.includes("rate-limited upstream")
  ) {
    return `Kuota/rate limit ${providerName} sedang penuh. Saldo kamu sudah otomatis direfund. Coba lagi beberapa menit, ganti model non-free, atau pakai provider key sendiri (BYOK) agar limit lebih longgar.`
  }

  if (
    normalized.includes("no endpoints found") ||
    normalized.includes("model not found") ||
    normalized.includes("unknown model")
  ) {
    return `Model yang dipilih saat ini tidak tersedia di ${providerName}. Saldo kamu sudah otomatis direfund. Silakan pilih model lain atau gunakan mode auto routing (openrouter/auto).`
  }

  if (normalized.includes("timed out")) {
    return `${providerName} terlalu lama merespons. Saldo kamu sudah otomatis direfund. Saya tetap menyiapkan starter full-stack agar kamu bisa lanjut edit di Code.`
  }

  return `${providerName} sedang sibuk atau gagal merespons. Saldo kamu sudah otomatis direfund. Saya tetap menyiapkan starter full-stack agar kamu bisa lanjut edit di Code.`
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  try {
    const raw = await request.json()
    const body = await GenerateSchema.parseAsync(raw)
    const prompt = body.prompt.trim()
    const selectedModel = body.selectedModel.trim()
    const projectId = body.projectId.trim()
    const idempotencyKey = body.idempotencyKey?.trim()

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
        files: {
          orderBy: {
            path: "asc",
          },
        },
        history: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const existingFiles = toGeneratedFiles(project.files || [])

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

    // Idempotency check: if client provided an idempotencyKey, return previous result
    if (idempotencyKey) {
      const existing = await prisma.generationHistory.findFirst({
        where: {
          projectId,
          idempotencyKey,
        },
      })

      if (existing) {
        try {
          const files = JSON.parse(existing.result) as GeneratedFile[]
          return NextResponse.json({
            message: 'Idempotent response: returning previous generation result',
            files,
            code: files[0]?.content || '',
            historyId: existing.id,
            usage: {
              cost: Number(existing.cost || 0),
              remainingBalance: user.balance,
            },
          })
        } catch (err) {
          // If parsing fails, continue to regenerate
          log('warn', 'Failed to parse existing generation result, regenerating', { historyId: existing.id })
        }
      }
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

      const basePrompt = promptEnhancement.prompt
      const effectivePrompt =
        existingFiles.length > 0
          ? buildContinuationPrompt({
              latestUserPrompt: prompt,
              basePrompt,
              existingFiles,
            })
          : basePrompt
      const fullStackPrompt = enforceFullStackRequirement(effectivePrompt)

      // Use orchestrator which checks idempotency and delegates to ProviderRouter
      const orchestration = await orchestrateGeneration({
        projectId: project.id,
        prompt: fullStackPrompt,
        provider: modelConfig.provider,
        modelName: modelConfig.modelName,
        idempotencyKey,
      })

      if ((orchestration as any).alreadyExists) {
        const existing = orchestration as any
        return NextResponse.json({
          message: 'Idempotent response: returning previous generation result',
          files: existing.files,
          code: existing.files?.[0]?.content || '',
          historyId: existing.historyId,
          usage: {
            cost: 0,
            remainingBalance: user.balance,
          },
        })
      }

      const result = (orchestration as any).providerResult
      const providerParsed = extractGeneratedFilesFromProviderMessage(result.message)
      const scaffold = buildProjectFiles({
        prompt: fullStackPrompt,
        originalPrompt: prompt,
        projectName: project.name,
        providerMessage: result.message,
        promptSummary: promptEnhancement.summary,
      })

      let generatedFiles: GeneratedFile[] = []
      let providerAssemblyMessage = ""
      const promptMode = inferPromptMode(prompt)
      const providerUpdatedEntry = hasPrimaryEntryUpdate(providerParsed.files)
      const shouldRebaseFromScaffold =
        existingFiles.length > 0 &&
        promptMode === "rebuild" &&
        (!providerUpdatedEntry || providerParsed.files.length <= 3)

      if (providerParsed.files.length > 0) {
        if (existingFiles.length > 0) {
          const mergeBase = shouldRebaseFromScaffold ? scaffold.files : existingFiles
          generatedFiles = mergeGeneratedFiles(mergeBase, providerParsed.files)
          providerAssemblyMessage = shouldRebaseFromScaffold
            ? `Provider menghasilkan ${providerParsed.files.length} file valid (${providerParsed.parseMode}). Karena prompt terdeteksi sebagai rebuild namun update halaman utama minim, sistem melakukan rebase dari scaffold terbaru lalu menerapkan output provider menjadi ${generatedFiles.length} file.`
            : `Provider menghasilkan ${providerParsed.files.length} file valid (${providerParsed.parseMode}) dan sistem menggabungkannya ke project existing (${existingFiles.length} file) menjadi ${generatedFiles.length} file.`
        } else {
          generatedFiles = mergeGeneratedFiles(scaffold.files, providerParsed.files)
          providerAssemblyMessage = `Provider menghasilkan ${providerParsed.files.length} file valid (${providerParsed.parseMode}) dan sistem melengkapi struktur standar menjadi ${generatedFiles.length} file.`
        }
      } else if (existingFiles.length > 0) {
        generatedFiles = existingFiles
        providerAssemblyMessage =
          "Output provider belum dalam format file terstruktur, jadi perubahan belum bisa diterapkan. Semua file project sebelumnya dipertahankan agar progress tidak hilang."
      } else {
        generatedFiles = scaffold.files
        providerAssemblyMessage =
          `${scaffold.message}\n\nOutput provider belum dalam format file terstruktur, jadi sistem memakai scaffold standar agar hasil tetap lengkap.`
      }

      const validationBeforeRepair = validateFullStackFiles(generatedFiles)
      const repairResult = autoRepairFullStackFiles(generatedFiles, scaffold.files)
      generatedFiles = repairResult.files

      const validationAfterRepair = validateFullStackFiles(generatedFiles)
      const repairedCategoryText =
        repairResult.missingBeforeRepair.length > 0
          ? repairResult.missingBeforeRepair.join(", ")
          : ""

      if (repairResult.repaired) {
        providerAssemblyMessage += `\n\nAuto-repair full-stack diterapkan: kategori [${repairedCategoryText}] dilengkapi dengan ${repairResult.addedFiles.length} file fallback.`
      } else if (validationBeforeRepair.missingCategories.length > 0) {
        providerAssemblyMessage += `\n\nValidasi full-stack mendeteksi kekurangan [${repairedCategoryText}], namun tidak ada fallback file tambahan yang bisa diterapkan otomatis.`
      }

      if (validationAfterRepair.missingCategories.length > 0) {
        throw new StrictFullStackValidationError({
          missingBeforeRepair: validationBeforeRepair.missingCategories,
          missingAfterRepair: validationAfterRepair.missingCategories,
          addedFiles: repairResult.addedFiles.map((file) => file.path),
          parseMode: providerParsed.parseMode,
          providerFileCount: providerParsed.files.length,
          finalFileCount: generatedFiles.length,
        })
      }

      log("info", "Generation output assembled", {
        projectId: project.id,
        selectedModel: modelConfig.key,
        providerUsed: result.providerUsed,
        providerModelUsed: result.modelUsed,
        existingFileCount: existingFiles.length,
        parseMode: providerParsed.parseMode,
        providerFileCount: providerParsed.files.length,
        missingBeforeRepair: validationBeforeRepair.missingCategories,
        missingAfterRepair: validationAfterRepair.missingCategories,
        autoRepairAddedFiles: repairResult.addedFiles.map((file) => file.path),
        shouldRebaseFromScaffold,
        providerUpdatedEntry,
        promptMode,
        finalFileCount: generatedFiles.length,
      })

      const sourceList = promptEnhancement.sourcesUsed
        .map((source) => source.split("@")[0])
        .join(" + ")
      const baseResponseMessage = promptEnhancement.usedEnhancement
        ? `${providerAssemblyMessage}\n\nPrompt user sudah diperjelas lebih dulu dengan ${sourceList}. Ringkasan brief: ${promptEnhancement.summary}`
        : providerAssemblyMessage
      const fallbackNote = result.usedFallback
        ? `\n\nCatatan: provider utama (${modelConfig.provider}) gagal merespons, jadi request otomatis dialihkan ke ${result.providerUsed} (${result.modelUsed}).`
        : ""
      const responseMessage = `${baseResponseMessage}${fallbackNote}`

      const historyId = await saveProjectGeneration(project.id, prompt, generatedFiles, {
        idempotencyKey,
        cost: modelConfig.price,
      })

      await BillingService.markCompleted(usageLog.id, {
        provider: result.providerUsed,
        model: result.modelUsed,
        errorMessage: result.usedFallback && result.primaryError
          ? `Primary provider failed: ${result.primaryError}`
          : null,
      })

      return NextResponse.json({
        message: responseMessage,
        files: generatedFiles,
        code: generatedFiles[0]?.content || "",
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
      const isStrictFullStackError = error instanceof StrictFullStackValidationError
      const errorMessage = error instanceof Error ? error.message : "AI request failed"
      const scaffoldFallback = buildProjectFiles({
        prompt,
        projectName: project.name,
      }).files
      const fallbackFiles = isStrictFullStackError
        ? autoRepairFullStackFiles(
            existingFiles.length > 0 ? existingFiles : scaffoldFallback,
            scaffoldFallback
          ).files
        : existingFiles.length > 0
          ? existingFiles
          : scaffoldFallback
      const friendlyMessage = isStrictFullStackError
        ? buildStrictFailSafeMessage((error as StrictFullStackValidationError).details)
        : getFriendlyProviderErrorMessage(errorMessage, modelConfig.provider)

      await BillingService.refundReservation(
        usageLog.id,
        user.id,
        modelConfig.price,
        errorMessage
      )

      const historyId = await saveProjectGeneration(project.id, prompt, fallbackFiles, {
        idempotencyKey,
        cost: 0,
      })

      return NextResponse.json({
        message:
          existingFiles.length > 0
            ? `${friendlyMessage}\n\nPerubahan belum diterapkan. File project terakhir dipertahankan supaya kamu bisa lanjut dari versi sebelumnya.`
            : friendlyMessage,
        files: fallbackFiles,
        code: fallbackFiles[0]?.content || "",
        historyId,
        usage: {
          model: modelConfig.key,
          provider: modelConfig.provider,
          cost: 0,
          remainingBalance: user.balance,
        },
        refunded: true,
        warning: errorMessage,
        ...(isStrictFullStackError
          ? {
              failSafe: {
                type: "strict-fullstack",
                details: (error as StrictFullStackValidationError).details,
              },
              code: "STRICT_FULLSTACK_FAILSAFE",
            }
          : {}),
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

function enforceFullStackRequirement(prompt: string) {
  return [
    prompt,
    "Hard requirement: Generate FULL-STACK Next.js app output, not frontend-only.",
    "Always include meaningful frontend UI + backend API route(s) + data model/service layer when applicable.",
    "Return ONLY valid JSON object with files array.",
  ].join("\n\n")
}

function inferPromptMode(prompt: string): "rebuild" | "refine" {
  const normalized = prompt.toLowerCase()

  const refineSignals = [
    "fix ",
    "perbaiki",
    "debug",
    "refactor",
    "update ",
    "ubah",
    "edit ",
    "tweak",
    "adjust",
    "rename",
    "ganti",
  ]

  if (refineSignals.some((signal) => normalized.includes(signal))) {
    return "refine"
  }

  return "rebuild"
}

function hasPrimaryEntryUpdate(files: GeneratedFile[]) {
  return files.some((file) => {
    const path = file.path.replace(/\\/g, "/").toLowerCase()
    return (
      path === "app/page.tsx" ||
      path === "app/page.ts" ||
      path === "app/layout.tsx" ||
      /app\/.+\/page\.(tsx|ts)$/i.test(path)
    )
  })
}

function toGeneratedFiles(
  files: Array<{ path: string; content: string; language: string | null }>
): GeneratedFile[] {
  return files.map((file) => ({
    path: normalizePath(file.path),
    content: file.content,
    language: normalizeLanguage(file.language, file.path),
  }))
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").trim()
}

function normalizeLanguage(language: string | null | undefined, path: string): GeneratedFile["language"] {
  const normalized = (language || "").toLowerCase().trim()

  if (normalized === "tsx") return "tsx"
  if (normalized === "ts" || normalized === "typescript" || normalized === "javascript" || normalized === "js") return "ts"
  if (normalized === "css") return "css"
  if (normalized === "json") return "json"
  if (normalized === "html") return "html"
  if (normalized === "prisma") return "prisma"
  if (normalized === "md" || normalized === "markdown") return "md"
  if (normalized === "env" || normalized === "dotenv") return "env"

  const lowerPath = path.toLowerCase()
  if (lowerPath.endsWith(".tsx")) return "tsx"
  if (lowerPath.endsWith(".ts")) return "ts"
  if (lowerPath.endsWith(".css")) return "css"
  if (lowerPath.endsWith(".json")) return "json"
  if (lowerPath.endsWith(".html")) return "html"
  if (lowerPath.endsWith(".prisma")) return "prisma"
  if (lowerPath.endsWith(".md")) return "md"
  if (lowerPath.endsWith(".env")) return "env"

  return "ts"
}

function buildContinuationPrompt({
  latestUserPrompt,
  basePrompt,
  existingFiles,
}: {
  latestUserPrompt: string
  basePrompt: string
  existingFiles: GeneratedFile[]
}) {
  const contextFiles = selectContextFiles(existingFiles)
  const fileTree = existingFiles
    .map((file) => `- ${file.path}`)
    .join("\n")

  const snippets = contextFiles
    .map((file) => {
      const content = truncateText(file.content, CONTEXT_FILE_CHAR_LIMIT)
      return `Path: ${file.path}\nLanguage: ${file.language}\n---\n${content}\n---`
    })
    .join("\n\n")

  return [
    `Latest user request:\n${latestUserPrompt}`,
    "Mode: Continue existing project. Do NOT restart from scaffold.",
    "If possible, edit existing files and add new files only when needed.",
    "Return ONLY valid JSON object using schema {\"message\":\"...\",\"files\":[{\"path\":\"...\",\"language\":\"...\",\"content\":\"...\"}]}.",
    "In files array, include only files you changed or created.",
    `Current project file tree (${existingFiles.length} files):\n${fileTree}`,
    `Current file content snippets (${contextFiles.length} files):\n${snippets}`,
    `Additional planning context:\n${basePrompt}`,
  ].join("\n\n")
}

function selectContextFiles(files: GeneratedFile[]) {
  const priorityRules = [
    /^app\/page\.tsx$/i,
    /^app\/layout\.tsx$/i,
    /^app\/.*\/page\.tsx$/i,
    /^app\/api\/.*\/route\.ts$/i,
    /^components\//i,
    /^lib\//i,
    /^prisma\/schema\.prisma$/i,
    /^app\/globals\.css$/i,
    /^styles\//i,
    /^package\.json$/i,
    /^tsconfig\.json$/i,
  ]

  const sorted = [...files].sort((left, right) => {
    const leftRank = getPathRank(left.path, priorityRules)
    const rightRank = getPathRank(right.path, priorityRules)

    if (leftRank !== rightRank) {
      return leftRank - rightRank
    }

    return left.path.localeCompare(right.path)
  })

  const selected: GeneratedFile[] = []
  let usedChars = 0

  for (const file of sorted) {
    if (selected.length >= CONTEXT_MAX_FILE_COUNT) {
      break
    }

    const estimated = Math.min(file.content.length, CONTEXT_FILE_CHAR_LIMIT)
    if (usedChars + estimated > CONTEXT_TOTAL_CHAR_LIMIT) {
      continue
    }

    selected.push(file)
    usedChars += estimated
  }

  return selected
}

function getPathRank(path: string, rules: RegExp[]) {
  for (let index = 0; index < rules.length; index += 1) {
    if (rules[index].test(path)) {
      return index
    }
  }

  return rules.length + 1
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value
  }

  return `${value.slice(0, limit)}\n/* ...truncated for context... */`
}

async function saveProjectGeneration(
  projectId: string,
  prompt: string,
  files: GeneratedFile[],
  opts?: { idempotencyKey?: string | null; cost?: number | null }
) {
  const history = await prisma.$transaction(async (tx) => {
    const createdHistory = await tx.generationHistory.create({
      data: {
        projectId,
        prompt,
        result: JSON.stringify(files),
        ...(opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
        cost: opts?.cost ?? 0,
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

function buildStrictFailSafeMessage(details: {
  missingBeforeRepair: string[]
  missingAfterRepair: string[]
  addedFiles: string[]
  parseMode: string
  providerFileCount: number
  finalFileCount: number
}) {
  const before = details.missingBeforeRepair.length > 0 ? details.missingBeforeRepair.join(", ") : "none"
  const after = details.missingAfterRepair.length > 0 ? details.missingAfterRepair.join(", ") : "none"
  const added = details.addedFiles.length > 0 ? details.addedFiles.join(", ") : "none"

  return [
    "Strict fail-safe aktif: hasil generate ditahan karena belum memenuhi standar full-stack setelah auto-repair.",
    "",
    "Diagnostik:",
    `- Missing sebelum repair: ${before}`,
    `- Missing setelah repair: ${after}`,
    `- File fallback yang ditambahkan: ${added}`,
    `- Parse mode provider: ${details.parseMode}`,
    `- Jumlah file valid dari provider: ${details.providerFileCount}`,
    `- Jumlah file akhir saat validasi: ${details.finalFileCount}`,
    "",
    "Saldo request ini sudah otomatis direfund. Coba prompt yang lebih spesifik atau ganti model.",
  ].join("\n")
}
