import { redirect } from "next/navigation"

// Redirect /dashboard/projects to /dashboard
export default function ProjectsPage() {
  redirect("/dashboard")
}
