import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { approximateTokens, recordUsage, summarizeUsage } from "@/lib/monitoring"

let ipCounter = 0
/** Every test gets its own client IP so the module-global window stays isolated. */
function uniqueIp() {
  ipCounter += 1
  return `10.99.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`
}

const base = () => ({ route: "/api/test", ip: uniqueIp() })

afterEach(() => {
  vi.useRealTimers()
})

describe("recordUsage", () => {
  it("counts a single request without flagging an anomaly", () => {
    const result = recordUsage(base())

    expect(result.anomaly).toBe(false)
    expect(result.recentCount).toBe(1)
    expect(result.stats.sumUnits).toBe(1)
  })

  it("scopes counters per category, user and IP", () => {
    const ip = uniqueIp()

    recordUsage({ route: "/api/test", ip, userId: "user-1", category: "ai" })
    recordUsage({ route: "/api/test", ip, userId: "user-1", category: "ai" })
    recordUsage({ route: "/api/test", ip, userId: "user-2", category: "ai" })
    recordUsage({ route: "/api/test", ip, userId: "user-1", category: "api" })

    const summaries = summarizeUsage() as Record<string, { count: number }>
    expect(summaries[`ai:user-1:${ip}`].count).toBe(2)
    expect(summaries[`ai:user-2:${ip}`].count).toBe(1)
    expect(summaries[`api:user-1:${ip}`].count).toBe(1)
    expect(summaries[`ai:anon:${ip}`]).toBeUndefined()
  })

  it("flags a request whose units spike far above the window mean", () => {
    const ip = uniqueIp()
    const opts = { route: "/api/test", ip }

    // Build a steady baseline (the spike check only engages after >5 samples).
    for (let i = 0; i < 20; i++) {
      expect(recordUsage({ ...opts, units: 5 }).anomaly).toBe(false)
    }

    const spike = recordUsage({ ...opts, units: 10_000 })
    expect(spike.anomaly).toBe(true)
    expect(spike.reason).toMatch(/^spike-units-/)
  })

  it("does not flag steady high usage as a spike", () => {
    const ip = uniqueIp()
    const opts = { route: "/api/test", ip }

    for (let i = 0; i < 25; i++) {
      expect(recordUsage({ ...opts, units: 500 }).anomaly).toBe(false)
    }
  })

  it("flags every request past the hard per-window threshold", () => {
    const ip = uniqueIp()
    const opts = { route: "/api/test", ip }

    // Default MAX_REQUESTS is 200 per key per window.
    for (let i = 0; i < 200; i++) {
      expect(recordUsage(opts).anomaly).toBe(false)
    }

    const overLimit = recordUsage(opts)
    expect(overLimit.anomaly).toBe(true)
    expect(overLimit.reason).toMatch(/^hard-threshold-201>200$/)
  })

  it("purges records older than the window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    const opts = { route: "/api/test", ip: uniqueIp() }

    expect(recordUsage(opts).recentCount).toBe(1)
    expect(recordUsage(opts).recentCount).toBe(2)

    // Default WINDOW_MS is 5 minutes; move past it so old records expire.
    vi.setSystemTime(new Date("2026-01-01T00:06:00Z"))
    expect(recordUsage(opts).recentCount).toBe(1)
    expect(recordUsage(opts).recentCount).toBe(2)
  })
})

describe("summarizeUsage", () => {
  it("reports the count and age of the oldest record per key", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    const ip = uniqueIp()

    recordUsage({ route: "/api/test", ip, userId: "user-1" })
    vi.setSystemTime(new Date("2026-01-01T00:01:00Z"))
    recordUsage({ route: "/api/test", ip, userId: "user-1" })

    const summary = (summarizeUsage() as any)[`api:user-1:${ip}`]
    expect(summary.count).toBe(2)
    expect(summary.oldestMsAgo).toBe(60_000)
  })
})

describe("approximateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(approximateTokens(undefined)).toBe(0)
    expect(approximateTokens(null)).toBe(0)
    expect(approximateTokens("")).toBe(0)
  })

  it("approximates ~4 characters per token, rounding up", () => {
    expect(approximateTokens("abcd")).toBe(1)
    expect(approximateTokens("abcde")).toBe(2)
    expect(approximateTokens("a".repeat(400))).toBe(100)
  })
})
