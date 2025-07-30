// Lightweight in-memory monitoring & anomaly detection for AI and API usage.
// NOTE: For production, replace with persistent/centralized metrics store.

export interface UsageRecord {
  ts: number
  route: string
  ip: string
  userId?: string
  category: string // e.g., 'ai', 'api'
  units: number // e.g., approximate tokens or 1 per request
}

interface WindowStats {
  count: number
  sumUnits: number
  mean: number
  m2: number // for variance (Welford)
}

const usageWindow: Record<string, UsageRecord[]> = {}

const WINDOW_MS = Number(process.env.AI_USAGE_WINDOW_MS || 5 * 60_000) // 5 minutes default
const MAX_REQUESTS = Number(process.env.AI_USAGE_MAX_REQUESTS || 200) // per key per window
const ANOMALY_MULTIPLIER = Number(process.env.AI_USAGE_ANOMALY_MULTIPLIER || 3)

function getKey(ip: string, userId: string | undefined, category: string) {
  return `${category}:${userId || 'anon'}:${ip}`
}

function computeStats(records: UsageRecord[]): WindowStats {
  let count = 0
  let mean = 0
  let m2 = 0
  let sumUnits = 0
  for (const r of records) {
    count++
    sumUnits += r.units
    const delta = r.units - mean
    mean += delta / count
    const delta2 = r.units - mean
    m2 += delta * delta2
  }
  return { count, sumUnits, mean, m2 }
}

export interface RecordUsageOptions {
  route: string
  ip: string
  userId?: string
  category?: string
  units?: number
}

export interface RecordUsageResult {
  anomaly: boolean
  reason?: string
  stats: WindowStats
  recentCount: number
  windowMs: number
}

export function recordUsage(opts: RecordUsageOptions): RecordUsageResult {
  const { route, ip, userId, category = 'api', units = 1 } = opts
  const key = getKey(ip, userId, category)
  const now = Date.now()
  const arr = usageWindow[key] || (usageWindow[key] = [])
  // purge old
  while (arr.length && now - arr[0].ts > WINDOW_MS) arr.shift()
  arr.push({ ts: now, ip, route, userId, category, units })
  const stats = computeStats(arr)
  let anomaly = false
  let reason: string | undefined
  if (stats.count > MAX_REQUESTS) {
    anomaly = true
    reason = `hard-threshold-${stats.count}>${MAX_REQUESTS}`
  }
  // Compare sumUnits vs adaptive threshold (mean*count + multiplier*std-dev)
  if (!anomaly && stats.count > 5) {
    const variance = stats.count > 1 ? stats.m2 / (stats.count - 1) : 0
    const stdDev = Math.sqrt(variance)
    // If current units (last) far exceeds mean + multiplier*std
    if (units > stats.mean + ANOMALY_MULTIPLIER * (stdDev || 1)) {
      anomaly = true
      reason = `spike-units-${units.toFixed(2)}>` + (stats.mean + ANOMALY_MULTIPLIER * (stdDev || 1)).toFixed(2)
    }
  }
  return { anomaly, reason, stats, recentCount: stats.count, windowMs: WINDOW_MS }
}

export function summarizeUsage() {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(usageWindow)) {
    out[k] = { count: v.length, oldestMsAgo: v.length ? Date.now() - v[0].ts : 0 }
  }
  return out
}

// Helper to approximate token count from text length (rough heuristic: 4 chars/token)
export function approximateTokens(text: string | undefined | null): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}
