import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { POST } from "@/app/api/auth/login/route"

const credentials = { email: "ada@example.com", password: "supersecret" }

function loginRequest(body: unknown) {
  const payload = typeof body === "string" ? body : JSON.stringify(body)
  return new NextRequest("http://localhost/api/auth/login", { method: "POST", body: payload })
}

describe("POST /api/auth/login", () => {
  beforeEach(() => supabaseMock.reset())

  it("returns 400 when email or password is missing", async () => {
    const noEmail = await POST(loginRequest({ password: "x" }))
    expect(noEmail.status).toBe(400)
    expect(await noEmail.json()).toEqual({ error: "Email and password are required" })

    const noPassword = await POST(loginRequest({ email: "a@b.co" }))
    expect(noPassword.status).toBe(400)
    expect(await noPassword.json()).toEqual({ error: "Email and password are required" })

    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("returns 400 for a malformed email without calling Supabase", async () => {
    const res = await POST(loginRequest({ ...credentials, email: "nope" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid email format" })
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("returns 401 for invalid credentials", async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    })

    const res = await POST(loginRequest(credentials))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Invalid email or password" })
  })

  it("returns 401 when the email is not confirmed", async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email not confirmed" },
    })

    const res = await POST(loginRequest(credentials))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: "Please confirm your email address before signing in",
    })
  })

  it("passes through other Supabase errors as 400", async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Too many requests" },
    })

    const res = await POST(loginRequest(credentials))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Too many requests" })
  })

  it("returns 400 when Supabase returns no user or session", async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    })

    const res = await POST(loginRequest(credentials))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Login failed - invalid response" })
  })

  it("logs the user in and attaches their profile", async () => {
    const user = { id: "user-1", email: "ada@example.com", email_confirmed_at: "2025-01-01T00:00:00Z" }
    const session = { access_token: "tok" }
    const profile = { id: "user-1", first_name: "Ada", last_name: "Lovelace" }
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
    supabaseMock.onTable("profiles", () => ({ data: profile, error: null }))

    const res = await POST(loginRequest(credentials))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Login successful!")
    expect(body.user).toEqual({
      id: "user-1",
      email: "ada@example.com",
      emailConfirmed: true,
      profile,
    })
    expect(body.session).toEqual(session)

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith(credentials)
    const profileQuery = supabaseMock.findQuery((q) => q.table === "profiles")
    expect(profileQuery?.chain).toContainEqual({ method: "eq", args: ["id", "user-1"] })
  })

  it("still logs the user in when the profile row is missing", async () => {
    const user = { id: "user-1", email: "ada@example.com", email_confirmed_at: null }
    const session = { access_token: "tok" }
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: { user, session }, error: null })
    supabaseMock.onTable("profiles", () => ({ data: null, error: { message: "PGRST116" } }))

    const res = await POST(loginRequest(credentials))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.profile).toBeNull()
    expect(body.user.emailConfirmed).toBe(false)
  })

  it("returns 500 for a malformed JSON body", async () => {
    const res = await POST(loginRequest("{not json"))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
  })

  it("returns 500 when Supabase throws unexpectedly", async () => {
    supabaseMock.auth.signInWithPassword.mockRejectedValue(new Error("network down"))

    const res = await POST(loginRequest(credentials))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
  })
})
