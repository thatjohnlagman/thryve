import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { GET, POST } from "@/app/api/teams-simple/route"

function postRequest(body: unknown) {
  const payload = typeof body === "string" ? body : JSON.stringify(body)
  return new NextRequest("http://localhost/api/teams-simple", { method: "POST", body: payload })
}

describe("GET /api/teams-simple", () => {
  it("returns a static hint message", async () => {
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toContain("Teams simple API")
  })
})

describe("POST /api/teams-simple", () => {
  it("echoes the requested action", async () => {
    const res = await POST(postRequest({ action: "createTeam", name: "Alpha" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: "Teams action: createTeam", success: true })
  })

  it("returns 500 for a malformed JSON body", async () => {
    const res = await POST(postRequest("{not json"))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to process request" })
  })
})
