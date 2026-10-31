import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

// These routes build their own service-role client instead of using @/lib/supabase.
vi.mock("@supabase/supabase-js", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { DELETE, GET } from "@/app/api/utilities/route"

function request(url = "http://localhost/api/utilities", method = "GET", authHeader?: string) {
  return new NextRequest(url, {
    method,
    headers: authHeader ? { authorization: authHeader } : undefined,
  })
}

describe("GET /api/utilities", () => {
  beforeEach(() => supabaseMock.reset())

  it("lists utilities without a user filter for anonymous callers", async () => {
    supabaseMock.onTable("utilities", () => ({ data: [{ id: "util-1" }], error: null }))

    const res = await GET(request())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, utilities: [{ id: "util-1" }] })

    const query = supabaseMock.findQuery((q) => q.table === "utilities")
    expect(query?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] })
    expect(query?.chain.some((c) => c.method === "or")).toBe(false)
  })

  it("scopes the listing to the caller's own plus public utilities when authenticated", async () => {
    supabaseMock.setUser({ id: "user-1" })
    supabaseMock.onTable("utilities", () => ({ data: [], error: null }))

    const res = await GET(request("http://localhost/api/utilities", "GET", "Bearer token-123"))

    expect(res.status).toBe(200)
    expect(supabaseMock.auth.getUser).toHaveBeenCalledWith("token-123")

    const query = supabaseMock.findQuery((q) => q.table === "utilities")
    expect(query?.chain).toContainEqual({ method: "or", args: ["user_id.eq.user-1,user_id.is.null"] })
  })

  it("does not filter by user when the bearer token resolves to no user", async () => {
    supabaseMock.onTable("utilities", () => ({ data: [], error: null }))

    await GET(request("http://localhost/api/utilities", "GET", "Bearer stale-token"))

    const query = supabaseMock.findQuery((q) => q.table === "utilities")
    expect(query?.chain.some((c) => c.method === "or")).toBe(false)
  })

  it("returns 500 when the query fails", async () => {
    supabaseMock.onTable("utilities", () => ({ data: null, error: { message: "boom" } }))

    const res = await GET(request())

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "boom" })
  })
})

describe("DELETE /api/utilities", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 400 when the id query parameter is missing", async () => {
    const res = await DELETE(request("http://localhost/api/utilities", "DELETE"))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Missing utility id" })
    expect(supabaseMock.findQuery((q) => q.table === "utilities")).toBeUndefined()
  })

  it("deletes the utility by id", async () => {
    supabaseMock.onTable("utilities", () => ({ data: null, error: null }))

    const res = await DELETE(request("http://localhost/api/utilities?id=util-9", "DELETE"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })

    const query = supabaseMock.findQuery((q) => q.table === "utilities" && q.action === "delete")
    expect(query?.chain).toContainEqual({ method: "eq", args: ["id", "util-9"] })
  })

  it("SECURITY NOTE: deletes without any authentication or ownership check", async () => {
    // Documents today's behaviour: the handler uses the service-role client and
    // never inspects credentials, so any caller who knows a utility id can
    // delete it. If this test ever fails because auth was added, update it.
    supabaseMock.onTable("utilities", () => ({ data: null, error: null }))

    const res = await DELETE(request("http://localhost/api/utilities?id=someone-elses-util", "DELETE"))

    expect(res.status).toBe(200)
    expect(supabaseMock.auth.getUser).not.toHaveBeenCalled()
  })

  it("returns 500 when the delete fails", async () => {
    supabaseMock.onTable("utilities", () => ({ data: null, error: { message: "boom" } }))

    const res = await DELETE(request("http://localhost/api/utilities?id=util-9", "DELETE"))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "boom" })
  })
})
