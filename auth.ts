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
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : ""
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : ""

        if (!email || !password) {
          return null
        }

        const user = await UserService.validateCredentials(email, password)
        if (!user) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || email.split("@")[0],
          image: user.image || undefined,
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
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
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async signIn({ user, account, profile, email, credentials }) {
      if (account?.provider === "google" && email?.verificationRequest) {
        // This is a verification request, not a login attempt
        return true
      }

      try {
        if (account?.provider === "google" && user.email) {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          })

          if (!existingUser) {
            await UserService.createUserWithWorkspace(
              user.email,
              user.name || null,
              user.image || null
            )
          } else {
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
        const err = error as Error
        console.error(
          `[AUTH] Error during signIn callback: ${err.name} - ${err.message}`
        )
        console.error(`[AUTH] User:`, user)
        console.error(`[AUTH] Account:`, account)
        // Return a redirect to the error page with the error name
        return `/auth/error?error=${err.name || "SignInError"}`
      }
    },
  },
  events: {
    async signIn(message) {
      /* on successful sign in */
    },
    async signOut(message) {
      /* on signout */
    },
    async createUser(message) {
      /* user created */
    },
    async updateUser(message) {
      /* user updated - e.g. their email was verified */
    },
    async linkAccount(message) {
      /* account linked to a user */
    },
    async session(message) {
      /* session is active */
    },
  },
})
