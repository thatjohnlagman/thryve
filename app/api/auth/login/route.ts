import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { LoginData } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const body: LoginData = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Attempt to sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Supabase login error:", error)

      // Handle specific error cases
      if (error.message.includes("Invalid login credentials")) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
      }

      if (error.message.includes("Email not confirmed")) {
        return NextResponse.json({ error: "Please confirm your email address before signing in" }, { status: 401 })
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ error: "Login failed - invalid response" }, { status: 400 })
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single()

    if (profileError) {
      console.error("Profile fetch error:", profileError)
      // Continue without profile data - it might not exist yet
    }

    return NextResponse.json({
      message: "Login successful!",
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: data.user.email_confirmed_at !== null,
        profile: profile || null,
      },
      session: data.session,
    })
  } catch (error) {
    console.error("Login endpoint error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
