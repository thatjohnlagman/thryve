import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { GET } from "@/app/api/teams/[id]/members/route"

const user = { id: "user-1", email: "ada@example.com" }
const params = { id: "team-1" }

function getRequest() {
  return new NextRequest("http://localhost/api/teams/team-1/members")
}

function registerHandlers({ membership, members, membersError = null }: { membership: any; members?: any; membersError?: any }) {
  supabaseMock.onTable(
    "team_members",
    () => (membership ? { data: membership, error: null } : { data: null, error: { message: "PGRST116" } }),
    (ctx) => ctx.single,
  )
  supabaseMock.onTable(
    "team_members",
    () => ({ data: members ?? [], error: membersError }),
    (ctx) => Boolean(ctx.selectArg?.includes("profiles:user_id")),
  )
}

describe("GET /api/teams/[id]/members", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await GET(getRequest(), { params })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 403 for a user who is not an active member of the team", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null, members: [] })

    const res = await GET(getRequest(), { params })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Not a team member" })

    const membershipQuery = supabaseMock.findQuery((q) => q.single)
    expect(membershipQuery?.chain).toEqual([
      { method: "eq", args: ["team_id", "team-1"] },
      { method: "eq", args: ["user_id", "user-1"] },
      { method: "eq", args: ["is_active", true] },
    ])
    expect(supabaseMock.findQuery((q) => Boolean(q.selectArg?.includes("profiles:user_id")))).toBeUndefined()
  })

  it("formats member names and avatars", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1", is_active: true },
      members: [
        { id: "m1", avatar: null, role: "Team Lead", profiles: { first_name: "Ada", last_name: "Lovelace" } },
        { id: "m2", avatar: "X", role: "Team Member", profiles: { first_name: "Grace", last_name: null } },
        { id: "m3", avatar: null, role: "Team Member", profiles: null },
        { id: "m4", avatar: null, role: "Team Member", profiles: { first_name: null, last_name: null } },
      ],
    })

    const res = await GET(getRequest(), { params })

    expect(res.status).toBe(200)
    const { members } = await res.json()
    expect(members).toEqual([
      { id: "m1", name: "Ada Lovelace", avatar: "A", role: "Team Lead" },
      { id: "m2", name: "Grace", avatar: "X", role: "Team Member" },
      { id: "m3", name: "Unknown User", avatar: "U", role: "Team Member" },
      { id: "m4", name: "Unknown User", avatar: "U", role: "Team Member" },
    ])
  })

  it("only lists active members of the requested team", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, members: [] })

    await GET(getRequest(), { params })

    const listQuery = supabaseMock.findQuery((q) => Boolean(q.selectArg?.includes("profiles:user_id")))
    expect(listQuery?.chain).toEqual([
      { method: "eq", args: ["team_id", "team-1"] },
      { method: "eq", args: ["is_active", true] },
    ])
  })

  it("returns 500 when the member list query fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      membersError: { message: "boom" },
    })

    const res = await GET(getRequest(), { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to fetch members" })
  })
})
