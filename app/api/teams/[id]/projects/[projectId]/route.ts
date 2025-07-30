import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function PATCH(request: NextRequest, { params }: { params: { id: string; projectId: string } }) {
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

    const { is_pinned } = await request.json()

    // If pinning a project, unpin all other projects first (only one pinned project allowed)
    if (is_pinned) {
      await supabase
        .from("team_projects")
        .update({ is_pinned: false })
        .eq("team_id", params.id)
        .neq("id", params.projectId)
    }

    const { data: project, error } = await supabase
      .from("team_projects")
      .update({ is_pinned })
      .eq("id", params.projectId)
      .eq("team_id", params.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating project pin status:", error)
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error("Error in project PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
