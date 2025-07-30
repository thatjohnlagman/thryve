import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamCode } = await request.json()

    if (!teamCode?.trim()) {
      return NextResponse.json({ error: "Team code is required" }, { status: 400 })
    }

    // Find team by invite code
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("invite_code", teamCode.trim().toUpperCase())
      .single()

    if (teamError || !team) {
      return NextResponse.json({ error: "Invalid team code" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", team.id)
      .eq("user_id", user.id)
      .single()

    if (existingMember) {
      if (existingMember.is_active) {
        return NextResponse.json({ error: "You are already a member of this team" }, { status: 400 })
      } else {
        // Reactivate membership
        const { error: updateError } = await supabase
          .from("team_members")
          .update({ is_active: true, joined_at: new Date().toISOString() })
          .eq("id", existingMember.id)

        if (updateError) {
          return NextResponse.json({ error: "Failed to rejoin team" }, { status: 500 })
        }
      }
    } else {
      const { error: memberError } = await supabase.from("team_members").insert({
        team_id: team.id,
        user_id: user.id,
        role: "Team Member",
        avatar: user.email?.charAt(0).toUpperCase() || "U",
      })

      if (memberError) {
        console.error("Error adding team member:", memberError)
        return NextResponse.json({ error: "Failed to join team" }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: "Successfully joined team",
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        tag: team.tag,
        color: team.color,
      },
    })
  } catch (error) {
    console.error("Error in teams join:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
