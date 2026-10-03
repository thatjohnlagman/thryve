// Centralized environment variable access & validation
// Never log secrets; only log presence when helpful for debugging.

interface GetEnvOptions {
  optional?: boolean
  default?: string
  maskInError?: boolean
}

export function getEnv(name: string, options: GetEnvOptions = {}): string {
  const raw = process.env[name]
  if (!raw || raw.trim() === "") {
    if (options.optional) {
      return options.default ?? ""
    }
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return raw
}

// Thryve Core Environment Getters
export const SUPABASE_URL = () => getEnv("NEXT_PUBLIC_SUPABASE_URL")
export const SUPABASE_ANON_KEY = () => getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
export const SUPABASE_SERVICE_ROLE_KEY = () => getEnv("SUPABASE_SERVICE_ROLE_KEY", { optional: true })
export const GEMINI_API_KEY = () => getEnv("GEMINI_API_KEY")
export const TAVILY_API_KEY = () => getEnv("TAVILY_API_KEY", { optional: true })
