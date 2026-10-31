import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// Serves generated dashboards through the service-role client.
vi.mock("@supabase/supabase-js", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { GET } from "@/app/api/utilities/dashboard/[id]/route"

const params = { id: "util-1" }
const request = () => new NextRequest("http://localhost/api/utilities/dashboard/util-1")

function registerUtility(utility: any) {
  supabaseMock.onTable("utilities", () =>
    utility ? { data: utility, error: null } : { data: null, error: { message: "PGRST116" } },
  )
}

describe("GET /api/utilities/dashboard/[id]", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 400 when the id is empty", async () => {
    const res = await GET(request(), { params: { id: "" } })

    expect(res.status).toBe(400)
    expect(await res.text()).toContain("Utility ID is required")
  })

  it("returns a 404 HTML page when the utility does not exist", async () => {
    registerUtility(null)

    const res = await GET(request(), { params })

    expect(res.status).toBe(404)
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    const html = await res.text()
    expect(html).toContain("Dashboard Not Found")
    // Lookup is scoped to the requested id.
    const query = supabaseMock.findQuery((q) => q.table === "utilities")
    expect(query?.chain).toContainEqual({ method: "eq", args: ["id", "util-1"] })
  })

  it("serves an auto-reloading page while the dashboard is still generating", async () => {
    registerUtility({ id: "util-1", file_name: "sales.csv", status: "generating-dashboard", generated_code: null })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    const html = await res.text()
    expect(html).toContain("Generating Dashboard")
    expect(html).toContain("sales.csv")
    expect(html).toContain("window.location.reload()")
  })

  it("serves the generated dashboard HTML with no-store caching headers", async () => {
    registerUtility({
      id: "util-1",
      file_name: "sales.csv",
      status: "ready",
      generated_code: "<html><body>dashboard</body></html>",
    })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("<html><body>dashboard</body></html>")
    expect(res.headers.get("Cache-Control")).toContain("no-store")
  })

  it("falls back to a minimal ready page when no code was stored", async () => {
    registerUtility({ id: "util-1", file_name: "sales.csv", status: "ready", generated_code: null })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain("sales.csv")
    expect(html).toContain("Dashboard is ready")
  })
})
