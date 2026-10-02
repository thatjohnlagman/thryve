import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { POST } from "@/app/api/teams/join/route"

const user = { id: "user-1", email: "ada@example.com" }
const team = { id: "team-1", name: "Alpha", description: "d", tag: "t", color: "c", invite_code: "ABC123" }

function joinRequest(body: unknown) {
  return new NextRequest("http://localhost/api/teams/join", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

describe("POST /api/teams/join", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await POST(joinRequest({ teamCode: "ABC123" }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(supabaseMock.queries).toHaveLength(0)
  })

  it("returns 400 when the team code is missing or blank", async () => {
    supabaseMock.setUser(user)

    const missing = await POST(joinRequest({}))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: "Team code is required" })

    const blank = await POST(joinRequest({ teamCode: "  " }))
    expect(blank.status).toBe(400)
  })

  it("looks the team up case-insensitively and 404s on an unknown code", async () => {
    supabaseMock.setUser(user)
    supabaseMock.onTable("teams", () => ({ data: null, error: { message: "no rows" } }))

    const res = await POST(joinRequest({ teamCode: "abc123" }))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Invalid team code" })

    const teamQuery = supabaseMock.findQuery((q) => q.table === "teams")
    expect(teamQuery?.chain).toContainEqual({ method: "eq", args: ["invite_code", "ABC123"] })
  })

  it("rejects a user who is already an active member", async () => {
    supabaseMock.setUser(user)
    supabaseMock.onTable("teams", () => ({ data: team, error: null }))
    supabaseMock.onTable("team_members", () => ({
      data: { id: "membership-1", is_active: true },
      error: null,
    }))

    const res = await POST(joinRequest({ teamCode: "ABC123" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "You are already a member of this team" })
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("reactivates a previously inactive membership", async () => {
    supabaseMock.setUser(user)
    supabaseMock.onTable("teams", () => ({ data: team, error: null }))
    supabaseMock.onTable("team_members", () => ({
      data: { id: "membership-1", is_active: false },
      error: null,
    }))

    const res = await POST(joinRequest({ teamCode: "ABC123" }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Successfully joined team")
    expect(body.team).toEqual({ id: "team-1", name: "Alpha", description: "d", tag: "t", color: "c" })

    const update = supabaseMock.findQuery((q) => q.table === "team_members" && q.action === "update")
    expect(update?.payload).toMatchObject({ is_active: true })
    expect(update?.payload.joined_at).toEqual(expect.any(String))
    expect(update?.chain).toContainEqual({ method: "eq", args: ["id", "membership-1"] })
  })

  it("inserts a new membership when the user has never joined", async () => {
    supabaseMock.setUser(user)
    supabaseMock.onTable("teams", () => ({ data: team, error: null }))
    supabaseMock.onTable("team_members", () => ({ data: null, error: null }))

    const res = await POST(joinRequest({ teamCode: "ABC123" }))

    expect(res.status).toBe(200)
    const insert = supabaseMock.findQuery((q) => q.table === "team_members" && q.action === "insert")
    expect(insert?.payload).toEqual({
      team_id: "team-1",
      user_id: "user-1",
      role: "Team Member",
      avatar: "A",
    })
  })

  it("returns 500 when the membership insert fails", async () => {
    supabaseMock.setUser(user)
    supabaseMock.onTable("teams", () => ({ data: team, error: null }))
    supabaseMock.onTable(
      "team_members",
      () => ({ data: null, error: { message: "boom" } }),
      (ctx) => ctx.action === "insert",
    )

    const res = await POST(joinRequest({ teamCode: "ABC123" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to join team" })
  })

  it("returns 500 when reactivation fails", async () => {
    supabaseMock.setUser(user)
    supabaseMock.onTable("teams", () => ({ data: team, error: null }))
    supabaseMock.onTable(
      "team_members",
      (ctx) =>
        ctx.action === "update"
          ? { data: null, error: { message: "boom" } }
          : { data: { id: "membership-1", is_active: false }, error: null },
    )

    const res = await POST(joinRequest({ teamCode: "ABC123" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to rejoin team" })
  })
})
