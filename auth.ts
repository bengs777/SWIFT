import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/db/client"
import { UserService } from "@/lib/services/user.service"
import { env } from "@/lib/env"

async function resolveDatabaseUserId(email?: string | null) {
  if (!email) return null

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  return dbUser?.id ?? null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await UserService.createUserWithWorkspaceIfMissing(
          credentials.email,
          credentials.email.split("@")[0],
          null
        )

        return {
          id: user.id,
          email: user.email,
          name: user.name || credentials.email.split("@")[0],
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    signUp: "/signup",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email
      }

      const databaseUserId = await resolveDatabaseUserId(
        user?.email ?? token.email
      )

      if (databaseUserId) {
        token.id = databaseUserId
      } else if (user?.id) {
        token.id = user.id
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const databaseUserId = await resolveDatabaseUserId(
          session.user.email ?? token.email
        )

        session.user.id = (databaseUserId ?? token.id) as string
        session.user.email = token.email as string
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
    async signIn({ user, account, profile }) {
      try {
        // Only handle Google OAuth
        if (account?.provider === "google" && user.email) {
          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          })

          if (!existingUser) {
            // Create new user with default workspace
            await UserService.createUserWithWorkspace(
              user.email,
              user.name,
              user.image || null
            )
          } else {
            // Update existing user
            await prisma.user.update({
              where: { email: user.email },
              data: {
                name: user.name || existingUser.name,
                image: user.image || existingUser.image,
              },
            })
          }
        }
        return true
      } catch (error) {
        console.error("[v0] Auth signIn error:", error)
        return false
      }
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log("[v0] User signed in:", user.email, "via", account?.provider)
    },
  },
})
