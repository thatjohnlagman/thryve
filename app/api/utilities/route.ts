import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Check optional authenticated user from header
    let userId: string | null = null
    try {
      const authHeader = request.headers.get("authorization")
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "")
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        if (user) userId = user.id
      }
    } catch {
      // Continue with null userId
    }

    let query = supabaseAdmin
      .from("utilities")
      .select("*")
      .order("created_at", { ascending: false })

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error("[API Utilities] Supabase query error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      utilities: data || [],
    })
  } catch (err: any) {
    console.error("[API Utilities] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing utility id" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { error } = await supabaseAdmin.from("utilities").delete().eq("id", id)

    if (error) {
      console.error("[API Utilities] Delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[API Utilities] Delete error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
