import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { POST } from "@/app/api/auth/logout/route"

function logoutRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/auth/logout", { method: "POST", headers })
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 401 when the authorization header is missing", async () => {
    const res = await POST(logoutRequest())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "No valid session found" })
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled()
  })

  it("returns 401 when the authorization header is not a Bearer token", async () => {
    const res = await POST(logoutRequest({ authorization: "Basic abc" }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "No valid session found" })
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled()
  })

  it("returns 400 when Supabase signOut fails", async () => {
    supabaseMock.auth.signOut.mockResolvedValue({ error: { message: "session not found" } })

    const res = await POST(logoutRequest({ authorization: "Bearer tok" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "session not found" })
  })

  it("logs out successfully with a Bearer token", async () => {
    supabaseMock.auth.signOut.mockResolvedValue({ error: null })

    const res = await POST(logoutRequest({ authorization: "Bearer tok" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: "Logout successful!" })
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it("returns 500 when signing out throws", async () => {
    supabaseMock.auth.signOut.mockRejectedValue(new Error("boom"))

    const res = await POST(logoutRequest({ authorization: "Bearer tok" }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
  })
})
