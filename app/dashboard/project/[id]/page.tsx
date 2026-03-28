"use client"

import { useState, useCallback, useEffect } from "react"
import { useParams } from "next/navigation"
import { EditorHeader } from "@/components/editor/header"
import { ChatPanel } from "@/components/editor/chat-panel"
import { PreviewPanel } from "@/components/editor/preview-panel"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { DEFAULT_MODEL_KEY, DEFAULT_MODEL_OPTIONS } from "@/lib/ai/models"
import type { ModelOption } from "@/lib/types"

const MAX_PROMPT_LENGTH = 12000

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

export type GeneratedFile = {
  path: string
  content: string
  language: string
}

export default function EditorPage() {
  const params = useParams()
  const projectId = params.id as string

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
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_KEY)
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(DEFAULT_MODEL_OPTIONS)

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
              language: file.language,
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
        if (!response.ok) return

        const data = await response.json()
        if (!isMounted || !Array.isArray(data.models) || data.models.length === 0) return

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
        // Keep local defaults if the model endpoint is unavailable.
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
        action: "Periksa AGENT_ROUTER_TOKEN atau AGENTROUTER_API_KEY, lalu pastikan token aktif dan akun di-whitelist oleh AgentRouter.",
        checkedAt: new Date().toISOString(),
      }
    }

    if (
      normalized.includes("quota") ||
      normalized.includes("insufficient_user_quota") ||
      normalized.includes("额度不足")
    ) {
      return {
        status: "error",
        issue: "quota",
        reason: "Provider quota exhausted",
        action: "Isi ulang kuota provider lalu coba generate lagi.",
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
                },
              }
            : msg
        )
      )

      // Update generated files
      if (data.files) {
        setGeneratedFiles(data.files)
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
  }, [buildProviderStatusFromError, messages, projectId])

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
    <div className="flex h-full flex-col">
      <EditorHeader projectId={projectId} currentVersion={currentVersion} />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={40} minSize={30}>
          <ChatPanel
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
        <ResizablePanel defaultSize={60} minSize={40}>
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
    </div>
  )
}
