import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db/client"
import { WorkspaceService } from "@/lib/services/workspace.service"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const workspaceId = request.nextUrl.searchParams.get("workspaceId")

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      )
    }

    // Check if user has access to workspace
    const membership = await WorkspaceService.checkMembership(
      workspaceId,
      session.user.id
    )

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: {
        files: {
          take: 5, // Get latest 5 files
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error("[v0] Error fetching projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name, description, workspaceId, prompt } = await request.json()

    if (!name || !workspaceId) {
      return NextResponse.json(
        { error: "Name and workspaceId are required" },
        { status: 400 }
      )
    }

    // Check if user has access to workspace
    const membership = await WorkspaceService.checkMembership(
      workspaceId,
      session.user.id
    )

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        prompt,
        workspaceId,
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating project:", error)
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    )
  }
}
