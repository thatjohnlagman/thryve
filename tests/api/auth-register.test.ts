import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("../helpers/supabase-mock")
  return { supabase: supabaseMock.client, createClient: () => supabaseMock.client }
})

import { supabaseMock } from "../helpers/supabase-mock"
import { POST } from "@/app/api/auth/register/route"

const validBody = {
  email: "ada@example.com",
  password: "supersecret",
  firstName: "Ada",
  lastName: "Lovelace",
  department: "engineering",
}

function registerRequest(body: unknown) {
  const payload = typeof body === "string" ? body : JSON.stringify(body)
  return new NextRequest("http://localhost/api/auth/register", { method: "POST", body: payload })
}

describe("POST /api/auth/register", () => {
  beforeEach(() => supabaseMock.reset())

  it.each([
    ["email", { ...validBody, email: undefined }],
    ["password", { ...validBody, password: undefined }],
    ["firstName", { ...validBody, firstName: undefined }],
    ["lastName", { ...validBody, lastName: undefined }],
    ["department", { ...validBody, department: undefined }],
  ])("returns 400 when %s is missing", async (_field, body) => {
    const res = await POST(registerRequest(body))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "All fields are required" })
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it("returns 400 for a malformed email", async () => {
    const res = await POST(registerRequest({ ...validBody, email: "not-an-email" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid email format" })
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it("returns 400 for a password shorter than 6 characters", async () => {
    const res = await POST(registerRequest({ ...validBody, password: "abc" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Password must be at least 6 characters long" })
  })

  it("returns 400 for an unknown department", async () => {
    const res = await POST(registerRequest({ ...validBody, department: "accounting" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid department" })
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it("registers the user with metadata and returns the session when auto-confirmed", async () => {
    const user = { id: "user-1", email: "ada@example.com" }
    const session = { access_token: "tok", token_type: "bearer" }
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user, session }, error: null })

    const res = await POST(registerRequest(validBody))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Registration successful!")
    expect(body.user).toEqual({ id: "user-1", email: "ada@example.com", emailConfirmed: true })
    expect(body.session).toEqual(session)

    expect(supabaseMock.auth.signUp).toHaveBeenCalledTimes(1)
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "supersecret",
      options: {
        data: { first_name: "Ada", last_name: "Lovelace", department: "engineering" },
      },
    })
  })

  it("asks the user to confirm their email when Supabase returns no session", async () => {
    const user = { id: "user-2", email: "ada@example.com" }
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null })

    const res = await POST(registerRequest(validBody))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toContain("check your email")
    expect(body.user.emailConfirmed).toBe(false)
    expect(body.session).toBeUndefined()
  })

  it("maps a Supabase error to a 400", async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    })

    const res = await POST(registerRequest(validBody))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "User already registered" })
  })

  it("returns 400 when Supabase reports success but creates no user", async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    const res = await POST(registerRequest(validBody))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Registration failed - no user created" })
  })

  it("returns 500 for a malformed JSON body", async () => {
    const res = await POST(registerRequest("{not json"))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled()
  })

  it("returns 500 when Supabase throws unexpectedly", async () => {
    supabaseMock.auth.signUp.mockRejectedValue(new Error("network down"))

    const res = await POST(registerRequest(validBody))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Internal server error" })
  })
})
