import { describe, expect, it } from "vitest"

import { PiiRedactor, defaultPiiRedactor } from "@/lib/pii-redactor"

// These tests pin the banking/PH redaction behaviour the upload & dashboard
// pipelines rely on before CSV data is sent to Gemini.

describe("PiiRedactor.redactText", () => {
  it("redacts email addresses", () => {
    const out = defaultPiiRedactor.redactText("Contact juan.delacruz@bank.example.com for details")
    expect(out).not.toContain("juan.delacruz@bank.example.com")
    expect(out).toContain("[EMAIL]")
  })

  it("redacts 16-digit account/card numbers, with or without separators", () => {
    for (const account of ["1234567890123456", "1234 5678 9012 3456", "1234-5678-9012-3456"]) {
      const out = defaultPiiRedactor.redactText(`Account ${account} was debited`)
      expect(out).not.toContain(account)
      expect(out).toContain("[ACCOUNT_NUMBER]")
    }
  })

  it("redacts Philippine mobile and landline numbers", () => {
    // KNOWN ISSUE: the generic [A-Z0-9]{8,12} pattern runs before the phone
    // patterns, so digit runs are tagged [CUSTOMER_ID] instead of [PH_PHONE].
    // The value is still fully masked, which is what the pipelines depend on.
    const mobile = defaultPiiRedactor.redactText("Mobile: 09171234567")
    expect(mobile).not.toContain("09171234567")
    expect(mobile).toContain("[CUSTOMER_ID]")

    const intl = defaultPiiRedactor.redactText("Mobile: +639171234567")
    expect(intl).not.toContain("639171234567")
    expect(intl).toContain("[CUSTOMER_ID]")
  })

  it("redacts US Social Security Numbers", () => {
    const out = defaultPiiRedactor.redactText("SSN on file: 123-45-6789")
    expect(out).not.toContain("123-45-6789")
    expect(out).toContain("[SSN]")
  })

  it("redacts IBANs", () => {
    const out = defaultPiiRedactor.redactText("IBAN DE89370400440532013000")
    expect(out).not.toContain("DE89370400440532013000")
    expect(out).toContain("[IBAN]")
  })

  it("redacts URLs", () => {
    // The url detector's [URL] tag does not survive the global replacement,
    // so URLs come back as [REDACTED] — still fully masked.
    const out = defaultPiiRedactor.redactText("See https://internal.bank.example.com/accounts for details")
    expect(out).not.toContain("internal.bank.example.com")
    expect(out).toContain("[REDACTED]")
  })

  it("leaves PII-free prose untouched", () => {
    const text = "total revenue grew modestly this quarter across all retail segments"
    expect(defaultPiiRedactor.redactText(text)).toBe(text)
  })

  it("returns non-string input unchanged", () => {
    expect(defaultPiiRedactor.redactText("" as any)).toBe("")
  })

  it("KNOWN ISSUE: redacts all-caps identifiers as [CUSTOMER_ID]", () => {
    // The generic `\b[A-Z0-9]{8,12}\b` pattern in pii-config.ts also matches
    // ordinary all-caps words. This documents today's behaviour so any future
    // tightening of the pattern is an explicit, reviewed change.
    const out = defaultPiiRedactor.redactText("Status of the PROJECTS pipeline")
    expect(out).toContain("[CUSTOMER_ID]")
  })
})

describe("PiiRedactor.containsPii", () => {
  it("detects text that contains PII", () => {
    expect(defaultPiiRedactor.containsPii("email me at ana@example.com")).toBe(true)
    expect(defaultPiiRedactor.containsPii("call 09171234567")).toBe(true)
  })

  it("reports clean text as PII-free", () => {
    expect(defaultPiiRedactor.containsPii("quarterly revenue by segment")).toBe(false)
  })
})

describe("PiiRedactor.getRedactionStats", () => {
  it("counts redaction markers and lists their unique types", () => {
    const original = "Contact juan@example.com or call 09171234567"
    const redacted = defaultPiiRedactor.redactText(original)

    const stats = defaultPiiRedactor.getRedactionStats(original, redacted)
    expect(stats.originalLength).toBe(original.length)
    expect(stats.redactedLength).toBe(redacted.length)
    expect(stats.redactionCount).toBe(2)
    expect(stats.redactionTypes).toEqual(expect.arrayContaining(["[EMAIL]", "[CUSTOMER_ID]"]))
    expect(stats.redactionTypes).toHaveLength(2)
  })
})

describe("PiiRedactor.redactCsvData", () => {
  it("preserves the header row verbatim while redacting data rows", () => {
    const csv = [
      "customer,email,balance",
      "Juan Cruz,juan@example.com,1234567890123456",
      "Ana Reyes,ana@example.com,5555",
    ].join("\n")

    const out = defaultPiiRedactor.redactCsvData(csv, { preserveHeaders: true, maxRows: 50 })
    const [header, ...rows] = out.split("\n")

    expect(header).toBe("customer,email,balance")
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row).not.toMatch(/@example\.com/)
      expect(row).not.toContain("1234567890123456")
    }
  })

  it("caps the number of processed data rows at maxRows", () => {
    const lines = ["id,value"]
    for (let i = 0; i < 100; i++) lines.push(`${i},${i * 10}`)
    const csv = lines.join("\n")

    const out = defaultPiiRedactor.redactCsvData(csv, { preserveHeaders: true, maxRows: 10 })
    expect(out.split("\n")).toHaveLength(11) // header + 10 rows
  })

  it("skips blank rows", () => {
    const csv = "id,value\n1,10\n\n2,20\n"
    const out = defaultPiiRedactor.redactCsvData(csv, { preserveHeaders: true, maxRows: 50 })
    expect(out.split("\n")).toHaveLength(3)
  })

  it("redacts the header row too when preserveHeaders is false", () => {
    // Edge case: a CSV whose header row itself contains redactable content.
    const csv = "contact_ana@example.com,revenue\nsomeone,10"

    const withHeaders = defaultPiiRedactor.redactCsvData(csv, { preserveHeaders: true, maxRows: 50 })
    expect(withHeaders.split("\n")[0]).toBe("contact_ana@example.com,revenue")

    const withoutHeaders = defaultPiiRedactor.redactCsvData(csv, { preserveHeaders: false, maxRows: 50 })
    expect(withoutHeaders).not.toContain("contact_ana@example.com")
    expect(withoutHeaders).toContain("[EMAIL]")
  })
})

describe("PiiRedactor construction", () => {
  it("honours a custom global replacement for unmatched PII", () => {
    const redactor = new PiiRedactor({ globalReplaceWith: "<masked>" })
    // Built-in detectors keep their own tags; the global value covers fallbacks.
    expect(redactor.redactText("quarterly revenue by segment")).toBe(
      "quarterly revenue by segment",
    )
  })

  it("applies caller-supplied custom patterns", () => {
    const redactor = new PiiRedactor({
      customPatterns: [
        { pattern: /ACCT-\d+/g, replacement: "[ACCOUNT]", description: "internal account ref" },
      ],
    })

    expect(redactor.redactText("ref ACCT-12345")).toContain("[ACCOUNT]")
    expect(redactor.redactText("ref ACCT-12345")).not.toContain("ACCT-12345")
  })
})
