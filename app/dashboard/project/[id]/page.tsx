"use client"

import { useState, useCallback, useEffect } from "react"
import { useParams } from "next/navigation"
import { EditorHeader } from "@/components/editor/header"
import { ChatPanel } from "@/components/editor/chat-panel"
import { PreviewPanel } from "@/components/editor/preview-panel"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { DEFAULT_MODEL_KEY, DEFAULT_MODEL_OPTIONS } from "@/lib/ai/models"
import type { GeneratedFile, ModelOption } from "@/lib/types"

const MAX_PROMPT_LENGTH = 12000
const SUPPORTED_LANGUAGES: GeneratedFile["language"][] = [
  "tsx",
  "ts",
  "css",
  "json",
  "html",
  "prisma",
  "md",
  "env",
]

const normalizeLanguage = (value: unknown): GeneratedFile["language"] => {
  const candidate = typeof value === "string" ? value : ""
  return SUPPORTED_LANGUAGES.includes(candidate as GeneratedFile["language"])
    ? (candidate as GeneratedFile["language"])
    : "tsx"
}

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  generatedCode?: string
  isGenerating?: boolean
  metadata?: {
    model?: string
    cost?: number
    remainingBalance?: number
    failSafeType?: "strict-fullstack"
  }
}

export type ProviderStatus = {
  status: "connected" | "slow" | "error"
  issue?: "healthy" | "latency" | "auth" | "quota" | "config" | "unknown"
  reason?: string
  action?: string
  responseTimeMs?: number
  checkedAt?: string
}

