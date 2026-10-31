import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/gemini", () => ({
  generateWithFallback: vi.fn(),
}))

import { generateWithFallback } from "@/lib/gemini"
import { POST } from "@/app/api/research/route"

const geminiMock = vi.mocked(generateWithFallback)

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/research", { method: "POST", body: JSON.stringify(body) })
}

/** Stub of the Tavily search API; every search call gets the same results. */
function stubTavily(results: any[]) {
  const fetchMock = vi.fn(async (_url: any, _init?: any) => ({ ok: true, json: async () => ({ results }) }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  geminiMock.mockReset()
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("POST /api/research", () => {
  it("returns 400 when GEMINI_API_KEY is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")

    const res = await POST(postRequest({ title: "T", category: "C" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Missing GEMINI_API_KEY in .env.local" })
    expect(geminiMock).not.toHaveBeenCalled()
  })

  describe("seeds mode", () => {
    const SEEDS_JSON = JSON.stringify({
      trends: [
        { title: "AI agents", category: "AI Agents", impact: "High", summary: "s", interpretation: "i" },
        { title: "Open finance", category: "Fintech", impact: "Medium", summary: "s", interpretation: "i" },
      ],
    })

    it("returns parsed seeds and marks automatic generation", async () => {
      vi.stubEnv("TAVILY_API_KEY", "")
      geminiMock.mockResolvedValue("```json\n" + SEEDS_JSON + "\n```")

      const res = await POST(postRequest({ bootstrap: true, mode: "seeds" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.generationType).toBe("automatic")
      expect(body.seeds).toHaveLength(2)
      expect(body.seeds[0]).toMatchObject({ title: "AI agents", impact: "High" })
    })

    it("asks for exactly the requested number of trends", async () => {
      vi.stubEnv("TAVILY_API_KEY", "")
      geminiMock.mockResolvedValue(SEEDS_JSON)

      await POST(postRequest({ bootstrap: true, mode: "seeds", count: 5 }))

      expect(geminiMock.mock.calls[0][0]).toContain("Generate exactly 5")
    })

    it("marks a topic-scoped seed request as manual and searches the web for it", async () => {
      vi.stubEnv("TAVILY_API_KEY", "tavily-key")
      geminiMock.mockResolvedValue(SEEDS_JSON)
      const fetchMock = stubTavily([
        { title: "AI banking", url: "https://example.com/ai-banking", content: "Growth everywhere" },
      ])

      const res = await POST(postRequest({ bootstrap: true, mode: "seeds", searchTopic: "Digital banking" }))

      expect(res.status).toBe(200)
      expect((await res.json()).generationType).toBe("manual")

      const prompt = geminiMock.mock.calls[0][0] as string
      expect(prompt).toContain("Digital banking")
      expect(prompt).toContain("Source: AI banking (https://example.com/ai-banking)")

      expect(fetchMock).toHaveBeenCalledTimes(2)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe("https://api.tavily.com/search")
      expect(init.headers.Authorization).toBe("Bearer tavily-key")
    })

    it("tells the model which trends already exist to avoid duplicates", async () => {
      vi.stubEnv("TAVILY_API_KEY", "")
      geminiMock.mockResolvedValue(SEEDS_JSON)

      await POST(
        postRequest({ bootstrap: true, mode: "seeds", existingTrends: ["AI agents", "Open finance"] }),
      )

      const prompt = geminiMock.mock.calls[0][0] as string
      expect(prompt).toContain("Avoid duplicating these existing trends")
      expect(prompt).toContain("1. AI agents")
      expect(prompt).toContain("2. Open finance")
    })

    it("returns empty seeds when the model output is not valid JSON", async () => {
      vi.stubEnv("TAVILY_API_KEY", "")
      geminiMock.mockResolvedValue("sorry, I cannot help with that")

      const res = await POST(postRequest({ bootstrap: true, mode: "seeds" }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ seeds: [], generationType: "automatic" })
    })

    it("keeps going when the Tavily search fails", async () => {
      vi.stubEnv("TAVILY_API_KEY", "tavily-key")
      geminiMock.mockResolvedValue(SEEDS_JSON)
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("tavily down")
        }),
      )

      const res = await POST(postRequest({ bootstrap: true, mode: "seeds" }))

      expect(res.status).toBe(200)
      expect((await res.json()).seeds).toHaveLength(2)
    })
  })

  describe("detailed analysis mode", () => {
    const DETAIL_JSON = JSON.stringify({
      detailed_research: {
        market_need: "pain",
        key_metrics: ["m1", "m2"],
        competitive_advantage: "moat",
        regulatory_considerations: "none",
        implementation_complexity: "Medium",
        target_demographics: ["users"],
      },
      prototype_prompt: "Build a app",
    })

    it("requires both title and category", async () => {
      const missingCategory = await POST(postRequest({ title: "AI agents" }))
      expect(missingCategory.status).toBe(400)
      expect(await missingCategory.json()).toEqual({ error: "Missing 'title' or 'category'." })

      const missingTitle = await POST(postRequest({ category: "Fintech" }))
      expect(missingTitle.status).toBe(400)

      expect(geminiMock).not.toHaveBeenCalled()
    })

    it("returns the parsed research plus deduplicated http sources", async () => {
      vi.stubEnv("TAVILY_API_KEY", "tavily-key")
      geminiMock.mockResolvedValue("```json\n" + DETAIL_JSON + "\n```")
      stubTavily([
        { title: "One", url: "https://example.com/1", content: "a".repeat(600) },
        { title: "One again", url: "https://example.com/1", content: "duplicate url" },
        { title: "Two", url: "https://example.com/2", snippet: "from snippet" },
        { title: "Bad", url: "ftp://example.com/3", content: "not http" },
      ])

      const res = await POST(postRequest({ title: "AI agents", category: "AI Agents" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.detailed_research).toMatchObject({ market_need: "pain", implementation_complexity: "Medium" })
      expect(body.prototype_prompt).toBe("Build a app")
      expect(body.sources).toEqual(["https://example.com/1", "https://example.com/2"])
    })

    it("caps the returned sources at six", async () => {
      vi.stubEnv("TAVILY_API_KEY", "tavily-key")
      geminiMock.mockResolvedValue(DETAIL_JSON)
      stubTavily(
        Array.from({ length: 10 }, (_, i) => ({
          title: `T${i}`,
          url: `https://example.com/${i}`,
          content: "c",
        })),
      )

      const res = await POST(postRequest({ title: "AI agents", category: "AI" }))

      expect((await res.json()).sources).toHaveLength(6)
    })

    it("falls back to default research when the model output is not valid JSON", async () => {
      vi.stubEnv("TAVILY_API_KEY", "")
      geminiMock.mockResolvedValue("not json at all")

      const res = await POST(postRequest({ title: "AI agents", category: "AI Agents" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.detailed_research.market_need).toContain("automated, intelligent digital solutions")
      expect(body.prototype_prompt).toContain("AI agents")
      expect(body.sources).toEqual([])
    })
  })
})
