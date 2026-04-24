import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { prisma } from "@/lib/db/client"
import { UserService } from "@/lib/services/user.service"
import { env } from "@/lib/env"

const userIdCache = new Map<string, string | null>()

type AuthToken = JWT & {
  id?: string | null
  email?: string | null
}

type AuthSession = Session & {
  user: NonNullable<Session["user"]> & {
    id?: string | null
  }
}

function isMissingUserTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const message = `${error.message} ${error.meta ? JSON.stringify(error.meta) : ""}`
    return /no such table/i.test(message) && /main\.User/i.test(message)
  }

  const message = error instanceof Error ? error.message : String(error)
  return /no such table/i.test(message) && /main\.User/i.test(message)
}

async function resolveDatabaseUserId(email?: string | null) {
  if (!email) return null

  const normalizedEmail = email.trim().toLowerCase()

  if (userIdCache.has(normalizedEmail)) {
    return userIdCache.get(normalizedEmail) ?? null
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    const userId = dbUser?.id ?? null
    userIdCache.set(normalizedEmail, userId)
    return userId
  } catch (error) {
    if (isMissingUserTableError(error)) {
      if (env.nodeEnv !== "production") {
        console.warn("[auth] User table is not ready yet; skipping database user lookup.")
      }
      userIdCache.set(normalizedEmail, null)
      return null
    }

    console.error("[auth] Database error resolving user ID:", error)
    return null
  }
}

setInterval(() => {
  userIdCache.clear()
}, 5 * 60 * 1000)

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: env.nextAuthSecret,
  providers: [
    Google({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      const currentToken = token as AuthToken

      if (user?.email) {
        currentToken.email = user.email
      }

      const databaseUserId = await resolveDatabaseUserId(
        user?.email ?? currentToken.email
      )

      if (databaseUserId) {
        currentToken.id = databaseUserId
      } else if (user?.id) {
        currentToken.id = user.id
      }

      return currentToken
    },
    async session({ session, token }) {
      if (session.user) {
        const currentToken = token as AuthToken
        const currentSession = session as AuthSession
        const sessionUser = currentSession.user
        const userEmail = sessionUser.email ?? currentToken.email

        if (userEmail) {
          try {
            await UserService.grantMonthlyFreeCreditsIfNeeded(userEmail)
          } catch (error) {
            console.error("[auth] Session credit sync warning:", error)
          }
        }

        const databaseUserId = await resolveDatabaseUserId(userEmail)

        sessionUser.id = databaseUserId ?? currentToken.id ?? undefined
        sessionUser.email = currentToken.email ?? sessionUser.email ?? null
      }

      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
    async signIn({ user, account }) {
      try {
        if (account?.provider === "google" && user.email) {
          await UserService.createUserWithWorkspaceIfMissing(
            user.email,
            user.name || user.email.split("@")[0],
            user.image || null
          )

          userIdCache.delete(user.email.trim().toLowerCase())
        }
      } catch (error) {
        console.error("[auth] Auth signIn sync warning:", error)
      }

      return true
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log("[auth] User signed in:", user.email, "via", account?.provider)
    },
  },
})
