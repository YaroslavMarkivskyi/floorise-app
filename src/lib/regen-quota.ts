const DAILY_LIMIT = 20

interface Bucket {
  count: number
  resetAt: number
}

const quotas = new Map<string, Bucket>()

function nextMidnightMs(): number {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.getTime()
}

export function checkAndDecrement(userId: string): boolean {
  const now = Date.now()
  const bucket = quotas.get(userId)

  if (!bucket || bucket.resetAt < now) {
    quotas.set(userId, { count: 1, resetAt: nextMidnightMs() })
    return true
  }

  if (bucket.count >= DAILY_LIMIT) return false

  bucket.count++
  return true
}
