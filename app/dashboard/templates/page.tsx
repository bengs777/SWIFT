"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Layout, ShoppingBag, FileText, Settings, ArrowRight } from "lucide-react"

const categories = [
  { id: "all", name: "All Templates", icon: Layout },
  { id: "marketing", name: "Marketing", icon: Layout },
  { id: "application", name: "Application", icon: Settings },
  { id: "content", name: "Content", icon: FileText },
  { id: "ecommerce", name: "E-commerce", icon: ShoppingBag },
]

const templates = [
  {
    id: "landing-page",
    name: "Landing Page",
    description: "A modern SaaS landing page with hero, features, and CTA sections",
    category: "marketing",
    popular: true,
    image: "/templates/landing.png",
  },
  {
    id: "dashboard",
    name: "Admin Dashboard",
    description: "An admin dashboard with sidebar navigation, charts, and data tables",
    category: "application",
    popular: true,
    image: "/templates/dashboard.png",
  },
  {
    id: "pricing-page",
    name: "Pricing Page",
    description: "A pricing page with tier comparison and FAQ section",
    category: "marketing",
    popular: false,
    image: "/templates/pricing.png",
  },
  {
    id: "auth-pages",
    name: "Authentication",
    description: "Login and signup forms with validation",
    category: "application",
    popular: true,
    image: "/templates/auth.png",
  },
  {
    id: "blog-layout",
    name: "Blog Layout",
    description: "A blog with article list, individual post pages, and categories",
    category: "content",
    popular: false,
    image: "/templates/blog.png",
  },
  {
    id: "contact-form",
    name: "Contact Form",
    description: "A contact page with form, map, and company info",
    category: "marketing",
    popular: false,
    image: "/templates/contact.png",
  },
  {
    id: "product-page",
    name: "Product Page",
    description: "E-commerce product page with gallery, reviews, and add to cart",
    category: "ecommerce",
    popular: true,
    image: "/templates/product.png",
  },
  {
    id: "checkout",
    name: "Checkout Flow",
    description: "Multi-step checkout with cart, shipping, and payment",
    category: "ecommerce",
    popular: false,
    image: "/templates/checkout.png",
  },
]

export default function TemplatesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      activeCategory === "all" || template.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const handleUseTemplate = (templateId: string) => {
    // Create a new project with this template
    const projectId = Math.random().toString(36).substring(7)
    router.push(`/dashboard/project/${projectId}?template=${templateId}`)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Start with a pre-built template and customize it to your needs
        </p>
      </div>

      {/* Search and Categories */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className="gap-2"
              >
                <category.icon className="h-4 w-4" />
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Template Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layout className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">No templates found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term or category
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-muted-foreground/30"
              >
                {/* Preview Image */}
                <div className="aspect-[4/3] bg-muted">
                  <div className="flex h-full items-center justify-center">
                    <Layout className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{template.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                    {template.popular && (
                      <Badge variant="secondary" className="shrink-0">Popular</Badge>
                    )}
                  </div>
                  
                  <Button
                    className="mt-4 w-full gap-2"
                    size="sm"
                    onClick={() => handleUseTemplate(template.id)}
                  >
                    Use Template
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
