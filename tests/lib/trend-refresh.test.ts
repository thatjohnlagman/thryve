import { describe, expect, it } from "vitest"

import {
  HOME_MIN_WEEKLY_TRENDS,
  TRENDS_SCREEN_MIN_WEEKLY_TRENDS,
  shouldRefreshTrends,
} from "@/lib/trend-refresh"

describe("shouldRefreshTrends", () => {
  it("refreshes when the week is below the minimum", () => {
    expect(shouldRefreshTrends([], HOME_MIN_WEEKLY_TRENDS)).toBe(true)
    expect(shouldRefreshTrends({ length: 2 }, HOME_MIN_WEEKLY_TRENDS)).toBe(true)
    expect(shouldRefreshTrends({ length: 0 }, TRENDS_SCREEN_MIN_WEEKLY_TRENDS)).toBe(true)
  })

  it("does not refresh once the minimum is met", () => {
    expect(shouldRefreshTrends({ length: 3 }, HOME_MIN_WEEKLY_TRENDS)).toBe(false)
    expect(shouldRefreshTrends({ length: 10 }, HOME_MIN_WEEKLY_TRENDS)).toBe(false)
    expect(shouldRefreshTrends({ length: 1 }, TRENDS_SCREEN_MIN_WEEKLY_TRENDS)).toBe(false)
  })

  it("pins the per-screen thresholds so they cannot drift silently", () => {
    // The home screen bootstraps a fuller week than the trends screen; if one
    // of these constants changes, revisit both call sites deliberately.
    expect(HOME_MIN_WEEKLY_TRENDS).toBe(3)
    expect(TRENDS_SCREEN_MIN_WEEKLY_TRENDS).toBe(1)
  })
})
