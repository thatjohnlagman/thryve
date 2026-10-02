import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { GET, POST } from "@/app/api/teams/route"

const user = { id: "user-1", email: "ada@example.com" }

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/teams", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function registerMembershipHandlers({
  memberships = [],
  members = [],
  membershipsError = null,
}: {
  memberships?: any[]
  members?: any[]
  membershipsError?: any
} = {}) {
  supabaseMock.onTable(
    "team_members",
    () => ({ data: memberships, error: membershipsError }),
    (ctx) => ctx.selectArg === "team_id, role, avatar",
  )
  supabaseMock.onTable(
    "team_members",
    () => ({ data: members, error: null }),
    (ctx) => ctx.selectArg === "team_id, avatar, user_id",
  )
}

describe("GET /api/teams", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await GET()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(supabaseMock.queries).toHaveLength(0)
  })

  it("returns an empty list when the user has no team memberships", async () => {
    supabaseMock.setUser(user)
    registerMembershipHandlers({ memberships: [] })

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ teams: [] })
  })

  it("returns 500 when membership lookup fails", async () => {
    supabaseMock.setUser(user)
    registerMembershipHandlers({ membershipsError: { message: "boom" } })

    const res = await GET()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to fetch team memberships" })
  })

  it("returns 500 when the teams lookup fails", async () => {
    supabaseMock.setUser(user)
    registerMembershipHandlers({ memberships: [{ team_id: "team-1", role: "Team Lead", avatar: "A" }] })
    supabaseMock.onTable("teams", () => ({ data: null, error: { message: "boom" } }))

    const res = await GET()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to fetch teams" })
  })

  it("only queries teams the user belongs to", async () => {
    supabaseMock.setUser(user)
    registerMembershipHandlers({ memberships: [{ team_id: "team-1", role: "Team Lead", avatar: "A" }] })
    supabaseMock.onTable("teams", () => ({
      data: [{ id: "team-1", name: "Alpha", description: "d", tag: "t", color: "c", invite_code: "INV1" }],
      error: null,
    }))

    const res = await GET()

    expect(res.status).toBe(200)
    const teamQuery = supabaseMock.findQuery((q) => q.table === "teams")
    expect(teamQuery?.chain).toContainEqual({ method: "in", args: ["id", ["team-1"]] })

    const allMembers = supabaseMock.findQuery(
      (q) => q.table === "team_members" && q.selectArg === "team_id, avatar, user_id",
    )
    expect(allMembers?.chain).toContainEqual({ method: "in", args: ["team_id", ["team-1"]] })
    expect(allMembers?.chain).toContainEqual({ method: "eq", args: ["is_active", true] })
  })

  it("formats teams with member avatars and counts", async () => {
    supabaseMock.setUser(user)
    registerMembershipHandlers({
      memberships: [{ team_id: "team-1", role: "Team Lead", avatar: "A" }],
      members: [
        { team_id: "team-1", avatar: "A", user_id: "user-1" },
        { team_id: "team-1", avatar: null, user_id: "user-2" },
        { team_id: "team-1", avatar: "C", user_id: "user-3" },
        { team_id: "team-1", avatar: "D", user_id: "user-4" },
      ],
    })
    supabaseMock.onTable("teams", () => ({
      data: [{ id: "team-1", name: "Alpha", description: "desc", tag: "core", color: "bg-red", invite_code: "INV1" }],
      error: null,
    }))

    const res = await GET()

    expect(res.status).toBe(200)
    const { teams } = await res.json()
    expect(teams).toHaveLength(1)
    expect(teams[0]).toEqual({
      id: "team-1",
      name: "Alpha",
      description: "desc",
      tag: "core",
      color: "bg-red",
      inviteCode: "INV1",
      // only the first three avatars, null falls back to "U"
      memberAvatars: ["A", "U", "C"],
      member_count: 4,
    })
  })

  it("still returns teams when the member avatars query fails", async () => {
    supabaseMock.setUser(user)
    registerMembershipHandlers({ memberships: [{ team_id: "team-1", role: "Team Lead", avatar: "A" }] })
    supabaseMock.onTable("teams", () => ({
      data: [{ id: "team-1", name: "Alpha", invite_code: "INV1" }],
      error: null,
    }))
    supabaseMock.onTable(
      "team_members",
      () => ({ data: null, error: { message: "boom" } }),
      (ctx) => ctx.selectArg === "team_id, avatar, user_id",
    )

    const res = await GET()

    expect(res.status).toBe(200)
    const { teams } = await res.json()
    expect(teams[0].memberAvatars).toEqual([])
    expect(teams[0].member_count).toBe(0)
  })
})

