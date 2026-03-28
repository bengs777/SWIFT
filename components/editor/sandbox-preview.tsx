"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { generateSandboxHtml, generateErrorPreview } from "@/lib/sandbox/engine"
import type { GeneratedFile } from "@/lib/types"

interface SandboxPreviewProps {
  files: GeneratedFile[]
  className?: string
  onError?: (error: string) => void
}

export function SandboxPreview({ files, className = "", onError }: SandboxPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate HTML for preview
  const previewHtml = useMemo(() => {
    if (files.length === 0) {
      return generateSandboxHtml([])
    }
    
    try {
      return generateSandboxHtml(files)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(errorMessage)
      onError?.(errorMessage)
      return generateErrorPreview(errorMessage)
    }
  }, [files, onError])

  // Update iframe content
  useEffect(() => {
    if (!iframeRef.current) return
    
    const iframe = iframeRef.current
    setIsLoading(true)
    setError(null)

    try {
      // Write to iframe document
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(previewHtml)
        doc.close()
      }

      // Listen for errors from iframe
      const handleError = (event: ErrorEvent) => {
        if (event.filename?.includes("blob:") || !event.filename) {
          const errorMessage = `${event.message} (line ${event.lineno})`
          setError(errorMessage)
          onError?.(errorMessage)
        }
      }

      iframe.contentWindow?.addEventListener("error", handleError)

      setIsLoading(false)

      return () => {
        iframe.contentWindow?.removeEventListener("error", handleError)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to render preview"
      setError(errorMessage)
      onError?.(errorMessage)
      setIsLoading(false)
    }
  }, [previewHtml, onError])

  return (
    <div className={`relative h-full w-full ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading preview...</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="h-full w-full border-0 bg-background"
        title="Preview"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
