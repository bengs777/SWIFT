import { PrismaClient } from '@prisma/client'
import { env } from '@/lib/env'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'],
  })

if (env.nodeEnv !== 'production') globalForPrisma.prisma = prisma

export default prisma
