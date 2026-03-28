import { AI_CONFIG } from './config'
import { env } from '@/lib/env'

export interface AIRequest {
  role: 'planner' | 'builder' | 'refiner'
  userMessage: string
  context?: Record<string, unknown>
}

export interface AIResponse {
  message: string
  files?: Array<{
    path: string
    content: string
    language: string
  }>
  components?: string[]
  structure?: string
  styling?: string
  interactions?: string[]
  dataStructure?: string
}

class BluesMindsApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "BluesMindsApiError"
    this.status = status
  }
}

export class AIClient {
  private apiKey: string
  private baseUrl: string
  private model: string
  private fallbackModels: string[]

  constructor() {
    this.apiKey = env.bluesMindsApiKey
    this.baseUrl = AI_CONFIG.baseUrl
    this.model = AI_CONFIG.model
    this.fallbackModels = this.buildModelCandidates()
    
    if (!this.apiKey) {
      console.warn('[v0] AIBLUESMINDS_API_KEY not set. AI features may not work properly.')
    }
  }

  async sendMessage(request: AIRequest): Promise<AIResponse> {
    const { role, userMessage, context } = request
    const systemPrompt = this.getSystemPrompt(role)

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: context ? `${userMessage}\n\nContext: ${JSON.stringify(context)}` : userMessage,
      },
    ]

    try {
      let lastError: Error | null = null

      for (const model of this.fallbackModels) {
        try {
          return await this.sendMessageWithModel(model, messages)
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          if (!this.shouldFallbackToAnotherModel(lastError)) {
            throw lastError
          }

          console.warn(`[v0] BluesMinds model "${model}" failed, trying next fallback model.`)
        }
      }

      throw lastError || new Error("BluesMinds request failed without a specific error.")
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('BluesMinds API request timed out after 65 seconds.')
      }

      console.error('[v0] AI Client error:', error)
      throw error
    }
  }

  private buildModelCandidates(): string[] {
    return [this.model, ...env.bluesMindsFallbackModels]
      .map((model) => model.trim())
      .filter(Boolean)
      .filter((model, index, list) => list.indexOf(model) === index)
  }

  private async sendMessageWithModel(
    model: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<AIResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 65000)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.maxTokens,
          top_p: AI_CONFIG.topP,
        }),
      })

      if (!response.ok) {
        const errorMessage = await this.extractErrorMessage(response)
        throw new BluesMindsApiError(
          response.status,
          `BluesMinds API error (${response.status}) for model "${model}": ${errorMessage}`
        )
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      try {
        const parsed = JSON.parse(content)
        return parsed as AIResponse
      } catch {
        return {
          message: content,
        }
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') || ''
    const bodyText = await response.text()

    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(bodyText)
        return parsed.error?.message || parsed.message || JSON.stringify(parsed)
      } catch {
        return bodyText || response.statusText
      }
    }

    return bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || response.statusText
  }

  private shouldFallbackToAnotherModel(error: Error): boolean {
    if (!(error instanceof BluesMindsApiError)) {
      return false
    }

    const message = error.message.toLowerCase()

    if (error.status === 401) {
      return false
    }

    return (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      message.includes('model') ||
      message.includes('access') ||
      message.includes('not found') ||
      message.includes('unsupported')
    )
  }

  private getSystemPrompt(role: 'planner' | 'builder' | 'refiner'): string {
    return AI_CONFIG.systemPrompts[role]
  }

  async generateCode(userPrompt: string, context?: Record<string, unknown>): Promise<AIResponse> {
    // Step 1: Plan
    const plan = await this.sendMessage({
      role: 'planner',
      userMessage: userPrompt,
      context,
    })

    // Step 2: Build
    const buildPrompt = `Based on this plan, generate the React/Next.js code:
${JSON.stringify(plan, null, 2)}

User's original request: ${userPrompt}`

    const code = await this.sendMessage({
      role: 'builder',
      userMessage: buildPrompt,
      context,
    })

    return code
  }

  async refineCode(originalCode: string, feedback: string, context?: Record<string, unknown>): Promise<AIResponse> {
    const refinePrompt = `Refine this code based on the user's feedback:

Original code:
\`\`\`
${originalCode}
\`\`\`

User feedback: ${feedback}`

    return this.sendMessage({
      role: 'refiner',
      userMessage: refinePrompt,
      context,
    })
  }
}

// Export singleton instance
export const aiClient = new AIClient()
