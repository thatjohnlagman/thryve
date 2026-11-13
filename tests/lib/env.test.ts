import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  GEMINI_API_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  TAVILY_API_KEY,
  getEnv,
} from "@/lib/env"

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.TEST_VAR
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe("getEnv", () => {
  it("returns the raw value when set", () => {
    process.env.TEST_VAR = "value"
    expect(getEnv("TEST_VAR")).toBe("value")
  })

  it("throws for a missing required variable, naming the variable", () => {
    expect(() => getEnv("TEST_VAR")).toThrow("Missing required environment variable: TEST_VAR")
  })

  it("throws for a blank or whitespace-only value", () => {
    process.env.TEST_VAR = ""
    expect(() => getEnv("TEST_VAR")).toThrow(/TEST_VAR/)

    process.env.TEST_VAR = "   "
    expect(() => getEnv("TEST_VAR")).toThrow(/TEST_VAR/)
  })

  it("returns '' for a missing optional variable", () => {
    expect(getEnv("TEST_VAR", { optional: true })).toBe("")
  })

  it("returns the default for a missing optional variable", () => {
    expect(getEnv("TEST_VAR", { optional: true, default: "fallback" })).toBe("fallback")
  })

  it("prefers the real value over the default", () => {
    process.env.TEST_VAR = "real"
    expect(getEnv("TEST_VAR", { optional: true, default: "fallback" })).toBe("real")
  })
})

describe("typed getters", () => {
  it("require their environment variables", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.GEMINI_API_KEY

    expect(() => SUPABASE_URL()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
    expect(() => SUPABASE_ANON_KEY()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
    expect(() => GEMINI_API_KEY()).toThrow(/GEMINI_API_KEY/)
  })

  it("treat the service-role key and Tavily key as optional", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.TAVILY_API_KEY

    expect(SUPABASE_SERVICE_ROLE_KEY()).toBe("")
    expect(TAVILY_API_KEY()).toBe("")
  })
})
