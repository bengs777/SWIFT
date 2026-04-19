import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.email) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <main className="flex min-h-0 flex-1 overflow-hidden pt-14 md:pt-0">{children}</main>
    </div>
  )
}
