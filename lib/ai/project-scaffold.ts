import type { GeneratedFile } from "@/lib/types"

type BuildProjectFilesInput = {
  prompt: string
  originalPrompt?: string | null
  projectName?: string | null
  providerMessage?: string | null
  promptSummary?: string | null
}

type BuildProjectFilesOutput = {
  message: string
  files: GeneratedFile[]
}

export function buildProjectFiles({
  prompt,
  originalPrompt,
  projectName,
  providerMessage,
  promptSummary,
}: BuildProjectFilesInput): BuildProjectFilesOutput {
  const name = sanitizeName(projectName || inferName(prompt) || "Swift Starter")
  const isCommerce = /(marketplace|e-?commerce|shop|store|product|cart|checkout|shopee)/i.test(prompt)

  const files = isCommerce
    ? buildCommerceFiles(name, prompt, originalPrompt, providerMessage, promptSummary)
    : buildGenericFiles(name, prompt, originalPrompt, providerMessage, promptSummary)

  return {
    message: `Generated a full-stack starter for ${name} with editable files in Code tab and preview-ready homepage.`,
    files,
  }
}

function buildCommerceFiles(
  name: string,
  prompt: string,
  originalPrompt?: string | null,
  providerMessage?: string | null,
  promptSummary?: string | null
): GeneratedFile[] {
  const previewPrompt = escapeInlineText(promptSummary || prompt)
  const sourcePrompt = escapeMultilineText(originalPrompt || prompt)
  const effectivePrompt = escapeMultilineText(prompt)
  const safeName = serializeForCode(name)
  const safePreviewPrompt = serializeForCode(previewPrompt)

  return [
    {
      path: "app/page.tsx",
      language: "tsx",
      content: `export default function HomePage() {
  const projectName = ${safeName}
  const buildBrief = ${safePreviewPrompt}
  const features = [
    "Marketplace landing with promo hero",
    "Catalog API endpoint",
    "Order API endpoint",
    "Prisma schema for products and orders",
  ]

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/25 via-orange-600/10 to-neutral-900 p-10">
        <span className="rounded-full border border-orange-300/30 px-3 py-1 text-xs tracking-[0.2em] text-orange-200">
          {projectName}
        </span>
        <h1 className="mt-5 text-4xl font-semibold leading-tight">Build a modern marketplace quickly</h1>
        <p className="mt-3 max-w-2xl text-neutral-300">
          Build brief: {buildBrief}
        </p>
      </section>

      <section className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-medium">{feature}</h2>
            <p className="mt-2 text-sm text-neutral-400">Edit this file from Code tab and save changes.</p>
          </article>
        ))}
      </section>
    </main>
  )
}
`,
    },
    {
      path: "app/api/products/route.ts",
      language: "ts",
      content: `import { NextResponse } from "next/server"
import { listProducts } from "@/lib/services/catalog.service"

export async function GET() {
  const products = await listProducts()
  return NextResponse.json({ products, total: products.length })
}
`,
    },
    {
      path: "app/api/orders/route.ts",
      language: "ts",
      content: `import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const payload = await request.json()
  const { customerName, items } = payload

  if (!customerName || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "customerName and items are required" }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    order: {
      id: \`ord-\${Date.now()}\`,
      customerName,
      itemCount: items.length,
      status: "pending-payment",
    },
  })
}
`,
    },
    {
      path: "lib/services/catalog.service.ts",
      language: "ts",
      content: `type Product = {
  id: string
  name: string
  price: number
  stock: number
}

const mockProducts: Product[] = [
  { id: "prod-1", name: "Smartphone Pro X", price: 4999000, stock: 20 },
  { id: "prod-2", name: "Wireless Earbuds", price: 799000, stock: 53 },
  { id: "prod-3", name: "Gaming Keyboard", price: 999000, stock: 38 },
]

export async function listProducts(): Promise<Product[]> {
  return mockProducts
}
`,
    },
    {
      path: "prisma/schema.prisma",
      language: "prisma",
      content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Product {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String
  price       Int
  stock       Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Order {
  id           String   @id @default(cuid())
  customerName String
  status       String   @default("pending-payment")
  totalAmount  Int
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
`,
    },
    {
      path: "README.md",
      language: "md",
      content: `# ${escapeMultilineText(name)}

Original prompt:

> ${sourcePrompt}

Enhanced build brief:

${effectivePrompt}

Provider summary:

${escapeMultilineText(providerMessage || "Local full-stack scaffold was used as a stable fallback.")}
`,
    },
  ]
}

function buildGenericFiles(
  name: string,
  prompt: string,
  originalPrompt?: string | null,
  providerMessage?: string | null,
  promptSummary?: string | null
): GeneratedFile[] {
  const previewPrompt = escapeInlineText(promptSummary || prompt)
  const sourcePrompt = escapeMultilineText(originalPrompt || prompt)
  const effectivePrompt = escapeMultilineText(prompt)
  const safeName = serializeForCode(name)
  const safePreviewPrompt = serializeForCode(previewPrompt)

  return [
    {
      path: "app/page.tsx",
      language: "tsx",
      content: `export default function HomePage() {
  const projectName = ${safeName}
  const buildBrief = ${safePreviewPrompt}

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-20 text-white">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-10">
        <h1 className="text-4xl font-semibold">{projectName}</h1>
        <p className="mt-4 text-neutral-300">
          Build brief: {buildBrief}
        </p>
        <p className="mt-3 text-sm text-neutral-400">
          Full-stack starter generated. You can edit this file directly in the Code tab.
        </p>
      </section>
    </main>
  )
}
`,
    },
    {
      path: "app/api/health/route.ts",
      language: "ts",
      content: `import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ ok: true, service: "swift-starter-api" })
}
`,
    },
    {
      path: "lib/services/app.service.ts",
      language: "ts",
      content: `export function getAppInfo() {
  return {
    name: ${safeName},
    version: "0.1.0",
  }
}
`,
    },
    {
      path: "README.md",
      language: "md",
      content: `# ${escapeMultilineText(name)}

Original prompt:

> ${sourcePrompt}

Enhanced build brief:

${effectivePrompt}

Provider summary:

${escapeMultilineText(providerMessage || "Local full-stack scaffold was used as a stable fallback.")}
`,
    },
  ]
}

function inferName(prompt: string) {
  const quoted = prompt.match(/["“](.+?)["”]/)
  if (quoted?.[1]) return quoted[1]

  const named = prompt.match(/(?:named|bernama|name)\s+([a-z0-9][a-z0-9\\s-]{2,30})/i)
  if (named?.[1]) return named[1].trim()

  return null
}

function sanitizeName(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim()
  return normalized.slice(0, 40)
}

function escapeInlineText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/`/g, "'")
    .replace(/\$/g, "\\$")
}

function escapeMultilineText(value: string) {
  return value.replace(/`/g, "'").replace(/\$/g, "\\$")
}

function serializeForCode(value: string) {
  return JSON.stringify(value).replace(/\$/g, "\\$")
}
