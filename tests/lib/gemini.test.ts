import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The SDK is mocked below; `state` is hoisted so the vi.mock factory can see it.
const state = vi.hoisted(() => ({
  /** Model names passed to getGenerativeModel, in call order. */
  requested: [] as string[],
  /** Every generateContent call: which model got it and with what payload. */
  calls: [] as Array<{ model: string; input: any }>,
  /** Per-model generateContent handlers; other models use `fallback`. */
  handlers: new Map<string, () => Promise<any>>(),
  fallback: undefined as (() => Promise<any>) | undefined,
}))

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    constructor(_apiKey: string) {}
    getGenerativeModel(config: { model: string }) {
      state.requested.push(config.model)
      return {
        generateContent: async (input: any) => {
          state.calls.push({ model: config.model, input })
          const handler = state.handlers.get(config.model) ?? state.fallback
          if (!handler) throw new Error(`no handler for ${config.model}`)
          return handler()
        },
      }
    }
  },
}))

import {
  ACTIVE_GEMINI_MODELS,
  generateInteractiveDashboardUI,
  generateInteractivePrototypeUI,
  generateWithFallback,
  getGeminiClient,
} from "@/lib/gemini"

const ok =
  (text: string) =>
  async () => ({ response: { text: () => text } })
const fail =
  (message = "model unavailable") =>
  async () => {
    throw new Error(message)
  }

/** The full text of the first user turn sent to the model. */
function firstPrompt(): string {
  return state.calls[0].input.contents[0].parts[0].text
}

beforeEach(() => {
  state.requested.length = 0
  state.calls.length = 0
  state.handlers.clear()
  state.fallback = undefined
  process.env.GEMINI_API_KEY = "test-key"
})

afterEach(() => {
  delete process.env.GEMINI_API_KEY
})

describe("getGeminiClient", () => {
  it("throws a descriptive error when GEMINI_API_KEY is missing", () => {
    delete process.env.GEMINI_API_KEY
    expect(() => getGeminiClient()).toThrow(/GEMINI_API_KEY/)
  })
})

describe("generateWithFallback", () => {
  it("returns the text of the first model that succeeds", async () => {
    state.fallback = ok("hello")

    await expect(generateWithFallback("hi there")).resolves.toBe("hello")
    expect(state.requested[0]).toBe(ACTIVE_GEMINI_MODELS[0])
  })

  it("sends a plain string prompt as a single user turn", async () => {
    state.fallback = ok("ok")

    await generateWithFallback("hi there")

    expect(state.calls[0].input.contents).toEqual([
      { role: "user", parts: [{ text: "hi there" }] },
    ])
  })

  it("passes through an array prompt unchanged", async () => {
    state.fallback = ok("ok")
    const contents = [{ role: "user" as const, parts: [{ text: "part one" }, { text: "part two" }] }]

    await generateWithFallback(contents)

    expect(state.calls[0].input.contents).toEqual(contents)
  })

  it("falls through to later models when an earlier one fails", async () => {
    const models = Array.from(new Set(ACTIVE_GEMINI_MODELS))
    state.handlers.set(models[0], fail())
    state.handlers.set(models[1], ok("from second model"))

    await expect(generateWithFallback("hi")).resolves.toBe("from second model")
    expect(state.requested.slice(0, 2)).toEqual(models.slice(0, 2))
  })

  it("skips models that return empty text", async () => {
    state.handlers.set(ACTIVE_GEMINI_MODELS[0], ok(""))
    state.fallback = ok("non-empty")

    await expect(generateWithFallback("hi")).resolves.toBe("non-empty")
  })

  it("throws the last error when every model fails", async () => {
    state.fallback = fail("quota exceeded")

    await expect(generateWithFallback("hi")).rejects.toThrow("quota exceeded")
    // The route dedupes models before trying them (the default model also
    // appears explicitly in ACTIVE_GEMINI_MODELS).
    expect(state.requested).toEqual(Array.from(new Set(ACTIVE_GEMINI_MODELS)))
  })
})

describe("generateInteractivePrototypeUI", () => {
  it("strips markdown fences from the generated HTML", async () => {
    state.fallback = ok("```html\n<!DOCTYPE html><html><body>hi</body></html>\n```")

    const html = await generateInteractivePrototypeUI({ prompt: "build", title: "T" })

    expect(html.startsWith("<!DOCTYPE html>")).toBe(true)
    expect(html.endsWith("</html>")).toBe(true)
    expect(html).not.toContain("```")
  })

  it("includes the title, category and description in the prompt", async () => {
    state.fallback = ok("<html></html>")

    await generateInteractivePrototypeUI({
      prompt: "A cool app",
      title: "Wallet",
      description: "Manage money",
      category: "Fintech",
    })

    const prompt = firstPrompt()
    expect(prompt).toContain("Wallet")
    expect(prompt).toContain("Fintech")
    expect(prompt).toContain("Manage money")
    expect(prompt).toContain("A cool app")
  })
})

describe("generateInteractiveDashboardUI", () => {
  const COMPLETE_HTML =
    '<html><body><canvas id="c"></canvas><script>new Chart();</script></body></html>'

  it("returns html, chart count and summary for complete output", async () => {
    state.fallback = ok("```html\n" + COMPLETE_HTML + "\n```")

    const result = await generateInteractiveDashboardUI({
      csvSample: "a,b\n1,2",
      fileName: "sales.csv",
    })

    expect(result.html).toBe(COMPLETE_HTML)
    expect(result.chartsCount).toBe(4)
    expect(result.summary).toContain("sales.csv")
  })

  it("includes the CSV sample and file name in the prompt", async () => {
    state.fallback = ok(COMPLETE_HTML)

    await generateInteractiveDashboardUI({ csvSample: "a,b\n1,2", fileName: "sales.csv" })

    const prompt = firstPrompt()
    expect(prompt).toContain("sales.csv")
    expect(prompt).toContain("a,b\n1,2")
  })

  it("rejects truncated output that is missing the closing html tag", async () => {
    state.fallback = ok("<html><body><script>new Chart(")

    await expect(
      generateInteractiveDashboardUI({ csvSample: "a,b\n1,2", fileName: "sales.csv" }),
    ).rejects.toThrow(/truncated or incomplete/)
  })

  it("rejects output that never renders a chart", async () => {
    state.fallback = ok("<html><body>no charts here</script></body></html>")

    await expect(
      generateInteractiveDashboardUI({ csvSample: "a,b\n1,2", fileName: "sales.csv" }),
    ).rejects.toThrow(/truncated or incomplete/)
  })
})
