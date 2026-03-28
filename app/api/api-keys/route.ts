import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { WorkspaceService } from '@/lib/services/workspace.service'
import { ApiKeyService } from '@/lib/services/api-key.service'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // Check if user is member of workspace
    const membership = await WorkspaceService.checkMembership(
      workspaceId,
      session.user.id
    )

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const apiKeys = await ApiKeyService.getApiKeys(workspaceId)
    return NextResponse.json(apiKeys)
  } catch (error) {
    console.error('[v0] Error fetching API keys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { workspaceId, name } = await request.json()

    if (!workspaceId || !name) {
      return NextResponse.json(
        { error: 'workspaceId and name are required' },
        { status: 400 }
      )
    }

    // Check if user is admin of workspace
    const membership = await WorkspaceService.checkMembership(
      workspaceId,
      session.user.id
    )

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create API keys' },
        { status: 403 }
      )
    }

    const apiKey = await ApiKeyService.createApiKey(workspaceId, name)
    return NextResponse.json(apiKey, { status: 201 })
  } catch (error) {
    console.error('[v0] Error creating API key:', error)
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}
