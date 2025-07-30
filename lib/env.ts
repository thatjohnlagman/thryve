// Centralized environment variable access & validation
// Never log secrets; only log presence when helpful for debugging.

interface GetEnvOptions {
  optional?: boolean
  default?: string
  maskInError?: boolean // if true, masks value length in thrown error (when default provided and still missing)
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

// Convenience specific getters (extend as needed)
export const GITHUB_MODELS_API_KEY = () => getEnv("GITHUB_MODELS_API_KEY")
export const E2B_API_KEY = () => getEnv("E2B_API_KEY")
export const E2B_STREAMLIT_TEMPLATE_ID = () => getEnv("E2B_STREAMLIT_TEMPLATE_ID", { optional: true, default: "k4thrnhazkpgtothmqqt" })
export const SUPABASE_URL = () => getEnv("NEXT_PUBLIC_SUPABASE_URL")
export const SUPABASE_SERVICE_ROLE_KEY = () => getEnv("SUPABASE_SERVICE_ROLE_KEY")
