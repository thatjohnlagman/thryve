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

    const { data: members, error } = await supabase
      .from("team_members")
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .eq("team_id", params.id)
      .eq("is_active", true)

    if (error) {
      console.error("Error fetching members:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    const formattedMembers =
      members?.map((member) => ({
        id: member.id,
        name: member.profiles
          ? `${member.profiles.first_name || ""} ${member.profiles.last_name || ""}`.trim() || "Unknown User"
          : "Unknown User",
        avatar: member.avatar || member.profiles?.first_name?.charAt(0).toUpperCase() || "U",
        role: member.role,
      })) || []

    return NextResponse.json({ members: formattedMembers })
  } catch (error) {
    console.error("Error in members GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
