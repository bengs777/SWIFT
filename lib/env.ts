const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim()) {
      return value
    }
  }

  return ""
}

const getEnvList = (...keys: string[]) => {
  const value = getEnv(...keys)

  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

const getEnvNumber = (fallback: number, ...keys: string[]) => {
  const value = getEnv(...keys)
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeProvider = (value: string) => {
  const normalized = value.toLowerCase().trim()
  if (normalized === "agentrouter" || normalized === "openai") {
    return normalized
  }
  return ""
}

const normalizeUrl = (url: string) => url.replace(/\/+$/, "")

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: getEnv("DATABASE_URL"),
  nextAuthSecret: getEnv("NEXTAUTH_SECRET"),
  nextAuthUrl: getEnv("NEXTAUTH_URL"),
  googleClientId: getEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
  aiPrimaryProvider: normalizeProvider(getEnv("AI_PRIMARY_PROVIDER")) || "agentrouter",
  aiFallbackProvider: normalizeProvider(getEnv("AI_FALLBACK_PROVIDER")),
  aiTimeoutMs: getEnvNumber(20_000, "AI_TIMEOUT_MS"),
  aiMaxRetries: Math.max(1, Math.round(getEnvNumber(2, "AI_MAX_RETRIES"))),
  providerStatusCacheTtlMs: Math.max(
    60_000,
    Math.round(getEnvNumber(86_400_000, "PROVIDER_STATUS_CACHE_TTL_MS"))
  ),
  agentRouterApiKey: getEnv("AGENT_ROUTER_TOKEN", "AGENTROUTER_API_KEY", "AIBLUESMINDS_API_KEY"),
  agentRouterApiUrl: normalizeUrl(
    getEnv("AGENT_ROUTER_BASE_URL", "AGENTROUTER_BASE_URL", "AGENTROUTER_API_URL", "AIBLUESMINDS_API_URL") || "https://agentrouter.org/v1"
  ),
  agentRouterDefaultModel: getEnv("AGENT_ROUTER_DEFAULT_MODEL", "AGENTROUTER_DEFAULT_MODEL", "AIBLUESMINDS_MODEL"),
  agentRouterModels: getEnvList("AGENT_ROUTER_MODELS", "AGENTROUTER_MODELS", "AIBLUESMINDS_FALLBACK_MODELS"),
  agentRouterFallbackModels: getEnvList("AI_FALLBACK_MODELS", "AGENT_ROUTER_FALLBACK_MODELS", "AGENTROUTER_FALLBACK_MODELS"),
  openAiApiKey: getEnv("OPENAI_API_KEY"),
  openAiApiUrl: getEnv("OPENAI_API_URL") || "https://api.openai.com/v1",
  openAiFallbackModel: getEnv("OPENAI_FALLBACK_MODEL", "OPENAI_DEFAULT_MODEL") || "gpt-4o-mini",
  supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseAnonKey: getEnv("SUPABASE_ANON_KEY"),
  supabaseUrl: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseBucket: getEnv("SUPABASE_STORAGE_BUCKET"),
  vercelAccessToken: getEnv("VERCEL_ACCESS_TOKEN"),
  tursoAuthToken: getEnv("TURSO_AUTH_TOKEN"),
  tursoDatabaseUrl: getEnv("TURSO_DATABASE_URL"),
}

export { getEnv, getEnvList }
