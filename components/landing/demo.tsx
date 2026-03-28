"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"

const prompts = [
  "Build a dashboard with charts showing user analytics",
  "Create a pricing page with monthly and annual toggles",
  "Design a blog layout with featured posts sidebar",
  "Make a contact form with validation and success state",
]

export function Demo() {
  const [copied, setCopied] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState(0)

  const handleCopy = () => {
    navigator.clipboard.writeText(prompts[selectedPrompt])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="demo" className="border-t border-border py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Start with an idea
            </h2>
            <p className="mt-4 text-pretty text-lg text-muted-foreground">
              Swift is your web development assistant. Paste a screenshot or write a few sentences and Swift will generate a starting point for your next app, including the code for how it looks and how it works.
            </p>
            
            <div className="mt-8 space-y-3">
              {prompts.map((prompt, index) => (
                <button
                  key={prompt}
                  onClick={() => setSelectedPrompt(index)}
                  className={`block w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    selectedPrompt === index
                      ? "border-muted-foreground/50 bg-secondary text-foreground"
                      : "border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4">
              <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy prompt
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4 text-sm text-muted-foreground">Output Preview</div>
                <div className="space-y-4 rounded-lg border border-border bg-background p-4">
                  {selectedPrompt === 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-24 rounded bg-muted" />
                        <div className="h-4 w-16 rounded bg-muted" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="h-20 rounded-lg bg-accent/20" />
                        <div className="h-20 rounded-lg bg-accent/30" />
                        <div className="h-20 rounded-lg bg-accent/20" />
                      </div>
                      <div className="h-32 rounded-lg bg-muted" />
                    </div>
                  )}
                  {selectedPrompt === 1 && (
                    <div className="space-y-3">
                      <div className="mx-auto h-4 w-32 rounded bg-muted" />
                      <div className="flex justify-center gap-2">
                        <div className="h-8 w-20 rounded-full bg-accent/30" />
                        <div className="h-8 w-20 rounded-full bg-muted" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2 rounded-lg border border-border p-3">
                          <div className="h-3 w-12 rounded bg-muted" />
                          <div className="h-6 w-16 rounded bg-foreground" />
                        </div>
                        <div className="space-y-2 rounded-lg border-2 border-accent p-3">
                          <div className="h-3 w-12 rounded bg-accent/30" />
                          <div className="h-6 w-16 rounded bg-accent" />
                        </div>
                        <div className="space-y-2 rounded-lg border border-border p-3">
                          <div className="h-3 w-12 rounded bg-muted" />
                          <div className="h-6 w-16 rounded bg-foreground" />
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedPrompt === 2 && (
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="h-24 rounded-lg bg-muted" />
                        <div className="h-4 w-3/4 rounded bg-muted" />
                        <div className="h-24 rounded-lg bg-muted" />
                      </div>
                      <div className="w-24 space-y-2">
                        <div className="h-4 w-full rounded bg-accent/30" />
                        <div className="h-12 rounded bg-muted" />
                        <div className="h-12 rounded bg-muted" />
                      </div>
                    </div>
                  )}
                  {selectedPrompt === 3 && (
                    <div className="space-y-3">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-8 w-full rounded bg-input" />
                      <div className="h-8 w-full rounded bg-input" />
                      <div className="h-20 w-full rounded bg-input" />
                      <div className="h-10 w-full rounded bg-accent" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
