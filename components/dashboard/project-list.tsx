"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { MoreHorizontal, ExternalLink, Trash2, Globe } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"

interface ProjectListProps {
  searchQuery: string
  workspaceId?: string
}

interface ProjectItem {
  id: string
  name: string
  description: string | null
  updatedAt: string
  files: Array<{ id: string }>
}

export function ProjectList({ searchQuery, workspaceId }: ProjectListProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      if (!workspaceId) {
        setProjects([])
        setError("")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/projects?workspaceId=${workspaceId}`)
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          setError(data.error || "Failed to load projects")
          setProjects([])
          return
        }

        setProjects(data.projects || [])
      } catch (fetchError) {
        console.error("[v0] Failed to fetch projects:", fetchError)
        setError("Unable to load projects right now.")
        setProjects([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [workspaceId])

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (project.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [projects, searchQuery]
  )

  const handleDelete = async (projectId: string) => {
    setDeletingProjectId(projectId)
    setError("")

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error || "Failed to delete project")
        return
      }

      setProjects((currentProjects) =>
        currentProjects.filter((project) => project.id !== projectId)
      )
      router.refresh()
    } catch (deleteError) {
      console.error("[v0] Failed to delete project:", deleteError)
      setError("Unable to delete project right now.")
    } finally {
      setDeletingProjectId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (filteredProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Globe className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">No projects found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {searchQuery ? "Try a different search term" : "Create your first project to get started"}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filteredProjects.map((project) => (
        <Link
          key={project.id}
          href={`/dashboard/project/${project.id}`}
          className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-foreground">
                {project.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {project.description || "No description yet."}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/project/${project.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Preview
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={deletingProjectId === project.id}
                  onClick={(event) => {
                    event.preventDefault()
                    void handleDelete(project.id)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deletingProjectId === project.id ? "Deleting..." : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Badge variant="secondary">
              {project.files.length > 0 ? `${project.files.length} files` : "draft"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