export default function EditorPage() {
  const params = useParams()
  const projectId = params.id as string
  const isMobile = useIsMobile()

  const [messages, setMessages] = useState<Message[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [currentVersion, setCurrentVersion] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingFiles, setIsSavingFiles] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [activePreviewTab, setActivePreviewTab] = useState<"preview" | "code">("preview")
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const [selectedModel, setSelectedModel] = useState("")
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([])
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat")
  const [layoutPreset, setLayoutPreset] = useState<"prompt" | "balanced" | "preview">("balanced")
  const [layoutRenderKey, setLayoutRenderKey] = useState(0)

  const createIdempotencyKey = useCallback((prompt: string, modelKey: string) => {
    const base = `${projectId}:${modelKey}:${prompt.trim().toLowerCase()}`
    const hash = Array.from(base).reduce((acc, char, index) => {
      return (acc * 33 + char.charCodeAt(0) + index) % 2147483647
    }, 5381)

    const nonce =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10)

    return `gen_${hash.toString(36)}_${Date.now().toString(36)}_${nonce}`
  }, [projectId])

  useEffect(() => {
    let isMounted = true

    const loadProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to load project")
        }

        if (!isMounted) return

        const files = Array.isArray(data.project?.files)
          ? data.project.files.map((file: GeneratedFile) => ({
              path: file.path,
              content: file.content,
              language: normalizeLanguage(file.language),
            }))
          : []

        setGeneratedFiles(files)
        setCurrentVersion(data.project?.history?.length || (files.length > 0 ? 1 : 0))
      } catch (error) {
        if (!isMounted) return
        setProjectError(error instanceof Error ? error.message : "Failed to load project")
      } finally {
        if (isMounted) {
          setIsLoadingProject(false)
        }
      }
    }

    void loadProject()

    return () => {
      isMounted = false
    }
  }, [projectId])

  useEffect(() => {
    let isMounted = true

    const loadModels = async () => {
      try {
        const response = await fetch("/api/models")
        if (!response.ok) {
          setAvailableModels(DEFAULT_MODEL_OPTIONS)
          setSelectedModel(DEFAULT_MODEL_KEY)
          return
        }

        const data = await response.json()
        if (!isMounted || !Array.isArray(data.models) || data.models.length === 0) {
          setAvailableModels(DEFAULT_MODEL_OPTIONS)
          setSelectedModel(DEFAULT_MODEL_KEY)
          return
        }

        const normalizedModels: ModelOption[] = data.models.map((model: ModelOption) => ({
          key: model.key,
          label:
            model.label ||
            DEFAULT_MODEL_OPTIONS.find((option) => option.key === model.key)?.label ||
            model.modelName ||
            model.key,
          provider: model.provider,
          modelName: model.modelName,
          price: model.price,
          isActive: model.isActive,
        }))

        setAvailableModels(normalizedModels)

        if (!normalizedModels.some((model) => model.key === selectedModel)) {
          setSelectedModel(normalizedModels[0].key)
        }
      } catch {
        if (!isMounted) return
        setAvailableModels(DEFAULT_MODEL_OPTIONS)
        setSelectedModel(DEFAULT_MODEL_KEY)
      }
    }

    void loadModels()

    return () => {
      isMounted = false
    }
  }, [selectedModel])

  useEffect(() => {
    setProviderStatus(null)
  }, [selectedModel])

  const buildProviderStatusFromError = useCallback((errorMessage: string): ProviderStatus => {
    const normalized = errorMessage.toLowerCase()

    if (
      normalized.includes("unauthorized client") ||
      normalized.includes("unauthenticated") ||
      normalized.includes("authentication or model access") ||
      normalized.includes("api error (401)") ||
      normalized.includes("api error (403)")
    ) {
      return {
        status: "error",
        issue: "auth",
        reason: "Provider rejected authentication or model access",
        action: "Periksa API key provider aktif (OPENAI_API_KEY atau AGENT_ROUTER_TOKEN), izin model, dan endpoint API.",
        checkedAt: new Date().toISOString(),
      }
    }

    if (
      normalized.includes("quota") ||
      normalized.includes("insufficient_user_quota") ||
      normalized.includes("额度不足") ||
      normalized.includes("rate-limit") ||
      normalized.includes("rate limited")
    ) {
      return {
        status: "error",
        issue: "quota",
        reason: "Provider quota atau upstream rate limit sedang penuh",
        action: "Coba lagi beberapa menit, ganti model, atau gunakan key provider sendiri (BYOK).",
        checkedAt: new Date().toISOString(),
      }
    }

    if (
      normalized.includes("no endpoints found") ||
      normalized.includes("model not found") ||
      normalized.includes("unknown model")
    ) {
      return {
        status: "error",
        issue: "config",
        reason: "Model yang dipilih sedang tidak tersedia di provider",
        action: "Pilih model lain atau pakai openrouter/auto agar provider memilih endpoint yang tersedia.",
        checkedAt: new Date().toISOString(),
      }
    }

    if (normalized.includes("timed out")) {
      return {
        status: "slow",
        issue: "latency",
        reason: "Provider request timed out",
        action: "Coba lagi nanti atau ganti model yang lebih ringan.",
        checkedAt: new Date().toISOString(),
      }
    }

    if (normalized.includes("not configured") || normalized.includes("api key is missing")) {
      return {
        status: "error",
        issue: "config",
        reason: "Provider configuration is incomplete",
        action: "Periksa variabel env AgentRouter dan restart dev server.",
        checkedAt: new Date().toISOString(),
      }
    }

    return {
      status: "error",
      issue: "unknown",
      reason: "Provider request failed",
      action: "Periksa koneksi server dan konfigurasi provider.",
      checkedAt: new Date().toISOString(),
    }
  }, [])

  const saveFiles = useCallback(async (files: GeneratedFile[], prompt: string) => {
    setIsSavingFiles(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          prompt,
          tokensUsed: 0,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save files")
      }

      setIsDirty(false)
      setCurrentVersion((v) => v + 1)
      return data
    } finally {
      setIsSavingFiles(false)
    }
  }, [projectId])

  const handleSendMessage = useCallback(async (content: string, modelKey: string) => {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return
    }

    if (trimmedContent.length > MAX_PROMPT_LENGTH) {
      const assistantId = Math.random().toString(36).substring(7)
      const validationMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: `Prompt terlalu panjang. Maksimal ${MAX_PROMPT_LENGTH.toLocaleString("id-ID")} karakter.`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, validationMessage])
      return
    }

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: trimmedContent,
      timestamp: new Date(),
      metadata: {
        model: modelKey,
      },
    }

    setMessages((prev) => [...prev, userMessage])
    setIsGenerating(true)
    setProviderStatus(null)

    // Add assistant message placeholder
    const assistantId = Math.random().toString(36).substring(7)
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isGenerating: true,
    }

    setMessages((prev) => [...prev, assistantMessage])

    try {
      // Call AI API
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedContent,
          projectId,
          history: messages,
          selectedModel: modelKey,
          idempotencyKey: createIdempotencyKey(trimmedContent, modelKey),
        }),
      })

      const contentType = response.headers.get("content-type") || ""
      const responseText = await response.text()

      if (!response.ok) {
        let errorMessage = `Failed to generate (${response.status})`

        try {
          const parsed = JSON.parse(responseText)
          errorMessage = parsed.error || parsed.details || parsed.message || errorMessage
        } catch {
          // Keep fallback error message if the response was not JSON.
        }

        throw new Error(errorMessage)
      }

      if (!contentType.includes("application/json")) {
        throw new Error("Generate API returned a non-JSON response. You may need to sign in again.")
      }

      const data = JSON.parse(responseText)

      if (data.warning) {
        setProviderStatus(buildProviderStatusFromError(String(data.warning)))
      } else {
        setProviderStatus({
          status: "connected",
          issue: "healthy",
          reason: "Request terakhir berhasil.",
          action: "Provider siap dipakai.",
          checkedAt: new Date().toISOString(),
        })
      }

      // Update assistant message with response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: data.message,
                generatedCode: data.code,
                isGenerating: false,
                metadata: {
                  model: data.usage?.model,
                  cost: data.usage?.cost,
                  remainingBalance: data.usage?.remainingBalance,
                  failSafeType:
                    data?.failSafe?.type === "strict-fullstack"
                      ? "strict-fullstack"
                      : undefined,
                },
              }
            : msg
        )
      )

      // Update generated files
      if (Array.isArray(data.files)) {
        const normalizedFiles: GeneratedFile[] = data.files.map(
          (file: { path: string; content: string; language?: string }) => ({
            path: file.path,
            content: file.content,
            language: normalizeLanguage(file.language),
          })
        )

        setGeneratedFiles(normalizedFiles)
        setCurrentVersion((v) => v + 1)
        setIsDirty(false)
        setActivePreviewTab("code")
      } else {
        setGeneratedFiles([])
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Sorry, I encountered an error while generating. Please try again."

      setProviderStatus(buildProviderStatusFromError(message))

      // Update with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: message,
                isGenerating: false,
              }
            : msg
        )
      )
    } finally {
      setIsGenerating(false)
    }
  }, [buildProviderStatusFromError, createIdempotencyKey, messages, projectId])

  const handleUpdateFile = useCallback((index: number, content: string) => {
    setGeneratedFiles((currentFiles) =>
      currentFiles.map((file, fileIndex) =>
        fileIndex === index
          ? {
              ...file,
              content,
            }
          : file
      )
    )
    setIsDirty(true)
  }, [])

  const handleReplaceFiles = useCallback((files: GeneratedFile[]) => {
    setGeneratedFiles(files)
    setIsDirty(true)
  }, [])

  const handleSaveFiles = useCallback(async () => {
    const latestPrompt =
      [...messages].reverse().find((message) => message.role === "user")?.content ||
      "Manual code edit save"

    try {
      await saveFiles(generatedFiles, latestPrompt)
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          role: "assistant",
          content: error instanceof Error ? error.message : "Failed to save files",
          timestamp: new Date(),
        },
      ])
    }
  }, [generatedFiles, messages, saveFiles])

  const applyLayoutPreset = useCallback((preset: "prompt" | "balanced" | "preview") => {
    setLayoutPreset(preset)
    setLayoutRenderKey((current) => current + 1)
  }, [])

  if (isLoadingProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading project...
      </div>
    )
  }

  if (projectError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {projectError}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader projectId={projectId} currentVersion={currentVersion} />
      {isMobile ? (
        <>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Button
              size="sm"
              variant={mobileView === "chat" ? "default" : "outline"}
              onClick={() => setMobileView("chat")}
            >
              Prompt
            </Button>
            <Button
              size="sm"
              variant={mobileView === "preview" ? "default" : "outline"}
              onClick={() => setMobileView("preview")}
            >
              Preview
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {mobileView === "chat" ? (
              <ChatPanel
                projectId={projectId}
                messages={messages}
                onSendMessage={handleSendMessage}
                isGenerating={isGenerating}
                modelOptions={availableModels}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                onViewCode={() => {
                  setActivePreviewTab("code")
                  setMobileView("preview")
                }}
                providerStatus={providerStatus}
              />
            ) : (
              <PreviewPanel
                files={generatedFiles}
                currentVersion={currentVersion}
                onUpdateFile={handleUpdateFile}
                onReplaceFiles={handleReplaceFiles}
                onSaveFiles={handleSaveFiles}
                isSaving={isSavingFiles}
                isDirty={isDirty}
                activeTab={activePreviewTab}
                onTabChange={setActivePreviewTab}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-2">
            <Button
              size="sm"
              variant={layoutPreset === "prompt" ? "default" : "outline"}
              onClick={() => applyLayoutPreset("prompt")}
            >
              Prompt Besar
            </Button>
            <Button
              size="sm"
              variant={layoutPreset === "balanced" ? "default" : "outline"}
              onClick={() => applyLayoutPreset("balanced")}
            >
              Seimbang
            </Button>
            <Button
              size="sm"
              variant={layoutPreset === "preview" ? "default" : "outline"}
              onClick={() => applyLayoutPreset("preview")}
            >
              Preview Besar
            </Button>
          </div>
          <ResizablePanelGroup key={layoutRenderKey} direction="horizontal" className="min-h-0 flex-1">
            <ResizablePanel
              className="min-h-0"
              defaultSize={layoutPreset === "prompt" ? 55 : layoutPreset === "preview" ? 30 : 40}
              minSize={25}
            >
              <ChatPanel
                projectId={projectId}
                messages={messages}
                onSendMessage={handleSendMessage}
                isGenerating={isGenerating}
                modelOptions={availableModels}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                onViewCode={() => setActivePreviewTab("code")}
                providerStatus={providerStatus}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              className="min-h-0"
              defaultSize={layoutPreset === "prompt" ? 45 : layoutPreset === "preview" ? 70 : 60}
              minSize={30}
            >
              <PreviewPanel
                files={generatedFiles}
                currentVersion={currentVersion}
                onUpdateFile={handleUpdateFile}
                onReplaceFiles={handleReplaceFiles}
                onSaveFiles={handleSaveFiles}
                isSaving={isSavingFiles}
                isDirty={isDirty}
                activeTab={activePreviewTab}
                onTabChange={setActivePreviewTab}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </>
      )}
    </div>
  )
}
