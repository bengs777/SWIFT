import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { ModelConfigService } from "@/lib/services/model-config.service"
import { z } from "zod"

const MAX_PROMPT_LENGTH = 12000

const EstimateSchema = z.object({
  prompt: z.string().min(1),
  selectedModel: z.string().min(1),
  projectId: z.string().min(1).optional(),
})

function estimateTokens(prompt: string) {
  // Lightweight heuristic: 1 token ~= 4 chars plus small system overhead.
  return Math.max(64, Math.ceil(prompt.length / 4) + 120)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  try {
    const raw = await request.json()
    const body = await EstimateSchema.parseAsync(raw)
    const prompt = body.prompt.trim()
    const selectedModel = body.selectedModel.trim()

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        {
          error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.`,
          maxLength: MAX_PROMPT_LENGTH,
          currentLength: prompt.length,
        },
        { status: 400 }
      )
    }

    const [modelConfig, user] = await Promise.all([
      ModelConfigService.getActiveModelByKey(selectedModel),
      prisma.user.findUnique({
        where: { email },
        select: { balance: true },
      }),
    ])

    if (!modelConfig) {
      return NextResponse.json({ error: "Selected model is not available" }, { status: 403 })
    }

    if (!user) {
      return NextResponse.json({ error: "Authenticated user not found" }, { status: 404 })
    }

    const estimatedTokens = estimateTokens(prompt)
    const estimatedCost = modelConfig.price
    const remainingBalance = user.balance - estimatedCost

    return NextResponse.json({
      model: modelConfig.key,
      provider: modelConfig.provider,
      estimatedTokens,
      estimatedCost,
      currentBalance: user.balance,
      remainingBalance,
      canAfford: remainingBalance >= 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to estimate request"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
