import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { env } from '@/lib/env'

const globalForPrisma = global as unknown as { prisma?: PrismaClient }

function initializePrisma(): PrismaClient {
  if (env.nodeEnv !== 'production' && globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  if (!env.tursoDatabaseUrl) {
    throw new Error('TURSO_DATABASE_URL is required to initialize Prisma client')
  }

  const prismaAdapter = new PrismaLibSQL(
    createClient({
      url: env.tursoDatabaseUrl,
      authToken: env.tursoAuthToken || undefined,
    })
  )

  const prismaClient = new PrismaClient({
    adapter: prismaAdapter,
    log: ['warn', 'error'],
  })

  if (env.nodeEnv !== 'production') {
    globalForPrisma.prisma = prismaClient
  }

  return prismaClient
}

const prisma = initializePrisma()

export { prisma }
export default prisma
