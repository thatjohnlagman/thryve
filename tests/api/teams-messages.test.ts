import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { GET, POST } from "@/app/api/teams/[id]/messages/route"

const user = { id: "user-1", email: "ada@example.com" }
const params = { id: "team-1" }

function request(url = "http://localhost/api/teams/team-1/messages", body?: unknown, method = "GET") {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function registerHandlers({
  membership,
  messages = [],
  messagesError = null,
  newMessage = null,
  insertError = null,
}: {
  membership?: any
  messages?: any[]
  messagesError?: any
  newMessage?: any
  insertError?: any
} = {}) {
  supabaseMock.onTable(
    "team_members",
    () => (membership ? { data: membership, error: null } : { data: null, error: { message: "PGRST116" } }),
    (ctx) => ctx.single,
  )
  supabaseMock.onTable(
    "team_chat_messages",
    (ctx) =>
      ctx.action === "select" ? { data: messages, error: messagesError } : { data: newMessage, error: insertError },
  )
}

describe("GET /api/teams/[id]/messages", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await GET(request(), { params })

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 403 for non-members and never reads messages", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null })

    const res = await GET(request(), { params })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Not a team member" })
    expect(supabaseMock.findQuery((q) => q.table === "team_chat_messages")).toBeUndefined()
  })

  it("verifies active membership for the requesting user", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, messages: [] })

    await GET(request(), { params })

    const membershipQuery = supabaseMock.findQuery((q) => q.table === "team_members")
    expect(membershipQuery?.chain).toContainEqual({ method: "eq", args: ["team_id", "team-1"] })
    expect(membershipQuery?.chain).toContainEqual({ method: "eq", args: ["user_id", "user-1"] })
    expect(membershipQuery?.chain).toContainEqual({ method: "eq", args: ["is_active", true] })
  })

  it("returns messages oldest-first with author names and ownership flags", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      messages: [
        {
          id: "msg-2",
          user_id: "user-2",
          message: "second",
          created_at: "2026-01-01T10:05:00Z",
          profiles: { first_name: "Ben", last_name: "Reyes" },
        },
        {
          id: "msg-1",
          user_id: "user-1",
          message: "first",
          created_at: "2026-01-01T10:00:00Z",
          profiles: { first_name: "Ada", last_name: "Cruz" },
        },
      ],
    })

    const res = await GET(request(), { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toHaveLength(2)

    // The route reverses the descending query so clients get oldest-first.
    expect(body.messages.map((m: any) => m.id)).toEqual(["msg-1", "msg-2"])
    expect(body.messages[0]).toMatchObject({
      user: "Ada Cruz",
      message: "first",
      isUser: true,
      created_at: "2026-01-01T10:00:00Z",
    })
    // Locale/timezone dependent; just prove a time string came back.
    expect(body.messages[0].timestamp).toContain(":")
    expect(body.messages[1]).toMatchObject({ user: "Ben Reyes", isUser: false })
  })

  it("falls back to 'Unknown User' when the profile join is empty", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      messages: [
        { id: "msg-1", user_id: "user-x", message: "hi", created_at: "2026-01-01T10:00:00Z", profiles: null },
      ],
    })

    const res = await GET(request(), { params })

    const body = await res.json()
    expect(body.messages[0].user).toBe("Unknown User")
  })

  it("applies limit/offset pagination via a range query", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, messages: [] })

    await GET(request("http://localhost/api/teams/team-1/messages?limit=10&offset=20"), { params })

    const query = supabaseMock.findQuery((q) => q.table === "team_chat_messages")
    expect(query?.chain).toContainEqual({ method: "eq", args: ["team_id", "team-1"] })
    expect(query?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] })
    expect(query?.chain).toContainEqual({ method: "range", args: [20, 29] })
  })

  it("defaults to the first 50 messages", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, messages: [] })

    await GET(request(), { params })

    const query = supabaseMock.findQuery((q) => q.table === "team_chat_messages")
    expect(query?.chain).toContainEqual({ method: "range", args: [0, 49] })
  })

  it("returns 500 when the messages query fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, messagesError: { message: "boom" } })

    const res = await GET(request(), { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to fetch messages" })
  })
})

describe("POST /api/teams/[id]/messages", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await POST(request(undefined, { message: "hi" }, "POST"), { params })

    expect(res.status).toBe(401)
  })

  it("rejects a blank message before checking membership", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" } })

    const res = await POST(request(undefined, { message: "   " }, "POST"), { params })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Message is required" })
    expect(supabaseMock.findQuery((q) => q.table === "team_members")).toBeUndefined()
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("returns 403 for non-members and never inserts", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: null })

    const res = await POST(request(undefined, { message: "hi" }, "POST"), { params })

    expect(res.status).toBe(403)
    expect(supabaseMock.findQuery((q) => q.action === "insert")).toBeUndefined()
  })

  it("inserts the trimmed message for the authenticated user", async () => {
    supabaseMock.setUser(user)
    registerHandlers({
      membership: { id: "membership-1" },
      newMessage: {
        id: "msg-1",
        user_id: "user-1",
        message: "hello team",
        created_at: "2026-01-01T10:00:00Z",
        profiles: { first_name: "Ada", last_name: "Cruz" },
      },
    })

    const res = await POST(request(undefined, { message: "  hello team  " }, "POST"), { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toMatchObject({
      id: "msg-1",
      user: "Ada Cruz",
      message: "hello team",
      isUser: true,
      created_at: "2026-01-01T10:00:00Z",
    })

    const insert = supabaseMock.findQuery((q) => q.table === "team_chat_messages" && q.action === "insert")
    expect(insert?.payload).toEqual({
      team_id: "team-1",
      user_id: "user-1",
      message: "hello team",
    })
  })

  it("returns 500 when the insert fails", async () => {
    supabaseMock.setUser(user)
    registerHandlers({ membership: { id: "membership-1" }, insertError: { message: "boom" } })

    const res = await POST(request(undefined, { message: "hi" }, "POST"), { params })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to send message" })
  })
})
