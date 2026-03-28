import { prisma } from '@/lib/db/client'
import crypto from 'crypto'

export class ApiKeyService {
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  static async createApiKey(
    workspaceId: string,
    name: string,
    expiresAt?: Date
  ) {
    const key = this.generateKey()

    return prisma.apiKey.create({
      data: {
        workspaceId,
        name,
        key,
        expiresAt,
      },
    })
  }

  static async getApiKeys(workspaceId: string) {
    return prisma.apiKey.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        key: false, // Don't return the full key
        createdAt: true,
        lastUsed: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getApiKeyByKey(key: string) {
    return prisma.apiKey.findUnique({
      where: { key },
      include: {
        workspace: true,
      },
    })
  }

  static async updateLastUsed(apiKeyId: string) {
    return prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsed: new Date() },
    })
  }

  static async deleteApiKey(apiKeyId: string) {
    return prisma.apiKey.delete({
      where: { id: apiKeyId },
    })
  }

  static async rotateApiKey(apiKeyId: string) {
    const oldKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    })

    if (!oldKey) {
      throw new Error('API key not found')
    }

    // Delete old key and create new one
    await prisma.apiKey.delete({
      where: { id: apiKeyId },
    })

    const newKey = this.generateKey()
    return prisma.apiKey.create({
      data: {
        workspaceId: oldKey.workspaceId,
        name: oldKey.name,
        key: newKey,
      },
    })
  }
}
