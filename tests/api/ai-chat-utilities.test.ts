import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// Responses are served from a queue so continuation loops can be exercised.
const state = vi.hoisted(() => ({ queue: [] as Array<string | Error> }))

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    constructor(_apiKey: string) {}
    getGenerativeModel() {
      return {
        generateContent: async () => {
          const next = state.queue.shift()
          if (!next) throw new Error("generateContent queue exhausted")
          if (next instanceof Error) throw next
          return { response: { text: () => next } }
        },
      }
    }
  },
}))

import { POST } from "@/app/api/ai-chat/utilities/route"

const SENTINEL = "# END_OF_CODE"

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ai-chat/utilities", { method: "POST", body: JSON.stringify(body) })
}

beforeEach(() => {
  state.queue.length = 0
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("POST /api/ai-chat/utilities", () => {
  describe("deploy_version", () => {
    it("requires version and utility data", async () => {
      const res = await POST(postRequest({ action: "deploy_version", utility_id: "u1" }))

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        error: "Missing required data. Please ensure version and utility data are provided.",
      })
    })

    it("requires generated code on the version", async () => {
      const res = await POST(
        postRequest({
          action: "deploy_version",
          utility_id: "u1",
          version_id: "v1",
          versionData: { generated_code: "" },
          utilityData: { file_name: "a.csv" },
        }),
      )

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: "No code found for this version" })
    })

    it("deploys through the generate-dashboard API", async () => {
      const fetchMock = vi.fn(async (_url: any, _init?: any) => ({
        json: async () => ({ success: true, dashboardUrl: "/api/utilities/dashboard/u1", sandboxId: "sb-1" }),
      }))
      vi.stubGlobal("fetch", fetchMock)

      const res = await POST(
        postRequest({
          action: "deploy_version",
          utility_id: "u1",
          version_id: "v2",
          versionData: { generated_code: "<html></html>", version_number: 2 },
          utilityData: { file_name: "a.csv" },
        }),
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        success: true,
        dashboardUrl: "/api/utilities/dashboard/u1",
        sandboxId: "sb-1",
        message: "Version 2 deployed successfully",
      })

      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain("/api/generate-dashboard")
      expect(JSON.parse(init.body)).toEqual({
        utilityId: "u1",
        fileName: "a.csv",
        generatedCode: "<html></html>",
        isRedeployment: true,
        versionId: "v2",
      })
    })

    it("returns 500 when the deployment itself fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ json: async () => ({ success: false, error: "nope" }) })),
      )

      const res = await POST(
        postRequest({
          action: "deploy_version",
          utility_id: "u1",
          version_id: "v2",
          versionData: { generated_code: "<html></html>" },
          utilityData: { file_name: "a.csv" },
        }),
      )

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ success: false, error: "nope" })
    })
  })

  describe("legacy chat actions", () => {
    it("proxies create-chat to the simple AI chat endpoint", async () => {
      const fetchMock = vi.fn(
        async (_url: any) =>
          new Response(JSON.stringify({ response: "hello", success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      )
      vi.stubGlobal("fetch", fetchMock)

      const res = await POST(postRequest({ action: "create-chat", message: "hi" }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ response: "hello", success: true })
      expect(String(fetchMock.mock.calls[0][0])).toContain("/api/ai-chat-simple")
    })

    it("passes the upstream status through for send-message failures", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify({ error: "Internal server error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }),
        ),
      )

      const res = await POST(postRequest({ action: "send-message", message: "hi" }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: "Internal server error" })
    })
  })

  describe("code-aware generation", () => {
    it("flags a complete code revision and reports the sentinel as reached", async () => {
      state.queue.push(
        "Your request has been revised! Here's the updated dashboard code:\n" +
          "```python\nimport streamlit\nst.title('Revenue')\n" +
          SENTINEL +
          "\n```",
      )

      const res = await POST(postRequest({ message: "modify the chart" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toMatchObject({
        isCodeRevision: true,
        hasUpdatedCode: true,
        complete: true,
        sentinel: SENTINEL,
      })
      expect(body.message).not.toContain("may have been truncated")
    })

    it("keeps requesting continuation until the sentinel appears, then warns if still missing", async () => {
      // Three truncated attempts: the loop must ask three times and then warn.
      state.queue.push("```python\na = 1\nb = 2\n", "```python\na = 1\nb = 2\nc = 3\n", "```python\na = 1\n")

      const res = await POST(postRequest({ message: "modify the chart" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.isCodeRevision).toBe(true)
      expect(body.complete).toBe(false)
      expect(body.message).toContain("may have been truncated")
      expect(state.queue).toHaveLength(0)
    })

    it("does not treat a plain explanation as a code revision", async () => {
      // The continuation loop keeps asking until the sentinel or 3 attempts,
      // so hand it three non-code responses.
      state.queue.push(
        "The dashboard shows revenue by segment as a bar chart.",
        "The dashboard shows revenue by segment as a bar chart.",
        "The dashboard shows revenue by segment as a bar chart.",
      )

      const res = await POST(postRequest({ message: "What does this dashboard show?" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.isCodeRevision).toBe(false)
      expect(body.hasUpdatedCode).toBe(false)
    })

    it("returns 500 when generation keeps failing", async () => {
      state.queue.push(new Error("quota exceeded"))

      const res = await POST(postRequest({ message: "modify the chart" }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: "Failed to process your request. Please try again." })
    })
  })
})
