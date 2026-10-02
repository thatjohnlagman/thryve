import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { GET, POST } from "@/app/api/teams/[id]/projects/route"
import { PATCH } from "@/app/api/teams/[id]/projects/[projectId]/route"

const user = { id: "user-1", email: "ada@example.com" }
const params = { id: "team-1" }
const projectParams = { id: "team-1", projectId: "project-1" }

function request(body?: unknown, method = "POST") {
  return new NextRequest("http://localhost/api/teams/team-1/projects", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Registers: membership lookup (`single`) then an optional outcome for the team_projects query. */
function registerHandlers({
  membership,
  projects = [],
  projectsError = null,
  createResult = { data: { id: "project-1" }, error: null },
}: {
  membership?: any
  projects?: any[]
  projectsError?: any
  createResult?: { data: any; error: any }
} = {}) {
  supabaseMock.onTable(
    "team_members",
    () => (membership ? { data: membership, error: null } : { data: null, error: { message: "PGRST116" } }),
    (ctx) => ctx.single,
  )
  supabaseMock.onTable(
    "team_projects",
    (ctx) => (ctx.action === "select" ? { data: projects, error: projectsError } : createResult),
  )
}

describe("GET /api/teams/[id]/projects", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await GET(request(undefined, "GET"), { params })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 403 for non-members", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null })

    const res = await GET(request(undefined, "GET"), { params })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Not a team member" })
    expect(supabaseMock.findQuery((q) => q.table === "team_projects")).toBeUndefined()
  })

  it("lists the team's projects newest first", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      projects: [{ id: "project-1", title: "Fix onboarding" }],
    })

    const res = await GET(request(undefined, "GET"), { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ projects: [{ id: "project-1", title: "Fix onboarding" }] })

    const query = supabaseMock.findQuery((q) => q.table === "team_projects")
    expect(query?.chain).toContainEqual({ method: "eq", args: ["team_id", "team-1"] })
    expect(query?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] })
  })

  it("returns 500 when the projects query fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, projectsError: { message: "boom" } })

    const res = await GET(request(undefined, "GET"), { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to fetch projects" })
  })
})

describe("POST /api/teams/[id]/projects", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await POST(request({ title: "Ship it" }), { params })

    expect(res.status).toBe(401)
  })

  it("returns 400 when the title is missing", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" } })

    const res = await POST(request({ title: "   " }), { params })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Title is required" })
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("returns 403 when the creator is not a team member", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null })

    const res = await POST(request({ title: "Ship it" }), { params })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Not a team member" })
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("creates a pinned project with defaults", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      createResult: {
        data: { id: "project-1", title: "Ship it", is_pinned: true },
        error: null,
      },
    })

    const res = await POST(request({ title: "  Ship it  " }), { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.project).toMatchObject({ id: "project-1", title: "Ship it", is_pinned: true })

    const insert = supabaseMock.findQuery((q) => q.table === "team_projects" && q.action === "insert")
    expect(insert?.payload).toEqual({
      team_id: "team-1",
      title: "Ship it",
      issue: "",
      reason: "",
      category: "General",
      priority: "Medium",
      url: "",
      is_pinned: true,
      created_by: "user-1",
    })
  })

  it("keeps provided optional fields", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" } })

    const res = await POST(
      request({
        title: "Ship it",
        issue: "Users drop off",
        reason: "Onboarding is confusing",
        category: "UX",
        priority: "High",
        url: "https://example.com",
      }),
      { params },
    )

    expect(res.status).toBe(200)
    const insert = supabaseMock.findQuery((q) => q.table === "team_projects" && q.action === "insert")
    expect(insert?.payload).toMatchObject({
      issue: "Users drop off",
      reason: "Onboarding is confusing",
      category: "UX",
      priority: "High",
      url: "https://example.com",
    })
  })

  it("returns 500 when the insert fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      createResult: { data: null, error: { message: "boom" } },
    })

    const res = await POST(request({ title: "Ship it" }), { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to create project" })
  })
})

describe("PATCH /api/teams/[id]/projects/[projectId]", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await PATCH(request({ is_pinned: true }, "PATCH"), { params: projectParams })

    expect(res.status).toBe(401)
  })

  it("returns 403 for non-members", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null })

    const res = await PATCH(request({ is_pinned: true }, "PATCH"), { params: projectParams })

    expect(res.status).toBe(403)
    expect(supabaseMock.findQuery((q) => q.table === "team_projects")).toBeUndefined()
  })

  it("unpins the other projects when pinning", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      createResult: { data: { id: "project-1", is_pinned: true }, error: null },
    })

    const res = await PATCH(request({ is_pinned: true }, "PATCH"), { params: projectParams })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ project: { id: "project-1", is_pinned: true } })

    const updates = supabaseMock.queries.filter((q) => q.table === "team_projects" && q.action === "update")
    expect(updates).toHaveLength(2)

    const [unpinOthers, pinTarget] = updates
    expect(unpinOthers.payload).toEqual({ is_pinned: false })
    expect(unpinOthers.chain).toContainEqual({ method: "eq", args: ["team_id", "team-1"] })
    expect(unpinOthers.chain).toContainEqual({ method: "neq", args: ["id", "project-1"] })

    expect(pinTarget.payload).toEqual({ is_pinned: true })
    expect(pinTarget.chain).toContainEqual({ method: "eq", args: ["id", "project-1"] })
    expect(pinTarget.chain).toContainEqual({ method: "eq", args: ["team_id", "team-1"] })
  })

  it("does not touch other projects when unpinning", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      createResult: { data: { id: "project-1", is_pinned: false }, error: null },
    })

    const res = await PATCH(request({ is_pinned: false }, "PATCH"), { params: projectParams })

    expect(res.status).toBe(200)
    const updates = supabaseMock.queries.filter((q) => q.table === "team_projects" && q.action === "update")
    expect(updates).toHaveLength(1)
    expect(updates[0].payload).toEqual({ is_pinned: false })
  })

  it("returns 500 when the update fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      createResult: { data: null, error: { message: "boom" } },
    })

    const res = await PATCH(request({ is_pinned: true }, "PATCH"), { params: projectParams })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to update project" })
  })
})
