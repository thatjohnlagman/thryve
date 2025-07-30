// Centralized input sanitization, prompt injection detection, validation, and rate limiting helpers.
// NOTE: In-memory rate limiting is per-instance only; for multi-instance deployments use a shared store (Redis, Upstash, etc.).

import { z } from "zod"
import type { NextRequest } from "next/server"

// ------------ Sanitization ------------

export function sanitizeString(value: unknown, { maxLength = 5000 }: { maxLength?: number } = {}): string {
  if (typeof value !== "string") return ""
  // Remove null bytes & control chars (except newline, tab) and trim.
  let cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()
  if (cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength)
  return cleaned
}

export function sanitizeObject<T extends Record<string, any>>(obj: T, stringFields: string[]): T {
  const clone: any = { ...obj }
  for (const key of stringFields) {
    if (key in clone) clone[key] = sanitizeString(clone[key])
  }
  return clone
}

// ------------ Prompt Injection Detection ------------

export interface InjectionDetectionResult {
  isInjection: boolean
  indicators: string[]
}

const injectionPatterns: RegExp[] = [
  /ignore (all|any|previous|earlier) (instructions|directives)/i,
  /disregard (the )?(above|previous)/i,
  /forget (the )?(previous|above) (instructions|prompt)/i,
  /you are now (?:an?|the)?/i,
  /begin (system|new) prompt/i,
  /override (?:the )?rules/i,
  /(jailbreak|do anything now)/i,
  /unfiltered response/i,
  /bypass (?:safety|guardrails|filters)/i,
  /act as (?:an?|the)?/i,
]

export function detectPromptInjection(text: string): InjectionDetectionResult {
  const indicators: string[] = []
  for (const pattern of injectionPatterns) {
    if (pattern.test(text)) indicators.push(pattern.source)
  }
  return { isInjection: indicators.length > 0, indicators }
}

// ------------ Content Validation (Zod) ------------

export function validateWithSchema<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const parsed = schema.safeParse(data)
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join("; ") }
}

// ------------ Rate Limiting ------------

interface RateLimitRecord {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitRecord>()

export interface RateLimitOptions {
  windowMs?: number // default 60s
  max?: number // default 60
  key?: string // optional override key
}

export function rateLimit(keyBase: string, { windowMs, max, key }: RateLimitOptions = {}) {
  const w = windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS || 60000)
  const m = max ?? Number(process.env.RATE_LIMIT_MAX || 60)
  const k = key ?? keyBase
  const now = Date.now()
  const record = rateLimitStore.get(k)
  if (record) {
    if (now > record.resetAt) {
      rateLimitStore.set(k, { count: 1, resetAt: now + w })
      return { limited: false, remaining: m - 1, resetIn: w }
    }
    record.count += 1
    if (record.count > m) return { limited: true, remaining: 0, resetIn: record.resetAt - now }
    return { limited: false, remaining: m - record.count, resetIn: record.resetAt - now }
  }
  rateLimitStore.set(k, { count: 1, resetAt: now + w })
  return { limited: false, remaining: m - 1, resetIn: w }
}

export function getClientIp(req: NextRequest): string {
  // Next.js sets request.ip (Node 18) when behind Vercel edge/network. Fallback to headers.
  return (
    (req as any).ip ||
    req.headers.get("x-forwarded-for")?.split(/,\s*/)[0] ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

// Convenience combined guard for typical text input (e.g., chat message, prompt)
export function guardTextInput({
  value,
  fieldName,
  maxLength = 4000,
  allowEmpty = false,
  detectInjection = true,
}: {
  value: unknown
  fieldName: string
  maxLength?: number
  allowEmpty?: boolean
  detectInjection?: boolean
}): { ok: true; value: string } | { ok: false; error: string; injection?: InjectionDetectionResult } {
  const sanitized = sanitizeString(value, { maxLength })
  if (!allowEmpty && !sanitized) return { ok: false, error: `${fieldName} is required` }
  if (detectInjection && sanitized) {
    const detection = detectPromptInjection(sanitized)
    if (detection.isInjection) return { ok: false, error: `Potential prompt injection detected in ${fieldName}`, injection: detection }
  }
  return { ok: true, value: sanitized }
}

// Apply sanitization recursively to object string fields (shallow list) & run injection detection.
export function sanitizeAndDetect<T extends Record<string, any>>(data: T, stringFields: string[]): { data: T; issues: Record<string, string[]> } {
  const issues: Record<string, string[]> = {}
  const out: any = { ...data }
  for (const f of stringFields) {
    if (f in out) {
      const original = out[f]
      const sanitized = sanitizeString(original)
      out[f] = sanitized
      if (sanitized !== original) {
        issues[f] = issues[f] || []
        issues[f].push("sanitized")
      }
      if (sanitized) {
        const detection = detectPromptInjection(sanitized)
        if (detection.isInjection) {
          issues[f] = issues[f] || []
          issues[f].push("injection:" + detection.indicators.join(","))
        }
      }
    }
  }
  return { data: out, issues }
}
