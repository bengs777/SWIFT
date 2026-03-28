import { prisma } from "@/lib/db/client"

export class BillingService {
  static async reserveBalance(userId: string, modelConfigId: string, model: string, provider: string, prompt: string, cost: number) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, balance: true },
      })

      if (!user) {
        throw new Error("User not found")
      }

      if (user.balance < cost) {
        throw new Error("Insufficient balance")
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            decrement: cost,
          },
        },
      })

      return tx.usageLog.create({
        data: {
          userId,
          modelConfigId,
          model,
          provider,
          cost,
          prompt,
          status: "reserved",
        },
      })
    })
  }

  static async markCompleted(
    usageLogId: string,
    details?: {
      provider?: string
      model?: string
      errorMessage?: string | null
    }
  ) {
    const data: {
      status: "completed"
      provider?: string
      model?: string
      errorMessage?: string | null
    } = {
      status: "completed",
    }

    if (details?.provider) {
      data.provider = details.provider
    }

    if (details?.model) {
      data.model = details.model
    }

    if (typeof details?.errorMessage !== "undefined") {
      data.errorMessage = details.errorMessage
    }

    return prisma.usageLog.update({
      where: { id: usageLogId },
      data,
    })
  }

  static async refundReservation(usageLogId: string, userId: string, cost: number, errorMessage: string) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: cost,
          },
        },
      })

      return tx.usageLog.update({
        where: { id: usageLogId },
        data: {
          status: "refunded",
          errorMessage,
          refundedAt: new Date(),
        },
      })
    })
  }
}