describe("POST /api/teams", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await POST(postRequest({ name: "Alpha" }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 when the team name is missing or blank", async () => {
    supabaseMock.setUser(user)

    const missing = await POST(postRequest({ description: "d" }))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: "Team name is required" })

    const blank = await POST(postRequest({ name: "   " }))
    expect(blank.status).toBe(400)

    expect(supabaseMock.rpcCalls).toHaveLength(0)
  })

  it("creates a team plus the owner membership", async () => {
    supabaseMock.setUser(user)
    supabaseMock.mockRpc("INV-123")
    supabaseMock.onTable("teams", () => ({
      data: {
        id: "team-1",
        name: "Alpha",
        description: "My team",
        tag: null,
        color: "bg-gradient-to-br from-red-500 to-red-600",
        invite_code: "INV-123",
      },
      error: null,
    }))
    supabaseMock.onTable("team_members", () => ({ data: null, error: null }))

    const res = await POST(postRequest({ name: "  Alpha  ", description: "  My team  " }))

    expect(res.status).toBe(200)
    const { team } = await res.json()
    expect(team).toMatchObject({
      id: "team-1",
      name: "Alpha",
      description: "My team",
      inviteCode: "INV-123",
      member_count: 1,
      memberAvatars: ["A"],
    })

    expect(supabaseMock.rpcCalls[0]).toEqual({ fn: "generate_team_invite_code", args: [] })

    const teamInsert = supabaseMock.findQuery((q) => q.table === "teams" && q.action === "insert")
    expect(teamInsert?.payload).toMatchObject({
      name: "Alpha",
      description: "My team",
      invite_code: "INV-123",
      created_by: "user-1",
    })
    expect(teamInsert?.payload.color).toMatch(/^bg-gradient-to-br/)

    const memberInsert = supabaseMock.findQuery((q) => q.table === "team_members" && q.action === "insert")
    expect(memberInsert?.payload).toEqual({
      team_id: "team-1",
      user_id: "user-1",
      role: "Team Lead",
      avatar: "A",
    })
  })

  it("defaults the description when none is provided", async () => {
    supabaseMock.setUser(user)
    supabaseMock.mockRpc("INV-123")
    supabaseMock.onTable("teams", () => ({ data: { id: "team-1", name: "Alpha" }, error: null }))
    supabaseMock.onTable("team_members", () => ({ data: null, error: null }))

    const res = await POST(postRequest({ name: "Alpha" }))

    expect(res.status).toBe(200)
    const teamInsert = supabaseMock.findQuery((q) => q.table === "teams" && q.action === "insert")
    expect(teamInsert?.payload.description).toBe("Team Description")
  })

  it("returns 500 when the team insert fails", async () => {
    supabaseMock.setUser(user)
    supabaseMock.mockRpc("INV-123")
    supabaseMock.onTable("teams", () => ({ data: null, error: { message: "boom" } }))

    const res = await POST(postRequest({ name: "Alpha" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to create team" })
  })

  it("returns 500 when the owner membership insert fails", async () => {
    supabaseMock.setUser(user)
    supabaseMock.mockRpc("INV-123")
    supabaseMock.onTable("teams", () => ({ data: { id: "team-1", name: "Alpha" }, error: null }))
    supabaseMock.onTable("team_members", () => ({ data: null, error: { message: "boom" } }))

    const res = await POST(postRequest({ name: "Alpha" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to add team member" })
  })
})
