import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { RegisterData } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const body: RegisterData = await request.json()
    const { email, password, firstName, lastName, department } = body

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !department) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
    }

    // Validate department
    const validDepartments = ["product", "engineering", "design", "marketing", "sales"]
    if (!validDepartments.includes(department)) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 })
    }

    // Register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          department: department,
        },
      },
    })

    if (error) {
      console.error("Supabase registration error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json({ error: "Registration failed - no user created" }, { status: 400 })
    }

    // Check if email confirmation is required
    if (!data.session) {
      return NextResponse.json({
        message: "Registration successful! Please check your email to confirm your account.",
        user: {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: false,
        },
      })
    }

    // If session exists, user is automatically confirmed
    return NextResponse.json({
      message: "Registration successful!",
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: true,
      },
      session: data.session,
    })
  } catch (error) {
    console.error("Registration endpoint error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
