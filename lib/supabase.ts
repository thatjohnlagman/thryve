import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"

// Only validate in production or when actually needed
const isProduction = process.env.NODE_ENV === "production"
const hasValidConfig = supabaseUrl !== "https://placeholder.supabase.co" && supabaseAnonKey !== "placeholder-key"

if (isProduction && !hasValidConfig) {
  console.warn("Supabase environment variables not configured. Some features may not work.")
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
}

// Types for our database
export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  department: "product" | "engineering" | "design" | "marketing" | "sales" | null
  created_at: string
  updated_at: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  department: string
}

export interface LoginData {
  email: string
  password: string
}

export interface TrendDB {
  id: string
  title: string
  summary: string
  interpretation: string
  category: string
  impact: "High" | "Medium" | "Low"
  detailed_research?: any
  prototype_prompt?: string
  sources?: string[]
  is_heart: boolean
  user_id: string
  created_at: string
  updated_at: string
}

export interface NewsEventDB {
  id: string
  title: string
  summary: string
  source: string
  url: string
  image_url?: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface AIChatDB {
  id: string
  user_id: string
  title: string
  trend_context?: any
  created_at: string
  updated_at: string
}

export interface AIMessageDB {
  id: string
  chat_id: string
  user_id: string
  content: string
  message_type: "user" | "bot"
  response_metadata?: any
  created_at: string
}
