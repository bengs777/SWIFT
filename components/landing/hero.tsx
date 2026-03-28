"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-accent" />
            Powered by Kimi AI
          </div>
          
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            AI for teams building the web
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            Empower your entire organization to create at the speed of thought. Describe what you want, watch it come to life.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                Start Building
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="gap-2">
              <Play className="h-4 w-4" />
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Demo Preview */}
        <div className="mt-20">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-muted-foreground">swift.dev/dashboard</span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Chat Panel */}
              <div className="border-r border-border p-6">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <span className="text-xs">U</span>
                    </div>
                    <div className="rounded-lg bg-secondary px-4 py-2 text-sm text-foreground">
                      Create a sign up modal that has a form. When submitting the form, show a success toast.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                      <Zap className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>{"I'll create a modal that contains a form, and show a toast when the contents have been submitted. I'll use shadcn/ui, React and Tailwind:"}</p>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Modal with Form</span>
                          <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">v1</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                          Generating...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Preview Panel */}
              <div className="bg-background p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Modal with Form</span>
                </div>
                <div className="flex items-center gap-4 border-b border-border pb-3">
                  <button className="text-sm text-foreground">Preview</button>
                  <button className="text-sm text-muted-foreground">modal.tsx</button>
                </div>
                <div className="mt-4 font-mono text-xs leading-relaxed">
                  <div><span className="text-muted-foreground">1</span> <span className="code-string">{"'use client'"}</span></div>
                  <div><span className="text-muted-foreground">2</span></div>
                  <div><span className="text-muted-foreground">3</span> <span className="code-keyword">import</span> {"{ useFormStatus }"} <span className="code-keyword">from</span> <span className="code-string">{'"react-dom"'}</span></div>
                  <div><span className="text-muted-foreground">4</span> <span className="code-keyword">import</span> {"{ Button }"} <span className="code-keyword">from</span> <span className="code-string">{'"@/components/ui/button"'}</span></div>
                  <div><span className="text-muted-foreground">5</span> <span className="code-keyword">import</span> {"{ Input }"} <span className="code-keyword">from</span> <span className="code-string">{'"@/components/ui/input"'}</span></div>
                  <div><span className="text-muted-foreground">6</span> <span className="code-keyword">import</span> {"{ Label }"} <span className="code-keyword">from</span> <span className="code-string">{'"@/components/ui/label"'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Zap({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  )
}
