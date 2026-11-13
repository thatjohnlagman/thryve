import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// The upload route builds a service-role client and asks Gemini for the dashboard.
vi.mock("@supabase/supabase-js", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { createClient: () => supabaseMock.client }
})

vi.mock("@/lib/gemini", () => ({
  generateInteractiveDashboardUI: vi.fn(),
}))

import { supabaseMock } from "../helpers/supabase-mock"
import { generateInteractiveDashboardUI } from "@/lib/gemini"
import { POST } from "@/app/api/utilities/upload/route"

const geminiMock = vi.mocked(generateInteractiveDashboardUI)

const COMPLETE_HTML =
  '<!DOCTYPE html><html><head></head><body><canvas id="c"></canvas><script>new Chart()</script></body></html>'

const CSV = ["customer,email,revenue", "Juan Cruz,juan@example.com,1000", "Ana Reyes,ana@example.com,2000"].join(
  "\n",
)

function uploadRequest(body: unknown, authHeader?: string) {
  return new NextRequest("http://localhost/api/utilities/upload", {
    method: "POST",
    body: JSON.stringify(body),
    headers: authHeader ? { authorization: authHeader } : undefined,
  })
}

function registerRecord({ id = "util-1", insertError = null as any }: { id?: string; insertError?: any } = {}) {
  supabaseMock.onTable(
    "utilities",
    (ctx) => (ctx.action === "insert" ? { data: insertError ? null : { id }, error: insertError } : { data: null, error: null }),
  )
}

beforeEach(() => {
  supabaseMock.reset()
  geminiMock.mockReset()
})

describe("POST /api/utilities/upload", () => {
  it("returns 400 when fileName or csvData is missing", async () => {
    const res = await POST(uploadRequest({ fileName: "sales.csv" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "fileName and csvData are required" })
    expect(supabaseMock.findQuery((q) => q.table === "utilities")).toBeUndefined()
  })

  it("uploads, redacts PII before calling Gemini, and marks the utility ready", async () => {
    registerRecord()
    geminiMock.mockResolvedValue({ html: COMPLETE_HTML, chartsCount: 3, summary: "done" })

    const res = await POST(uploadRequest({ fileName: "sales.csv", fileSize: 2048, csvData: CSV }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.utility).toMatchObject({
      id: "util-1",
      name: "sales.csv",
      size: "2 KB",
      charts: 3,
      status: "ready",
      dashboardUrl: "/api/utilities/dashboard/util-1",
    })

    // PII must never reach the model: the CSV sample passed to Gemini is redacted and capped.
    const geminiInput = geminiMock.mock.calls[0][0]
    expect(geminiInput.fileName).toBe("sales.csv")
    expect(geminiInput.csvSample).not.toContain("juan@example.com")
    expect(geminiInput.csvSample).toContain("customer,email,revenue")

    // The record is created as generating, then flipped to ready with the HTML.
    const insert = supabaseMock.findQuery((q) => q.table === "utilities" && q.action === "insert")
    expect(insert?.payload).toMatchObject({
      user_id: null,
      file_name: "sales.csv",
      file_size: 2048,
      status: "generating-dashboard",
    })

    const update = supabaseMock.findQuery((q) => q.table === "utilities" && q.action === "update")
    expect(update?.payload).toMatchObject({
      status: "ready",
      generated_code: COMPLETE_HTML,
      dashboard_url: "/api/utilities/dashboard/util-1",
      charts_count: 3,
      error_message: null,
    })
    expect(update?.chain).toContainEqual({ method: "eq", args: ["id", "util-1"] })
  })

  it("stores guest uploads under a guest/ prefix and authenticated ones under the user id", async () => {
    registerRecord()
    geminiMock.mockResolvedValue({ html: COMPLETE_HTML, chartsCount: 4, summary: "" })

    await POST(uploadRequest({ fileName: "a.csv", csvData: "h,v\n1,2" }))
    const guestUpload = supabaseMock.storageCalls.find((c) => c.method === "upload")
    expect(guestUpload?.bucket).toBe("utilities-files")
    expect(guestUpload?.args[0]).toMatch(/^guest\//)

    supabaseMock.setUser({ id: "user-42" })
    registerRecord()
    await POST(uploadRequest({ fileName: "b.csv", csvData: "h,v\n1,2" }, "Bearer token-xyz"))
    const userUploads = supabaseMock.storageCalls.filter((c) => c.method === "upload")
    expect(userUploads[1].args[0]).toMatch(/^user-42\//)
  })

  it("falls back to a generated dashboard when Gemini fails", async () => {
    registerRecord()
    geminiMock.mockRejectedValue(new Error("quota exceeded"))

    const res = await POST(uploadRequest({ fileName: "sales.csv", csvData: CSV }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.generatedCode).toContain("new Chart")
    expect(body.generatedCode).toContain("sales.csv")
    expect(body.utility.status).toBe("ready")
  })

  it("falls back to a generated dashboard when Gemini returns incomplete HTML", async () => {
    registerRecord()
    geminiMock.mockResolvedValue({ html: "<html><body>truncated", chartsCount: 4, summary: "" })

    const res = await POST(uploadRequest({ fileName: "sales.csv", csvData: CSV }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.generatedCode).toContain("</html>")
    expect(body.generatedCode).toContain("new Chart")
  })

  it("keeps going when the storage upload fails (non-critical)", async () => {
    registerRecord()
    supabaseMock.setStorageUpload({ data: null, error: { message: "storage down" } })
    geminiMock.mockResolvedValue({ html: COMPLETE_HTML, chartsCount: 4, summary: "" })

    const res = await POST(uploadRequest({ fileName: "sales.csv", csvData: CSV }))

    expect(res.status).toBe(200)
  })

  it("returns 500 when the database record cannot be created", async () => {
    registerRecord({ insertError: { message: "insert denied" } })

    const res = await POST(uploadRequest({ fileName: "sales.csv", csvData: CSV }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "insert denied" })
    expect(geminiMock).not.toHaveBeenCalled()
  })
})
