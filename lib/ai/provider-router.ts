import { env } from "@/lib/env"

type ProviderRequest = {
  provider: string
  modelName: string
  prompt: string
}

type ProviderResponse = {
  message: string
  providerUsed: "agentrouter" | "openai"
  modelUsed: string
  usedFallback: boolean
  fallbackFrom?: "agentrouter"
  primaryError?: string
}

type ProviderMessage = {
  message: string
}

class ProviderTimeoutError extends Error {
  constructor(provider: string, timeoutMs: number) {
    super(`${provider} request timed out after ${Math.round(timeoutMs / 1000)} seconds`)
    this.name = "ProviderTimeoutError"
  }
}

export class ProviderRouter {
  static async generate({ provider, modelName, prompt }: ProviderRequest): Promise<ProviderResponse> {
    if (provider === "agentrouter") {
      try {
        const primary = await this.callAgentRouter(modelName, prompt)
        return {
          message: primary.message,
          providerUsed: "agentrouter",
          modelUsed: modelName,
          usedFallback: false,
        }
      } catch (error) {
        const primaryError = error instanceof Error ? error : new Error(String(error))
        const fallback = await this.tryOpenAiFallback(prompt, primaryError)
        if (fallback) {
          return fallback
        }
        throw primaryError
      }
    }

    if (provider === "openai") {
      const openAi = await this.callOpenAI(modelName, prompt)
      return {
        message: openAi.message,
        providerUsed: "openai",
        modelUsed: modelName,
        usedFallback: false,
      }
    }

    throw new Error(`Unsupported AI provider: ${provider}`)
  }

  private static async callAgentRouter(modelName: string, prompt: string): Promise<ProviderMessage> {
    if (!env.agentRouterApiKey) {
      throw new Error("AGENTROUTER_API_KEY is not configured")
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < env.aiMaxRetries; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(
          `${env.agentRouterApiUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.agentRouterApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: "system",
                  content: "You are a production-ready AI Gateway assistant. Answer clearly and helpfully.",
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
            }),
          },
          "AgentRouter",
          env.aiTimeoutMs
        )

        if (response.ok) {
          const data = await response.json()
          const message =
            data.choices?.[0]?.message?.content ||
            data.choices?.[0]?.message?.reasoning ||
            data.choices?.[0]?.text ||
            data.output_text

          return {
            message:
              typeof message === "string" && message.trim()
                ? message
                : "No response returned by AgentRouter.",
          }
        }

        const errorMessage = await this.extractError(response, "AgentRouter")
        lastError = new Error(errorMessage)

        const shouldRetry = response.status === 429 || response.status >= 500
        if (!shouldRetry || attempt === env.aiMaxRetries - 1) {
          break
        }

        await this.sleep(800 * (attempt + 1))
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < env.aiMaxRetries - 1) {
          await this.sleep(800 * (attempt + 1))
          continue
        }
      }
    }

    throw lastError || new Error("AgentRouter request failed.")
  }

  private static async callOpenAI(modelName: string, prompt: string): Promise<ProviderMessage> {
    if (!env.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured")
    }

    const response = await this.fetchWithTimeout(
      `${env.openAiApiUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "system",
              content: "You are a production-ready AI Gateway assistant. Answer clearly and helpfully.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
      "OpenAI",
      env.aiTimeoutMs
    )

    if (!response.ok) {
      throw new Error(await this.extractError(response, "OpenAI"))
    }

    const data = await response.json()
    return {
      message: data.choices?.[0]?.message?.content || "No response returned by OpenAI.",
    }
  }

  private static async tryOpenAiFallback(prompt: string, primaryError: Error): Promise<ProviderResponse | null> {
    if (!this.shouldFallbackToOpenAi(primaryError)) {
      return null
    }

    if (env.aiFallbackProvider !== "openai" || !env.openAiApiKey) {
      return null
    }

    const fallbackModel = env.openAiFallbackModel.trim()
    if (!fallbackModel) {
      return null
    }

    try {
      const fallback = await this.callOpenAI(fallbackModel, prompt)
      return {
        message: fallback.message,
        providerUsed: "openai",
        modelUsed: fallbackModel,
        usedFallback: true,
        fallbackFrom: "agentrouter",
        primaryError: primaryError.message,
      }
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(`${primaryError.message}; OpenAI fallback failed: ${fallbackMessage}`)
    }
  }

  private static shouldFallbackToOpenAi(error: Error): boolean {
    if (error.message.includes("AGENTROUTER_API_KEY is not configured")) {
      return true
    }

    if (error instanceof ProviderTimeoutError) {
      return true
    }

    const status = this.extractStatusCode(error.message)
    if (typeof status === "number") {
      return status === 401 || status === 403 || status === 404 || status === 408 || status === 409 || status === 429 || status >= 500
    }

    return true
  }

  private static extractStatusCode(message: string): number | undefined {
    const match = message.match(/api error \((\d{3})\)/i)
    if (!match) {
      return undefined
    }

    const parsed = Number(match[1])
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private static async extractError(response: Response, provider: string) {
    const text = await response.text()

    try {
      const parsed = JSON.parse(text)
      return `${provider} API error (${response.status}): ${parsed.error?.message || parsed.message || text}`
    } catch {
      return `${provider} API error (${response.status}): ${text}`
    }
  }

  private static async fetchWithTimeout(
    input: string,
    init: RequestInit,
    provider: string,
    timeoutMs: number
  ) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderTimeoutError(provider, timeoutMs)
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private static sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
