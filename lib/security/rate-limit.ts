const WINDOW_MS = 60_000
const MAX_REQUESTS = 10

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function enforceUserRateLimit(userId: string) {
  const now = Date.now()
  const current = buckets.get(userId)

  if (!current || current.resetAt <= now) {
    buckets.set(userId, {
      count: 1,
      resetAt: now + WINDOW_MS,
    })
    return
  }

  if (current.count >= MAX_REQUESTS) {
    throw new Error("Rate limit exceeded. Maximum 10 requests per minute.")
  }

  current.count += 1
  buckets.set(userId, current)
}
