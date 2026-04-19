import { NextResponse } from "next/server"
import { z } from "zod"
import { UserService } from "@/lib/services/user.service"

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  termsAccepted: z.literal(true),
})

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid registration data" },
      { status: 400 }
    )
  }

  try {
    const user = await UserService.createCredentialsUserWithWorkspace(
      parsed.data.email,
      parsed.data.name,
      parsed.data.password
    )

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === "USER_EXISTS") {
      return NextResponse.json(
        { error: "Email already registered. Please sign in." },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Unable to create account right now" },
      { status: 500 }
    )
  }
}
