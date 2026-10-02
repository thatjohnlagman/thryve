import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { POST as updateUrl } from "@/app/api/prototypes/update-url/route"
import { POST as updateProject } from "@/app/api/prototypes/update-project/route"

function request(body: unknown) {
  const payload = typeof body === "string" ? body : JSON.stringify(body)
  return new NextRequest("http://localhost/api/prototypes/update-url", { method: "POST", body: payload })
}

describe("POST /api/prototypes/update-url", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 400 when prototypeId is missing", async () => {
    const res = await updateUrl(request({ newUrl: "https://v0.app/p/1" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "prototypeId and newUrl are required" })
    expect(supabaseMock.queries).toHaveLength(0)
  })

  it("returns 400 when newUrl is missing", async () => {
    const res = await updateUrl(request({ prototypeId: "proto-1" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "prototypeId and newUrl are required" })
    expect(supabaseMock.queries).toHaveLength(0)
  })

  it("updates the prototype url", async () => {
    supabaseMock.onTable("prototypes", () => ({
      data: { id: "proto-1", title: "Landing page", v0_url: "https://v0.app/p/1" },
      error: null,
    }))

    const res = await updateUrl(request({ prototypeId: "proto-1", newUrl: "https://v0.app/p/1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      success: true,
      prototype: { id: "proto-1", title: "Landing page", v0_url: "https://v0.app/p/1" },
      message: "Prototype URL updated successfully",
    })

    const query = supabaseMock.findQuery((q) => q.table === "prototypes")
    expect(query?.action).toBe("update")
    expect(query?.payload.v0_url).toBe("https://v0.app/p/1")
    expect(query?.payload.updated_at).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(query?.payload.updated_at))).toBe(false)
    expect(query?.chain).toContainEqual({ method: "eq", args: ["id", "proto-1"] })
  })

  it("returns 500 when the database update fails", async () => {
    supabaseMock.onTable("prototypes", () => ({ data: null, error: { message: "boom" } }))

    const res = await updateUrl(request({ prototypeId: "proto-1", newUrl: "https://v0.app/p/1" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to update prototype URL" })
  })

  it("returns 500 for a malformed JSON body", async () => {
    const res = await updateUrl(request("{not json"))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
  })
})

describe("POST /api/prototypes/update-project", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 400 when prototypeId is missing", async () => {
    const res = await updateProject(request({ v0ProjectId: "proj-1" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "prototypeId is required" })
    expect(supabaseMock.queries).toHaveLength(0)
  })

  it("only writes the fields that were provided", async () => {
    supabaseMock.onTable("prototypes", () => ({
      data: { id: "proto-1", v0_project_id: "proj-1" },
      error: null,
    }))

    const res = await updateProject(request({ prototypeId: "proto-1", v0ProjectId: "proj-1" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toBe("Prototype project details updated successfully")

    const query = supabaseMock.findQuery((q) => q.table === "prototypes")
    expect(Object.keys(query?.payload).sort()).toEqual(["updated_at", "v0_project_id"])
    expect(query?.payload.v0_project_id).toBe("proj-1")
    expect(query?.payload.v0_url).toBeUndefined()
  })

  it("writes the url when it is provided", async () => {
    supabaseMock.onTable("prototypes", () => ({
      data: { id: "proto-1", v0_project_id: "proj-1", v0_url: "https://v0.app/p/1" },
      error: null,
    }))

    const res = await updateProject(
      request({ prototypeId: "proto-1", v0ProjectId: "proj-1", v0Url: "https://v0.app/p/1" }),
    )

    expect(res.status).toBe(200)
    const query = supabaseMock.findQuery((q) => q.table === "prototypes")
    expect(query?.payload).toMatchObject({
      v0_project_id: "proj-1",
      v0_url: "https://v0.app/p/1",
    })
  })

  it("returns 500 when the database update fails", async () => {
    supabaseMock.onTable("prototypes", () => ({ data: null, error: { message: "boom" } }))

    const res = await updateProject(request({ prototypeId: "proto-1", v0ProjectId: "proj-1" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to update prototype project details" })
  })

  it("returns 500 for a malformed JSON body", async () => {
    const res = await updateProject(request("{not json"))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
  })
})
