import { describe, expect, it } from "vitest"

import { isLoginFormComplete, isRegisterFormComplete, isValidEmail } from "@/lib/validation"

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("ana@example.com")).toBe(true)
    expect(isValidEmail("juan.delacruz+tag@sub.bank.example.co.uk")).toBe(true)
  })

  it("rejects malformed addresses", () => {
    for (const value of [
      "",
      "not-an-email",
      "missing@tld",
      "two @at.signs.com",
      "space inside@example.com",
      "trailing@example.com ",
      "@example.com",
      "user@.com",
    ]) {
      expect(isValidEmail(value), value).toBe(false)
    }
  })
})

describe("isRegisterFormComplete", () => {
  const valid = {
    firstName: "Ana",
    lastName: "Reyes",
    email: "ana@example.com",
    department: "product",
    password: "s3cret!",
    confirm: "s3cret!",
    agreed: true,
  }

  it("accepts a fully valid form", () => {
    expect(isRegisterFormComplete(valid)).toBe(true)
  })

  it("requires every field to be filled", () => {
    expect(isRegisterFormComplete({ ...valid, firstName: "  " })).toBe(false)
    expect(isRegisterFormComplete({ ...valid, lastName: "" })).toBe(false)
    expect(isRegisterFormComplete({ ...valid, email: "" })).toBe(false)
    expect(isRegisterFormComplete({ ...valid, department: "" })).toBe(false)
    expect(isRegisterFormComplete({ ...valid, password: "" })).toBe(false)
    expect(isRegisterFormComplete({ ...valid, confirm: "" })).toBe(false)
  })

  it("requires the passwords to match", () => {
    expect(isRegisterFormComplete({ ...valid, confirm: "s3cret" })).toBe(false)
  })

  it("requires a valid email", () => {
    expect(isRegisterFormComplete({ ...valid, email: "ana(at)example.com" })).toBe(false)
  })

  it("requires the terms checkbox", () => {
    expect(isRegisterFormComplete({ ...valid, agreed: false })).toBe(false)
  })
})

describe("isLoginFormComplete", () => {
  it("requires a valid email and a non-empty password", () => {
    expect(isLoginFormComplete("ana@example.com", "hunter2")).toBe(true)
  })

  it("rejects an incomplete form", () => {
    expect(isLoginFormComplete("ana@example.com", "   ")).toBe(false)
    expect(isLoginFormComplete("not-an-email", "hunter2")).toBe(false)
    expect(isLoginFormComplete("", "")).toBe(false)
  })
})
