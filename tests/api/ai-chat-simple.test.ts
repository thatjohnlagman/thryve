import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  /** Payloads handed to generateContent, in call order. */
  calls: [] as any[],
  responseText: "Yve reply",
  error: null as Error | null,
}))

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    constructor(_apiKey: string) {}
    getGenerativeModel(config: { model: string }) {
      return {
        generateContent: async (input: any) => {
          state.calls.push({ model: config.model, input })
          if (state.error) throw state.error
          return { response: { text: () => state.responseText } }
        },
      }
    }
  },
}))

import { POST } from "@/app/api/ai-chat-simple/route"

function postRequest(body: unknown) {
  return new Request("http://localhost/api/ai-chat-simple", { method: "POST", body: JSON.stringify(body) })
}

beforeEach(() => {
  state.calls.length = 0
  state.responseText = "Yve reply"
  state.error = null
  vi.stubEnv("GEMINI_API_KEY", "test-key")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("POST /api/ai-chat-simple", () => {
  it("returns 500 when the Gemini key is not configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")

    const res = await POST(postRequest({ message: "hi" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "AI service not configured" })
    expect(state.calls).toHaveLength(0)
  })

  it("answers with the model response", async () => {
    const res = await POST(postRequest({ message: "How do I validate an idea?" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ response: "Yve reply", success: true })
  })

  it("sends the Yve system prompt, mapped history and the current message in order", async () => {
    await POST(
      postRequest({
        message: "and then?",
        conversation_history: [
          { message_type: "user", content: "first question" },
          { message_type: "bot", content: "first answer" },
        ],
      }),
    )

    const contents = state.calls[0].input.contents
    expect(contents).toHaveLength(4)
    expect(contents[0].role).toBe("user")
    expect(contents[0].parts[0].text).toContain("Yve, Thryve's Agentic AI Copilot")
    expect(contents[1]).toEqual({ role: "user", parts: [{ text: "first question" }] })
    expect(contents[2]).toEqual({ role: "model", parts: [{ text: "first answer" }] })
    expect(contents[3]).toEqual({ role: "user", parts: [{ text: "and then?" }] })
  })

  it("injects trend context into the system prompt", async () => {
    await POST(
      postRequest({
        message: "tell me more",
        context_type: "trend",
        context_info: {
          title: "AI agents in banking",
          category: "Fintech",
          summary: "Banks automate ops",
          interpretation: "Strong moat",
          impact: "High",
        },
      }),
    )

    const systemPrompt = state.calls[0].input.contents[0].parts[0].text
    expect(systemPrompt).toContain("AI agents in banking")
    expect(systemPrompt).toContain("Fintech")
    expect(systemPrompt).toContain("Banks automate ops")
  })

  it("returns 500 when the model call throws", async () => {
    state.error = new Error("quota exceeded")

    const res = await POST(postRequest({ message: "hi" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
  })
})
