import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/gemini", () => ({
  generateWithFallback: vi.fn(),
}))

import { generateWithFallback } from "@/lib/gemini"
import { GET } from "@/app/api/news/route"

const geminiMock = vi.mocked(generateWithFallback)

/** Stub of the Tavily search API; every search call gets the same results. */
function stubTavily(results: any[]) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ results }) }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  geminiMock.mockReset()
  vi.stubEnv("TAVILY_API_KEY", "tavily-key")
  vi.stubEnv("GEMINI_API_KEY", "gemini-key")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/news", () => {
  it("returns an empty item list when an API key is missing", async () => {
    vi.stubEnv("TAVILY_API_KEY", "")

    const res = await GET()

    // NOTE: configuration problems come back as 200 with an error field.
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      items: [],
      error: "Missing TAVILY_API_KEY or GEMINI_API_KEY in .env.local",
    })
    expect(geminiMock).not.toHaveBeenCalled()
  })

  it("returns an empty item list when search yields no valid sources", async () => {
    stubTavily([{ title: "Bad", url: "ftp://not-http", content: "x" }])

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [], error: "No news sources found via search" })
    expect(geminiMock).not.toHaveBeenCalled()
  })

  it("curates, validates and enriches items returned by the model", async () => {
    stubTavily([{ title: "Real article", url: "https://example.com/a", content: "body" }])
    geminiMock.mockResolvedValue(
      "```json\n" +
        JSON.stringify([
          {
            title: "Banks adopt AI agents",
            summary: "Big shift",
            source: "Inquirer",
            url: "https://example.com/a",
            imageUrl: "",
            publishedAt: "",
          },
          {
            title: "Has own image",
            summary: "s",
            source: "BusinessWorld",
            url: "https://example.com/b",
            imageUrl: "https://cdn.example.com/x.jpg",
            publishedAt: "Today",
          },
          { title: "No url at all", summary: "s", source: "x", url: "", imageUrl: "", publishedAt: "" },
          { title: "Invented scheme", summary: "s", source: "x", url: "javascript:alert(1)", imageUrl: "", publishedAt: "" },
        ]) +
        "\n```",
    )

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    // Items without a valid http(s) URL are dropped.
    expect(body.items).toHaveLength(2)

    const first = body.items[0]
    expect(first).toMatchObject({
      title: "Banks adopt AI agents",
      source: "Inquirer",
      url: "https://example.com/a",
    })
    // Missing fields get safe defaults; empty images get an enriched thumbnail.
    expect(first.imageUrl).toMatch(/^https:\/\//)
    expect(first.publishedAt).toBe("Recently")

    const second = body.items[1]
    expect(second.imageUrl).toBe("https://cdn.example.com/x.jpg")
    expect(second.publishedAt).toBe("Today")
  })

  it("unwraps an { items } object instead of a bare array", async () => {
    stubTavily([{ title: "Real", url: "https://example.com/a", content: "b" }])
    geminiMock.mockResolvedValue(
      JSON.stringify({ items: [{ title: "T", summary: "s", source: "S", url: "https://example.com/a", imageUrl: "", publishedAt: "" }] }),
    )

    const res = await GET()

    expect((await res.json()).items).toHaveLength(1)
  })

  it("returns empty items when the model throws", async () => {
    stubTavily([{ title: "Real", url: "https://example.com/a", content: "b" }])
    geminiMock.mockRejectedValue(new Error("quota exceeded"))

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [], error: "quota exceeded" })
  })

  it("queries Tavily once per news query", async () => {
    const fetchMock = stubTavily([{ title: "Real", url: "https://example.com/a", content: "b" }])
    geminiMock.mockResolvedValue("[]")

    await GET()

    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
