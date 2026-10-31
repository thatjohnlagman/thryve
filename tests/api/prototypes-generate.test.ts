import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@supabase/supabase-js", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { createClient: () => supabaseMock.client }
})

vi.mock("@/lib/gemini", () => ({
  generateInteractivePrototypeUI: vi.fn(),
}))

import { supabaseMock } from "../helpers/supabase-mock"
import { generateInteractivePrototypeUI } from "@/lib/gemini"
import { GET, POST } from "@/app/api/prototypes/generate/route"

const geminiMock = vi.mocked(generateInteractivePrototypeUI)

const HTML = "<!DOCTYPE html><html><body>app</body></html>"

function postRequest(body: unknown, authHeader?: string) {
  return new NextRequest("http://localhost/api/prototypes/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: authHeader ? { authorization: authHeader } : undefined,
  })
}

/** Registers the existing-prototype lookup plus insert/update outcomes. */
function registerHandlers({
  existing = null as any,
  insertResult = { data: { id: "proto-9" }, error: null as any },
}: {
  existing?: any
  insertResult?: { data: any; error: any }
} = {}) {
  supabaseMock.onTable(
    "prototypes",
    (ctx) => {
      if (ctx.action === "select") return { data: existing, error: null }
      if (ctx.action === "insert") return insertResult
      return { data: null, error: null }
    },
  )
}

beforeEach(() => {
  supabaseMock.reset()
  geminiMock.mockReset()
})

describe("POST /api/prototypes/generate", () => {
  it("returns 400 when the prompt is missing", async () => {
    const res = await POST(postRequest({ title: "Wallet" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Prompt is required" })
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("creates a generating prototype record for guests and kicks off generation", async () => {
    registerHandlers()
    geminiMock.mockResolvedValue(HTML)

    const res = await POST(postRequest({ prompt: "Build a wallet", title: "Wallet" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      prototypeId: "proto-9",
      status: "generating",
      message: "Prototype generation started",
      isUpdate: false,
    })

    const lookup = supabaseMock.findQuery((q) => q.table === "prototypes" && q.action === "select")
    expect(lookup?.chain).toContainEqual({ method: "eq", args: ["title", "Wallet"] })
    expect(lookup?.chain).toContainEqual({ method: "is", args: ["user_id", null] })

    const insert = supabaseMock.findQuery((q) => q.table === "prototypes" && q.action === "insert")
    expect(insert?.payload).toMatchObject({
      user_id: null,
      trend_id: null,
      title: "Wallet",
      prompt: "Build a wallet",
      status: "Generating",
    })
  })

  it("sanitizes bank branding out of the prompt", async () => {
    registerHandlers()
    geminiMock.mockResolvedValue(HTML)

    const res = await POST(
      postRequest({
        prompt: "Build BPI's mobile app for Bank of the Philippine Islands customers",
        title: "Banking",
      }),
    )

    expect(res.status).toBe(200)
    const insert = supabaseMock.findQuery((q) => q.table === "prototypes" && q.action === "insert")
    expect(insert?.payload.prompt).toBe("Build Thryve's mobile app for Thryve customers")
    expect(insert?.payload.prompt).not.toContain("BPI")
    expect(insert?.payload.prompt).not.toContain("Bank of the Philippine Islands")
  })

  it("scopes the existing-prototype lookup to the authenticated user", async () => {
    supabaseMock.setUser({ id: "user-7" })
    registerHandlers()
    geminiMock.mockResolvedValue(HTML)

    await POST(postRequest({ prompt: "Build", title: "Wallet" }, "Bearer token-abc"))

    const lookup = supabaseMock.findQuery((q) => q.table === "prototypes" && q.action === "select")
    expect(lookup?.chain).toContainEqual({ method: "eq", args: ["user_id", "user-7"] })
  })

  it("updates an existing prototype with the same title instead of inserting", async () => {
    registerHandlers({ existing: { id: "proto-1", status: "Ready" } })
    geminiMock.mockResolvedValue(HTML)

    const res = await POST(postRequest({ prompt: "Build a wallet v2", title: "Wallet" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ prototypeId: "proto-1", isUpdate: true, message: "Prototype update started" })

    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
    const update = supabaseMock.findQuery((q) => q.table === "prototypes" && q.action === "update")
    expect(update?.payload).toMatchObject({ prompt: "Build a wallet v2", status: "Generating" })
  })

  it("returns 500 when the record cannot be created", async () => {
    registerHandlers({ insertResult: { data: null, error: { message: "denied" } } })

    const res = await POST(postRequest({ prompt: "Build", title: "Wallet" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to create prototype record" })
  })

  it("marks the prototype Ready with the generated code once generation finishes", async () => {
    registerHandlers()
    geminiMock.mockResolvedValue(HTML)

    await POST(postRequest({ prompt: "Build", title: "Wallet" }))

    await vi.waitFor(() => {
      const ready = supabaseMock
        .queries.filter((q) => q.table === "prototypes" && q.action === "update")
        .find((q) => q.payload?.status === "Ready")
      expect(ready?.payload).toMatchObject({
        prototype_code: HTML,
        v0_url: "/api/prototypes/preview/proto-9",
        v0_project_id: "proto-9",
        error_message: null,
      })
      expect(ready?.chain).toContainEqual({ method: "eq", args: ["id", "proto-9"] })
    })
  })

  it("marks the prototype Failed when Gemini generation throws", async () => {
    registerHandlers()
    geminiMock.mockRejectedValue(new Error("quota exceeded"))

    await POST(postRequest({ prompt: "Build", title: "Wallet" }))

    await vi.waitFor(() => {
      const failed = supabaseMock
        .queries.filter((q) => q.table === "prototypes" && q.action === "update")
        .find((q) => q.payload?.status === "Failed")
      expect(failed?.payload.error_message).toBe("quota exceeded")
    })
  })
})

describe("GET /api/prototypes/generate", () => {
  beforeEach(() => supabaseMock.reset())

  it("lists prototypes without a user filter for anonymous callers", async () => {
    supabaseMock.onTable("prototypes", () => ({ data: [{ id: "proto-1" }], error: null }))

    const res = await GET(new NextRequest("http://localhost/api/prototypes/generate", { method: "GET" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, prototypes: [{ id: "proto-1" }] })

    const query = supabaseMock.findQuery((q) => q.table === "prototypes")
    expect(query?.chain.some((c) => c.method === "or")).toBe(false)
  })

  it("includes the caller's own plus public prototypes when authenticated", async () => {
    supabaseMock.setUser({ id: "user-1" })
    supabaseMock.onTable("prototypes", () => ({ data: [], error: null }))

    const res = await GET(
      new NextRequest("http://localhost/api/prototypes/generate", {
        method: "GET",
        headers: { authorization: "Bearer token-1" },
      }),
    )

    expect(res.status).toBe(200)
    const query = supabaseMock.findQuery((q) => q.table === "prototypes")
    expect(query?.chain).toContainEqual({ method: "or", args: ["user_id.eq.user-1,user_id.is.null"] })
  })

  it("returns 500 when the query fails", async () => {
    supabaseMock.onTable("prototypes", () => ({ data: null, error: { message: "boom" } }))

    const res = await GET(new NextRequest("http://localhost/api/prototypes/generate", { method: "GET" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "boom" })
  })
})
