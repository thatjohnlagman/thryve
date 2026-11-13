import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// Serves generated prototypes through the service-role client.
vi.mock("@supabase/supabase-js", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { GET } from "@/app/api/prototypes/preview/[id]/route"

const params = { id: "proto-1" }
const request = () => new NextRequest("http://localhost/api/prototypes/preview/proto-1")

function registerPrototype(prototype: any) {
  supabaseMock.onTable("prototypes", () =>
    prototype ? { data: prototype, error: null } : { data: null, error: { message: "PGRST116" } },
  )
}

describe("GET /api/prototypes/preview/[id]", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 400 when the id is empty", async () => {
    const res = await GET(request(), { params: { id: "" } })

    expect(res.status).toBe(400)
    expect(await res.text()).toContain("Prototype ID is required")
  })

  it("returns a 404 HTML page when the prototype does not exist", async () => {
    registerPrototype(null)

    const res = await GET(request(), { params })

    expect(res.status).toBe(404)
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    const html = await res.text()
    expect(html).toContain("Prototype Not Found")

    const query = supabaseMock.findQuery((q) => q.table === "prototypes")
    expect(query?.chain).toContainEqual({ method: "eq", args: ["id", "proto-1"] })
  })

  it("serves an auto-reloading page while the prototype is still generating", async () => {
    registerPrototype({
      id: "proto-1",
      title: "Wallet",
      status: "Generating",
      prototype_code: null,
    })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8")
    const html = await res.text()
    expect(html).toContain("Generating Prototype")
    expect(html).toContain("Wallet")
    expect(html).toContain("window.location.reload()")
  })

  it("serves the generated prototype HTML with no-store caching headers", async () => {
    registerPrototype({
      id: "proto-1",
      title: "Wallet",
      status: "Ready",
      prototype_code: "<html><body>prototype</body></html>",
    })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("<html><body>prototype</body></html>")
    expect(res.headers.get("Cache-Control")).toContain("no-store")
  })

  it("falls back to a placeholder page when no code was stored", async () => {
    registerPrototype({
      id: "proto-1",
      title: "Wallet",
      status: "Ready",
      prototype_code: null,
      description: "A money app",
    })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain("Wallet")
    expect(html).toContain("A money app")
  })
})
