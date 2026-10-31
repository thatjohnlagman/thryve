import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@supabase/supabase-js", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { createClient: () => supabaseMock.client }
})

vi.mock("@/lib/gemini", () => ({
  generateInteractiveDashboardUI: vi.fn(),
}))

import { supabaseMock } from "../helpers/supabase-mock"
import { generateInteractiveDashboardUI } from "@/lib/gemini"
import { POST } from "@/app/api/generate-dashboard/route"

const geminiMock = vi.mocked(generateInteractiveDashboardUI)

const COMPLETE_HTML =
  '<!DOCTYPE html><html><body><canvas id="c"></canvas><script>new Chart()</script></body></html>'

const CSV_WITH_PII = ["customer,email,amount", "Juan,juan@example.com,100", "Ana,ana@example.com,200"].join("\n")

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/generate-dashboard", { method: "POST", body: JSON.stringify(body) })
}

function registerUtility(record: any) {
  supabaseMock.onTable("utilities", () =>
    record ? { data: record, error: null } : { data: null, error: { message: "PGRST116" } },
  )
}

beforeEach(() => {
  supabaseMock.reset()
  geminiMock.mockReset()
})

describe("POST /api/generate-dashboard", () => {
  it("returns 400 when utilityId or fileName is missing", async () => {
    const res = await POST(postRequest({ fileName: "a.csv" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Missing utilityId or fileName" })
  })

  it("returns 404 when the utility record does not exist", async () => {
    registerUtility(null)

    const res = await POST(postRequest({ utilityId: "util-1", fileName: "a.csv" }))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Utility record not found" })
    expect(geminiMock).not.toHaveBeenCalled()
  })

  it("returns the cached dashboard without touching storage or Gemini", async () => {
    registerUtility({ file_link: "guest/1-a.csv", file_name: "a.csv", generated_code: COMPLETE_HTML })

    const res = await POST(postRequest({ utilityId: "util-1", fileName: "a.csv" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      dashboardUrl: "/api/utilities/dashboard/util-1",
      generatedCode: COMPLETE_HTML,
    })
    expect(geminiMock).not.toHaveBeenCalled()
    expect(supabaseMock.storageCalls).toHaveLength(0)
  })

  it("regenerates from the stored CSV when generatedCode is supplied", async () => {
    registerUtility({ file_link: "guest/1-a.csv", file_name: "a.csv", generated_code: COMPLETE_HTML })
    geminiMock.mockResolvedValue({ html: COMPLETE_HTML, chartsCount: 2, summary: "" })

    const res = await POST(
      postRequest({ utilityId: "util-1", fileName: "a.csv", generatedCode: "<html>old</html>" }),
    )

    expect(res.status).toBe(200)
    expect(geminiMock).toHaveBeenCalledTimes(1)
  })

  it("downloads the CSV, redacts PII, regenerates and stores the new dashboard", async () => {
    registerUtility({ file_link: "guest/1-a.csv", file_name: "a.csv", generated_code: null })
    supabaseMock.setStorageDownload(async () => ({ data: { text: async () => CSV_WITH_PII }, error: null }))
    geminiMock.mockResolvedValue({ html: COMPLETE_HTML, chartsCount: 2, summary: "" })

    const res = await POST(postRequest({ utilityId: "util-1", fileName: "a.csv" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      dashboardUrl: "/api/utilities/dashboard/util-1",
      generatedCode: COMPLETE_HTML,
    })

    expect(supabaseMock.storageCalls[0]).toMatchObject({ bucket: "utilities-files", method: "download" })

    // PII must never reach the model.
    const geminiInput = geminiMock.mock.calls[0][0]
    expect(geminiInput.csvSample).not.toContain("juan@example.com")

    const update = supabaseMock.findQuery((q) => q.table === "utilities" && q.action === "update")
    expect(update?.payload).toMatchObject({
      status: "ready",
      generated_code: COMPLETE_HTML,
      charts_count: 2,
      error_message: null,
    })
    expect(update?.chain).toContainEqual({ method: "eq", args: ["id", "util-1"] })
  })

  it("falls back to a placeholder CSV when the storage download fails", async () => {
    registerUtility({ file_link: "guest/1-a.csv", file_name: "a.csv", generated_code: null })
    supabaseMock.setStorageDownload(async () => ({ data: null, error: { message: "gone" } }))
    geminiMock.mockResolvedValue({ html: COMPLETE_HTML, chartsCount: 4, summary: "" })

    const res = await POST(postRequest({ utilityId: "util-1", fileName: "a.csv" }))

    expect(res.status).toBe(200)
    const geminiInput = geminiMock.mock.calls[0][0]
    expect(geminiInput.csvSample).toContain("Retail")
  })

  it("returns 500 when Gemini generation fails", async () => {
    registerUtility({ file_link: "guest/1-a.csv", file_name: "a.csv", generated_code: null })
    supabaseMock.setStorageDownload(async () => ({ data: { text: async () => CSV_WITH_PII }, error: null }))
    geminiMock.mockRejectedValue(new Error("quota exceeded"))

    const res = await POST(postRequest({ utilityId: "util-1", fileName: "a.csv" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ success: false, error: "quota exceeded" })
  })
})
