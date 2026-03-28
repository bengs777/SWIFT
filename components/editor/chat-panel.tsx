"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap, Send, Paperclip, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/app/dashboard/project/[id]/page"
import type { ProviderStatus } from "@/app/dashboard/project/[id]/page"
import type { ModelOption } from "@/lib/types"

const MAX_PROMPT_LENGTH = 12000

interface ChatPanelProps {
  messages: Message[]
  onSendMessage: (content: string, selectedModel: string) => void
  isGenerating: boolean
  modelOptions: ModelOption[]
  selectedModel: string
  onModelChange: (model: string) => void
  onViewCode?: () => void
  providerStatus?: ProviderStatus | null
}

export function ChatPanel({
  messages,
  onSendMessage,
  isGenerating,
  modelOptions,
  selectedModel,
  onModelChange,
  onViewCode,
  providerStatus,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = () => {
    if (!input.trim() || isGenerating) return
    onSendMessage(input.trim(), selectedModel)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onViewCode={onViewCode} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="space-y-3">
          <ProviderHealthCard status={providerStatus} />
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="min-h-[80px] resize-none"
            disabled={isGenerating}
          />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={isGenerating}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={isGenerating}>
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Select value={selectedModel} onValueChange={onModelChange} disabled={isGenerating}>
              <SelectTrigger className="h-9 min-w-[220px]">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((model) => (
                  <SelectItem key={model.key} value={model.key}>
                    {model.label} (Rp {model.price.toLocaleString("id-ID")}/request)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProviderStatusBadge status={providerStatus} />
            <Button
              size="icon"
              className="ml-auto h-9 w-9 shrink-0"
              onClick={handleSubmit}
              disabled={!input.trim() || isGenerating}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line. Billing uses flat pricing per request.
        </p>
        <p className={cn(
          "mt-1 text-xs",
          input.length > MAX_PROMPT_LENGTH ? "text-destructive" : "text-muted-foreground"
        )}>
          {input.length.toLocaleString("id-ID")} / {MAX_PROMPT_LENGTH.toLocaleString("id-ID")} characters
        </p>
      </div>
    </div>
  )
}

function ProviderStatusBadge({ status }: { status?: ProviderStatus | null }) {
  if (!status) {
    return (
      <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
        idle
      </span>
    )
  }

  const statusConfig =
    status.issue === "healthy"
      ? {
          label: "connected",
          className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        }
      : status.issue === "latency" || status.status === "slow"
        ? {
          label: "slow",
          className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
        }
      : status.issue === "auth"
        ? {
            label: "auth",
            className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
          }
        : status.issue === "quota"
          ? {
              label: "quota",
              className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
            }
          : status.issue === "config"
            ? {
                label: "config",
                className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
              }
        : {
            label: "error",
            className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
          }

  return (
    <span
      title={status.reason || "Provider status"}
      className={cn(
        "rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
        statusConfig.className
      )}
    >
      {statusConfig.label}
    </span>
  )
}

function ProviderHealthCard({
  status,
}: {
  status?: ProviderStatus | null
}) {
  if (!status) {
    return (
      <div className="rounded-xl border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
        Status provider akan muncul setelah request generate dijalankan.
      </div>
    )
  }

  const config =
    status.issue === "healthy"
      ? {
          title: "Provider siap dipakai",
          className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
        }
      : status.issue === "latency"
        ? {
            title: "Provider hidup tapi lambat",
            className: "border-amber-500/30 bg-amber-500/10 text-amber-100",
          }
        : status.issue === "auth"
          ? {
              title: "Masalah auth atau akses model",
              className: "border-rose-500/30 bg-rose-500/10 text-rose-100",
            }
          : status.issue === "quota"
            ? {
                title: "Kuota provider habis",
                className: "border-rose-500/30 bg-rose-500/10 text-rose-100",
              }
            : status.issue === "config"
              ? {
                  title: "Konfigurasi provider belum lengkap",
                  className: "border-rose-500/30 bg-rose-500/10 text-rose-100",
                }
              : {
                  title: "Kesehatan provider belum ideal",
                  className: "border-border bg-card/80 text-foreground",
                }

  return (
    <div className={cn("rounded-xl border px-3 py-3", config.className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{config.title}</p>
          <p className="mt-1 text-xs opacity-90">{status.reason || "Provider status tersedia."}</p>
        </div>
        <ProviderStatusBadge status={status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] opacity-80">
        {typeof status.responseTimeMs === "number" && (
          <span>Response {status.responseTimeMs} ms</span>
        )}
        {status.checkedAt && (
          <span>Checked {formatCheckedAt(status.checkedAt)}</span>
        )}
      </div>
      {status.action && (
        <p className="mt-2 text-xs opacity-90">{status.action}</p>
      )}
    </div>
  )
}

function formatCheckedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "just now"
  }

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
        <Zap className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Start building</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Describe what you want to create and I'll generate the code for you.
      </p>
      <div className="mt-6 space-y-2">
        <SuggestionChip>Create a login form with validation</SuggestionChip>
        <SuggestionChip>Build a pricing page with three tiers</SuggestionChip>
        <SuggestionChip>Make a dashboard with charts</SuggestionChip>
      </div>
    </div>
  )
}

function SuggestionChip({ children }: { children: string }) {
  return (
    <button className="block w-full rounded-lg border border-border bg-card px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground">
      {children}
    </button>
  )
}

function MessageBubble({
  message,
  onViewCode,
}: {
  message: Message
  onViewCode?: () => void
}) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2",
          isUser ? "bg-secondary text-secondary-foreground" : "bg-card text-card-foreground"
        )}
      >
        {message.isGenerating ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <GeneratingStatus startedAt={message.timestamp} />
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            {!isUser && message.metadata?.model && (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-1">
                  Model: {message.metadata.model}
                </span>
                {typeof message.metadata.cost === "number" && (
                  <span className="rounded-full border border-border px-2 py-1">
                    Cost: Rp {message.metadata.cost.toLocaleString("id-ID")}
                  </span>
                )}
                {typeof message.metadata.remainingBalance === "number" && (
                  <span className="rounded-full border border-border px-2 py-1">
                    Balance: Rp {message.metadata.remainingBalance.toLocaleString("id-ID")}
                  </span>
                )}
              </div>
            )}
            {message.generatedCode && (
              <div className="mt-3 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Generated Component</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={onViewCode}
                  >
                    View Code
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
          <span className="text-xs font-medium text-secondary-foreground">U</span>
        </div>
      )}
    </div>
  )
}

function GeneratingStatus({ startedAt }: { startedAt: Date }) {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - startedAt.getTime())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt.getTime())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [startedAt])

  let label = "Menghubungi model..."

  if (elapsedMs >= 4000) {
    label = "Model sedang menyusun jawaban..."
  }

  if (elapsedMs >= 10000) {
    label = "Provider sedang lambat, mohon tunggu..."
  }

  if (elapsedMs >= 18000) {
    label = "Masih menunggu provider. Request akan dihentikan otomatis jika terlalu lama."
  }

  return <span className="text-sm text-muted-foreground">{label}</span>
}
