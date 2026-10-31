import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { POST } from "@/app/api/ai-chat/trends/route"

const user = { id: "user-1", email: "ada@example.com" }

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ai-chat/trends", { method: "POST", body: JSON.stringify(body) })
}

/** Stub of the Gemini REST endpoint used by generateAIResponseWithHistory. */
function stubGemini(text = "AI reply") {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

/**
 * Registers ai_messages handlers: the single-row context lookup (when present)
 * wins over the plain history/list select; inserts always succeed.
 */
function registerMessages({
  context = null as any,
  list = [] as any[],
  insertError = null as any,
}: {
  context?: any
  list?: any[]
  insertError?: any
} = {}) {
  supabaseMock.onTable(
    "ai_messages",
    () => (context ? { data: context, error: null } : { data: null, error: { message: "PGRST116" } }),
    (ctx) => ctx.action === "select" && ctx.single,
  )
  supabaseMock.onTable(
    "ai_messages",
    () => ({ data: list, error: null }),
    (ctx) => ctx.action === "select",
  )
  supabaseMock.onTable(
    "ai_messages",
    () => ({ data: null, error: insertError }),
    (ctx) => ctx.action === "insert",
  )
}

beforeEach(() => {
  supabaseMock.reset()
  vi.stubEnv("GEMINI_API_KEY", "test-key")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("POST /api/ai-chat/trends", () => {
  it("returns 401 when there is no authenticated user", async () => {
    supabaseMock.setUser(null, { message: "no session" })

    const res = await POST(postRequest({ action: "get_conversations" }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 for an unknown action", async () => {
    supabaseMock.setUser(user)

    const res = await POST(postRequest({ action: "dance" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid action" })
  })

  describe("create_chat", () => {
    it("stores the user message, the AI reply, and returns the conversation id", async () => {
      supabaseMock.setUser(user)
      registerMessages()
      stubGemini("Hello there")

      const res = await POST(postRequest({ action: "create_chat", first_message: "Hi Yve" }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({ conversationId: expect.any(String), response: "Hello there", success: true })

      const inserts = supabaseMock.queries.filter((q) => q.table === "ai_messages" && q.action === "insert")
      expect(inserts).toHaveLength(2)
      expect(inserts[0].payload).toMatchObject({
        conversation_id: body.conversationId,
        user_id: "user-1",
        context_type: "general",
        context_id: null,
        content: "Hi Yve",
        message_type: "user",
      })
      expect(inserts[1].payload).toMatchObject({ content: "Hello there", message_type: "bot" })
    })

    it("loads trend context before answering", async () => {
      supabaseMock.setUser(user)
      registerMessages()
      supabaseMock.onTable("trends", () => ({
        data: { id: "trend-1", title: "AI agents", category: "Fintech" },
        error: null,
      }))
      stubGemini()

      const res = await POST(
        postRequest({
          action: "create_chat",
          first_message: "Tell me more",
          context_type: "trend",
          context_id: "trend-1",
        }),
      )

      expect(res.status).toBe(200)
      const trendQuery = supabaseMock.findQuery((q) => q.table === "trends")
      expect(trendQuery?.chain).toContainEqual({ method: "eq", args: ["id", "trend-1"] })
    })

    it("returns 500 when the first message cannot be stored", async () => {
      supabaseMock.setUser(user)
      registerMessages({ insertError: { message: "denied" } })
      stubGemini()

      const res = await POST(postRequest({ action: "create_chat", first_message: "Hi" }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: "Failed to add message" })
    })

    it("returns 500 when the AI reply cannot be stored", async () => {
      supabaseMock.setUser(user)
      // First insert succeeds, second fails.
      let insertCount = 0
      supabaseMock.onTable("ai_messages", () => {
        insertCount++
        return { data: null, error: insertCount > 1 ? { message: "denied" } : null }
      })
      stubGemini()

      const res = await POST(postRequest({ action: "create_chat", first_message: "Hi" }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: "Failed to add AI response" })
    })
  })

  describe("send_message", () => {
    it("returns 404 for a conversation the user does not own", async () => {
      supabaseMock.setUser(user)
      registerMessages({ context: null })

      const res = await POST(postRequest({ action: "send_message", conversation_id: "conv-1", message: "hi" }))

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: "Conversation not found" })
    })

    it("appends to the existing conversation with its trend context", async () => {
      supabaseMock.setUser(user)
      registerMessages({
        context: { context_type: "trend", context_id: "trend-1" },
        list: [
          { content: "earlier question", message_type: "user", created_at: "2026-01-01T10:00:00Z" },
          { content: "earlier answer", message_type: "bot", created_at: "2026-01-01T10:01:00Z" },
        ],
      })
      supabaseMock.onTable("trends", () => ({ data: { id: "trend-1", title: "AI agents" }, error: null }))
      stubGemini("Continuing")

      const res = await POST(
        postRequest({ action: "send_message", conversation_id: "conv-1", message: "go on" }),
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ response: "Continuing", success: true })

      const historyQuery = supabaseMock.queries.find(
        (q) =>
          q.table === "ai_messages" &&
          q.action === "select" &&
          !q.single &&
          q.chain.some((c) => c.method === "order"),
      )
      expect(historyQuery?.chain).toContainEqual({ method: "eq", args: ["conversation_id", "conv-1"] })
      expect(historyQuery?.chain).toContainEqual({ method: "eq", args: ["user_id", "user-1"] })
      expect(historyQuery?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: true }] })

      const inserts = supabaseMock.queries.filter((q) => q.table === "ai_messages" && q.action === "insert")
      expect(inserts[0].payload).toMatchObject({
        conversation_id: "conv-1",
        context_type: "trend",
        context_id: "trend-1",
        content: "go on",
        message_type: "user",
      })
      expect(inserts[1].payload).toMatchObject({ content: "Continuing", message_type: "bot" })
    })

    it("returns 500 when the conversation history cannot be loaded", async () => {
      supabaseMock.setUser(user)
      supabaseMock.onTable(
        "ai_messages",
        () => ({ data: { context_type: "general", context_id: null }, error: null }),
        (ctx) => ctx.action === "select" && ctx.single,
      )
      supabaseMock.onTable(
        "ai_messages",
        () => ({ data: null, error: { message: "boom" } }),
        (ctx) => ctx.action === "select",
      )

      const res = await POST(postRequest({ action: "send_message", conversation_id: "conv-1", message: "hi" }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: "Failed to get conversation history" })
    })
  })

  describe("get_conversations", () => {
    it("groups messages by conversation with titles, counts and latest message", async () => {
      supabaseMock.setUser(user)
      const longTitle = "x".repeat(60)
      registerMessages({
        list: [
          { conversation_id: "conv-1", context_type: "trend", context_id: "t1", content: longTitle, created_at: "2026-01-01T10:00:00Z" },
          { conversation_id: "conv-1", context_type: "trend", context_id: "t1", content: "later message", created_at: "2026-01-01T11:00:00Z" },
          { conversation_id: "conv-2", context_type: "general", context_id: null, content: "other chat", created_at: "2026-01-02T09:00:00Z" },
        ],
      })

      const res = await POST(postRequest({ action: "get_conversations" }))

      expect(res.status).toBe(200)
      const { conversations } = await res.json()
      expect(conversations).toHaveLength(2)

      const conv1 = conversations.find((c: any) => c.id === "conv-1")
      expect(conv1).toMatchObject({
        context_type: "trend",
        context_id: "t1",
        title: "x".repeat(50) + "...",
        lastMessage: "later message",
        timestamp: "2026-01-01T11:00:00Z",
        messageCount: 2,
      })

      expect(conversations.find((c: any) => c.id === "conv-2")).toMatchObject({
        title: "other chat",
        messageCount: 1,
      })

      // Conversations are always scoped to the authenticated user.
      const listQuery = supabaseMock.findQuery((q) => q.table === "ai_messages" && q.action === "select" && !q.single)
      expect(listQuery?.chain).toContainEqual({ method: "eq", args: ["user_id", "user-1"] })
    })

    it("truncates short titles without ellipsis", async () => {
      supabaseMock.setUser(user)
      registerMessages({
        list: [{ conversation_id: "conv-1", context_type: "general", context_id: null, content: "short", created_at: "2026-01-01T10:00:00Z" }],
      })

      const res = await POST(postRequest({ action: "get_conversations" }))

      expect((await res.json()).conversations[0].title).toBe("short")
    })
  })

  describe("get_messages", () => {
    it("returns the conversation's messages for the owner", async () => {
      supabaseMock.setUser(user)
      registerMessages({
        list: [{ id: "msg-1", content: "hello", message_type: "user", created_at: "2026-01-01T10:00:00Z" }],
      })

      const res = await POST(postRequest({ action: "get_messages", conversation_id: "conv-1" }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        messages: [{ id: "msg-1", content: "hello", message_type: "user", created_at: "2026-01-01T10:00:00Z" }],
      })

      const query = supabaseMock.findQuery((q) => q.table === "ai_messages" && q.action === "select" && !q.single)
      expect(query?.chain).toContainEqual({ method: "eq", args: ["conversation_id", "conv-1"] })
      expect(query?.chain).toContainEqual({ method: "eq", args: ["user_id", "user-1"] })
    })

    it("returns 500 when the query fails", async () => {
      supabaseMock.setUser(user)
      supabaseMock.onTable(
        "ai_messages",
        () => ({ data: null, error: { message: "boom" } }),
        (ctx) => ctx.action === "select",
      )

      const res = await POST(postRequest({ action: "get_messages", conversation_id: "conv-1" }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: "Failed to get messages" })
    })
  })

  describe("delete_conversation", () => {
    it("deletes only the caller's messages in that conversation", async () => {
      supabaseMock.setUser(user)
      supabaseMock.onTable("ai_messages", () => ({ data: null, error: null }), (ctx) => ctx.action === "delete")

      const res = await POST(postRequest({ action: "delete_conversation", conversation_id: "conv-1" }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true })

      const del = supabaseMock.findQuery((q) => q.table === "ai_messages" && q.action === "delete")
      expect(del?.chain).toContainEqual({ method: "eq", args: ["conversation_id", "conv-1"] })
      expect(del?.chain).toContainEqual({ method: "eq", args: ["user_id", "user-1"] })
    })

    it("returns 500 when the delete fails", async () => {
      supabaseMock.setUser(user)
      supabaseMock.onTable(
        "ai_messages",
        () => ({ data: null, error: { message: "boom" } }),
        (ctx) => ctx.action === "delete",
      )

      const res = await POST(postRequest({ action: "delete_conversation", conversation_id: "conv-1" }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: "Failed to delete conversation" })
    })
  })
})
