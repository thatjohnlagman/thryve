import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", params.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 })
    }

    const { data: projects, error } = await supabase
      .from("team_projects")
      .select("*")
      .eq("team_id", params.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching projects:", error)
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
    }

    return NextResponse.json({ projects: projects || [] })
  } catch (error) {
    console.error("Error in projects GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, issue, reason, category, priority, url } = await request.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", params.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 })
    }

    const { data: project, error } = await supabase
      .from("team_projects")
      .insert({
        team_id: params.id,
        title: title.trim(),
        issue: issue?.trim() || "",
        reason: reason?.trim() || "",
        category: category?.trim() || "General",
        priority: priority?.trim() || "Medium",
        url: url?.trim() || "",
        is_pinned: true,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating project:", error)
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error("Error in projects POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
