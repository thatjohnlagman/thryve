import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { GET, POST } from "@/app/api/teams/[id]/announcements/route"

const user = { id: "user-1", email: "ada@example.com" }
const params = { id: "team-1" }

function request(body?: unknown, method = "GET") {
  return new NextRequest("http://localhost/api/teams/team-1/announcements", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function registerHandlers({
  membership,
  announcements = [],
  announcementsError = null,
  created = null,
  insertError = null,
}: {
  membership?: any
  announcements?: any[]
  announcementsError?: any
  created?: any
  insertError?: any
} = {}) {
  supabaseMock.onTable(
    "team_members",
    () => (membership ? { data: membership, error: null } : { data: null, error: { message: "PGRST116" } }),
    (ctx) => ctx.single,
  )
  supabaseMock.onTable(
    "team_announcements",
    (ctx) =>
      ctx.action === "select" ? { data: announcements, error: announcementsError } : { data: created, error: insertError },
  )
}

describe("GET /api/teams/[id]/announcements", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await GET(request(), { params })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 403 for non-members and never reads announcements", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null })

    const res = await GET(request(), { params })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Not a team member" })
    expect(supabaseMock.findQuery((q) => q.table === "team_announcements")).toBeUndefined()
  })

  it("verifies active membership for the requesting user", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, announcements: [] })

    await GET(request(), { params })

    const membershipQuery = supabaseMock.findQuery((q) => q.table === "team_members")
    expect(membershipQuery?.chain).toContainEqual({ method: "eq", args: ["team_id", "team-1"] })
    expect(membershipQuery?.chain).toContainEqual({ method: "eq", args: ["user_id", "user-1"] })
    expect(membershipQuery?.chain).toContainEqual({ method: "eq", args: ["is_active", true] })
  })

  it("returns newest-first announcements with author name and avatar seed", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      announcements: [
        {
          id: "ann-1",
          title: "Ship day",
          description: "Demo at 4pm",
          created_at: "2026-01-02T09:00:00Z",
          profiles: { first_name: "ada", last_name: "cruz" },
        },
      ],
    })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.announcements).toHaveLength(1)
    expect(body.announcements[0]).toMatchObject({
      id: "ann-1",
      title: "Ship day",
      description: "Demo at 4pm",
      user: { name: "ada cruz", avatar: "A" },
    })
    expect(body.announcements[0].timestamp).toBe(new Date("2026-01-02T09:00:00Z").toLocaleString())

    const query = supabaseMock.findQuery((q) => q.table === "team_announcements")
    expect(query?.chain).toContainEqual({ method: "eq", args: ["team_id", "team-1"] })
    expect(query?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] })
  })

  it("falls back to 'Unknown User' with a generic avatar", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      announcements: [
        { id: "ann-1", title: "T", description: "D", created_at: "2026-01-02T09:00:00Z", profiles: null },
      ],
    })

    const res = await GET(request(), { params })

    const body = await res.json()
    expect(body.announcements[0].user).toEqual({ name: "Unknown User", avatar: "U" })
  })

  it("returns 500 when the query fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, announcementsError: { message: "boom" } })

    const res = await GET(request(), { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to fetch announcements" })
  })
})

describe("POST /api/teams/[id]/announcements", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await POST(request({ title: "T", description: "D" }, "POST"), { params })

    expect(res.status).toBe(401)
  })

  it("requires both title and description", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" } })

    const missingDescription = await POST(request({ title: "T", description: "  " }, "POST"), { params })
    expect(missingDescription.status).toBe(400)
    expect(await missingDescription.json()).toEqual({ error: "Title and description are required" })

    const missingTitle = await POST(request({ description: "D" }, "POST"), { params })
    expect(missingTitle.status).toBe(400)

    expect(supabaseMock.findQuery((q) => q.table === "team_members")).toBeUndefined()
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("returns 403 for non-members and never inserts", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null })

    const res = await POST(request({ title: "T", description: "D" }, "POST"), { params })

    expect(res.status).toBe(403)
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("inserts the trimmed announcement for the authenticated user", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      created: {
        id: "ann-1",
        title: "Ship day",
        description: "Demo at 4pm",
        created_at: "2026-01-02T09:00:00Z",
        profiles: { first_name: "Ada", last_name: "Cruz" },
      },
    })

    const res = await POST(request({ title: "  Ship day ", description: " Demo at 4pm " }, "POST"), { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.announcement).toMatchObject({
      id: "ann-1",
      title: "Ship day",
      description: "Demo at 4pm",
      user: { name: "Ada Cruz", avatar: "A" },
      timestamp: "Just now",
    })

    const insert = supabaseMock.findQuery((q) => q.table === "team_announcements" && q.action === "insert")
    expect(insert?.payload).toEqual({
      team_id: "team-1",
      user_id: "user-1",
      title: "Ship day",
      description: "Demo at 4pm",
    })
  })

  it("returns 500 when the insert fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, insertError: { message: "boom" } })

    const res = await POST(request({ title: "T", description: "D" }, "POST"), { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to create announcement" })
  })
})
